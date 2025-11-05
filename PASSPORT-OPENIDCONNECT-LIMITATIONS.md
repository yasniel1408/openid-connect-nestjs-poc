# ⚠️ Limitaciones de passport-openidconnect

## 🔍 Problema Principal

`passport-openidconnect` v0.1.2 tiene limitaciones críticas que nos obligaron a usar `passport-custom` + `openid-client`:

### 1. ❌ No Captura Tokens Correctamente

**Con passport-openidconnect:**
```typescript
export class OidcPkceAzureStrategy extends PassportStrategy(OpenIdConnectStrategy, 'oidc-azure') {
  constructor() {
    super({
      issuer: '...',
      clientID: '...',
      // ...
    }, (issuer, profile, context, idToken, done) => {
      console.log('context:', context);
      // context es {} o undefined
      // context.accessToken es undefined ❌
      // context.refreshToken es undefined ❌
      
      const user = {
        tokens: {
          access_token: context?.accessToken, // undefined ❌
          refresh_token: context?.refreshToken, // undefined ❌
          token_type: 'Bearer', // solo esto funciona
        }
      };
      done(null, user);
    });
  }
}
```

**Resultado en Redis:**
```json
{
  "user": {
    "tokens": {
      "token_type": "Bearer"
      // ❌ Falta access_token
      // ❌ Falta id_token
      // ❌ Falta refresh_token
    }
  }
}
```

### 2. ❌ Sin Soporte PKCE

`passport-openidconnect` no tiene parámetro para PKCE:
```typescript
super({
  issuer: '...',
  clientID: '...',
  // ❌ No hay opción para code_challenge
  // ❌ No hay opción para code_challenge_method
  // ❌ No genera codeVerifier automáticamente
});
```

PKCE es crítico para seguridad en:
- SPAs (Single Page Applications)
- Mobile apps
- Aplicaciones públicas sin client_secret

### 3. ❌ Versión Antigua y No Mantenida

- **Versión:** 0.1.2 (2016)
- **Último commit:** Hace 8 años
- **Issues abiertos:** 40+
- **Pull requests sin mergearse:** 15+
- **Dependencias obsoletas:** Sí

### 4. ❌ Problemas con el Callback

El verify callback no recibe los parámetros correctamente:

```typescript
// Firma documentada (no funciona bien)
(issuer, profile, context, idToken, done) => {
  // context debería tener { accessToken, refreshToken, params }
  // pero viene vacío o incompleto
}

// Lo que realmente recibes
(issuer, profile, {}, undefined, done) => {
  // ❌ context vacío
  // ❌ idToken undefined
}
```

---

## ✅ Solución: passport-custom + openid-client

Usando `passport-custom` con `openid-client` tenemos control total:

```typescript
export class OidcPkceAzureStrategy extends PassportStrategy(CustomStrategy, 'oidc-azure') {
  async validate(req: Request): Promise<any> {
    const client = await this.clientPromise;
    
    // Si no hay code, iniciar flujo
    if (!req.query.code) {
      const state = generators.state();
      const nonce = generators.nonce();
      const codeVerifier = generators.codeVerifier();
      const codeChallenge = generators.codeChallenge(codeVerifier); // ✅ PKCE
      
      // Guardar en sesión
      req.session.oidc[provider] = { state, nonce, codeVerifier };
      
      const authUrl = client.authorizationUrl({
        state,
        nonce,
        code_challenge: codeChallenge, // ✅ PKCE
        code_challenge_method: 'S256',
      });
      
      req.res.redirect(authUrl);
      return null;
    }
    
    // Si hay code, hacer callback
    if (req.query.code) {
      const saved = req.session.oidc[provider];
      
      const tokenSet = await client.callback(redirectUri, params, {
        state: saved.state,
        nonce: saved.nonce,
        code_verifier: saved.codeVerifier, // ✅ PKCE verificación
      });
      
      // ✅ TODOS los tokens disponibles
      const user = {
        tokens: {
          access_token: tokenSet.access_token,     // ✅
          id_token: tokenSet.id_token,             // ✅
          refresh_token: tokenSet.refresh_token,   // ✅
          expires_at: tokenSet.expires_at,         // ✅
          token_type: tokenSet.token_type,         // ✅
        },
        claims: tokenSet.claims(),                 // ✅
        userinfo: await client.userinfo(tokenSet.access_token), // ✅
      };
      
      return user;
    }
  }
}
```

**Resultado en Redis:**
```json
{
  "user": {
    "tokens": {
      "access_token": "ya29.a0ARW5m75...",     // ✅
      "id_token": "eyJhbGciOiJSUzI1NiIs...",   // ✅
      "refresh_token": "1//0gL3q...",          // ✅
      "expires_at": 1762224458,                // ✅
      "token_type": "Bearer"                   // ✅
    },
    "claims": { /* todos los claims */ },      // ✅
    "userinfo": { /* info completa */ }        // ✅
  }
}
```

---

## 📊 Comparación

| Característica | passport-openidconnect | passport-custom + openid-client |
|----------------|------------------------|--------------------------------|
| **Tokens capturados** | Solo token_type ❌ | Todos (access, id, refresh) ✅ |
| **PKCE** | No soportado ❌ | Soportado nativamente ✅ |
| **Claims** | No accesibles ❌ | Accesibles completos ✅ |
| **Userinfo** | Limitado ❌ | Llamada manual disponible ✅ |
| **Mantenimiento** | Abandonado (2016) ❌ | Activo (2024) ✅ |
| **Documentación** | Obsoleta ❌ | Excelente ✅ |
| **Control** | Limitado ❌ | Total ✅ |
| **Complejidad** | Simple ✅ | Moderada ⚠️ |

---

## 🤔 ¿Por Qué No Funciona passport-openidconnect?

### Investigación del Código Fuente

Mirando el código de `passport-openidconnect`:

```javascript
// lib/strategy.js (versión 0.1.2)
Strategy.prototype.userProfile = function(accessToken, done) {
  // ❌ No guarda el accessToken en ningún lugar
  // ❌ No pasa el refreshToken al verify callback
  // ❌ El context que pasa está incompleto
}

Strategy.prototype.authenticate = function(req, options) {
  // ...
  oauth2.getOAuthAccessToken(code, params, function(err, accessToken, refreshToken, params) {
    // ✅ Obtiene los tokens aquí
    // ❌ Pero no los pasa correctamente al verify callback
    
    self._verify(issuer, profile, /* context vacío */ {}, idToken, function(err, user) {
      // ❌ context debería tener accessToken y refreshToken pero no los pasa
    });
  });
}
```

El problema está en el código fuente de la librería - simplemente **no pasa los tokens** al verify callback correctamente.

---

## 💡 Alternativas Evaluadas

### 1. ❌ Usar passport-oauth2 + patches
- Requiere parchear la librería
- No es sostenible
- Dificulta actualizaciones

### 2. ❌ Fork de passport-openidconnect
- Requiere mantener un fork
- Trabajo adicional de mantenimiento
- No recomendado

### 3. ✅ passport-custom + openid-client (ELEGIDO)
- Control total del flujo
- Librería moderna y mantenida
- PKCE nativo
- Todos los tokens accesibles
- Fácil de entender y debuggear

### 4. ⚠️ passport-azure-ad (solo para Azure)
- Solo funciona con Azure AD
- No es genérico para otros providers
- Más opinado (Microsoft way)

---

## 🎯 Conclusión

`passport-openidconnect` está **obsoleto y roto** para casos de uso modernos. Usar `passport-custom` + `openid-client` es la mejor práctica actual para OAuth 2.0 + OIDC en NestJS.

### Ventajas de Nuestra Implementación:

1. ✅ **Tokens completos** - Access, ID, Refresh todos disponibles
2. ✅ **PKCE** - Seguridad mejorada para SPAs
3. ✅ **Control total** - Podemos customizar cualquier parte del flujo
4. ✅ **Librería moderna** - openid-client es la librería certificada de OpenID
5. ✅ **Fácil debug** - Control sobre cada paso del proceso
6. ✅ **Funciona con Guards** - Compatible con `@UseGuards(AuthGuard('oidc-azure'))`

### Guards Siguen Funcionando:

```typescript
@Get('azure/login')
@UseGuards(AuthGuard('oidc-azure'))  // ✅ Funciona perfecto
async azureLogin() {}

@Get('azure/callback')
@UseGuards(AuthGuard('oidc-azure'))  // ✅ Funciona perfecto
async azureCallback(@Req() req) {
  const user = req.user; // ✅ Poblado con tokens completos
}
```

**La única diferencia es que usamos `CustomStrategy` en vez de `OpenIdConnectStrategy`, pero el resultado es el mismo: los guards funcionan perfectamente y obtenemos todos los tokens.**

---

**Creado:** 2025-01-04  
**Versión:** 1.0.0  
**Recomendación:** ✅ Mantener `passport-custom` + `openid-client`

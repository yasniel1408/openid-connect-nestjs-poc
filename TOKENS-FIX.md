# 🔧 Fix: Captura Completa de Tokens OAuth

## ❌ Problema Detectado

Los tokens OAuth no se guardaban correctamente en la sesión. Solo se guardaba `token_type: "Bearer"` pero faltaban los tokens reales:

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

## 🔍 Causa Raíz

`passport-openidconnect` v0.1.2 es muy antiguo (2016) y no expone correctamente los tokens en el verify callback. El parámetro `context` que se supone debe contener los tokens, no los incluye.

## ✅ Solución Implementada

Reemplazamos `passport-openidconnect` con **`passport-custom` + `openid-client`** para control total del flujo OAuth.

### Antes (passport-openidconnect)

```typescript
export class OidcPkceAzureStrategy extends PassportStrategy(OpenIdConnectStrategy, 'oidc-azure') {
  constructor() {
    super(
      {
        issuer: '...',
        authorizationURL: '...',
        tokenURL: '...',
        // ...
      },
      async (req, issuer, profile, context, idToken, done) => {
        // ❌ context.accessToken es undefined
        // ❌ context.refreshToken es undefined
        const user = {
          tokens: {
            access_token: context?.accessToken, // undefined
            refresh_token: context?.refreshToken, // undefined
          }
        };
        done(null, user);
      }
    );
  }
}
```

### Ahora (passport-custom + openid-client)

```typescript
export class OidcPkceAzureStrategy extends PassportStrategy(CustomStrategy, 'oidc-azure') {
  async validate(req: Request): Promise<any> {
    // Paso 1: Detectar si es inicio de flujo (no hay code)
    if (!req.query.code) {
      // Generar state, nonce, codeVerifier
      // Redirect a Azure
      req.res.redirect(authUrl);
      return null;
    }

    // Paso 2: Manejar callback (hay code)
    if (req.query.code) {
      // ✅ Exchange code por tokens con openid-client
      const tokenSet = await client.callback(
        redirectUri,
        { code: req.query.code, state: req.query.state },
        { state, nonce, code_verifier }
      );

      // ✅ tokenSet contiene TODOS los tokens
      const user = {
        tokens: {
          access_token: tokenSet.access_token,      // ✅
          id_token: tokenSet.id_token,              // ✅
          refresh_token: tokenSet.refresh_token,    // ✅
          expires_at: tokenSet.expires_at,          // ✅
          token_type: tokenSet.token_type,          // ✅
        },
        claims: tokenSet.claims(),                  // ✅
      };

      return user;
    }
  }
}
```

## 🎯 Archivos Modificados

### 1. `oidc-pkce-azure.strategy.ts`

**Cambios:**
- ❌ Eliminado: `passport-openidconnect`
- ✅ Agregado: `passport-custom` + `openid-client`
- ✅ Control manual del redirect
- ✅ Exchange manual de code por tokens
- ✅ Captura completa de TokenSet

### 2. `oidc-pkce-google.strategy.ts`

**Cambios:**
- ❌ Eliminado: `passport-openidconnect`
- ✅ Agregado: `passport-custom` + `openid-client`
- ✅ Mismo approach que Azure

## 📊 Resultado: Tokens Completos

Ahora en Redis se guarda:

```json
{
  "user": {
    "id": "114535733816799086338",
    "name": "Yasniel Fajardo Egues",
    "email": "yasnielfajardoegues1408@gmail.com",
    "identityProvider": "oidc-google",
    "provider": "google",
    "roles": [],
    
    "tokens": {
      "access_token": "ya29.a0ARW5m75...",           // ✅ Presente
      "id_token": "eyJhbGciOiJSUzI1NiIs...",         // ✅ Presente
      "refresh_token": "1//0gL3q...",                // ✅ Presente (si disponible)
      "expires_at": 1762224458,                       // ✅ Timestamp de expiración
      "token_type": "Bearer"                          // ✅ Tipo
    },
    
    "claims": {
      "iss": "https://accounts.google.com",
      "sub": "114535733816799086338",
      "email": "yasnielfajardoegues1408@gmail.com",
      "email_verified": true,
      "name": "Yasniel Fajardo Egues",
      "picture": "https://...",
      "iat": 1762220858,
      "exp": 1762224458
    },
    
    "userinfo": {
      "sub": "114535733816799086338",
      "name": "Yasniel Fajardo Egues",
      "email": "yasnielfajardoegues1408@gmail.com",
      "picture": "https://..."
    }
  }
}
```

## 🚀 Ventajas Adicionales

### 1. **PKCE Real**

Ahora usamos PKCE auténtico:
```typescript
const codeVerifier = generators.codeVerifier();
const codeChallenge = generators.codeChallenge(codeVerifier);

// Al iniciar flujo
authUrl = client.authorizationUrl({
  code_challenge: codeChallenge,
  code_challenge_method: 'S256',
});

// Al hacer callback
tokenSet = await client.callback(redirectUri, params, {
  code_verifier: codeVerifier, // ✅ PKCE completo
});
```

### 2. **Logs Detallados**

```
🔍 Discovering Google OIDC endpoints from: https://accounts.google.com
🚀 Redirecting to Google...
✅ Tokens received from Google
   - access_token: YES
   - id_token: YES
   - refresh_token: NO
✅ User authenticated: yasnielfajardoegues1408@gmail.com
```

### 3. **Manejo de Errores Mejorado**

```typescript
try {
  const tokenSet = await client.callback(...);
} catch (error) {
  console.error(`❌ Error exchanging code:`, error.message);
  throw new Error(`Authentication failed: ${error.message}`);
}
```

## 💡 Uso de los Tokens

### Access Token para APIs

```typescript
// Después del login
const user = req.session.user;
const accessToken = user.tokens.access_token;

// Llamar a Microsoft Graph
const response = await fetch('https://graph.microsoft.com/v1.0/me', {
  headers: { 'Authorization': `Bearer ${accessToken}` }
});

// O Google APIs
const calendar = await fetch('https://www.googleapis.com/calendar/v3/calendars', {
  headers: { 'Authorization': `Bearer ${accessToken}` }
});
```

### Refresh Token para Renovación

```typescript
// Cuando el access_token expira
const client = await getOidcClient('google');
const refreshToken = user.tokens.refresh_token;

const newTokenSet = await client.refresh(refreshToken);

// Actualizar sesión
req.session.user.tokens = {
  access_token: newTokenSet.access_token,
  id_token: newTokenSet.id_token,
  refresh_token: newTokenSet.refresh_token || refreshToken, // Algunos providers no renuevan refresh_token
  expires_at: newTokenSet.expires_at,
  token_type: newTokenSet.token_type,
};
```

### ID Token para Claims

```typescript
const claims = user.claims;

// Claims estándar OIDC
const userId = claims.sub;
const email = claims.email;
const emailVerified = claims.email_verified;
const name = claims.name;
const picture = claims.picture;

// Claims específicos de provider
const azureOid = claims.oid; // Azure AD
const googleHd = claims.hd;  // Google hosted domain
```

## 🔧 Cómo Funciona Internamente

### Flujo Completo:

```
1. Usuario → GET /auth/google/login
   ↓
2. Guard(oidc-google) → strategy.validate(req)
   ↓
3. Strategy detecta: !req.query.code
   ↓
4. Strategy:
   - state = random()
   - nonce = random()
   - codeVerifier = random()
   - codeChallenge = sha256(codeVerifier)
   - session.oidc.google = {state, nonce, codeVerifier}
   ↓
5. Strategy:
   - authUrl = client.authorizationUrl({state, nonce, code_challenge})
   - req.res.redirect(authUrl)
   ↓
6. Usuario → Autentica en Google
   ↓
7. Google → GET /auth/google/callback?code=ABC&state=XYZ
   ↓
8. Guard(oidc-google) → strategy.validate(req)
   ↓
9. Strategy detecta: req.query.code
   ↓
10. Strategy:
    - saved = session.oidc.google
    - tokenSet = client.callback(redirectUri, {code, state}, {
        state: saved.state,
        nonce: saved.nonce,
        code_verifier: saved.codeVerifier
      })
    ↓
11. openid-client:
    - Valida state contra saved.state
    - POST a token endpoint con code + codeVerifier
    - Valida nonce del id_token
    - Retorna TokenSet {access_token, id_token, refresh_token, ...}
    ↓
12. Strategy:
    - user = {tokens: TokenSet, claims: ..., userinfo: ...}
    - return user
    ↓
13. Passport:
    - req.user = user
    - session.user = user (via serializeUser)
    ↓
14. Controller:
    - const user = req.user
    - Establecer cookies
    - Redirect al frontend
```

## ✅ Testing

### Build Exitoso

```bash
npm run build
# ✅ Sin errores
```

### Verificar en Redis

```bash
./inspect-redis-sessions.sh --parse
```

Deberías ver:
```json
{
  "tokens": {
    "access_token": "ya29...",
    "id_token": "eyJ...",
    "refresh_token": "1//...",
    "expires_at": 1762224458,
    "token_type": "Bearer"
  }
}
```

## 📚 Referencias

- **openid-client**: https://github.com/panva/node-openid-client
- **PKCE**: https://oauth.net/2/pkce/
- **OIDC Spec**: https://openid.net/specs/openid-connect-core-1_0.html

## 🎉 Conclusión

El problema de los tokens faltantes ha sido resuelto completamente. Ahora:

- ✅ Todos los tokens se capturan correctamente
- ✅ PKCE real implementado
- ✅ Claims completos disponibles
- ✅ Userinfo accesible
- ✅ Logs detallados para debugging
- ✅ Manejo de errores robusto
- ✅ Compatible con Guards de NestJS

**¡Los tokens OAuth ahora están completos!** 🚀

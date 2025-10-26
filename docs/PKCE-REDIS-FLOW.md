# 🔐 Cómo Funciona PKCE + Sesiones + Redis en tu Backend

## 🎯 Resumen Rápido

**Lo que se guarda en Redis:**
```
session:abc123def456... = {
  user: { id, name, email, tokens, claims, etc },
  oidc: { azure: { state, nonce, codeVerifier } }
}
```

**Lo que se guarda en Cookies del navegador:**
```
axis-session=abc123def456...  (httpOnly, firmada, solo el ID de sesión)
logged=true
user_info=base64(id, name, email, roles)
axis-strategy=local-username|oidc-azure|etc
```

**Relación:**
- La cookie `axis-session` contiene el **ID de sesión** (ej: `abc123def456...`)
- Redis usa ese ID para buscar la sesión completa con el prefijo `session:`
- Los **tokens JWT** (access_token, id_token, refresh_token) están **dentro de la sesión en Redis**, NO en la cookie

---

## 🔄 Flujo Completo: PKCE con OIDC (Azure/Google)

### **Paso 1: Usuario hace click en "Login con Azure"**

Frontend → `GET http://localhost:3001/auth/azure/login`

**Backend hace:**
```typescript
// En oidc.service.ts - getAuthUrl()
const state = generators.state();          // Token aleatorio anti-CSRF
const nonce = generators.nonce();          // Token anti-replay
const codeVerifier = generators.codeVerifier();  // Secret PKCE
const codeChallenge = generators.codeChallenge(codeVerifier);

// 🔴 GUARDA EN SESIÓN (que va a Redis)
sess.oidc = {
  azure: { state, nonce, codeVerifier }
}

// Redirige a Azure con:
// ?code_challenge=xyz&code_challenge_method=S256&state=abc...
```

**Lo que se guarda en Redis en este punto:**
```json
{
  "cookie": { "originalMaxAge": 3600000, ... },
  "oidc": {
    "azure": {
      "state": "random-state-token",
      "nonce": "random-nonce-token",
      "codeVerifier": "secret-pkce-verifier"  // 🔑 El secret PKCE
    }
  }
}
```

**Cookie que recibe el navegador:**
```
axis-session=sid123...  (solo el ID, firmada con SESSION_SECRET)
```

---

### **Paso 2: Usuario hace login en Azure y vuelve al callback**

Azure redirige → `GET http://localhost:3001/auth/azure/callback?code=AUTH_CODE&state=abc...`

**Backend hace:**
```typescript
// En oidc.service.ts - handleCallback()

// 1. 🔍 RECUPERA LA SESIÓN DE REDIS usando la cookie
const saved = sess.oidc?.azure;  // { state, nonce, codeVerifier }

// 2. 🔐 Valida state (anti-CSRF)
// 3. 📞 Canjea el code por tokens usando el codeVerifier (PKCE)
const tokenSet = await client.callback(redirectUri, params, {
  state: saved.state,
  nonce: saved.nonce,
  code_verifier: saved.codeVerifier  // 🔑 Envía el secret a Azure
});

// 4. 🎫 GUARDA TODO EN LA SESIÓN (que va a Redis)
sess.user = {
  id: '...',
  name: 'Juan Pérez',
  email: 'juan@example.com',
  provider: 'azure',
  identityProvider: 'https://login.microsoftonline.com/...',
  roles: ['user'],
  claims: { ... },  // Claims del id_token
  tokens: {
    access_token: 'eyJhbGc...',     // 🔑 JWT de Azure
    id_token: 'eyJhbGc...',          // 🔑 JWT de Azure
    refresh_token: 'xyz...',         // 🔑 Para renovar
    expires_at: 1234567890,
    token_type: 'Bearer'
  }
};

// 5. 🧹 Limpia los datos PKCE temporales
delete sess.oidc.azure;
```

**Lo que se guarda en Redis después del callback:**
```json
{
  "cookie": { "originalMaxAge": 3600000, ... },
  "user": {
    "id": "abc-123",
    "name": "Juan Pérez",
    "email": "juan@example.com",
    "provider": "azure",
    "identityProvider": "https://login.microsoftonline.com/tenant/v2.0",
    "roles": ["user"],
    "claims": {
      "aud": "client-id",
      "iss": "https://login.microsoftonline.com/...",
      "sub": "abc-123",
      "name": "Juan Pérez",
      "email": "juan@example.com"
    },
    "tokens": {
      "access_token": "eyJhbGciOiJSUzI1NiIs...",  // 🔑 JWT completo
      "id_token": "eyJhbGciOiJSUzI1NiIs...",      // 🔑 JWT completo
      "refresh_token": "0.AXEA...",                // 🔑 Para renovar
      "expires_at": 1729777890,
      "token_type": "Bearer"
    }
  }
}
```

**Cookies adicionales que se envían al navegador:**
```
axis-session=sid123...              (httpOnly, el ID de sesión)
logged=true                         (para que el frontend sepa)
user_info=eyJpZCI6ImFiYy0xMj...    (base64 de {id, name, email, roles})
axis-strategy=oidc-azure            (qué estrategia usó)
```

---

### **Paso 3: Usuario hace request a /products**

Frontend → `GET http://localhost:3001/products` con cookie `axis-session=sid123...`

**Backend hace:**
```typescript
// 1. Express-session lee la cookie axis-session=sid123...
// 2. Busca en Redis: session:sid123...
// 3. Deserializa el objeto completo con user y tokens
// 4. Lo pone en req.session.user

// En el guard o middleware:
const user = req.session?.user;
// user contiene TODOS los tokens JWT originales de Azure

// Si necesitas el access_token:
const accessToken = user.tokens.access_token;
// Puedes usarlo para llamar a Microsoft Graph, etc.
```

---

## 🔑 Puntos Clave

### 1. **PKCE (Proof Key for Code Exchange)**
- `code_verifier`: Secret aleatorio que se guarda en la sesión (Redis)
- `code_challenge`: Hash SHA256 del code_verifier que se envía a Azure
- Cuando Azure devuelve el `code`, el backend envía el `code_verifier` para probar que es el mismo cliente
- **Sin Redis, perderías el code_verifier al reiniciar y no podrías completar el callback**

### 2. **¿Qué se guarda dónde?**

| Dato | Cookie (navegador) | Redis |
|------|-------------------|-------|
| Session ID | ✅ `axis-session` | Clave: `session:{ID}` |
| JWT tokens | ❌ | ✅ Dentro de `user.tokens` |
| User info | ✅ Base64 (sin tokens) | ✅ Objeto completo |
| PKCE secrets | ❌ | ✅ Temporalmente en `oidc` |
| State/Nonce | ❌ | ✅ Durante el flujo OIDC |

### 3. **Seguridad**
- Los **JWT tokens nunca van a la cookie del navegador** (están en Redis)
- La cookie solo tiene el **ID de sesión firmado** con `SESSION_SECRET`
- La cookie es `httpOnly` = JavaScript del navegador NO puede leerla
- Si alguien roba la cookie, solo tiene el ID, pero necesita el `SESSION_SECRET` para falsificarla

### 4. **¿Por qué necesitas Redis?**

**Sin Redis (memoria):**
```
Usuario hace login → Sesión en RAM del servidor
Usuario reinicia backend → 💥 Se pierde la RAM
Cookie sigue en navegador → No encuentra sesión → 401 Unauthorized
```

**Con Redis:**
```
Usuario hace login → Sesión en Redis
Usuario reinicia backend → Redis sigue corriendo
Cookie sigue en navegador → Redis encuentra sesión → ✅ Sigue autenticado
```

---

## 🔄 Flujo Simplificado: Local Username/Email

Es más simple porque no hay OIDC ni PKCE:

```typescript
// POST /auth/local/username con {username, password}

// 1. Passport valida credenciales (local-username.strategy.ts)
const user = { id, name, email, roles, identityProvider: 'local-username' };

// 2. Passport guarda en sesión automáticamente
req.session.user = user;

// 3. Se genera un JWT propio (con GetTokenByUserService)
const token = jwt.sign(user, CCE_JWT_SECRET);

// 4. Se guarda en cookies adicionales
res.cookie('axis-session', sessionId);  // El ID de sesión
res.cookie('logged', 'true');
res.cookie('user_info', base64(user));
res.cookie('axis-strategy', 'local-username');
```

**En Redis:**
```json
{
  "user": {
    "id": "u1",
    "name": "Axis User",
    "email": "axis@example.com",
    "roles": ["user"],
    "identityProvider": "local-username"
  }
}
```

---

## 🧪 Cómo Verificar Qué Hay en Redis

### Ver todas las sesiones:
```bash
docker exec -it openid-redis redis-cli KEYS "session:*"
```

### Ver el contenido de una sesión:
```bash
# Primero obtén el session ID
docker exec -it openid-redis redis-cli KEYS "session:*"
# Output: 1) "session:abc123def456..."

# Luego lee su contenido (está serializado)
docker exec -it openid-redis redis-cli GET "session:abc123def456..."
```

Verás algo como (serializado por express-session):
```
{"cookie":{"originalMaxAge":3600000,...},"user":{...tokens...}}
```

---

## 🎯 Respuesta Directa a tu Pregunta

> "¿Redis ya guarda la relación entre cookie y JWT?"

**Sí, exactamente:**

1. **Cookie** `axis-session` = `abc123` (solo el ID)
2. **Redis** = `session:abc123` → `{ user: { tokens: { access_token: 'JWT...', id_token: 'JWT...' } } }`

La cookie es la "llave" que el navegador envía, Redis tiene el "contenido" completo con los tokens JWT.

**¿Cómo se relacionan?**
- Express-session lee la cookie → extrae el session ID → busca en Redis con prefijo `session:` → deserializa el objeto
- Cuando haces `req.session.user.tokens.access_token`, está leyendo de Redis en tiempo real

**¿Qué pasa cuando reinicias?**
- Antes (memoria): Cookie existe, pero la RAM se borró → 404 Not Found
- Ahora (Redis): Cookie existe, Redis sigue con los datos → ✅ Funciona

---

## 📚 Para Profundizar

- `src/main.ts` → Configuración de RedisStore
- `src/auth/services/oidc.service.ts` → Manejo de PKCE y tokens
- `src/auth/services/cookie.service.ts` → Cookies públicas (logged, user_info)
- `src/auth/auth.controller.ts` → Endpoints que guardan en sesión

¿Alguna parte específica del flujo que quieras que te explique más a fondo? 🚀

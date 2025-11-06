# 📡 API Endpoints

## 🎯 Resumen de Endpoints

### Autenticación Local

#### Session-based Login (con redirect)
```http
POST /auth/local/login
Content-Type: application/json

{
  "username": "axis",
  "password": "axis123"
}
```
**Respuesta:** Redirect a frontend con cookies establecidas

**Estrategia:** `local-session` (passport-local)

---

#### JWT Direct Login (respuesta JSON)
```http
POST /auth/jwt/login
Content-Type: application/json

{
  "username": "axis",
  "password": "axis123"
}
```
**Respuesta:**
```json
{
  "success": true,
  "accessToken": "eyJhbGci...",
  "tokenType": "Bearer",
  "expiresIn": 3600,
  "user": {
    "id": "u1",
    "email": "axis@example.com",
    "name": "Axis User",
    "roles": ["user"]
  }
}
```

**Estrategia:** Ninguna (validación manual), retorna JWT

---

#### JWT Refresh
```http
POST /auth/jwt/refresh
Authorization: Bearer <jwt_token>
Cookie: axis-session=<jwt_token>
```
**Respuesta:**
```json
{
  "success": true,
  "message": "JWT renovado exitosamente",
  "accessToken": "eyJhbGci...",
  "tokenType": "Bearer",
  "expiresIn": 3600
}
```

**Estrategia:** `local-jwt` (passport-jwt)

---

### Autenticación OAuth/OIDC

#### Azure AD - Iniciar Login
```http
GET /auth/azure/login
```
**Respuesta:** Redirect a Azure AD login page

**Estrategia:** `oidc-azure` (passport-custom + openid-client)

---

#### Azure AD - Callback
```http
GET /auth/azure/callback?code=...&state=...
```
**Respuesta:** Redirect a frontend con cookies establecidas

**Estrategia:** `oidc-azure` (passport-custom + openid-client)

**Tokens capturados:**
- `access_token` - Para llamar Microsoft Graph API
- `id_token` - Claims del usuario
- `refresh_token` - Para renovar tokens
- `claims` - Claims completos del JWT
- `userinfo` - Info del usuario desde userinfo endpoint

---

#### Google - Iniciar Login
```http
GET /auth/google/login
```
**Respuesta:** Redirect a Google login page

**Estrategia:** `oidc-google` (passport-custom + openid-client)

---

#### Google - Callback
```http
GET /auth/google/callback?code=...&state=...
```
**Respuesta:** Redirect a frontend con cookies establecidas

**Estrategia:** `oidc-google` (passport-custom + openid-client)

---

### Endpoints Comunes

#### Obtener Usuario Actual
```http
GET /auth/me
Cookie: axis-session=<jwt_token>
```
**Respuesta:**
```json
{
  "id": "u1",
  "name": "Axis User",
  "email": "axis@example.com",
  "identityProvider": "local-session",
  "roles": ["user"],
  "tokens": {
    "access_token": "...",
    "id_token": "...",
    "refresh_token": "..."
  }
}
```

**Estrategia:** Ninguna (lee de sesión o req.user)

---

#### Logout
```http
GET /auth/logout
```
**Respuesta:** Redirect a frontend con sesión destruida

**Acciones:**
1. Destruye sesión en Redis
2. Limpia cookies del navegador
3. Redirige al frontend

---

#### Client Credentials Token (Machine-to-Machine)
```http
POST /auth/system/cc/token
Content-Type: application/json

{
  "scope": "https://graph.microsoft.com/.default"
}
```
**Respuesta:**
```json
{
  "access_token": "eyJ0eXAi...",
  "token_type": "Bearer",
  "expires_in": 3599,
  "ext_expires_in": 3599,
  "scope": "https://graph.microsoft.com/.default"
}
```

**Estrategia:** Azure Identity SDK (ClientSecretCredential)

**Uso:** Para que el backend llame a APIs de Microsoft sin usuario

---

### Recursos Protegidos

#### Listar Productos
```http
GET /products
Authorization: Bearer <jwt_token>
Cookie: axis-session=<jwt_token>
```
**Respuesta:**
```json
{
  "products": [
    { "id": 1, "name": "Product 1", "price": 100 },
    { "id": 2, "name": "Product 2", "price": 200 }
  ],
  "user": {
    "id": "u1",
    "name": "Axis User",
    "email": "axis@example.com"
  }
}
```

**Estrategia:** `AnyAuthGuard` (acepta cualquier método de autenticación)

---

## 🔐 Estrategias de Passport

### 1. `local-session`
- **Tipo:** passport-local
- **Uso:** Login tradicional con username/password
- **Endpoint:** `POST /auth/local/login`
- **Output:** Redirect con cookies

### 2. `local-jwt`
- **Tipo:** passport-jwt
- **Uso:** Validar JWT en requests
- **Endpoint:** `POST /auth/jwt/refresh`, `GET /products`
- **Output:** Usuario extraído del JWT

### 3. `oidc-azure`
- **Tipo:** passport-custom + openid-client
- **Uso:** OAuth 2.0 + OIDC con Azure AD
- **Endpoints:** `GET /auth/azure/login`, `GET /auth/azure/callback`
- **Output:** Usuario con tokens OAuth completos

### 4. `oidc-google`
- **Tipo:** passport-custom + openid-client
- **Uso:** OAuth 2.0 + OIDC con Google
- **Endpoints:** `GET /auth/google/login`, `GET /auth/google/callback`
- **Output:** Usuario con tokens OAuth completos

### 5. `azure-cce-jwt`
- **Tipo:** passport-jwt + jwks-rsa
- **Uso:** Validar tokens de Azure AD (Client Credentials)
- **Endpoint:** Headers de APIs protegidas
- **Output:** Claims del token

### 6. `azure-cce-jwt-v2`
- **Tipo:** passport-azure-ad (BearerStrategy)
- **Uso:** Validar tokens de Azure AD (oficial de Microsoft)
- **Endpoint:** Headers de APIs protegidas
- **Output:** Claims del token

---

## 🍪 Cookies Establecidas

### `axis-session`
- **Tipo:** HttpOnly, Secure (prod), SameSite=lax
- **Contenido:** JWT firmado con SESSION_SECRET
- **Duración:** 1 hora (configurable)
- **Uso:** Autenticación en requests subsiguientes

### `logged`
- **Tipo:** Pública (JavaScript accesible)
- **Contenido:** `"true"` si está autenticado
- **Uso:** Frontend detecta si hay sesión activa

### `user_info`
- **Tipo:** Pública (JavaScript accesible)
- **Contenido:** Base64 de `{ id, name, email, roles, provider }`
- **Uso:** Frontend muestra info del usuario sin llamar API

---

## 📋 Variables de Entorno Requeridas

### General
```env
PORT=3001
CORS_ORIGIN=http://localhost:3000
NODE_ENV=development
```

### JWT
```env
SESSION_SECRET=your-secret-key-here
JWT_ISSUER=axis-backend
JWT_AUDIENCE=axis-api
```

### Sesión
```env
SESSION_COOKIE_NAME=axis-session
SESSION_COOKIE_SECURE=false
SESSION_COOKIE_MAX_AGE=3600000
```

### Redis
```env
REDIS_URL=redis://localhost:6379
```

### Providers OIDC
```env
OIDC_PROVIDERS=azure,google
```

### Azure AD
```env
OIDC_ISSUER_azure=https://login.microsoftonline.com/tenant/v2.0
OIDC_CLIENT_ID_azure=your-client-id
OIDC_CLIENT_SECRET_azure=your-secret
OIDC_REDIRECT_URI_azure=http://localhost:3001/auth/azure/callback
OIDC_SCOPE_azure=openid profile email
OIDC_AUDIENCE_azure=api://your-client-id
OIDC_CLOCK_TOLERANCE_azure=60
OIDC_RELAX_AUDIENCE_azure=true
```

### Google
```env
OIDC_ISSUER_google=https://accounts.google.com
OIDC_CLIENT_ID_google=your-client-id
OIDC_CLIENT_SECRET_google=your-secret
OIDC_REDIRECT_URI_google=http://localhost:3001/auth/google/callback
OIDC_SCOPE_google=openid email profile
```

---

## 🚀 Ejemplos de Uso

### Frontend - Login Local (Session)
```typescript
const response = await fetch('http://localhost:3001/auth/local/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  credentials: 'include',
  body: JSON.stringify({ username: 'axis', password: 'axis123' }),
  redirect: 'manual',
});

if (response.type === 'opaqueredirect' || response.status === 0) {
  window.location.href = '/';
}
```

### Frontend - Login JWT (API-style)
```typescript
const response = await fetch('http://localhost:3001/auth/jwt/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  credentials: 'include',
  body: JSON.stringify({ username: 'axis', password: 'axis123' }),
});

const data = await response.json();
localStorage.setItem('jwt_token', data.accessToken);
```

### Frontend - Login con Azure/Google
```typescript
// Simple redirect
window.location.href = 'http://localhost:3001/auth/azure/login';
// o
window.location.href = 'http://localhost:3001/auth/google/login';
```

### Backend - Llamar Microsoft Graph con Access Token
```typescript
const user = req.session.user;
const accessToken = user.tokens.access_token;

const profile = await fetch('https://graph.microsoft.com/v1.0/me', {
  headers: { 'Authorization': `Bearer ${accessToken}` }
});
```

### Backend - Obtener Token Client Credentials
```typescript
const response = await fetch('http://localhost:3001/auth/system/cc/token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ 
    scope: 'https://graph.microsoft.com/.default' 
  }),
});

const { access_token } = await response.json();

// Usar el token para llamar APIs
const result = await fetch('https://graph.microsoft.com/v1.0/users', {
  headers: { 'Authorization': `Bearer ${access_token}` }
});
```

---

## ✅ Resumen de Cambios

### Endpoints Renombrados

| Antes | Ahora |
|-------|-------|
| `POST /auth/local/username` | `POST /auth/local/login` |
| N/A | `POST /auth/jwt/login` (ya existía) |

### Estrategias Renombradas

| Antes | Ahora |
|-------|-------|
| `local-username` | `local-session` |
| `LocalUsernameStrategy` | `LocalSessionStrategy` |

### Archivos Renombrados

| Antes | Ahora |
|-------|-------|
| `local-username.strategy.ts` | `local-session.strategy.ts` |

---

**Creado:** 2025-01-04  
**Versión:** 1.0.0  
**Estado:** ✅ Todos los endpoints funcionando

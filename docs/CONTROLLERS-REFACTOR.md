# 📂 Nueva Estructura de Controllers - Guía

## ✅ Refactorización Completada

El `AuthController` monolítico ha sido separado en **4 controllers especializados**, cada uno con su responsabilidad específica.

## 📁 Estructura de Archivos

```
src/auth/
├── controllers/
│   ├── index.ts                      # Exporta todos los controllers
│   ├── local-auth.controller.ts      # ⭐ Autenticación local (username/password)
│   ├── oidc-auth.controller.ts       # ⭐ OAuth 2.0 + OIDC (Azure, Google)
│   ├── jwt-auth.controller.ts        # ⭐ Operaciones JWT (validar, renovar)
│   └── common-auth.controller.ts     # ⭐ Endpoints comunes (me, logout, etc.)
├── strategies/
│   ├── local-username.strategy.ts
│   ├── local-jwt.strategy.ts
│   ├── oidc-pkce-azure.strategy.ts
│   └── ...
├── services/
│   └── ...
├── auth.module.ts                    # ✅ Actualizado con nuevos controllers
├── auth.controller.OLD.ts            # 📦 Respaldo del controller original
└── auth.module.OLD.ts                # 📦 Respaldo del módulo original
```

---

## 🎯 Controllers Separados

### 1. LocalAuthController
**Responsabilidad:** Autenticación local con credenciales

**Ruta base:** `/auth/local`

**Endpoints:**
```typescript
POST /auth/local/username    // Login con username/password
```

**Strategy:** `LocalUsernameStrategy` (passport-local)

**Qué hace:**
- Valida credenciales contra DB/array
- Genera JWT
- Crea sesión en Redis
- Establece cookies
- Redirige al frontend

**Ejemplo de uso:**
```bash
curl -X POST http://localhost:3001/auth/local/username \
  -H "Content-Type: application/json" \
  -d '{"username":"axis","password":"axis123"}'
```

---

### 2. OidcAuthController
**Responsabilidad:** OAuth 2.0 + OpenID Connect

**Ruta base:** `/auth`

**Endpoints:**
```typescript
GET /auth/azure/login       // Iniciar flujo OAuth con Azure
GET /auth/azure/callback    // Callback de Azure
GET /auth/google/login      // Iniciar flujo OAuth con Google
GET /auth/google/callback   // Callback de Google
```

**Strategies:** `OidcPkceAzureStrategy`, `OidcPkceGoogleStrategy`

**Qué hace:**
- Implementa flujo PKCE (OAuth 2.0 con seguridad mejorada)
- Maneja redirects a providers externos
- Procesa callbacks con authorization code
- Canjea code por tokens (access_token, id_token, refresh_token)
- Guarda tokens en sesión Redis

**Ejemplo de uso:**
```bash
# En navegador, visita:
http://localhost:3001/auth/azure/login
```

---

### 3. JwtAuthController
**Responsabilidad:** Operaciones con JWT

**Ruta base:** `/auth/jwt`

**Endpoints:**
```typescript
POST /auth/jwt/validate     // Validar JWT existente
POST /auth/jwt/refresh      // Renovar JWT (token rotation)
```

**Strategy:** `LocalJwtStrategy` (passport-jwt)

**Qué hace:**
- Valida JWT existentes (signature, expiration, issuer, audience)
- Genera nuevos JWT para token rotation
- Implementa sliding sessions
- NO consulta DB (stateless)

**Ejemplo de uso:**
```bash
# Validar
curl -X POST http://localhost:3001/auth/jwt/validate \
  -b "axis-session=JWT_TOKEN"

# Renovar
curl -X POST http://localhost:3001/auth/jwt/refresh \
  -b "axis-session=JWT_TOKEN"
```

---

### 4. CommonAuthController
**Responsabilidad:** Endpoints comunes de autenticación

**Ruta base:** `/auth`

**Endpoints:**
```typescript
GET  /auth/me                // Info del usuario autenticado
GET  /auth/logout            // Cerrar sesión
POST /auth/system/cc/token   // Client Credentials (OAuth 2.0)
```

**Qué hace:**
- `/me`: Retorna usuario de sesión actual
- `/logout`: Destruye sesión + limpia cookies + logout en provider OIDC
- `/system/cc/token`: Token para machine-to-machine auth

**Ejemplo de uso:**
```bash
# Obtener info del usuario
curl http://localhost:3001/auth/me -b cookies.txt

# Logout
curl http://localhost:3001/auth/logout -b cookies.txt

# Client Credentials
curl -X POST http://localhost:3001/auth/system/cc/token \
  -H "Content-Type: application/json" \
  -d '{"scope":"https://graph.microsoft.com/.default"}'
```

---

## 🔄 Migración de Rutas

### Rutas que NO cambiaron:
```
✅ GET  /auth/azure/login       (OidcAuthController)
✅ GET  /auth/azure/callback    (OidcAuthController)
✅ GET  /auth/google/login      (OidcAuthController)
✅ GET  /auth/google/callback   (OidcAuthController)
✅ GET  /auth/me                (CommonAuthController)
✅ GET  /auth/logout            (CommonAuthController)
✅ POST /auth/system/cc/token   (CommonAuthController)
```

### Rutas que cambiaron ligeramente:
```
❌ POST /auth/local/username        (antes)
✅ POST /auth/local/username        (ahora - LocalAuthController)
   ↑ Misma ruta, diferente controller

❌ POST /auth/local/jwt/validate    (antes)
✅ POST /auth/jwt/validate          (ahora - JwtAuthController)
   ↑ Cambió de /local/jwt a /jwt

❌ POST /auth/local/jwt/refresh     (antes)
✅ POST /auth/jwt/refresh           (ahora - JwtAuthController)
   ↑ Cambió de /local/jwt a /jwt
```

---

## 📊 Tabla de Mapeo

| Controller Antiguo | Método | Nueva Ubicación | Controller Nuevo |
|-------------------|--------|-----------------|------------------|
| AuthController | `POST /auth/local/username` | `POST /auth/local/username` | LocalAuthController |
| AuthController | `POST /auth/local/jwt/validate` | `POST /auth/jwt/validate` | JwtAuthController |
| AuthController | `POST /auth/local/jwt/refresh` | `POST /auth/jwt/refresh` | JwtAuthController |
| AuthController | `GET /auth/azure/login` | `GET /auth/azure/login` | OidcAuthController |
| AuthController | `GET /auth/azure/callback` | `GET /auth/azure/callback` | OidcAuthController |
| AuthController | `GET /auth/google/login` | `GET /auth/google/login` | OidcAuthController |
| AuthController | `GET /auth/google/callback` | `GET /auth/google/callback` | OidcAuthController |
| AuthController | `GET /auth/me` | `GET /auth/me` | CommonAuthController |
| AuthController | `GET /auth/logout` | `GET /auth/logout` | CommonAuthController |
| AuthController | `POST /auth/system/cc/token` | `POST /auth/system/cc/token` | CommonAuthController |

---

## 🔧 Cambios Necesarios en el Frontend

### Si usabas `/auth/local/jwt/*`:

**❌ Antes:**
```typescript
await fetch('/auth/local/jwt/validate', ...)
await fetch('/auth/local/jwt/refresh', ...)
```

**✅ Ahora:**
```typescript
await fetch('/auth/jwt/validate', ...)
await fetch('/auth/jwt/refresh', ...)
```

### Todo lo demás sigue igual:
```typescript
// ✅ Sin cambios
await fetch('/auth/local/username', ...)
await fetch('/auth/azure/login', ...)
await fetch('/auth/me', ...)
await fetch('/auth/logout', ...)
```

---

## 💻 Ejemplo de Actualización en Frontend

```typescript
// utils/auth.ts

// ❌ ANTES
export async function validateJwt() {
  return fetch('/auth/local/jwt/validate', {
    method: 'POST',
    credentials: 'include'
  });
}

export async function refreshJwt() {
  return fetch('/auth/local/jwt/refresh', {
    method: 'POST',
    credentials: 'include'
  });
}

// ✅ AHORA
export async function validateJwt() {
  return fetch('/auth/jwt/validate', {
    method: 'POST',
    credentials: 'include'
  });
}

export async function refreshJwt() {
  return fetch('/auth/jwt/refresh', {
    method: 'POST',
    credentials: 'include'
  });
}
```

---

## 🎯 Ventajas de la Nueva Estructura

### 1. **Separación de Responsabilidades**
- Cada controller tiene un propósito claro
- Más fácil de mantener y testear
- Código más organizado

### 2. **Escalabilidad**
- Fácil agregar nuevos providers OIDC
- Fácil agregar nuevos métodos de auth local
- Fácil extender operaciones JWT

### 3. **Documentación Clara**
- Cada controller está bien documentado
- Fácil entender qué hace cada endpoint
- Comentarios explican el flujo completo

### 4. **Testing Más Fácil**
- Puedes testear cada controller independientemente
- Mocks más simples
- Tests más enfocados

### 5. **Colaboración en Equipo**
- Diferentes desarrolladores pueden trabajar en diferentes controllers
- Menos conflictos de merge
- Código más modular

---

## 📚 Estructura del Módulo Actualizado

```typescript
// auth.module.ts
@Module({
  controllers: [
    LocalAuthController,      // ⭐ Local auth
    OidcAuthController,       // ⭐ OAuth/OIDC
    JwtAuthController,        // ⭐ JWT operations
    CommonAuthController,     // ⭐ Common endpoints
  ],
  providers: [
    // Services
    DiscoveryService,
    OidcService,
    CceTokenService,
    GetTokenByUserService,
    CookieService,
    AuthConfigService,
    // Strategies
    LocalUsernameStrategy,
    LocalJwtStrategy,
    OidcPkceAzureStrategy,
    OidcPkceGoogleStrategy,
    AzureCceJwtStrategyV1,
    AzureCceJwtStrategyV2,
    // Middleware & Guards
    SessionSyncMiddleware,
    AnyAuthGuard,
  ],
})
export class AuthModule {}
```

---

## ✅ Checklist de Migración

- [x] Crear 4 nuevos controllers especializados
- [x] Actualizar auth.module.ts con nuevos controllers
- [x] Respaldar archivos antiguos (.OLD)
- [ ] Actualizar endpoints en frontend (solo `/auth/local/jwt/*` → `/auth/jwt/*`)
- [ ] Actualizar tests (si existen)
- [ ] Verificar que todo funcione correctamente

---

## 🧪 Testing

```bash
# 1. Levantar backend
npm run backend2:dev

# 2. Probar cada controller:

# Local Auth
curl -X POST http://localhost:3001/auth/local/username \
  -H "Content-Type: application/json" \
  -d '{"username":"axis","password":"axis123"}' \
  -c cookies.txt -L

# JWT Auth
curl -X POST http://localhost:3001/auth/jwt/validate -b cookies.txt
curl -X POST http://localhost:3001/auth/jwt/refresh -b cookies.txt

# Common Auth
curl http://localhost:3001/auth/me -b cookies.txt
curl http://localhost:3001/auth/logout -b cookies.txt

# OIDC Auth (en navegador)
# http://localhost:3001/auth/azure/login
```

---

## 🎉 Resumen

Has separado un controller monolítico de 135 líneas en **4 controllers especializados**, cada uno con su responsabilidad clara:

1. **LocalAuthController** → Login local
2. **OidcAuthController** → OAuth/OIDC
3. **JwtAuthController** → Operaciones JWT
4. **CommonAuthController** → Endpoints comunes

El código ahora es más mantenible, escalable y fácil de entender! 🚀

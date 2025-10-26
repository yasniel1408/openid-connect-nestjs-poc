# 🕐 Expiración de Tokens y Cookies - Guía Completa

## 📊 Resumen de TTLs (Time To Live)

En tu aplicación hay varios "relojes" corriendo simultáneamente:

```
┌─────────────────────────────────────────────────────────────┐
│                    EXPIRACIÓN EN CAPAS                       │
├─────────────────────────────────────────────────────────────┤
│ 1. Cookie del navegador    → SESSION_COOKIE_MAX_AGE         │
│ 2. Sesión en Redis         → TTL de Redis (mismo que cookie)│
│ 3. Access Token JWT        → expires_at (de Azure/Google)   │
│ 4. ID Token JWT            → exp claim (de Azure/Google)    │
│ 5. Refresh Token           → Varios días/meses              │
└─────────────────────────────────────────────────────────────┘
```

## 🎯 Escenarios de Expiración

### Escenario 1: La Cookie Expira (Browser)

**¿Cuándo?** Después de `SESSION_COOKIE_MAX_AGE` (ej: 1 hora)

```
Usuario hace login
  ↓
Cookie: axis-session=abc123; MaxAge=3600
  ↓
... pasa 1 hora ...
  ↓
Navegador ELIMINA la cookie automáticamente
  ↓
Próximo request NO envía la cookie
  ↓
Backend: req.session es undefined
  ↓
Guard/Middleware retorna 401 Unauthorized
```

**Estado en Redis:** La sesión SIGUE en Redis (hasta que expire su TTL)

**Solución:** Usuario debe hacer login de nuevo

---

### Escenario 2: La Sesión en Redis Expira

**¿Cuándo?** Después del TTL de Redis (mismo tiempo que la cookie)

```
Usuario hace login
  ↓
Redis: session:abc123 con TTL=3600s
  ↓
... pasa 1 hora ...
  ↓
Redis ELIMINA la sesión automáticamente (TTL expiró)
  ↓
Usuario hace request con la cookie (aún existe en navegador)
  ↓
Express-session busca session:abc123 en Redis
  ↓
Redis: Key not found
  ↓
Express-session crea sesión VACÍA (sin user)
  ↓
Backend: req.session.user es undefined
  ↓
Guard retorna 401 Unauthorized
```

**Estado en navegador:** Cookie aún existe pero es inútil

**Solución:** Usuario debe hacer login de nuevo

---

### Escenario 3: El Access Token JWT Expira

**¿Cuándo?** Típicamente 1 hora después del login (según Azure/Google)

```
Usuario hace login
  ↓
Redis guarda: tokens: { access_token, expires_at: 1234567890 }
  ↓
Cookie y sesión Redis SIGUEN VIVAS
  ↓
... pasa 1 hora ...
  ↓
Access token EXPIRA (pero sesión sigue viva)
  ↓
Usuario hace request
  ↓
Backend: req.session.user existe ✅
  ↓
Guard: Sesión válida ✅
  ↓
PERO: Si intentas usar el access_token para llamar a Microsoft Graph
  ↓
Microsoft Graph retorna: 401 Token Expired
```

**Estado:**
- ✅ Cookie: Válida
- ✅ Sesión Redis: Válida
- ❌ Access Token: Expirado
- ✅ Refresh Token: Válido (si existe)

**Solución:** Usar el Refresh Token para renovar

---

### Escenario 4: El Refresh Token Expira

**¿Cuándo?** Días o meses después (según configuración del provider)

```
... pasa mucho tiempo ...
  ↓
Refresh token EXPIRA
  ↓
Intentas renovar el access token
  ↓
Azure/Google retorna: 400 Invalid Refresh Token
  ↓
No puedes renovar
```

**Solución:** Usuario debe hacer login de nuevo

---

## 🔄 Flujos Completos con Manejo de Expiración

### Flujo 1: Request Normal (Todo Válido)

```
GET /products
Cookie: axis-session=abc123
  ↓
Express-session busca en Redis: session:abc123 ✅
  ↓
Redis retorna: { user: { ... } }
  ↓
req.session.user existe ✅
  ↓
Guard verifica autenticación ✅
  ↓
200 OK [productos]
```

---

### Flujo 2: Cookie Expiró en el Navegador

```
GET /products
(Sin cookie, el navegador la eliminó)
  ↓
Express-session: No hay cookie
  ↓
req.session es nueva sesión vacía
  ↓
req.session.user = undefined
  ↓
Guard: 401 Unauthorized
  ↓
Frontend redirige a /login
```

---

### Flujo 3: Sesión Redis Expiró (pero cookie existe)

```
GET /products
Cookie: axis-session=abc123
  ↓
Express-session busca en Redis: session:abc123
  ↓
Redis: Key not found (TTL expiró)
  ↓
Express-session crea nueva sesión vacía
  ↓
req.session.user = undefined
  ↓
Guard: 401 Unauthorized
  ↓
Frontend redirige a /login
```

---

### Flujo 4: Access Token Expiró (renovar con Refresh Token)

```
GET /api/microsoft-graph/me
Cookie: axis-session=abc123 ✅
  ↓
Sesión Redis existe ✅
  ↓
req.session.user.tokens.access_token (expirado ❌)
  ↓
Verificar: Date.now() > tokens.expires_at * 1000
  ↓
Token expiró, intentar renovar
  ↓
Usar refresh_token para obtener nuevos tokens
  ↓
Azure retorna: { access_token, id_token, expires_at }
  ↓
Actualizar sesión:
req.session.user.tokens = newTokens
  ↓
Continuar con el request usando el nuevo token ✅
```

---

## 💻 Implementación: Renovación Automática de Tokens

### 1. Middleware para Renovar Tokens Automáticamente

```typescript
// token-refresh.middleware.ts
import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { OidcService } from './oidc.service';

@Injectable()
export class TokenRefreshMiddleware implements NestMiddleware {
  constructor(private readonly oidcService: OidcService) {}

  async use(req: Request, res: Response, next: NextFunction) {
    const session = (req as any).session;
    const user = session?.user;

    if (!user || !user.tokens) {
      return next(); // No hay usuario, continuar
    }

    const { access_token, expires_at, refresh_token } = user.tokens;

    // Verificar si el token expira en los próximos 5 minutos
    const expiresIn = expires_at ? expires_at - Math.floor(Date.now() / 1000) : 0;
    const shouldRefresh = expiresIn < 300; // 5 minutos

    if (shouldRefresh && refresh_token) {
      try {
        console.log('🔄 Refreshing access token...');
        
        // Renovar el token
        const newTokens = await this.oidcService.refreshTokens(
          user.provider,
          refresh_token
        );

        // Actualizar la sesión con los nuevos tokens
        session.user.tokens = {
          ...newTokens,
          refresh_token: newTokens.refresh_token || refresh_token
        };

        console.log('✅ Access token refreshed successfully');
      } catch (error) {
        console.error('❌ Failed to refresh token:', error);
        
        // Si falla el refresh, limpiar la sesión
        session.destroy(() => {});
        return res.status(401).json({
          error: 'Session expired',
          message: 'Please login again'
        });
      }
    }

    next();
  }
}
```

### 2. Servicio OIDC con Refresh Token

```typescript
// En oidc.service.ts
async refreshTokens(provider: string, refreshToken: string) {
  const client = await this.getClient(provider);
  
  try {
    const tokenSet = await client.refresh(refreshToken);
    
    return {
      access_token: tokenSet.access_token,
      id_token: tokenSet.id_token,
      refresh_token: tokenSet.refresh_token,
      expires_at: tokenSet.expires_at,
      token_type: tokenSet.token_type || 'Bearer'
    };
  } catch (error) {
    throw new Error(`Failed to refresh token: ${error.message}`);
  }
}
```

### 3. Endpoint Manual para Renovar Token

```typescript
// En auth.controller.ts
@Post('refresh')
async refreshToken(@Req() req: Request, @Res() res: Response) {
  const session = (req as any).session;
  const refreshToken = session?.user?.tokens?.refresh_token;

  if (!refreshToken) {
    return res.status(401).json({ error: 'No refresh token available' });
  }

  try {
    const newTokens = await this.oidcService.refreshTokens(
      session.user.provider,
      refreshToken
    );

    // Actualizar sesión
    session.user.tokens = newTokens;

    return res.json({
      success: true,
      expiresAt: newTokens.expires_at
    });
  } catch (error) {
    // Limpiar sesión si falla
    session.destroy(() => {});
    return res.status(401).json({
      error: 'Failed to refresh token',
      message: 'Please login again'
    });
  }
}
```

### 4. Verificar Expiración en Frontend

```typescript
// frontend - utils/auth.ts
export function isTokenExpiringSoon(expiresAt: number): boolean {
  const now = Math.floor(Date.now() / 1000);
  const expiresIn = expiresAt - now;
  return expiresIn < 300; // Menos de 5 minutos
}

export async function ensureValidToken() {
  const response = await fetch('/auth/me');
  const user = await response.json();

  if (user?.tokens?.expires_at) {
    if (isTokenExpiringSoon(user.tokens.expires_at)) {
      console.log('Token expiring soon, refreshing...');
      await fetch('/auth/refresh', { method: 'POST' });
    }
  }
}

// Llamar antes de requests importantes
await ensureValidToken();
await fetch('/api/important-data');
```

---

## 🛡️ Estrategias de Manejo

### Estrategia 1: Sliding Sessions (Renovación Automática)

**Concepto:** Cada request renueva el TTL de la sesión

```typescript
// En cookie.main.ts, agregar a session config:
{
  rolling: true, // Renueva la cookie en cada request
  resave: false,
  saveUninitialized: false
}
```

**Resultado:**
- Usuario activo = sesión nunca expira
- Usuario inactivo = sesión expira después de inactividad

---

### Estrategia 2: Absolute Timeout (Expiración Absoluta)

**Concepto:** La sesión expira después de X tiempo desde el login, sin importar actividad

```typescript
// Al hacer login, guardar timestamp
session.user = {
  ...user,
  loginTimestamp: Date.now()
};

// En middleware, verificar
const loginTime = session.user?.loginTimestamp;
const maxSessionTime = 8 * 60 * 60 * 1000; // 8 horas

if (loginTime && (Date.now() - loginTime) > maxSessionTime) {
  session.destroy(() => {});
  return res.status(401).json({ error: 'Session expired' });
}
```

---

### Estrategia 3: Dual TTL (Sliding + Absolute)

**Concepto:** Combina ambas estrategias

```typescript
// Configuración
const SLIDING_WINDOW = 30 * 60 * 1000; // 30 minutos de inactividad
const ABSOLUTE_TIMEOUT = 8 * 60 * 60 * 1000; // 8 horas máximo

// En middleware
const lastActivity = session.lastActivity || Date.now();
const loginTime = session.loginTimestamp || Date.now();
const now = Date.now();

// Verificar inactividad (sliding)
if (now - lastActivity > SLIDING_WINDOW) {
  session.destroy(() => {});
  return res.status(401).json({ error: 'Session expired due to inactivity' });
}

// Verificar tiempo absoluto
if (now - loginTime > ABSOLUTE_TIMEOUT) {
  session.destroy(() => {});
  return res.status(401).json({ error: 'Session expired, please login again' });
}

// Actualizar última actividad
session.lastActivity = now;
```

---

## 📊 Tabla de Tiempos Recomendados

| Tipo | Tiempo Recomendado | Configuración |
|------|-------------------|---------------|
| Cookie del navegador | 1-8 horas | `SESSION_COOKIE_MAX_AGE` |
| Sesión Redis TTL | Mismo que cookie | TTL en RedisStore |
| Access Token (Azure) | 1 hora | Configurado en Azure |
| Refresh Token (Azure) | 14 días - 90 días | Configurado en Azure |
| Sliding Window | 30 minutos | Middleware custom |
| Absolute Timeout | 8-24 horas | Middleware custom |

---

## 🚨 Manejo de Errores en el Frontend

```typescript
// Interceptor de fetch/axios
async function fetchWithAuth(url: string, options: RequestInit = {}) {
  const response = await fetch(url, {
    ...options,
    credentials: 'include' // Importante para enviar cookies
  });

  // Si la sesión expiró
  if (response.status === 401) {
    const data = await response.json();
    
    if (data.error === 'Session expired') {
      // Redirigir a login
      window.location.href = '/login?reason=session_expired';
    }
  }

  return response;
}
```

---

## 📝 Resumen de Estados

```
┌──────────────────────────────────────────────────────────┐
│              MATRIZ DE ESTADOS DE EXPIRACIÓN             │
├────────────┬──────────┬────────────┬─────────────────────┤
│ Cookie     │ Redis    │ Token JWT  │ Resultado           │
├────────────┼──────────┼────────────┼─────────────────────┤
│ ✅ Válida  │ ✅ Válida│ ✅ Válido  │ ✅ Todo funciona    │
│ ✅ Válida  │ ✅ Válida│ ❌ Expiró  │ 🔄 Renovar con RT   │
│ ✅ Válida  │ ❌ Expiró│ -          │ ❌ 401 - Re-login   │
│ ❌ Expiró  │ ✅ Válida│ -          │ ❌ 401 - Re-login   │
│ ❌ Expiró  │ ❌ Expiró│ -          │ ❌ 401 - Re-login   │
└────────────┴──────────┴────────────┴─────────────────────┘

RT = Refresh Token
```

---

## 🎯 Recomendaciones

### Para Aplicaciones Web (SPA)

1. **Sesiones cortas con sliding:** 30 min inactividad
2. **Renovar tokens automáticamente:** Middleware de refresh
3. **Notificar al usuario:** "Tu sesión expirará en 5 minutos"

### Para APIs

1. **Tokens JWT puros:** Sin sesiones stateful
2. **Refresh tokens:** Para renovar access tokens
3. **Short-lived access tokens:** 15-60 minutos

### Para Aplicaciones Críticas (Banking)

1. **Absolute timeout:** Máximo 15 minutos
2. **Re-autenticación:** Para acciones sensibles
3. **Invalidar en cambio de IP:** Detectar cambios sospechosos

---

## 🔧 Configuración Recomendada para tu Proyecto

```env
# Sesión (1 hora)
SESSION_COOKIE_MAX_AGE=3600000
SESSION_COOKIE_SECURE=true

# En producción, usar sliding sessions
SESSION_ROLLING=true

# Configurar en Azure AD:
# - Access token: 1 hora
# - Refresh token: 14 días
# - Conditional access policies
```

¿Quieres que implemente alguna de estas estrategias en tu código? 🚀

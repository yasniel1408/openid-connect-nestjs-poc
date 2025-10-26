# 🔐 Endpoints Local JWT - Guía de Uso

## 📋 Endpoints Implementados

### 1. POST `/auth/local/username` - Login con Usuario/Contraseña

**Propósito:** Autenticar usuario con credenciales y crear sesión + JWT

**Request:**
```typescript
POST /auth/local/username
Content-Type: application/json

{
  "username": "axis",
  "password": "axis123"
}
```

**Response:**
```
302 Redirect to CORS_ORIGIN
Set-Cookie: axis-session=JWT_TOKEN; HttpOnly; SameSite=lax
Set-Cookie: logged=true
Set-Cookie: user_info=base64_encoded_user_data
Set-Cookie: axis-strategy=local
```

**¿Qué hace?**
1. Valida credenciales con `LocalUsernameStrategy`
2. Guarda user en sesión Redis (via passport.serializeUser)
3. Genera JWT con `GetTokenByUserService`
4. Establece cookies (axis-session con JWT, logged, user_info)
5. Redirige al frontend

---

### 2. POST `/auth/local/jwt/validate` - Validar JWT Existente

**Propósito:** Verificar si un JWT es válido

**Request:**
```typescript
POST /auth/local/jwt/validate
Cookie: axis-session=JWT_TOKEN

// Body vacío o cualquier cosa
{}
```

**Response (200 OK):**
```json
{
  "valid": true,
  "user": {
    "id": "u1",
    "email": "axis@example.com",
    "name": "Axis User",
    "roles": ["user"],
    "identityProvider": "local-jwt"
  }
}
```

**Response (401 Unauthorized):**
```json
{
  "statusCode": 401,
  "message": "Unauthorized"
}
```

**¿Qué hace?**
1. El guard `AuthGuard('local-jwt')` extrae JWT de la cookie
2. Valida signature, expiration, issuer, audience
3. Si es válido, pone user en `req.user`
4. Retorna info del usuario

**Casos de uso:**
- Verificar si el usuario sigue autenticado
- Validar JWT antes de hacer operaciones sensibles
- Debugging

---

### 3. POST `/auth/local/jwt/refresh` - Renovar JWT

**Propósito:** Generar un nuevo JWT usando el JWT actual (token rotation)

**Request:**
```typescript
POST /auth/local/jwt/refresh
Cookie: axis-session=OLD_JWT_TOKEN

// Body vacío
{}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "JWT renovado exitosamente",
  "expiresIn": "1h"
}
```

**New Cookies:**
```
Set-Cookie: axis-session=NEW_JWT_TOKEN; HttpOnly; SameSite=lax
Set-Cookie: user_info=updated_base64_data
```

**¿Qué hace?**
1. Valida JWT actual con el guard
2. Genera NUEVO JWT con la misma info del usuario
3. Reemplaza la cookie con el nuevo JWT
4. Extiende la sesión por 1 hora más

**Casos de uso:**
- Renovar token antes de que expire
- Implementar "sliding sessions" (sesión se renueva con actividad)
- Token rotation por seguridad

---

## 🔄 Flujos de Uso

### Flujo 1: Login y Acceso a Recursos

```
1. Usuario → POST /auth/local/username {username, password}
   └─> Backend valida → Genera JWT → Set cookie
   
2. Usuario → GET /products
   Cookie: axis-session=JWT
   └─> Backend valida JWT con LocalJwtStrategy
   └─> Guard permite acceso
   └─> 200 OK [productos]

3. Usuario → GET /any-protected-route
   Cookie: axis-session=JWT
   └─> Mismo flujo, JWT válido = acceso ✅
```

### Flujo 2: Validar JWT Manualmente

```
Frontend necesita saber si el usuario sigue autenticado

1. Frontend → POST /auth/local/jwt/validate
   Cookie: axis-session=JWT
   
2. Backend → Valida JWT
   ├─> Válido → 200 {valid: true, user: {...}}
   └─> Inválido/Expirado → 401 Unauthorized

3. Frontend → 
   ├─> Si 200: Usuario sigue autenticado ✅
   └─> Si 401: Redirigir a /login ❌
```

### Flujo 3: Renovación Automática (Sliding Session)

```
Frontend detecta que JWT expira pronto

1. Frontend → POST /auth/local/jwt/refresh
   Cookie: axis-session=OLD_JWT
   
2. Backend → 
   ├─> Valida OLD_JWT
   ├─> Genera NEW_JWT
   └─> Set-Cookie: axis-session=NEW_JWT

3. Frontend → 
   └─> Cookie actualizada automáticamente
   └─> Sesión extendida 1 hora más ✅

Usuario activo = Sesión nunca expira
Usuario inactivo 1h = Sesión expira
```

---

## 💻 Ejemplos de Uso en Frontend

### Ejemplo 1: Login

```typescript
// app/login/page.tsx
async function handleLogin(username: string, password: string) {
  const response = await fetch(`${API_BASE}/auth/local/username`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include', // ⚠️ IMPORTANTE
    body: JSON.stringify({ username, password }),
  });

  if (response.ok || response.redirected) {
    window.location.href = '/';
  }
}
```

### Ejemplo 2: Validar Sesión

```typescript
// utils/auth.ts
export async function isAuthenticated(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE}/auth/local/jwt/validate`, {
      method: 'POST',
      credentials: 'include',
    });

    if (response.ok) {
      const data = await response.json();
      return data.valid === true;
    }
    return false;
  } catch {
    return false;
  }
}

// Uso en component
useEffect(() => {
  isAuthenticated().then(valid => {
    if (!valid) {
      router.push('/login');
    }
  });
}, []);
```

### Ejemplo 3: Renovación Automática de JWT

```typescript
// middleware.ts o interceptor
let refreshInProgress = false;

async function ensureValidToken() {
  if (refreshInProgress) return;

  try {
    refreshInProgress = true;
    
    const response = await fetch(`${API_BASE}/auth/local/jwt/refresh`, {
      method: 'POST',
      credentials: 'include',
    });

    if (response.ok) {
      console.log('✅ JWT renovado');
    } else {
      console.log('❌ JWT expiró, redirigiendo a login');
      window.location.href = '/login';
    }
  } finally {
    refreshInProgress = false;
  }
}

// Llamar cada 50 minutos (antes de que expire en 1h)
setInterval(ensureValidToken, 50 * 60 * 1000);
```

### Ejemplo 4: Interceptor para Fetch

```typescript
// utils/fetch-with-auth.ts
export async function fetchWithAuth(url: string, options: RequestInit = {}) {
  const response = await fetch(url, {
    ...options,
    credentials: 'include',
  });

  // Si 401, intentar renovar token
  if (response.status === 401) {
    console.log('Token expiró, intentando renovar...');
    
    const refreshResponse = await fetch(`${API_BASE}/auth/local/jwt/refresh`, {
      method: 'POST',
      credentials: 'include',
    });

    if (refreshResponse.ok) {
      // Token renovado, reintentar request original
      return fetch(url, { ...options, credentials: 'include' });
    } else {
      // No se pudo renovar, redirigir a login
      window.location.href = '/login?reason=session_expired';
      throw new Error('Session expired');
    }
  }

  return response;
}

// Uso
const data = await fetchWithAuth('/api/products').then(r => r.json());
```

---

## 🔒 Seguridad

### JWT en Cookie vs Header

**Cookie (tu implementación):**
```
✅ HttpOnly = JavaScript no puede leer
✅ SameSite = Protección CSRF
✅ Secure en prod = Solo HTTPS
✅ Automático = Browser envía en cada request
```

**Header Authorization:**
```
❌ Vulnerable a XSS (JS puede leerlo)
✅ Más flexible para APIs públicas
✅ CORS más simple
```

### Configuración de Seguridad

```typescript
// local-jwt.strategy.ts
{
  jwtFromRequest: ExtractJwt.fromExtractors([
    cookieExtractor,                           // Primero intenta cookie
    ExtractJwt.fromAuthHeaderAsBearerToken(),  // Fallback a header
  ]),
  secretOrKey: SESSION_SECRET,                 // Clave secreta
  issuer: 'axis-backend',                      // Emisor esperado
  audience: 'axis-api',                        // Audiencia esperada
  ignoreExpiration: false,                     // Validar expiración
  algorithms: ['HS256'],                       // Solo HS256
}
```

---

## 🧪 Testing

### Con cURL

```bash
# 1. Login
curl -X POST http://localhost:3001/auth/local/username \
  -H "Content-Type: application/json" \
  -d '{"username":"axis","password":"axis123"}' \
  -c cookies.txt \
  -L

# 2. Validar JWT
curl -X POST http://localhost:3001/auth/local/jwt/validate \
  -b cookies.txt

# 3. Renovar JWT
curl -X POST http://localhost:3001/auth/local/jwt/refresh \
  -b cookies.txt \
  -c cookies.txt

# 4. Acceder a productos
curl http://localhost:3001/products \
  -b cookies.txt
```

### Con Postman

1. **Login:**
   - POST `http://localhost:3001/auth/local/username`
   - Body: `{"username":"axis","password":"axis123"}`
   - ✅ Cookies se guardan automáticamente

2. **Validar:**
   - POST `http://localhost:3001/auth/local/jwt/validate`
   - Cookies se envían automáticamente
   - ✅ Debe retornar `{"valid": true, ...}`

3. **Renovar:**
   - POST `http://localhost:3001/auth/local/jwt/refresh`
   - ✅ Nueva cookie se guarda

---

## 📊 Comparación de Endpoints

| Endpoint | Guard | Genera JWT | Valida JWT | Uso Principal |
|----------|-------|-----------|------------|---------------|
| `/local/username` | `local` | ✅ | ❌ | Login inicial |
| `/local/jwt/validate` | `local-jwt` | ❌ | ✅ | Verificar sesión |
| `/local/jwt/refresh` | `local-jwt` | ✅ | ✅ | Renovar token |

---

## 🎯 Próximos Pasos

### 1. Agregar Endpoint de Logout

```typescript
@Post('local/jwt/logout')
async logout(@Req() req: Request, @Res() res: Response) {
  // Limpiar cookies
  this.publicCookieService.setLoggedOut(res);
  
  // Opcional: Blacklist del JWT
  // await this.jwtBlacklistService.add(req.jwt);
  
  return res.json({ success: true });
}
```

### 2. Implementar JWT Blacklist

Para invalidar tokens antes de expiración:

```typescript
// jwt-blacklist.service.ts
@Injectable()
export class JwtBlacklistService {
  constructor(private redis: RedisClient) {}

  async add(token: string, expiresIn: number) {
    const key = `blacklist:${token}`;
    await this.redis.setEx(key, expiresIn, 'true');
  }

  async isBlacklisted(token: string): Promise<boolean> {
    const exists = await this.redis.exists(`blacklist:${token}`);
    return exists === 1;
  }
}

// En local-jwt.strategy.ts
async validate(payload: any, done: Function) {
  const token = this.extractJwtFromRequest();
  const isBlacklisted = await this.blacklist.isBlacklisted(token);
  
  if (isBlacklisted) {
    throw new UnauthorizedException('Token revoked');
  }
  
  return payload;
}
```

### 3. Agregar Claims Personalizados

```typescript
// En get-token-by-user.service.ts
async execute(user: any, strategy: string) {
  const payload = {
    sub: user.id,
    email: user.email,
    name: user.name,
    roles: user.roles,
    strategy,
    iss: 'axis-backend',
    aud: 'axis-api',
    // Claims personalizados
    permissions: user.permissions,
    tenant: user.tenant,
    metadata: {
      loginTime: Date.now(),
      deviceType: 'web',
    },
  };

  return this.jwtService.signAsync(payload, {
    algorithm: 'HS256',
    expiresIn: '1h',
  });
}
```

---

## ✅ Resumen

Has implementado:
- ✅ Login con username/password → Genera JWT
- ✅ Validación de JWT existente
- ✅ Renovación de JWT (token rotation)
- ✅ JWT en cookies HttpOnly (seguro)
- ✅ Soporte para header Authorization (opcional)
- ✅ Integración con Passport strategies

Todo listo para usar! 🚀

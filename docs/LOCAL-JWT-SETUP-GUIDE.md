# 🔐 Guía Completa: Local JWT Strategy + Login + Frontend

## ✅ Archivos Configurados

### Backend

1. **`src/auth/strategies/local-jwt.strategy.ts`** ⭐
   - Estrategia JWT para validar tokens en cookies
   - Extrae JWT de cookie `axis-session` o header `Authorization`
   - Valida signature, issuer, audience y expiración

2. **`src/auth/auth.module.ts`**
   - Registra `LocalJwtStrategy` en providers
   - Configura JwtModule con SESSION_SECRET

3. **`src/cookie.main.ts`**
   - Agrega `passport.serializeUser` y `passport.deserializeUser`
   - Necesario para que Passport funcione con sesiones

### Frontend

4. **`app/login/page.tsx`** 🆕
   - Página de login completa
   - Form para username/password
   - Botones para OAuth (Azure, Google)
   - Manejo de errores
   - Estados de carga

5. **`app/page.tsx`**
   - Muestra info del usuario autenticado
   - Links a login/logout
   - Navegación mejorada

## 🚀 Cómo Funciona el Flujo

### Flujo 1: Login con Username/Password

```
┌──────────────┐         ┌──────────────┐         ┌──────────────┐
│   Frontend   │         │   Backend    │         │    Redis     │
└──────────────┘         └──────────────┘         └──────────────┘
       │                        │                        │
       │ POST /auth/local/username                       │
       │ {username, password}   │                        │
       ├───────────────────────>│                        │
       │                        │                        │
       │                        │ LocalUsernameStrategy  │
       │                        │ valida credenciales    │
       │                        │                        │
       │                        │ passport.serializeUser │
       │                        │ guarda user en sesión  │
       │                        ├───────────────────────>│
       │                        │                        │
       │                        │ Genera JWT             │
       │                        │ con SESSION_SECRET     │
       │                        │                        │
       │<───────────────────────┤                        │
       │ Set-Cookie:            │                        │
       │  axis-session=jwt...   │                        │
       │  logged=true           │                        │
       │  user_info=base64...   │                        │
       │                        │                        │
       │ Redirect a /           │                        │
       │<───────────────────────┤                        │
       │                        │                        │
```

### Flujo 2: Request a Productos (con JWT)

```
┌──────────────┐         ┌──────────────┐         ┌──────────────┐
│   Frontend   │         │   Backend    │         │    Redis     │
└──────────────┘         └──────────────┘         └──────────────┘
       │                        │                        │
       │ GET /products          │                        │
       │ Cookie: axis-session=jwt                        │
       ├───────────────────────>│                        │
       │                        │                        │
       │                        │ LocalJwtStrategy       │
       │                        │ extrae JWT de cookie   │
       │                        │                        │
       │                        │ Valida JWT:            │
       │                        │ - Signature ✅         │
       │                        │ - Expiration ✅        │
       │                        │ - Issuer ✅            │
       │                        │ - Audience ✅          │
       │                        │                        │
       │                        │ Payload → req.user     │
       │                        │                        │
       │<───────────────────────┤                        │
       │ 200 OK                 │                        │
       │ [productos]            │                        │
       │                        │                        │
```

### Flujo 3: Login con Azure/Google (OIDC PKCE)

```
Usuario → Click "Login con Azure"
       ↓
Frontend → window.location = /auth/azure/login
       ↓
Backend → Genera state, nonce, codeVerifier
       ↓
       Guarda en Redis session
       ↓
       Redirect a Azure con codeChallenge
       ↓
Usuario hace login en Azure
       ↓
Azure → Redirect a /auth/azure/callback?code=...
       ↓
Backend → Recupera codeVerifier de Redis
       ↓
       Canjea code por tokens con Azure
       ↓
       Guarda user + tokens en sesión Redis
       ↓
       Set cookies (axis-session, logged, user_info)
       ↓
       Redirect a Frontend /
```

## 🔧 Configuración Necesaria

### Variables de Entorno (Backend)

```env
# Session & JWT
SESSION_SECRET=tu-secret-muy-seguro-aqui
SESSION_COOKIE_NAME=axis-session
SESSION_COOKIE_MAX_AGE=3600000
SESSION_COOKIE_SECURE=false

# JWT Config
JWT_ISSUER=axis-backend
JWT_AUDIENCE=axis-api

# Redis
REDIS_URL=redis://localhost:6379

# CORS
CORS_ORIGIN=http://localhost:3000

# Azure AD (opcional)
OIDC_ISSUER_azure=https://login.microsoftonline.com/tenant/v2.0
OIDC_CLIENT_ID_azure=your-client-id
OIDC_CLIENT_SECRET_azure=your-client-secret
OIDC_REDIRECT_URI_azure=http://localhost:3001/auth/azure/callback

# Google (opcional)
OIDC_ISSUER_google=https://accounts.google.com
OIDC_CLIENT_ID_google=your-client-id
OIDC_CLIENT_SECRET_google=your-client-secret
OIDC_REDIRECT_URI_google=http://localhost:3001/auth/google/callback
```

### Variables de Entorno (Frontend)

```env
# .env.local
NEXT_PUBLIC_API_BASE_URL=http://localhost:3001
```

## 📝 Endpoints del Backend

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| POST | `/auth/local/username` | Login con username/password |
| GET | `/auth/azure/login` | Inicia OAuth con Azure |
| GET | `/auth/azure/callback` | Callback de Azure |
| GET | `/auth/google/login` | Inicia OAuth con Google |
| GET | `/auth/google/callback` | Callback de Google |
| GET | `/auth/me` | Info del usuario autenticado |
| GET | `/auth/logout` | Cierra sesión |
| GET | `/products` | Productos (protegido) |

## 🧪 Cómo Probar

### 1. Levantar Redis

```bash
docker-compose up -d
```

### 2. Iniciar Backend

```bash
npm run backend2:dev
```

Deberías ver:
```
✅ Redis Client Connected
✅ Passport initialized with session support
🚀 Passport backend listening on http://localhost:3001
```

### 3. Iniciar Frontend

```bash
npm run frontend2:dev
```

### 4. Probar Login

1. Ve a http://localhost:3000
2. Click en "Login"
3. Usa: `axis` / `axis123`
4. Deberías ver tu info de usuario
5. Ve a "Productos" - debería funcionar

### 5. Verificar en Redis

```bash
./inspect-redis-sessions.sh --parse
```

Deberías ver:
```
🔑 Session: session:abc123...
  👤 User ID: u1
  📧 Email: axis@example.com
  🏢 Provider: local
  🎫 Has Access Token: ✅ Yes
```

## 🎯 Usuarios de Prueba

En `local-username.strategy.ts`:

```typescript
username: 'axis'
password: 'axis123'
```

Puedes agregar más usuarios al array `USERS`.

## 🔐 Seguridad

### JWT en Cookies

**Ventajas:**
- ✅ HttpOnly cookie = JavaScript no puede leerla
- ✅ SameSite = Protección contra CSRF
- ✅ Secure en producción = Solo HTTPS

**Flujo:**
1. Usuario hace login → Backend genera JWT
2. JWT se envía como cookie HttpOnly
3. Navegador envía cookie automáticamente en cada request
4. Backend valida JWT en cada request

### Passport Session vs JWT

**Session (con Redis):**
- User completo guardado en Redis
- Cookie solo tiene el session ID
- Más flexible (puedes invalidar sesiones)
- Requiere Redis

**JWT:**
- User info en el token (firmado)
- Cookie tiene el JWT completo
- Stateless (no necesita Redis para validar)
- No puedes invalidar sin blacklist

**Tu configuración usa AMBOS:**
- Sesión en Redis para OAuth (necesita guardar tokens de Azure/Google)
- JWT en cookie para validación rápida
- Passport puede usar cualquiera de los dos

## 🐛 Troubleshooting

### Error: "Login sessions require session support"

**Causa:** Falta `passport.serializeUser/deserializeUser`

**Solución:** Ya está agregado en `cookie.main.ts`

### Cookie no se envía en requests

**Causa:** Falta `credentials: 'include'` en fetch

**Solución:** Ya está en el código del login

### 401 Unauthorized en /products

**Causa:** No estás autenticado o el JWT expiró

**Solución:** 
1. Verifica que hiciste login
2. Verifica la cookie en DevTools
3. Verifica que Redis está corriendo

### JWT Invalid signature

**Causa:** SESSION_SECRET diferente entre login y validación

**Solución:** Verifica que SESSION_SECRET sea el mismo

## 📚 Próximos Pasos

### 1. Agregar Más Usuarios

Edita `local-username.strategy.ts`:

```typescript
const USERS = [
  { id: 'u1', username: 'axis', password: 'axis123', ... },
  { id: 'u2', username: 'admin', password: 'admin123', ... },
  { id: 'u3', username: 'test', password: 'test123', ... },
];
```

### 2. Conectar a Base de Datos

Reemplaza el array `USERS` con consultas a tu DB:

```typescript
async validate(username: string, password: string) {
  const user = await this.userService.findByUsername(username);
  if (!user) return null;
  
  const isValid = await bcrypt.compare(password, user.password);
  if (!isValid) return null;
  
  return user;
}
```

### 3. Agregar Refresh Tokens

Implementa el middleware de renovación automática del documento `TOKEN-EXPIRATION-GUIDE.md`.

### 4. Proteger Rutas Específicas

Usa guards en controllers:

```typescript
@Get('admin')
@UseGuards(AuthGuard('local-jwt'))
async adminOnly(@Req() req: Request) {
  const user = req.user;
  if (!user.roles.includes('admin')) {
    throw new ForbiddenException();
  }
  return { message: 'Welcome admin!' };
}
```

### 5. Agregar Roles y Permissions

Crea un custom decorator:

```typescript
// roles.decorator.ts
export const Roles = (...roles: string[]) => SetMetadata('roles', roles);

// roles.guard.ts
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.get<string[]>('roles', context.getHandler());
    if (!roles) return true;
    
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    return roles.some(role => user.roles?.includes(role));
  }
}

// Uso:
@Get('admin')
@UseGuards(AuthGuard('local-jwt'), RolesGuard)
@Roles('admin')
async adminOnly() {
  return { message: 'Admin only!' };
}
```

## ✅ Resumen

Has configurado:
- ✅ Estrategia Local JWT para validar tokens
- ✅ Serialización de Passport para sesiones
- ✅ Página de login en frontend
- ✅ Integración con OAuth (Azure, Google)
- ✅ Protección de rutas
- ✅ Cookies seguras (HttpOnly, SameSite)
- ✅ Sesiones persistentes en Redis

Todo listo para probar! 🚀

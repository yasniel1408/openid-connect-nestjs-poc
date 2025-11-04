# 🔐 OIDC Refactor: Usando Guards en vez de Servicios Manuales

## ✅ Cambios Realizados

Hemos refactorizado el flujo OIDC para usar **Guards de Passport directamente** en vez de manejar el flujo manualmente con servicios.

## 🎯 Antes vs Después

### ❌ ANTES (Manual con OidcService)

```typescript
// Controller manejaba todo manualmente
@Get('azure/login')
async azureLogin(@Req() req, @Res() res) {
  const url = await this.oidc.getAuthUrl('azure', req.session);
  return res.redirect(url); // Redirect manual
}

@Get('azure/callback')
async azureCallback(@Req() req, @Res() res) {
  const user = await this.oidc.handleCallback('azure', req.query, req.session);
  this.cookieService.setFromUser(res, user, 'oidc-azure');
  return res.redirect(this.authConfig.getCorsOrigin());
}
```

**Problemas:**
- ❌ Controller hace demasiado trabajo
- ❌ Lógica duplicada para cada provider
- ❌ No usa el patrón estándar de Passport
- ❌ Difícil de testear con guards
- ❌ No se beneficia de decoradores como `@UseGuards()`

### ✅ DESPUÉS (Guards de Passport)

```typescript
// Controller simple y declarativo
@Get('azure/login')
@UseGuards(AuthGuard('oidc-azure'))
async azureLogin() {
  // Passport maneja el redirect automáticamente
  // Este método nunca se ejecuta
}

@Get('azure/callback')
@UseGuards(AuthGuard('oidc-azure'))
async azureCallback(@Req() req, @Res() res) {
  const user = req.user; // ✅ Ya poblado por Passport
  
  // Solo establecer cookies y redirigir
  const token = await this.getTokenByUser.execute(user, 'oidc-azure');
  this.cookieService.setFromUser(res, user);
  this.cookieService.setLoggedIn(res, token, 'oidc-azure');
  
  return res.redirect(this.authConfig.getCorsOrigin());
}
```

**Ventajas:**
- ✅ Controller limpio y simple
- ✅ Passport maneja todo el flujo OAuth
- ✅ Patrón estándar de NestJS
- ✅ Fácil agregar más providers
- ✅ Guards reutilizables
- ✅ Mejor testeable

---

## 📁 Arquitectura Nueva

```
src/auth/
├── controllers/
│   ├── oidc-auth.controller.ts      # ✅ Usa @UseGuards()
│   └── ...
├── strategies/
│   ├── oidc-pkce-azure.strategy.ts  # ✅ Captura tokens completos
│   ├── oidc-pkce-google.strategy.ts # ✅ Captura tokens completos
│   └── ...
└── services/
    ├── oidc.service.ts               # ⚠️ Solo para logout endpoint
    └── ...
```

---

## 🔄 Flujo OAuth Completo con Guards

### 1. Usuario Click en "Login con Azure"

```
Frontend → GET /auth/azure/login
```

### 2. Guard Intercepta Request

```typescript
@Get('azure/login')
@UseGuards(AuthGuard('oidc-azure'))  // ← Guard intercepta aquí
async azureLogin() {
  // Nunca se ejecuta en el primer request
}
```

### 3. Strategy Genera URL de Authorization

La `OidcPkceAzureStrategy` automáticamente:
1. Genera `state`, `nonce` (Passport lo hace)
2. Construye URL de authorization
3. **Passport redirige al usuario a Azure**

```
Usuario → Redirect a Azure AD
https://login.microsoftonline.com/tenant/oauth2/v2.0/authorize
  ?client_id=...
  &redirect_uri=http://localhost:3001/auth/azure/callback
  &response_type=code
  &scope=openid+profile+email
  &state=...
  &nonce=...
```

### 4. Usuario Hace Login en Azure

Azure muestra su pantalla de login → Usuario ingresa credenciales

### 5. Azure Redirige a Callback

```
Azure → GET /auth/azure/callback?code=abc123&state=xyz789
```

### 6. Guard Intercepta Callback

```typescript
@Get('azure/callback')
@UseGuards(AuthGuard('oidc-azure'))  // ← Guard intercepta
async azureCallback(@Req() req, @Res() res) {
  const user = req.user; // ✅ Ya poblado
}
```

### 7. Strategy Procesa Callback

La strategy automáticamente:
1. Valida `state` (anti-CSRF)
2. Canjea `code` por tokens (access_token, id_token, refresh_token)
3. Obtiene user info
4. Llama al verify callback
5. **Popula `req.user`**

```typescript
// En oidc-pkce-azure.strategy.ts
async (req, issuer, profile, context, idToken, done) => {
  const user = {
    id: profile.sub,
    name: profile.name,
    email: profile.email,
    tokens: {
      access_token: context.accessToken,
      id_token: context.idToken,
      refresh_token: context.refreshToken,
    },
    // ... más info
  };
  
  done(null, user); // ✅ Passport pone esto en req.user
}
```

### 8. Controller Ejecuta Lógica

Ahora sí se ejecuta el método del controller:

```typescript
async azureCallback(@Req() req, @Res() res) {
  const user = req.user; // ✅ Usuario con tokens incluidos
  
  // Guardar en sesión
  req.session.user = user;
  
  // Generar JWT para frontend
  const token = await this.getTokenByUser.execute(user, 'oidc-azure');
  
  // Establecer cookies
  this.cookieService.setFromUser(res, user);
  this.cookieService.setLoggedIn(res, token, 'oidc-azure');
  
  // Redirigir al frontend
  return res.redirect('http://localhost:3000');
}
```

### 9. Usuario en Frontend Autenticado

```
Usuario → http://localhost:3000
Cookies: 
  - axis-session=jwt_token (HttpOnly)
  - logged=true
  - user_info=base64_encoded_data
```

---

## 🎨 Estrategias Mejoradas

### OidcPkceAzureStrategy

```typescript
@Injectable()
export class OidcPkceAzureStrategy extends PassportStrategy(OpenIdConnectStrategy, 'oidc-azure') {
  constructor(authConfig: AuthConfigService) {
    super(
      {
        issuer: 'https://login.microsoftonline.com/tenant/v2.0',
        authorizationURL: 'https://login.microsoftonline.com/tenant/oauth2/v2.0/authorize',
        tokenURL: 'https://login.microsoftonline.com/tenant/oauth2/v2.0/token',
        userInfoURL: 'https://graph.microsoft.com/oidc/userinfo',
        clientID: '...',
        clientSecret: '...',
        callbackURL: 'http://localhost:3001/auth/azure/callback',
        scope: ['openid', 'profile', 'email'],
        passReqToCallback: true, // ⭐ Importante para acceder a req
      },
      // Verify callback ejecutado después de obtener tokens
      async (req, issuer, profile, context, idToken, done) => {
        // context.accessToken, context.refreshToken disponibles aquí
        const user = {
          id: profile.sub,
          name: profile.name,
          email: profile.email,
          tokens: {
            access_token: context.accessToken,
            id_token: context.idToken,
            refresh_token: context.refreshToken,
          },
          claims: idToken,
          profile: profile._json,
        };
        
        console.log(`✅ Azure login: ${user.email}`);
        done(null, user); // Passport pone user en req.user
      }
    );
  }
}
```

**Características:**
- ✅ Captura todos los tokens (access, id, refresh)
- ✅ Guarda claims completos del ID token
- ✅ Guarda profile completo
- ✅ Logs para debugging
- ✅ Manejo de errores integrado

### OidcPkceGoogleStrategy

Similar a Azure pero con endpoints de Google:

```typescript
{
  issuer: 'https://accounts.google.com',
  authorizationURL: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenURL: 'https://oauth2.googleapis.com/token',
  userInfoURL: 'https://openidconnect.googleapis.com/v1/userinfo',
  // ...
}
```

---

## 🚀 Agregar Nuevos Providers

### Ejemplo: Agregar GitHub

**1. Crear Strategy**

```typescript
// strategies/oidc-github.strategy.ts
@Injectable()
export class OidcGitHubStrategy extends PassportStrategy(OpenIdConnectStrategy, 'oidc-github') {
  constructor(authConfig: AuthConfigService) {
    super(
      {
        issuer: 'https://github.com',
        authorizationURL: 'https://github.com/login/oauth/authorize',
        tokenURL: 'https://github.com/login/oauth/access_token',
        userInfoURL: 'https://api.github.com/user',
        clientID: authConfig.getProviderSetting('github', 'OIDC_CLIENT_ID'),
        clientSecret: authConfig.getProviderSetting('github', 'OIDC_CLIENT_SECRET'),
        callbackURL: authConfig.getRedirectUri('github'),
        scope: ['read:user', 'user:email'],
        passReqToCallback: true,
      },
      async (req, issuer, profile, context, idToken, done) => {
        const user = {
          id: profile.id,
          name: profile.displayName,
          email: profile._json.email,
          username: profile._json.login,
          avatar: profile._json.avatar_url,
          tokens: {
            access_token: context.accessToken,
          },
        };
        done(null, user);
      }
    );
  }
}
```

**2. Registrar en Module**

```typescript
// auth.module.ts
providers: [
  // ... strategies existentes
  OidcGitHubStrategy, // ← Agregar aquí
]
```

**3. Agregar Endpoints en Controller**

```typescript
// oidc-auth.controller.ts
@Get('github/login')
@UseGuards(AuthGuard('oidc-github'))
async githubLogin() {}

@Get('github/callback')
@UseGuards(AuthGuard('oidc-github'))
async githubCallback(@Req() req, @Res() res) {
  const user = req.user;
  const token = await this.getTokenByUser.execute(user, 'oidc-github');
  this.cookieService.setFromUser(res, user);
  this.cookieService.setLoggedIn(res, token, 'oidc-github');
  return res.redirect(this.authConfig.getCorsOrigin());
}
```

**4. Agregar Variables de Entorno**

```env
OIDC_PROVIDERS=azure,google,github
OIDC_ISSUER_github=https://github.com
OIDC_CLIENT_ID_github=your_github_client_id
OIDC_CLIENT_SECRET_github=your_github_client_secret
OIDC_REDIRECT_URI_github=http://localhost:3001/auth/github/callback
```

**5. Agregar Botón en Frontend**

```tsx
<button onClick={() => window.location.href = '/auth/github/login'}>
  Login con GitHub
</button>
```

**¡Listo!** 🎉

---

## 🔒 Tokens Guardados

Con la nueva implementación, tienes acceso completo a los tokens:

```typescript
// En el callback
const user = req.user;

// Acceder a tokens
user.tokens.access_token   // Para llamar APIs del provider
user.tokens.id_token       // JWT con claims del usuario
user.tokens.refresh_token  // Para renovar access_token

// Claims del ID token
user.claims.sub           // User ID
user.claims.email         // Email
user.claims.name          // Nombre
user.claims.iss           // Issuer
user.claims.aud           // Audience
user.claims.exp           // Expiration

// Profile completo
user.profile.email
user.profile.name
user.profile.picture
```

### Usar Access Token para Llamar APIs

```typescript
// Después del login, tienes el access_token guardado en sesión
const user = req.session.user;
const accessToken = user.tokens.access_token;

// Llamar a Microsoft Graph API
const response = await fetch('https://graph.microsoft.com/v1.0/me', {
  headers: {
    'Authorization': `Bearer ${accessToken}`
  }
});

// O usar Google APIs
const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
  headers: {
    'Authorization': `Bearer ${accessToken}`
  }
});
```

---

## 📊 Comparación con OidcService

| Aspecto | OidcService (Manual) | Guards de Passport |
|---------|---------------------|-------------------|
| **Código en Controller** | Mucho | Mínimo |
| **Redirects** | Manuales | Automáticos |
| **Validación State** | Manual | Automática |
| **Exchange Code** | Manual | Automático |
| **Tokens** | Manual | Automáticos |
| **Extensibilidad** | Agregar métodos | Agregar strategy |
| **Testing** | Complejo | Simple (mock guards) |
| **Patrón NestJS** | No estándar | Estándar |
| **Logs** | Manual | Automático + custom |

---

## 🧪 Testing

### Antes (Manual)

```typescript
// Tenías que mockear OidcService completo
const mockOidcService = {
  getAuthUrl: jest.fn().mockResolvedValue('https://azure.com/...'),
  handleCallback: jest.fn().mockResolvedValue(mockUser),
};
```

### Después (Guards)

```typescript
// Solo mockear el guard
const mockAuthGuard = {
  canActivate: jest.fn().mockImplementation((context) => {
    const req = context.switchToHttp().getRequest();
    req.user = mockUser; // Simular req.user poblado
    return true;
  }),
};

beforeEach(() => {
  const module = await Test.createTestingModule({
    controllers: [OidcAuthController],
  })
    .overrideGuard(AuthGuard('oidc-azure'))
    .useValue(mockAuthGuard)
    .compile();
});
```

---

## 🎯 OidcService Ahora es Opcional

El `OidcService` ya solo se usa para:
- ✅ Logout (generar end_session URL)
- ✅ Refresh tokens (opcional)
- ✅ Operaciones avanzadas

**Ya NO se usa para:**
- ❌ Generar auth URLs (lo hace Passport)
- ❌ Manejar callbacks (lo hace Passport)
- ❌ Validar state (lo hace Passport)
- ❌ Exchange code por tokens (lo hace Passport)

**Puedes incluso eliminarlo si:**
- No necesitas logout en el provider (solo local)
- No necesitas refresh tokens
- No necesitas operaciones avanzadas

---

## ✅ Resumen

### Lo que cambiaste:

1. **OidcAuthController** → Usa `@UseGuards()` en vez de `oidc.getAuthUrl()` / `oidc.handleCallback()`
2. **OidcPkceAzureStrategy** → Captura tokens completos en el verify callback
3. **OidcPkceGoogleStrategy** → Captura tokens completos en el verify callback
4. **OidcService** → Solo se usa en logout (opcional)

### Beneficios:

- ✅ Controller más limpio (10 líneas vs 30 líneas)
- ✅ Patrón estándar de Passport/NestJS
- ✅ Guards reutilizables en cualquier ruta
- ✅ Fácil agregar nuevos providers
- ✅ Mejor separación de responsabilidades
- ✅ Testing más simple
- ✅ Acceso completo a tokens OAuth

### Próximos pasos opcionales:

1. Eliminar `OidcService` si no lo necesitas
2. Agregar más providers (GitHub, Okta, Auth0)
3. Implementar refresh token automático
4. Agregar guards personalizados (ej: `@RequireOAuth()`)
5. Mejorar logging y metrics

---

🎉 **Ahora tu código sigue el patrón estándar de Passport y NestJS!**

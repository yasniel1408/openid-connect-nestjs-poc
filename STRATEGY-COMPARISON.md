# 🔑 Comparación: LocalUsernameStrategy vs LocalJwtStrategy

## 📊 Resumen Ejecutivo

Tienes **2 Passport Strategies diferentes** implementadas, cada una con su propósito específico:

| Aspecto | LocalUsernameStrategy | LocalJwtStrategy |
|---------|----------------------|------------------|
| **Tipo de Passport** | `passport-local` | `passport-jwt` |
| **Autenticación** | Username + Password | JWT Token |
| **Endpoint** | `POST /auth/local/username` | `POST /auth/local/jwt/validate`<br>`POST /auth/local/jwt/refresh` |
| **Cuándo se usa** | Login inicial | Validar/Renovar token |
| **Input** | `{username, password}` en body | JWT en cookie o header |
| **Output** | Genera JWT + Sesión | Valida JWT existente |
| **Strategy File** | `local-username.strategy.ts` | `local-jwt.strategy.ts` |
| **Guard Name** | `'local'` | `'local-jwt'` |

---

## 1️⃣ LocalUsernameStrategy (passport-local)

### 📄 Archivo: `local-username.strategy.ts`

```typescript
@Injectable()
export class LocalUsernameStrategy extends PassportStrategy(Strategy, 'local') {
  constructor() {
    super({ 
      usernameField: 'username', 
      passwordField: 'password' 
    });
  }

  async validate(username: string, password: string) {
    // Validar contra DB o array de usuarios
    const user = USERS.find(u => 
      u.username === username && u.password === password
    );
    
    if (!user) return null; // ❌ Credenciales inválidas
    
    return {  // ✅ Usuario válido
      id: user.id,
      name: user.name,
      email: user.email,
      roles: user.roles,
      identityProvider: 'local'
    };
  }
}
```

### 🎯 Uso en Controller

```typescript
// auth.controller.ts
@Post('local/username')
@UseGuards(AuthGuard('local'))  // ← Usa 'local' guard
async localUsername(@Req() req, @Res() res) {
  const user = req.user;  // Usuario validado por la strategy
  
  // 1. Guardar en sesión Redis
  req.session.user = user;
  
  // 2. Generar JWT
  const token = await this.getTokenByUser.execute(user, 'local');
  
  // 3. Establecer cookies
  this.publicCookieService.setLoggedIn(res, token, 'local');
  
  // 4. Redirigir al frontend
  return res.redirect('/');
}
```

### 🔄 Flujo Completo

```
Usuario → POST /auth/local/username
         {username: "axis", password: "axis123"}
    ↓
AuthGuard('local') activa LocalUsernameStrategy
    ↓
Strategy.validate(username, password)
    ├─> Busca en DB/array
    ├─> Valida password
    └─> Retorna user object o null
    ↓
Si user válido:
    ├─> req.user = user
    ├─> Guardar en sesión Redis
    ├─> Generar JWT con GetTokenByUserService
    ├─> Set-Cookie: axis-session=JWT
    └─> Redirect
    ↓
✅ Usuario autenticado
```

### ✅ Cuándo Usar

- ✅ **Login inicial** con username/password
- ✅ **Primera autenticación** del usuario
- ✅ **Validar credenciales** contra base de datos
- ✅ **Crear sesión nueva** después de validar

---

## 2️⃣ LocalJwtStrategy (passport-jwt)

### 📄 Archivo: `local-jwt.strategy.ts`

```typescript
@Injectable()
export class LocalJwtStrategy extends PassportStrategy(JwtStrategy, 'local-jwt') {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        cookieExtractor,                           // De cookie
        ExtractJwt.fromAuthHeaderAsBearerToken(), // De header
      ]),
      secretOrKey: config.getOrThrow('SESSION_SECRET'),
      issuer: 'axis-backend',
      audience: 'axis-api',
      ignoreExpiration: false,
      algorithms: ['HS256'],
    });
  }

  async validate(payload: any) {
    // El JWT ya fue validado (signature, exp, iss, aud)
    // Aquí solo extraemos la info del payload
    return {
      id: payload.sub || payload.id,
      email: payload.email,
      name: payload.name,
      roles: payload.roles || [],
      identityProvider: payload.iss || 'local-jwt',
    };
  }
}
```

### 🎯 Uso en Controller

```typescript
// auth.controller.ts

// Endpoint 1: Validar JWT
@Post('local/jwt/validate')
@UseGuards(AuthGuard('local-jwt'))  // ← Usa 'local-jwt' guard
async validateJwt(@Req() req, @Res() res) {
  const user = req.user;  // Usuario del JWT validado
  
  return res.json({
    valid: true,
    user: user
  });
}

// Endpoint 2: Renovar JWT
@Post('local/jwt/refresh')
@UseGuards(AuthGuard('local-jwt'))  // ← También usa 'local-jwt' guard
async refreshJwt(@Req() req, @Res() res) {
  const user = req.user;  // Usuario del JWT actual
  
  // Generar NUEVO JWT con misma info
  const newToken = await this.getTokenByUser.execute(user, 'local-jwt');
  
  // Actualizar cookie
  this.publicCookieService.setLoggedIn(res, newToken, 'local-jwt');
  
  return res.json({ success: true });
}
```

### 🔄 Flujo Completo

```
Usuario → POST /auth/local/jwt/validate
         Cookie: axis-session=JWT_TOKEN
    ↓
AuthGuard('local-jwt') activa LocalJwtStrategy
    ↓
Strategy extrae JWT de cookie/header
    ↓
Strategy valida JWT:
    ├─> Verifica signature con SESSION_SECRET
    ├─> Verifica expiration
    ├─> Verifica issuer ('axis-backend')
    └─> Verifica audience ('axis-api')
    ↓
Si JWT válido:
    ├─> Decodifica payload
    ├─> Strategy.validate(payload)
    └─> req.user = user del payload
    ↓
✅ Request continúa con req.user
```

### ✅ Cuándo Usar

- ✅ **Validar** si un JWT es válido
- ✅ **Renovar** JWT antes de expiración
- ✅ **Proteger rutas** que solo aceptan JWT
- ✅ **Implementar** sliding sessions
- ✅ **Verificar** autenticación sin consultar DB

---

## 🔀 Diferencias Clave

### Entrada (Input)

**LocalUsernameStrategy:**
```json
POST /auth/local/username
{
  "username": "axis",
  "password": "axis123"
}
```

**LocalJwtStrategy:**
```
POST /auth/local/jwt/validate
Cookie: axis-session=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Validación

**LocalUsernameStrategy:**
```typescript
// Consulta a base de datos o array
const user = await this.userService.findByUsername(username);
if (!user) return null;

const isValid = await bcrypt.compare(password, user.password);
if (!isValid) return null;

return user;
```

**LocalJwtStrategy:**
```typescript
// NO consulta DB
// Solo valida la firma y estructura del JWT
// El token DEBE ser válido (no expirado, firma correcta)
return payload;  // Info del usuario desde el token
```

### Salida (Output)

**LocalUsernameStrategy:**
```typescript
// Genera NUEVO JWT
// Crea NUEVA sesión en Redis
// Redirige al frontend
```

**LocalJwtStrategy:**
```typescript
// Valida JWT existente
// Puede generar NUEVO JWT (en /refresh)
// Retorna JSON (no redirect)
```

---

## 🎯 Casos de Uso

### Escenario 1: Usuario Nuevo Hace Login

```
1. Usuario → POST /auth/local/username {username, password}
            ↓
            LocalUsernameStrategy
            ↓
            ✅ Credenciales válidas
            ↓
            Genera JWT + Sesión Redis
            ↓
            Set cookies
            ↓
            Redirect a frontend
```

### Escenario 2: Usuario Ya Autenticado Accede a Productos

```
1. Usuario → GET /products
            Cookie: axis-session=JWT
            ↓
            LocalJwtStrategy (si usas @UseGuards(AuthGuard('local-jwt')))
            ↓
            ✅ JWT válido
            ↓
            req.user poblado
            ↓
            Retorna productos
```

### Escenario 3: Frontend Verifica Autenticación

```
1. Frontend → POST /auth/local/jwt/validate
             Cookie: axis-session=JWT
             ↓
             LocalJwtStrategy
             ↓
             ✅ JWT válido
             ↓
             Retorna {valid: true, user: {...}}
             ↓
             Frontend sabe que usuario está autenticado
```

### Escenario 4: Token Está por Expirar

```
1. Frontend → POST /auth/local/jwt/refresh
             Cookie: axis-session=OLD_JWT
             ↓
             LocalJwtStrategy valida OLD_JWT
             ↓
             ✅ Válido
             ↓
             Genera NEW_JWT
             ↓
             Set-Cookie: axis-session=NEW_JWT
             ↓
             Sesión extendida 1h más
```

---

## 🔒 Seguridad

### LocalUsernameStrategy

- ✅ Valida credenciales reales (username/password)
- ✅ Puede implementar rate limiting por IP
- ✅ Puede detectar intentos de brute force
- ✅ Debería usar bcrypt para passwords
- ⚠️ Vulnerable a credential stuffing

### LocalJwtStrategy

- ✅ Sin consultas a DB (más rápido)
- ✅ Stateless (el token tiene toda la info)
- ✅ Valida firma criptográfica
- ✅ Valida expiración automáticamente
- ⚠️ No puede invalidar tokens (usa blacklist si necesitas)
- ⚠️ Si el SECRET se compromete, todos los tokens son inválidos

---

## 📊 Tabla Comparativa Completa

| Feature | LocalUsernameStrategy | LocalJwtStrategy |
|---------|----------------------|------------------|
| **Package** | `passport-local` | `passport-jwt` |
| **Base Class** | `Strategy` | `JwtStrategy` |
| **Input** | username + password | JWT token |
| **Validation** | Consulta DB | Valida firma JWT |
| **Speed** | Más lento (DB query) | Muy rápido (sin DB) |
| **Use Case** | Login inicial | Requests subsecuentes |
| **Stateful** | Sí (crea sesión) | No (stateless) |
| **Can Create JWT** | Sí (después de validar) | Sí (en /refresh) |
| **Can Validate JWT** | No | Sí |
| **Token Rotation** | N/A | Sí (con /refresh) |
| **Brute Force Risk** | Alto | Bajo |
| **Requires DB** | Sí | No |
| **Revocation** | Fácil (borra sesión) | Difícil (necesita blacklist) |

---

## 💡 Best Practices

### Para LocalUsernameStrategy

1. ✅ **Usar bcrypt** para hashear passwords
2. ✅ **Rate limiting** por IP
3. ✅ **Account lockout** después de X intentos
4. ✅ **Strong password policy**
5. ✅ **2FA** para cuentas sensibles
6. ✅ **Log** intentos de login fallidos

### Para LocalJwtStrategy

1. ✅ **Secret fuerte** (mínimo 32 chars)
2. ✅ **Tokens de corta duración** (1h)
3. ✅ **Implementar refresh** para token rotation
4. ✅ **Validar issuer y audience**
5. ✅ **HTTPS only** en producción
6. ✅ **Blacklist** para logout inmediato (opcional)

---

## 🚀 Resumen

**LocalUsernameStrategy** es para el **LOGIN INICIAL**:
- Recibe credenciales
- Valida contra DB
- Genera JWT nuevo
- Crea sesión

**LocalJwtStrategy** es para **TODO LO DEMÁS**:
- Valida JWT existente
- Protege rutas
- Renueva tokens
- Sin consultas a DB

Ambas trabajan juntas para proporcionar autenticación completa! 🎉

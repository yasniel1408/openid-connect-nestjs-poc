# 🔐 Login Modes: Session vs JWT Direct

## ✅ Dos Formas de Hacer Login

Ahora tienes **2 endpoints de login** con diferentes comportamientos:

| Aspecto | Session Login | JWT Direct Login |
|---------|--------------|------------------|
| **Endpoint** | `POST /auth/local/username` | `POST /auth/jwt/login` |
| **Controller** | `LocalAuthController` | `JwtAuthController` |
| **Response** | Redirect (302) | JSON con token |
| **Use Case** | Navegadores tradicionales | SPAs, Mobile apps, APIs |
| **Frontend** | Sigue redirects | Maneja JWT manualmente |

---

## 1️⃣ Session Login (Modo Tradicional)

### Backend Endpoint

```typescript
// LocalAuthController
POST /auth/local/username
```

### Request

```typescript
POST /auth/local/username
Content-Type: application/json

{
  "username": "axis",
  "password": "axis123"
}
```

### Response

```
302 Found
Location: http://localhost:3000
Set-Cookie: axis-session=JWT_TOKEN; HttpOnly; SameSite=lax
Set-Cookie: logged=true
Set-Cookie: user_info=base64_encoded_data
```

### Frontend Code

```typescript
const response = await fetch('/auth/local/username', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  credentials: 'include',
  body: JSON.stringify({ username, password }),
  redirect: 'manual', // Capturar redirect manualmente
});

if (response.redirected) {
  window.location.href = response.url; // Seguir redirect
}
```

### ✅ Ventajas

- ✅ Patrón tradicional bien conocido
- ✅ Cookies se establecen automáticamente
- ✅ No necesitas manejar JWT manualmente
- ✅ Funciona como form HTML estándar

### ❌ Desventajas

- ❌ Requiere manejo de redirects
- ❌ No obtienes el JWT en la respuesta
- ❌ Menos flexible para SPAs

### 🎯 Cuándo Usar

- ✅ Aplicaciones web tradicionales
- ✅ Navegadores que manejan bien redirects
- ✅ Cuando no necesitas el JWT directamente

---

## 2️⃣ JWT Direct Login (Modo API)

### Backend Endpoint

```typescript
// JwtAuthController
POST /auth/jwt/login
```

### Request

```typescript
POST /auth/jwt/login
Content-Type: application/json

{
  "username": "axis",
  "password": "axis123"
}
```

### Response

```json
{
  "success": true,
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
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

**También establece cookies** (para compatibilidad):
```
Set-Cookie: axis-session=JWT_TOKEN; HttpOnly; SameSite=lax
Set-Cookie: logged=true
Set-Cookie: user_info=base64_encoded_data
```

### Frontend Code

```typescript
const response = await fetch('/auth/jwt/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  credentials: 'include',
  body: JSON.stringify({ username, password }),
});

if (response.ok) {
  const data = await response.json();
  
  // Opción 1: Guardar en localStorage
  localStorage.setItem('jwt_token', data.accessToken);
  
  // Opción 2: Usar en memoria
  const token = data.accessToken;
  
  // Opción 3: Ya está en cookie (automático)
  // No necesitas hacer nada
  
  // Navegar a home
  router.push('/');
}
```

### ✅ Ventajas

- ✅ Respuesta JSON (más flexible)
- ✅ Obtienes el JWT en la respuesta
- ✅ Puedes guardar el token donde quieras (localStorage, memory, etc.)
- ✅ Perfecto para SPAs y mobile apps
- ✅ No requiere manejo de redirects
- ✅ También establece cookies (lo mejor de ambos mundos)

### ❌ Desventajas

- ❌ Tienes que manejar el JWT tú mismo (si quieres)
- ❌ Más código en el frontend

### 🎯 Cuándo Usar

- ✅ Single Page Applications (React, Vue, Angular)
- ✅ Mobile apps (React Native, Flutter)
- ✅ APIs que necesitan JWT en respuesta
- ✅ Cuando quieres control total del token

---

## 🔄 Comparación de Flujos

### Flujo 1: Session Login

```
Usuario → Submit form
    ↓
Frontend → POST /auth/local/username
    ↓
Backend → Valida credenciales
    ↓
Backend → Genera JWT
    ↓
Backend → Set-Cookie: axis-session=JWT
    ↓
Backend → 302 Redirect to /
    ↓
Frontend → Sigue redirect automáticamente
    ↓
✅ Usuario en home con cookie establecida
```

### Flujo 2: JWT Direct Login

```
Usuario → Submit form
    ↓
Frontend → POST /auth/jwt/login
    ↓
Backend → Valida credenciales
    ↓
Backend → Genera JWT
    ↓
Backend → Set-Cookie: axis-session=JWT
    ↓
Backend → 200 JSON {accessToken: "..."}
    ↓
Frontend → Recibe JWT en respuesta
    ↓
Frontend → Guarda JWT (opcional)
    ↓
Frontend → router.push('/')
    ↓
✅ Usuario en home con JWT + cookie
```

---

## 💻 Frontend Implementation

### Página de Login con Ambos Modos

```typescript
'use client';

import { useState } from 'react';

type LoginMode = 'session' | 'jwt';

export default function LoginPage() {
  const [loginMode, setLoginMode] = useState<LoginMode>('session');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [jwtToken, setJwtToken] = useState('');

  // Login con sesión (redirect)
  const handleSessionLogin = async (e) => {
    e.preventDefault();
    
    const response = await fetch('/auth/local/username', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ username, password }),
      redirect: 'manual',
    });

    if (response.redirected) {
      window.location.href = response.url;
    }
  };

  // Login con JWT (JSON response)
  const handleJwtLogin = async (e) => {
    e.preventDefault();
    
    const response = await fetch('/auth/jwt/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ username, password }),
    });

    if (response.ok) {
      const data = await response.json();
      setJwtToken(data.accessToken);
      
      // Guardar en localStorage (opcional)
      localStorage.setItem('jwt_token', data.accessToken);
      
      // Navegar a home
      router.push('/');
    }
  };

  const handleSubmit = loginMode === 'session' 
    ? handleSessionLogin 
    : handleJwtLogin;

  return (
    <div>
      {/* Mode Selector */}
      <div>
        <button onClick={() => setLoginMode('session')}>
          Session Mode
        </button>
        <button onClick={() => setLoginMode('jwt')}>
          JWT Mode
        </button>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit}>
        <input 
          value={username} 
          onChange={(e) => setUsername(e.target.value)} 
        />
        <input 
          type="password"
          value={password} 
          onChange={(e) => setPassword(e.target.value)} 
        />
        <button type="submit">
          Login ({loginMode === 'session' ? 'Redirect' : 'JSON'})
        </button>
      </form>

      {/* JWT Display (solo en modo JWT) */}
      {jwtToken && (
        <div>
          <strong>JWT Token recibido:</strong>
          <pre>{jwtToken}</pre>
        </div>
      )}
    </div>
  );
}
```

---

## 🔐 Usar el JWT en Requests

### Opción 1: Cookie (Automático)

El backend ya estableció la cookie, así que no necesitas hacer nada:

```typescript
// El browser envía la cookie automáticamente
fetch('/api/products', {
  credentials: 'include',
});
```

### Opción 2: Authorization Header

Si guardaste el token, úsalo en el header:

```typescript
const token = localStorage.getItem('jwt_token');

fetch('/api/products', {
  headers: {
    'Authorization': `Bearer ${token}`,
  },
});
```

### Opción 3: Ambos

El backend acepta ambos métodos (cookie o header):

```typescript
const token = localStorage.getItem('jwt_token');

fetch('/api/products', {
  headers: {
    'Authorization': `Bearer ${token}`,
  },
  credentials: 'include', // También envía cookie
});
```

---

## 📊 Diferencias Técnicas

### Session Login

**Backend (LocalAuthController):**
```typescript
@Post('local/username')
@UseGuards(AuthGuard('local'))
async loginWithUsername(@Req() req, @Res() res) {
  const user = req.user;
  
  // Guardar en sesión
  req.session.user = user;
  
  // Generar JWT
  const token = await this.getTokenByUser.execute(user, 'local');
  
  // Set cookie
  this.cookieService.setLoggedIn(res, token, 'local');
  
  // Redirect
  return res.redirect('/');
}
```

**Response:**
- Status: `302 Found`
- Headers: `Location: http://localhost:3000`
- Cookies: establecidas

### JWT Direct Login

**Backend (JwtAuthController):**
```typescript
@Post('jwt/login')
@UseGuards(AuthGuard('local'))
async login(@Req() req, @Res() res) {
  const user = req.user;
  
  // Guardar en sesión (opcional)
  req.session.user = user;
  
  // Generar JWT
  const token = await this.getTokenByUser.execute(user, 'jwt');
  
  // Set cookie (opcional, para compatibilidad)
  this.cookieService.setLoggedIn(res, token, 'jwt');
  
  // Retornar JSON
  return res.json({
    success: true,
    accessToken: token,
    tokenType: 'Bearer',
    expiresIn: 3600,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      roles: user.roles,
    },
  });
}
```

**Response:**
- Status: `200 OK`
- Body: JSON con token
- Cookies: establecidas (opcional)

---

## 🎯 Recomendaciones

### Para Aplicaciones Web Tradicionales
```
✅ Usar: Session Login (/auth/local/username)
```

### Para SPAs (React, Vue, Angular)
```
✅ Usar: JWT Direct Login (/auth/jwt/login)
```

### Para Mobile Apps
```
✅ Usar: JWT Direct Login (/auth/jwt/login)
```

### Para APIs
```
✅ Usar: JWT Direct Login (/auth/jwt/login)
```

---

## ✅ Resumen

Tienes **2 modos de login** con el mismo mecanismo de autenticación (LocalUsernameStrategy) pero diferentes respuestas:

1. **Session Login** → Redirect (tradicional, fácil)
2. **JWT Direct Login** → JSON con token (moderno, flexible)

Ambos establecen cookies HttpOnly para seguridad, pero JWT Direct también te da el token en la respuesta para mayor flexibilidad.

Elige el que mejor se adapte a tu frontend! 🚀

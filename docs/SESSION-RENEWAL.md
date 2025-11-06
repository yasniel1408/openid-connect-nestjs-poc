# 🔄 Renovación de Sesión con Ping

## 📋 Resumen

El endpoint `/auth/ping` renueva automáticamente el TTL de la sesión en Redis y la cookie del navegador sin necesidad de re-login.

## 🎯 Caso de Uso

**Problema:** Las sesiones expiran después de 1 hora (`SESSION_COOKIE_MAX_AGE=3600000`). Si el usuario está activo pero no hace requests, pierde la sesión.

**Solución:** El frontend llama a `/auth/ping` periódicamente (por ejemplo, cada 10 minutos) para mantener la sesión activa mientras el usuario está en la aplicación.

## 🔧 Cómo Funciona

### Backend

```typescript
@Get('ping')
async ping(@Req() req: Request, @Res() res: Response) {
  const session = (req as any).session;
  
  // 1. Touch resetea el TTL en Redis
  session.touch();
  
  // 2. Save persiste los cambios en Redis
  session.save((err) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to renew' });
    }
    
    // 3. Response incluye nueva fecha de expiración
    return res.json({ 
      message: 'pong',
      session: {
        renewed: true,
        expiresAt: session.cookie.expires,
      }
    });
  });
}
```

### Frontend (Next.js)

```typescript
// hooks/useSessionKeepAlive.ts
import { useEffect } from 'react';

export function useSessionKeepAlive(intervalMinutes = 10) {
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const response = await fetch('http://localhost:3001/auth/ping', {
          credentials: 'include', // ✅ Envía cookies
        });
        
        const data = await response.json();
        
        if (data.session?.renewed) {
          console.log('✅ Sesión renovada:', data.session.expiresAt);
        }
      } catch (error) {
        console.error('❌ Error renovando sesión:', error);
      }
    }, intervalMinutes * 60 * 1000);

    return () => clearInterval(interval);
  }, [intervalMinutes]);
}
```

### Uso en Componente

```typescript
// app/dashboard/page.tsx
'use client';

import { useSessionKeepAlive } from '@/hooks/useSessionKeepAlive';

export default function DashboardPage() {
  // Renueva sesión cada 10 minutos
  useSessionKeepAlive(10);
  
  return (
    <div>
      <h1>Dashboard</h1>
      {/* Tu contenido */}
    </div>
  );
}
```

## 📊 Comportamiento

### Sin Ping (Sesión Expira)

```
Login → 3:00 PM
TTL: 3600s (1 hora)
Usuario inactivo
4:00 PM → Sesión expira ❌
```

### Con Ping (Sesión Se Mantiene)

```
Login → 3:00 PM
TTL: 3600s

3:10 PM → Ping → TTL reset a 3600s
3:20 PM → Ping → TTL reset a 3600s
3:30 PM → Ping → TTL reset a 3600s
...
Usuario sigue activo → Sesión nunca expira ✅
```

## 🔍 Verificación

### 1. Verificar TTL en Redis Antes del Ping

```bash
redis-cli
> KEYS axis-session:*
1) "axis-session:abc123..."

> TTL axis-session:abc123...
2400  # Quedan 40 minutos
```

### 2. Llamar al Ping

```bash
curl http://localhost:3001/auth/ping \
  -H "Cookie: axis-session=s%3Aabc123..." \
  --verbose
```

**Response:**
```json
{
  "message": "pong",
  "session": {
    "active": true,
    "renewed": true,
    "expiresAt": "2025-11-05T14:04:53.000Z",
    "maxAge": 3600000,
    "user": {
      "email": "user@example.com"
    }
  }
}
```

### 3. Verificar TTL en Redis Después del Ping

```bash
> TTL axis-session:abc123...
3600  # ✅ Reseteado a 1 hora completa
```

## ⚙️ Configuración

### Variables de Entorno

```env
# Duración de la sesión
SESSION_COOKIE_MAX_AGE=3600000  # 1 hora en milisegundos

# Si aumentas esto, las sesiones duran más
SESSION_COOKIE_MAX_AGE=7200000  # 2 horas
SESSION_COOKIE_MAX_AGE=86400000 # 24 horas
```

### Frecuencia de Ping Recomendada

| Duración Sesión | Frecuencia Ping | Razón |
|-----------------|----------------|-------|
| 1 hora | Cada 10 min | Renueva 6 veces antes de expirar |
| 2 horas | Cada 20 min | Renueva 6 veces antes de expirar |
| 24 horas | Cada 2 horas | Suficiente para mantener activa |

**Regla:** Ping cada `SESSION_COOKIE_MAX_AGE / 6`

## 🚨 Consideraciones

### 1. No Proteger con Guards

```typescript
// ❌ MAL - Si la sesión expiró, el guard rechaza el request
@UseGuards(SessionAuthGuard)
@Get('ping')
async ping() { ... }

// ✅ BIEN - Ping funciona incluso sin sesión activa
@Get('ping')
async ping() { ... }
```

### 2. Sesión vs Access Token

- **Session TTL:** Controlado por ping
- **OAuth access_token:** Independiente, puede expirar antes

Si llamas APIs externas (Microsoft Graph), necesitas también renovar el `access_token` usando `refresh_token`.

### 3. Cleanup en Logout

El endpoint `/auth/logout` destruye la sesión:

```typescript
@Get('logout')
async logout(@Req() req: Request) {
  (req as any).session.destroy(() => {});
  // Ping ya no funcionará para esta sesión
}
```

## 📈 Monitoreo

### Logs del Backend

```
✅ [Ping] Sesión renovada: {
  sessionID: 'abc123...',
  user: 'user@example.com',
  expiresAt: '2025-11-05T14:04:53.000Z'
}
```

### Frontend DevTools

```javascript
// Console
✅ Sesión renovada: 2025-11-05T14:04:53.000Z

// Network Tab
GET /auth/ping
Status: 200 OK
Set-Cookie: axis-session=...; Max-Age=3600; ...
```

## 🎯 Resultado Final

Con esta implementación:
- ✅ Las sesiones se mantienen activas mientras el usuario usa la app
- ✅ El TTL de Redis se resetea automáticamente
- ✅ La cookie del navegador se renueva
- ✅ El usuario no necesita hacer login repetidamente
- ✅ Funciona sin necesidad de guards o autenticación

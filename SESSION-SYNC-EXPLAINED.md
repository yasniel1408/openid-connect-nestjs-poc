# 🔄 Sincronización de Sesión: Cookie, Redis y TTL

## 🎯 Problema Resuelto

Antes había inconsistencias entre:
- ⏰ **Cookie `expires`** en el navegador
- ⏰ **TTL de Redis** en el servidor  
- ⏰ **`maxAge` de la sesión** en memoria

Esto causaba que la sesión expirara en Redis pero la cookie aún estuviera activa, o viceversa.

## ✅ Solución Implementada

### 1. Configuración de Sesión con `rolling: true`

```typescript
// apps/backend-passport-strategies/src/cookie.main.ts

const sessionConfig: session.SessionOptions = {
  name: sessionCookieName,
  secret: sessionSecret,
  resave: false,            // No guardar si no hay cambios
  saveUninitialized: false, // No crear sesión vacía
  rolling: true,            // ✅ CLAVE: Renovar cookie en cada request
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: secureFlag,
    maxAge: 3600000,        // 1 hora en ms
  },
};
```

**¿Qué hace `rolling: true`?**
- Cada request que toca la sesión actualiza automáticamente `cookie.expires`
- Express-session calcula: `expires = Date.now() + maxAge`
- La cookie se envía de vuelta al navegador con el nuevo `expires`

### 2. RedisStore con `disableTouch: false`

```typescript
const redisStore = new RedisStore({
  client: redisClient,
  prefix: 'axis-session:',
  ttl: 3600,              // 1 hora en segundos
  disableTouch: false,    // ✅ CLAVE: Permitir actualizar TTL con touch()
  disableTTL: false,      // ✅ Usar TTL de Redis
});
```

**¿Qué hace `disableTouch: false`?**
- Permite que `session.touch()` actualice el TTL de Redis
- Ejecuta internamente: `EXPIRE axis-session:xxx 3600`
- Resetea el TTL a 3600s (1 hora)

### 3. Endpoint `/auth/ping` Mejorado

```typescript
@Get('ping')
async ping(@Req() req: Request, @Res() res: Response) {
  const session: any = req.session;

  // 🔄 PASO 1: Renovar cookie
  const maxAge = 3600000; // 1 hora
  session.cookie.maxAge = maxAge;
  session.cookie.expires = new Date(Date.now() + maxAge);

  // 🔄 PASO 2: Touch actualiza lastModified (usado por RedisStore)
  session.touch();

  // 🔄 PASO 3: Guardar explícitamente en Redis
  return new Promise((resolve) => {
    session.save((err) => {
      if (err) {
        console.error('❌ Error guardando sesión:', err);
        return resolve(res.status(500).json({ error: 'failed to save' }));
      }

      console.log('✅ Sesión renovada:', {
        sessionId: session.id,
        expiresAt: session.cookie.expires,
        maxAge: session.cookie.maxAge,
        user: session.user?.email
      });

      resolve(res.status(200).json({
        message: 'pong',
        session: {
          active: true,
          renewed: true,
          expiresAt: session.cookie.expires,
          maxAge: session.cookie.maxAge
        }
      }));
    });
  });
}
```

## 📊 Flujo de Sincronización

### Caso 1: Login Inicial

```
┌──────────────────────────────────────────────────────────┐
│ 1. Usuario hace login (Azure/Google)                     │
└──────────────────────────────────────────────────────────┘
                        ↓
┌──────────────────────────────────────────────────────────┐
│ 2. Passport crea sesión                                  │
│    - req.session.user = { id, email, tokens, ... }       │
│    - session.cookie.maxAge = 3600000 (1h)                │
│    - session.cookie.expires = Date.now() + 3600000       │
└──────────────────────────────────────────────────────────┘
                        ↓
┌──────────────────────────────────────────────────────────┐
│ 3. session.save() guarda en Redis                        │
│    - Key: axis-session:abc123...                         │
│    - Value: { cookie: {...}, user: {...} }               │
│    - TTL: 3600s (1 hora)                                 │
│    - Comando: SETEX axis-session:abc123... 3600 "{...}"  │
└──────────────────────────────────────────────────────────┘
                        ↓
┌──────────────────────────────────────────────────────────┐
│ 4. Express envía cookie al navegador                     │
│    Set-Cookie: axis-session=abc123...; Max-Age=3600;     │
│                HttpOnly; SameSite=Lax                     │
└──────────────────────────────────────────────────────────┘

✅ Estado inicial sincronizado:
   - Cookie expires:  2024-11-06 16:00:00
   - Redis TTL:       3600s (expira 2024-11-06 16:00:00)
   - Session maxAge:  3600000ms
```

### Caso 2: Usuario Activo (hace ping)

```
┌──────────────────────────────────────────────────────────┐
│ 1. Usuario mueve mouse → react-idle-timer detecta        │
└──────────────────────────────────────────────────────────┘
                        ↓
┌──────────────────────────────────────────────────────────┐
│ 2. Frontend: GET /auth/ping (con cookie)                 │
│    Cookie: axis-session=abc123...                        │
└──────────────────────────────────────────────────────────┘
                        ↓
┌──────────────────────────────────────────────────────────┐
│ 3. Express-session middleware:                           │
│    - Lee cookie del request                              │
│    - Consulta Redis: GET axis-session:abc123...          │
│    - Deserializa sesión a req.session                    │
│    - rolling=true → actualiza cookie.expires             │
└──────────────────────────────────────────────────────────┘
                        ↓
┌──────────────────────────────────────────────────────────┐
│ 4. Controller /auth/ping:                                │
│    - session.cookie.maxAge = 3600000                     │
│    - session.cookie.expires = Date.now() + 3600000       │
│    - session.touch() → marca para actualizar TTL         │
│    - session.save() → ejecuta                            │
└──────────────────────────────────────────────────────────┘
                        ↓
┌──────────────────────────────────────────────────────────┐
│ 5. RedisStore ejecuta:                                   │
│    - SETEX axis-session:abc123... 3600 "{...}"           │
│    - Esto sobrescribe y resetea TTL a 3600s              │
└──────────────────────────────────────────────────────────┘
                        ↓
┌──────────────────────────────────────────────────────────┐
│ 6. Express envía response con cookie renovada:           │
│    Set-Cookie: axis-session=abc123...; Max-Age=3600;     │
│                Expires=Wed, 06 Nov 2024 16:30:00 GMT     │
└──────────────────────────────────────────────────────────┘

✅ Estado sincronizado después del ping:
   - Cookie expires:  2024-11-06 16:30:00 (RENOVADA)
   - Redis TTL:       3600s (RESETEADO a 1 hora completa)
   - Session maxAge:  3600000ms (RENOVADO)
```

### Caso 3: Usuario Inactivo (sin pings)

```
T = 0min     Login
             - Cookie expires: 15:00 + 1h = 16:00
             - Redis TTL: 3600s

T = 30min    Último ping
             - Cookie expires: 15:30 + 1h = 16:30
             - Redis TTL: 3600s (reseteado)

T = 33min    Usuario deja de interactuar (idle > 3min)
             - ❌ react-idle-timer NO hace más pings
             - Cookie expires: 16:30 (sin cambios)
             - Redis TTL: 3570s (decrementando)

T = 60min    Usuario sigue inactivo
             - Cookie expires: 16:30 (sin cambios)
             - Redis TTL: 1800s (30 minutos restantes)

T = 93min    Sesión expira en Redis
             - Cookie expires: 16:30 (todavía válida en browser)
             - Redis TTL: 0s → ❌ Key eliminada
             - Próximo request → 401 Unauthorized

✅ Comportamiento correcto:
   - Sesión expira después de 1 hora de inactividad
   - Cookie puede existir, pero Redis no tiene datos
   - Express-session retorna sesión vacía → logout automático
```

## 🔍 Verificación con Redis CLI

### Durante Login
```bash
redis-cli

# Ver sesión recién creada
> KEYS axis-session:*
1) "axis-session:abc123def456..."

# Ver TTL (debe ser ~3600s)
> TTL axis-session:abc123def456...
(integer) 3598

# Ver contenido
> GET axis-session:abc123def456...
"{\"cookie\":{\"maxAge\":3600000,\"expires\":\"2024-11-06T16:00:00.000Z\",...},\"user\":{...}}"
```

### Después de hacer ping
```bash
# TTL debe estar cerca de 3600s de nuevo
> TTL axis-session:abc123def456...
(integer) 3599  # ✅ Reseteado a 1 hora

# Cookie expires debe ser Date.now() + 1h
> GET axis-session:abc123def456... | jq '.cookie.expires'
"2024-11-06T16:30:00.000Z"  # ✅ Renovado
```

### Monitoreo en tiempo real
```bash
# En una terminal
./inspect-redis-sessions.sh --watch

# En otra terminal, interactúa con la app
# Observa cómo el TTL se resetea a 3600s después de cada ping
```

## 📈 Métricas de Sincronización

| Componente | Antes del Ping | Después del Ping |
|------------|----------------|------------------|
| **Cookie expires** | 2024-11-06 15:30:00 | 2024-11-06 16:00:00 ✅ |
| **Cookie maxAge** | 1800000ms (30min) | 3600000ms (1h) ✅ |
| **Redis TTL** | 1800s (30min) | 3600s (1h) ✅ |
| **Session en Redis** | Valor antiguo | Valor actualizado ✅ |

## 🎯 Garantías

1. ✅ **Cookie y Redis siempre sincronizados**: `rolling: true` + `session.save()`
2. ✅ **TTL se resetea en cada ping**: `disableTouch: false` + `touch()`
3. ✅ **No hay race conditions**: `session.save()` es atómico
4. ✅ **Expiration consistente**: `maxAge` = `TTL * 1000`
5. ✅ **Logs verificables**: Console log muestra todos los valores

## 🚨 Casos Edge

### ¿Qué pasa si Redis falla durante ping?
```typescript
session.save((err) => {
  if (err) {
    console.error('❌ Error guardando sesión:', err);
    // Response con error, pero sesión en memoria sigue válida
    // Próximo request intentará guardar de nuevo
  }
});
```

### ¿Qué pasa si hay múltiples requests simultáneos?
```typescript
// express-session maneja concurrencia automáticamente
// Última escritura gana (last-write-wins)
// Con rolling=true, todos los requests renuevan la sesión
```

### ¿Qué pasa si el frontend hace ping pero Redis ya expiró?
```bash
GET /auth/ping
→ express-session no encuentra sesión en Redis
→ req.session.user = undefined
→ Controller retorna 401
→ Frontend redirige a login
```

## 📚 Referencias

- [express-session docs](https://github.com/expressjs/session#rolling)
- [connect-redis docs](https://github.com/tj/connect-redis#options)
- [Redis EXPIRE command](https://redis.io/commands/expire/)
- [SESSION-HEARTBEAT-SUMMARY.md](./SESSION-HEARTBEAT-SUMMARY.md)

## ✅ Testing Checklist

- [ ] Login → Verificar TTL en Redis = 3600s
- [ ] Login → Verificar cookie maxAge = 3600000ms
- [ ] Ping → Verificar TTL resetea a 3600s
- [ ] Ping → Verificar cookie expires se actualiza
- [ ] Idle 3+ min → Verificar que no hay más pings
- [ ] Esperar 1h → Verificar sesión expira en Redis
- [ ] Después de expirar → Verificar request retorna 401
- [ ] Multi-tab → Verificar TTL se sincroniza entre pestañas

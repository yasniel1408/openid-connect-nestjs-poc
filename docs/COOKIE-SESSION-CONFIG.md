# 🍪 Cookie & Session Configuration

## Descripción

Este módulo (`cookie.main.ts`) centraliza toda la configuración de cookies, sesiones, Redis y Passport en un solo lugar, manteniendo el código limpio y organizado.

## Arquitectura

```
main.ts
  └─> setupCookieSession(app, configService)
        └─> CookieSessionConfig.configure()
              ├─> cookieParser()           // Lee cookies del request
              ├─> setupRedisClient()       // Conecta a Redis
              ├─> setupSession()           // Configura express-session + RedisStore
              └─> setupPassport()          // Inicializa Passport
```

## Características

### ✅ Configuración Centralizada
Toda la lógica de cookies y sesiones en un solo archivo para fácil mantenimiento.

### ✅ Fallback Automático
Si Redis no está disponible, automáticamente cae a sesiones en memoria (con advertencia).

### ✅ Event Listeners de Redis
Monitorea el estado de la conexión de Redis:
- `connect` - Cuando se conecta por primera vez
- `ready` - Cuando está listo para recibir comandos
- `error` - Cuando hay un error
- `reconnecting` - Cuando está reconectando

### ✅ Graceful Shutdown
Maneja correctamente el cierre de la aplicación, desconectando Redis limpiamente.

### ✅ Logs Informativos
Muestra información clara sobre la configuración aplicada.

## Uso

### En main.ts:

```typescript
import { setupCookieSession } from './cookie.main.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  // Configurar cookies y sesiones
  const cookieSessionConfig = await setupCookieSession(app, configService);

  // Graceful shutdown
  process.on('SIGTERM', async () => {
    await cookieSessionConfig.disconnect();
    await app.close();
  });

  await app.listen(3001);
}
```

## Variables de Entorno

| Variable | Descripción | Valor por defecto |
|----------|-------------|-------------------|
| `REDIS_URL` | URL de conexión a Redis | `redis://localhost:6379` |
| `SESSION_SECRET` | Secret para firmar cookies | **Requerido** |
| `SESSION_COOKIE_NAME` | Nombre de la cookie de sesión | `axis-session` |
| `SESSION_COOKIE_SECURE` | HTTPS only | `false` en dev, `true` en prod |
| `SESSION_COOKIE_MAX_AGE` | Duración de la sesión en ms | `3600000` (1 hora) |
| `NODE_ENV` | Ambiente de ejecución | `development` |

## Configuración de Sesión

### Cookie Options

```typescript
{
  httpOnly: true,        // No accesible desde JavaScript
  sameSite: 'lax',       // Protección contra CSRF
  secure: false/true,    // Solo HTTPS (true en producción)
  maxAge: 3600000        // Duración en milisegundos
}
```

### Session Options

```typescript
{
  name: 'axis-session',      // Nombre de la cookie
  secret: 'your-secret',     // Para firmar la cookie
  resave: false,             // No re-guardar si no cambió
  saveUninitialized: false,  // No guardar sesiones vacías
  store: RedisStore          // Almacén de sesiones (Redis o memoria)
}
```

### Redis Store Options

```typescript
{
  client: redisClient,    // Cliente de Redis
  prefix: 'session:',     // Prefijo para las claves en Redis
  ttl: 3600               // Time-to-live en segundos
}
```

## Flujo de Sesión

### 1. Usuario hace login
```
POST /auth/local/username
  ↓
Passport valida credenciales
  ↓
req.session.user = { id, name, email, ... }
  ↓
Express-session serializa y guarda en Redis:
  session:abc123 = { user: {...} }
  ↓
Response con cookie:
  Set-Cookie: axis-session=abc123; HttpOnly; SameSite=Lax
```

### 2. Usuario hace request
```
GET /products
Cookie: axis-session=abc123
  ↓
Express-session lee cookie
  ↓
Busca en Redis: session:abc123
  ↓
Deserializa y pone en req.session
  ↓
Guard verifica req.session.user
  ↓
Response: 200 OK
```

### 3. Backend reinicia
```
Backend se detiene
  ↓
Redis sigue corriendo con las sesiones
  ↓
Backend se inicia
  ↓
Usuario hace request con la misma cookie
  ↓
Redis encuentra la sesión → ✅ Funciona
```

## Logs de Ejemplo

### Inicio exitoso con Redis:
```
✅ Redis Client Connected
✅ Redis Client Ready
📦 Redis session store configured at redis://localhost:6379
📦 Using Redis session store
🍪 Session configuration:
   - Cookie name: axis-session
   - Max age: 3600000ms (3600s)
   - Secure: false
   - SameSite: lax
   - Store: Redis
🔐 Passport initialized
✅ Cookie & Session configuration completed

═══════════════════════════════════════════════════════════
🚀 Passport backend listening on http://localhost:3001
🌐 CORS origin: http://localhost:3000
═══════════════════════════════════════════════════════════
```

### Inicio sin Redis (fallback):
```
❌ Failed to connect to Redis: Error: connect ECONNREFUSED 127.0.0.1:6379
⚠️  Falling back to in-memory sessions (not recommended for production)
⚠️  Using in-memory session store (sessions will be lost on restart)
🍪 Session configuration:
   - Cookie name: axis-session
   - Max age: 3600000ms (3600s)
   - Secure: false
   - SameSite: lax
   - Store: Memory
🔐 Passport initialized
✅ Cookie & Session configuration completed
```

## API del Módulo

### CookieSessionConfig

#### `configure(app, configService): Promise<void>`
Configura toda la infraestructura de cookies y sesiones.

#### `disconnect(): Promise<void>`
Desconecta gracefully el cliente de Redis.

#### `getRedisClient(): RedisClientType | null`
Obtiene el cliente de Redis para operaciones adicionales.

### setupCookieSession (Factory)

```typescript
const config = await setupCookieSession(app, configService);

// Acceder al cliente de Redis
const redisClient = config.getRedisClient();

// Graceful shutdown
await config.disconnect();
```

## Troubleshooting

### Redis no conecta
```
❌ Redis Client Error: Error: connect ECONNREFUSED
```
**Solución:** Inicia Redis con `docker-compose up -d`

### Sesiones no persisten después de reiniciar
**Verificar:**
1. Redis está corriendo: `docker ps | grep redis`
2. Logs muestran "Using Redis session store"
3. Variable `REDIS_URL` está configurada correctamente

### Cookie no se envía al navegador
**Verificar:**
1. CORS está configurado con `credentials: true`
2. Frontend hace requests con `credentials: 'include'`
3. Cookie `sameSite` es compatible con tu setup

## Buenas Prácticas

### Producción
```env
NODE_ENV=production
SESSION_COOKIE_SECURE=true
REDIS_URL=redis://:password@redis-host:6379
```

### Desarrollo
```env
NODE_ENV=development
SESSION_COOKIE_SECURE=false
REDIS_URL=redis://localhost:6379
```

### Secrets
- Usa un `SESSION_SECRET` fuerte (mínimo 32 caracteres)
- No compartas el secret entre ambientes
- Rota el secret periódicamente en producción

## Testing

Para testear la configuración de cookies:

```bash
# 1. Iniciar Redis
docker-compose up -d

# 2. Iniciar backend
npm run start:dev

# 3. Hacer login
curl -X POST http://localhost:3001/auth/local/username \
  -H "Content-Type: application/json" \
  -d '{"username":"axis","password":"axis123"}' \
  -c cookies.txt

# 4. Verificar sesión en Redis
docker exec -it openid-redis redis-cli KEYS "session:*"

# 5. Usar la sesión
curl http://localhost:3001/products -b cookies.txt
```

## Recursos

- [express-session docs](https://github.com/expressjs/session)
- [connect-redis docs](https://github.com/tj/connect-redis)
- [Redis client docs](https://github.com/redis/node-redis)
- [Passport docs](http://www.passportjs.org/)

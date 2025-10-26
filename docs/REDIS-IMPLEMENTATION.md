# ✅ Implementación de Redis para Sesiones Persistentes

## 🎯 Problema Resuelto

Antes: Las sesiones se guardaban en memoria. Si reiniciabas el backend, perdías todas las sesiones y las cookies dejaban de funcionar.

Ahora: Las sesiones se guardan en Redis, persistiendo entre reinicios del servidor.

## 📦 Cambios Realizados

### 1. Dependencias agregadas
- `connect-redis@7` - Store de sesiones para Redis
- `redis@4` - Cliente de Redis

### 2. Archivos creados
- `/docker-compose.yml` - Configuración de Redis en Docker
- `/REDIS-SETUP.md` - Guía completa de configuración de Redis
- `/apps/backend-passport-strategies/start-with-redis-check.sh` - Script de inicio con verificación

### 3. Archivos modificados
- `/apps/backend-passport-strategies/src/main.ts` - Integración de Redis store
- `/apps/backend-passport-strategies/.env.example` - Variable REDIS_URL agregada
- `/README.md` - Sección de inicio rápido con Redis

## 🚀 Cómo usar

### Paso 1: Levantar Redis
```bash
# Opción A: Con Docker (recomendado)
docker-compose up -d

# Opción B: Redis local
brew install redis
brew services start redis
```

### Paso 2: Configurar variables de entorno
```bash
# Si no tienes .env, créalo desde el ejemplo
cp apps/backend-passport-strategies/.env.example apps/backend-passport-strategies/.env
```

Asegúrate de tener en tu `.env`:
```env
REDIS_URL=redis://localhost:6379
```

### Paso 3: Iniciar el backend
```bash
npm run backend2:dev

# O con el script de verificación
./apps/backend-passport-strategies/start-with-redis-check.sh
```

## ✅ Verificar que funciona

### 1. Verifica la conexión en los logs del backend
Deberías ver:
```
Redis Client Connected
Passport backend listening on http://localhost:3001
Redis session store configured at redis://localhost:6379
```

### 2. Haz login en la aplicación
- Ve a http://localhost:3000 (frontend)
- Haz login con cualquier estrategia (username, email, Azure, Google, etc.)

### 3. Verifica que la sesión se guardó en Redis
```bash
docker exec -it openid-redis redis-cli KEYS "session:*"
```

Deberías ver algo como:
```
1) "session:abc123def456..."
```

### 4. Reinicia el backend
```bash
# Detén el backend (Ctrl+C)
# Inícialo de nuevo
npm run backend2:dev
```

### 5. Verifica que la cookie sigue funcionando
- Ve a http://localhost:3000
- **NO deberías necesitar hacer login de nuevo**
- La sesión debe seguir activa

## 🔧 Comandos útiles de Redis

```bash
# Ver todas las sesiones
docker exec -it openid-redis redis-cli KEYS "session:*"

# Contar sesiones activas
docker exec -it openid-redis redis-cli DBSIZE

# Ver contenido de una sesión
docker exec -it openid-redis redis-cli GET "session:SESSION_ID"

# Limpiar todas las sesiones
docker exec -it openid-redis redis-cli FLUSHDB

# Ver información del servidor
docker exec -it openid-redis redis-cli INFO

# Detener Redis
docker-compose down
```

## 🐛 Troubleshooting

### Error: Cannot connect to Redis
El backend intentará conectarse a Redis. Si Redis no está disponible, verás un error:
```
Redis Client Error [Error: connect ECONNREFUSED 127.0.0.1:6379]
```

**Solución:** Inicia Redis con `docker-compose up -d`

### Error: Docker daemon not running
```
Cannot connect to the Docker daemon
```

**Solución:** 
- macOS: Inicia Docker Desktop
- Linux: `sudo systemctl start docker`

### Las sesiones no persisten
1. Verifica que Redis esté corriendo: `docker ps | grep redis`
2. Verifica la conexión en los logs del backend
3. Verifica que las sesiones se guarden: `docker exec -it openid-redis redis-cli KEYS "session:*"`

## 📚 Documentación adicional

Para más detalles, consulta:
- `/REDIS-SETUP.md` - Guía completa de Redis
- `/README.md` - Guía general del proyecto

## 🎉 Beneficios

- ✅ Sesiones persistentes entre reinicios
- ✅ Cookies funcionan después de reiniciar el backend
- ✅ Escalabilidad horizontal (múltiples instancias del backend)
- ✅ TTL automático de sesiones
- ✅ Mejor rendimiento que sesiones en base de datos
- ✅ Fácil monitoreo y debugging de sesiones

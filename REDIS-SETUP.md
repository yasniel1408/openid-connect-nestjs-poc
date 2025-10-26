# 🔴 Configuración de Redis para Sesiones Persistentes

## ¿Por qué Redis?

Antes las sesiones se guardaban en memoria, por lo que:
- ❌ Al reiniciar el backend, perdías todas las sesiones
- ❌ Las cookies dejaban de funcionar
- ❌ Los usuarios tenían que volver a hacer login

Con Redis:
- ✅ Las sesiones persisten entre reinicios
- ✅ Las cookies siguen funcionando
- ✅ Puedes escalar horizontalmente con múltiples backends
- ✅ TTL automático de sesiones

## Opción 1: Docker Compose (Recomendado)

### Iniciar Redis
```bash
docker-compose up -d
```

### Verificar que está corriendo
```bash
docker ps | grep redis
# o
docker logs openid-redis
```

### Detener Redis
```bash
docker-compose down
```

### Limpiar datos y reiniciar
```bash
docker-compose down -v
docker-compose up -d
```

## Opción 2: Redis local (sin Docker)

### macOS (Homebrew)
```bash
brew install redis
brew services start redis
```

### Ubuntu/Debian
```bash
sudo apt-get update
sudo apt-get install redis-server
sudo systemctl start redis-server
```

### Verificar conexión
```bash
redis-cli ping
# Debe responder: PONG
```

## Configuración del Backend

Asegúrate de tener en tu archivo `.env`:
```bash
REDIS_URL=redis://localhost:6379
```

Si Redis está en otro host o puerto:
```bash
REDIS_URL=redis://usuario:password@host:puerto
```

## Comandos útiles de Redis

### Ver todas las sesiones activas
```bash
docker exec -it openid-redis redis-cli KEYS "session:*"
# o sin docker:
redis-cli KEYS "session:*"
```

### Ver contenido de una sesión específica
```bash
docker exec -it openid-redis redis-cli GET "session:abc123..."
```

### Contar sesiones activas
```bash
docker exec -it openid-redis redis-cli DBSIZE
```

### Limpiar todas las sesiones
```bash
docker exec -it openid-redis redis-cli FLUSHDB
```

### Ver información del servidor Redis
```bash
docker exec -it openid-redis redis-cli INFO
```

### Ver tiempo de vida de una sesión
```bash
docker exec -it openid-redis redis-cli TTL "session:abc123..."
```

## Troubleshooting

### Error: Cannot connect to Redis
1. Verifica que Redis esté corriendo:
   ```bash
   docker ps | grep redis
   ```

2. Verifica la URL en tu `.env`:
   ```bash
   REDIS_URL=redis://localhost:6379
   ```

3. Si usas Docker, verifica que el puerto 6379 esté libre:
   ```bash
   lsof -i :6379
   ```

### Error: Docker daemon not running
1. Inicia Docker Desktop (macOS/Windows)
2. O instala y configura Docker en Linux

### Error: Session not persisting
1. Verifica que el backend se conectó a Redis:
   - Deberías ver en los logs: `Redis Client Connected`

2. Verifica que las sesiones se están guardando:
   ```bash
   redis-cli KEYS "session:*"
   ```

## Migración de sesiones en memoria a Redis

Si ya tenías usuarios logueados con sesiones en memoria:
1. Todos los usuarios perderán su sesión al cambiar a Redis
2. Deberán hacer login nuevamente
3. Después de eso, sus sesiones persistirán entre reinicios

## Producción

Para producción considera:
- Usar Redis con persistencia configurada (AOF + RDB)
- Configurar password para Redis
- Usar Redis Cluster para alta disponibilidad
- Ajustar el TTL según tus necesidades de negocio
- Monitorear el uso de memoria de Redis

Ejemplo de configuración segura:
```bash
REDIS_URL=redis://:tu-password-seguro@redis-host:6379
```

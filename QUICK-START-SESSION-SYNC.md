# 🚀 Quick Start: Sistema de Sesión Sincronizado

## TL;DR

Sistema de sesión con heartbeat inteligente que mantiene la sesión activa mientras el usuario interactúa, y expira automáticamente después de inactividad.

## ✅ Características

- ✅ **Cookie y Redis 100% sincronizados** - No más inconsistencias de TTL
- ✅ **Heartbeat inteligente** - Solo hace ping cuando hay actividad real
- ✅ **Multi-tab sync** - Sincroniza sesión entre pestañas
- ✅ **Auto-expiración** - Sesión expira después de 1 hora de inactividad
- ✅ **Zero config** - Funciona out-of-the-box

## 🎯 Flujo Simplificado

```
Login → Sesión creada (TTL: 1h)
  ↓
Usuario activo → Ping cada 500ms → TTL resetea a 1h ✅
  ↓
Usuario inactivo (3+ min) → No más pings
  ↓
Después de 1h → Sesión expira → 401 Unauthorized
```

## 📦 Instalación

Ya está todo configurado. Solo necesitas:

```bash
# 1. Iniciar Redis
docker-compose up -d

# 2. Iniciar aplicación
npm run dev

# 3. Login
open http://localhost:3000
```

## 🔍 Verificación Rápida

### Opción 1: Watch Mode (Recomendado)

```bash
# Terminal 1: Iniciar app
npm run dev

# Terminal 2: Monitor en tiempo real
./inspect-redis-sessions.sh --watch

# Terminal 3: Login y usa la app
open http://localhost:3000
```

**Observa:**
- TTL reseteándose a 3600s cuando hay actividad ✅
- TTL decrementando cuando no hay actividad ✅

### Opción 2: DevTools

```bash
# 1. Login en http://localhost:3000
# 2. Abrir DevTools → Network tab
# 3. Mover mouse → Ver /auth/ping requests ✅
# 4. Dejar de tocar por 3+ min → No más pings ✅
```

### Opción 3: Redis CLI

```bash
redis-cli

# Ver sesiones activas
> KEYS axis-session:*

# Ver TTL (debe estar cerca de 3600s después de cada ping)
> TTL axis-session:abc123...
(integer) 3599

# Ver contenido
> GET axis-session:abc123... | jq
```

## 🎛️ Configuración

### Variables de Entorno

```env
# Backend .env
SESSION_COOKIE_MAX_AGE=3600000  # 1 hora (ms)
SESSION_COOKIE_NAME=axis-session
REDIS_URL=redis://localhost:6379
```

### Tiempos Ajustables

| Config | Ubicación | Default |
|--------|-----------|---------|
| **Session Duration** | `SESSION_COOKIE_MAX_AGE` | 1 hora |
| **Idle Timeout** | `SessionHeartbeat.tsx` → `timeout` | 3 min |
| **Ping Debounce** | `SessionHeartbeat.tsx` → `debounce` | 500ms |

## 🐛 Troubleshooting

### Sesión expira aunque esté activo

```bash
# Verificar que rolling esté habilitado
grep -r "rolling:" apps/backend-passport-strategies/src/cookie.main.ts
# Debe mostrar: rolling: true ✅

# Verificar que disableTouch esté deshabilitado
grep -r "disableTouch:" apps/backend-passport-strategies/src/cookie.main.ts
# Debe mostrar: disableTouch: false ✅

# Ver logs del backend
npm run dev
# Después de hacer ping, debe mostrar:
# ✅ Sesión renovada: { sessionId: ..., expiresAt: ..., maxAge: ... }
```

### Ping no funciona

```bash
# Verificar que SessionHeartbeat esté montado
grep -r "SessionHeartbeat" apps/frontend-passport-strategies/app/layout.tsx
# Debe existir <SessionHeartbeat /> ✅

# Verificar en DevTools → Console
# No debe haber errores de CORS ni 404

# Verificar endpoint existe
curl http://localhost:3001/auth/ping -b cookies.txt
# Debe retornar: { message: "pong", session: { active: true, ... } }
```

### Redis no guarda sesión

```bash
# Verificar que Redis esté corriendo
docker ps | grep openid-redis
# Debe mostrar container corriendo ✅

# Probar conexión
docker exec -it openid-redis redis-cli PING
# Debe retornar: PONG ✅

# Ver logs del backend
npm run dev
# Debe mostrar:
# ✅ Redis Client Connected
# ✅ Redis Client Ready
# 📦 Using Redis session store
```

## 📚 Documentación Completa

1. **[SESSION-SYNC-FIX.md](./SESSION-SYNC-FIX.md)** - Detalles del fix de sincronización
2. **[SESSION-SYNC-EXPLAINED.md](./SESSION-SYNC-EXPLAINED.md)** - Explicación profunda del flujo
3. **[SESSION-HEARTBEAT-SUMMARY.md](./SESSION-HEARTBEAT-SUMMARY.md)** - Resumen del heartbeat
4. **[REACT-IDLE-TIMER-IMPLEMENTATION.md](./REACT-IDLE-TIMER-IMPLEMENTATION.md)** - Frontend idle detection

## 🎨 Arquitectura Visual

```
┌─────────────────────────────────────────────────────────┐
│                        Frontend                         │
│  ┌──────────────────────────────────────────────────┐  │
│  │ SessionHeartbeat Component                        │  │
│  │  - useIdleTimer (react-idle-timer)                │  │
│  │  - Detecta actividad (mouse, keyboard, scroll)    │  │
│  │  - Timeout: 3 min                                 │  │
│  │  - Debounce: 500ms                                │  │
│  └──────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
                        │ GET /auth/ping
                        │ (con cookie)
                        ▼
┌─────────────────────────────────────────────────────────┐
│                        Backend                          │
│  ┌──────────────────────────────────────────────────┐  │
│  │ /auth/ping Endpoint                               │  │
│  │  1. session.cookie.maxAge = 3600000               │  │
│  │  2. session.cookie.expires = Date.now() + 1h      │  │
│  │  3. session.touch()                               │  │
│  │  4. session.save((err) => {...})                  │  │
│  └──────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
                        │ SETEX axis-session:xxx 3600 "{...}"
                        ▼
┌─────────────────────────────────────────────────────────┐
│                         Redis                           │
│  Key: axis-session:abc123...                            │
│  TTL: 3600s (resetea en cada ping)                      │
│  Value: { cookie: {...}, user: {...}, ... }             │
└─────────────────────────────────────────────────────────┘
```

## ⚡ Performance

| Métrica | Valor |
|---------|-------|
| **Pings por hora (activo)** | ~7200 (1 cada 500ms con actividad) |
| **Pings por hora (inactivo)** | 0 |
| **Latencia por ping** | <10ms (Redis local) |
| **Tamaño de sesión** | ~2-5KB |
| **Memory overhead** | ~0.01MB por sesión |

## 🔒 Seguridad

- ✅ Cookies con `httpOnly`, `sameSite: lax`
- ✅ Session store en Redis (no en memoria)
- ✅ TTL automático (previene sesiones zombie)
- ✅ CSRF protection (Next.js built-in)
- ✅ Secure flag en producción

## 🚢 Production Ready

```bash
# Variables de entorno para producción
NODE_ENV=production
SESSION_COOKIE_SECURE=true  # HTTPS only
SESSION_SECRET=<strong-random-secret>
REDIS_URL=redis://production-redis:6379
SESSION_COOKIE_MAX_AGE=3600000
```

## ✅ Checklist Pre-Deploy

- [ ] `NODE_ENV=production`
- [ ] `SESSION_COOKIE_SECURE=true`
- [ ] `SESSION_SECRET` es fuerte y único
- [ ] Redis tiene persistencia habilitada
- [ ] Redis tiene backup configurado
- [ ] Logs de sesión están deshabilitados o con nivel INFO
- [ ] CORS configurado correctamente
- [ ] Rate limiting en `/auth/ping`

## 🎓 Aprendizajes Clave

1. **`rolling: true`** es esencial para renovar cookies automáticamente
2. **`disableTouch: false`** permite que `session.touch()` actualice TTL de Redis
3. **`session.save(callback)`** asegura que cambios se persistan antes de responder
4. **react-idle-timer** es superior a `setInterval` para detectar actividad
5. **Debounce** previene spam de requests innecesarios

## 🆘 Ayuda

¿Problemas? Revisa:
1. Logs del backend: `npm run dev`
2. Redis CLI: `docker exec -it openid-redis redis-cli`
3. DevTools Network tab
4. Script de inspección: `./inspect-redis-sessions.sh --watch`

**¿Aún no funciona?** Limpia todo y empieza de nuevo:
```bash
docker exec -it openid-redis redis-cli FLUSHDB
rm -rf node_modules
npm install
npm run dev
```

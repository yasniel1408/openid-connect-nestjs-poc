# 🔄 Implementación de react-idle-timer para Session Heartbeat

## 📋 Resumen

Implementación de `react-idle-timer` para mantener la sesión activa automáticamente cuando el usuario interactúa con la aplicación.

## 🎯 Ventajas vs setInterval Simple

| Característica | setInterval | react-idle-timer |
|----------------|-------------|------------------|
| **Hace ping cuando inactivo** | ❌ Sí (desperdicia recursos) | ✅ No |
| **Hace ping en background** | ❌ Sí | ✅ No |
| **Sincroniza entre pestañas** | ❌ No | ✅ Sí |
| **Detecta actividad real** | ❌ No | ✅ Sí (mouse, teclado, scroll, touch) |
| **Debounce integrado** | ❌ No | ✅ Sí |
| **UX apropiada** | ⚠️ Regular | ✅ Excelente |

## 🏗️ Arquitectura

```
┌─────────────────────────────────────────────┐
│ app/layout.tsx (Server Component)           │
│                                             │
│  ┌────────────────────────────────────────┐ │
│  │ ClientProviders (Client Component)     │ │
│  │                                        │ │
│  │  ┌──────────────────────────────────┐ │ │
│  │  │ SessionHeartbeat               │ │ │
│  │  │                                 │ │ │
│  │  │  useIdleTimer({                │ │ │
│  │  │    timeout: 3min,              │ │ │
│  │  │    onAction: () => ping()      │ │ │
│  │  │  })                            │ │ │
│  │  └──────────────────────────────────┘ │ │
│  │                                        │ │
│  │  {children} ← Páginas de la app       │ │
│  └────────────────────────────────────────┘ │
└─────────────────────────────────────────────┘
```

## 📁 Estructura de Archivos

```
apps/frontend-passport-strategies/
├── app/
│   ├── components/
│   │   ├── SessionHeartbeat.tsx    ← Hook de idle timer
│   │   └── ClientProviders.tsx     ← Wrapper para client components
│   └── layout.tsx                  ← Layout principal (importa ClientProviders)
```

## 🔧 Implementación

### 1. SessionHeartbeat.tsx

```typescript
'use client';

import { useIdleTimer } from 'react-idle-timer';

export function SessionHeartbeat() {
  const onAction = () => {
    fetch('http://localhost:3001/auth/ping', {
      method: 'GET',
      credentials: 'include',
      keepalive: true,
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.session?.renewed) {
          console.log('✅ [Heartbeat] Sesión renovada');
        }
      })
      .catch((error) => {
        console.error('❌ [Heartbeat] Error:', error);
      });
  };

  useIdleTimer({
    timeout: 1000 * 60 * 3, // 3 minutos sin actividad
    onAction,               // Ejecuta en cada acción del usuario
    debounce: 500,          // Espera 500ms entre eventos
    crossTab: true,         // Sincroniza entre pestañas
  });

  return null;
}
```

### 2. ClientProviders.tsx

```typescript
'use client';

import { SessionHeartbeat } from './SessionHeartbeat';

export function ClientProviders({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SessionHeartbeat />
      {children}
    </>
  );
}
```

### 3. layout.tsx

```typescript
import { ClientProviders } from './components/ClientProviders';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>
        <ClientProviders>
          {/* Tu UI aquí */}
          {children}
        </ClientProviders>
      </body>
    </html>
  );
}
```

## ⚙️ Configuración

### Parámetros del useIdleTimer

```typescript
useIdleTimer({
  // ⏱️ Timeout de inactividad
  timeout: 1000 * 60 * 3,  // 3 minutos
  
  // 🎯 Callback cuando hay actividad
  onAction,                 // Se ejecuta en cada acción del usuario
  
  // ⏸️ Debounce: espera entre eventos consecutivos
  debounce: 500,           // 500ms - evita spam de requests
  
  // 🔄 Sincronización entre pestañas
  crossTab: true,          // Coordina entre tabs del navegador
  
  // ⚡ Throttle de eventos DOM (performance)
  eventsThrottle: 200,     // 200ms entre eventos de DOM
  
  // 🎮 Eventos que detecta (por defecto todos)
  events: [
    'mousemove',
    'keydown',
    'wheel',
    'DOMMouseScroll',
    'mousedown',
    'touchstart',
    'touchmove',
    'MSPointerDown',
    'MSPointerMove',
    'visibilitychange'
  ]
});
```

### Ajustar Según Duración de Sesión

| Duración Sesión | Timeout Idle Timer | Comportamiento |
|-----------------|-------------------|----------------|
| 1 hora | 3-5 minutos | Ping cada 3-5 min si hay actividad |
| 2 horas | 5-10 minutos | Ping cada 5-10 min si hay actividad |
| 24 horas | 15-30 minutos | Ping cada 15-30 min si hay actividad |

**Regla:** `timeout = SESSION_COOKIE_MAX_AGE / 20`

## 📊 Comportamiento

### Escenario 1: Usuario Activo

```
Login → 3:00 PM

3:01 PM → Usuario mueve mouse
  └─ debounce 500ms → Ping → Sesión renovada ✅

3:02 PM → Usuario escribe
  └─ debounce 500ms → Ping → Sesión renovada ✅

3:05 PM → Usuario scrollea
  └─ debounce 500ms → Ping → Sesión renovada ✅

... Usuario sigue activo → Sesión NUNCA expira ✅
```

### Escenario 2: Usuario Inactivo

```
Login → 3:00 PM
TTL: 3600s (1 hora)

3:00 PM - 3:03 PM → Usuario activo
  └─ Pings cada acción → Sesión renovada ✅

3:03 PM → Usuario deja la computadora (va al baño)

3:04 PM → No hay actividad
3:05 PM → No hay actividad
3:06 PM → No hay actividad (3 min sin actividad)
  └─ ⚠️ Timer considera al usuario IDLE
  └─ ❌ NO hace más pings

4:00 PM → Sesión expira (1 hora desde último ping) ✅

Usuario regresa → Debe hacer login de nuevo
```

### Escenario 3: Múltiples Pestañas

```
Pestaña 1: Dashboard
Pestaña 2: Productos

Usuario activo en Pestaña 1:
  └─ Ping desde Pestaña 1 ✅
  └─ crossTab: true → Pestaña 2 también se beneficia ✅

Usuario cambia a Pestaña 2:
  └─ Ping desde Pestaña 2 ✅
  └─ Ambas pestañas mantienen sesión sincronizada ✅
```

## 🔍 Debugging

### 1. Ver Pings en Console

```javascript
// En DevTools Console
[Heartbeat] Sesión renovada: {
  expiresAt: "3:45:00 PM",
  user: "user@example.com"
}
```

### 2. Ver Requests en Network Tab

```
GET /auth/ping
Status: 200 OK
Timing: 
  - Request: Cada vez que hay actividad (debounced)
  - Gap máximo: 3 minutos sin actividad
```

### 3. Verificar Redis

```bash
redis-cli
> KEYS axis-session:*
1) "axis-session:abc123..."

> TTL axis-session:abc123...
3600  # Se resetea con cada ping
```

### 4. Forzar Idle State (Testing)

```typescript
const { getRemainingTime, isIdle } = useIdleTimer({ ... });

// En console
console.log('Tiempo restante:', getRemainingTime() / 1000, 'segundos');
console.log('¿Está idle?:', isIdle());
```

## 🚨 Consideraciones

### 1. keepalive: true

```typescript
fetch('/auth/ping', {
  keepalive: true  // ✅ Request sobrevive si se cierra la pestaña
})
```

Sin `keepalive`, si el usuario cierra la pestaña durante un ping, el request se cancela.

### 2. Sincronización crossTab

`crossTab: true` usa **LocalStorage** para sincronizar entre pestañas:

- ✅ Si usuario está activo en cualquier pestaña → Todas se benefician
- ✅ Solo una pestaña hace el ping (evita duplicados)
- ⚠️ Requiere mismo origin (same domain)

### 3. No Proteger /auth/ping con Guards

```typescript
// ❌ MAL - Guard bloquearía pings cuando sesión está por expirar
@UseGuards(SessionAuthGuard)
@Get('ping')
async ping() { ... }

// ✅ BIEN - Ping funciona siempre
@Get('ping')
async ping() { ... }
```

### 4. Performance

`react-idle-timer` es **muy eficiente**:

- Solo escucha eventos DOM nativos
- Usa passive event listeners
- Debounce/throttle integrados
- No impacta rendering

## 📈 Monitoreo de Producción

### Agregar Analytics (Opcional)

```typescript
const onAction = () => {
  fetch('/auth/ping', { ... })
    .then(() => {
      // Track successful heartbeat
      analytics.track('session_renewed');
    })
    .catch((error) => {
      // Track errors
      analytics.track('session_renewal_failed', { error });
    });
};
```

### Agregar Callback onIdle

```typescript
useIdleTimer({
  timeout: 1000 * 60 * 3,
  onAction,
  onIdle: () => {
    // Usuario lleva 3 minutos sin actividad
    console.warn('⚠️ Usuario inactivo, sesión expirará pronto');
    // Opcional: Mostrar modal de advertencia
  },
});
```

## ✅ Testing

### Test Manual

1. **Login** en la aplicación
2. **Abrir DevTools** → Console y Network
3. **Mover el mouse** → Debería ver ping en Network
4. **Esperar 1 segundo y mover de nuevo** → No debería hacer ping (debounce)
5. **Esperar 3+ minutos sin tocar nada** → No debería hacer pings
6. **Mover el mouse de nuevo** → Ping se reactiva

### Test con Redis

```bash
# Terminal 1: Watch Redis TTL
watch -n 1 'redis-cli TTL axis-session:$(redis-cli KEYS "axis-session:*" | head -1 | cut -d: -f2-)'

# Terminal 2: Interactúa con la app
# Observa cómo el TTL se resetea con cada ping
```

## 🎯 Resultado Final

Con esta implementación:

- ✅ Sesión se mantiene activa mientras usuario usa la app
- ✅ Sesión expira si usuario realmente está inactivo (3+ min)
- ✅ No desperdicia recursos en background o con usuario ausente
- ✅ Sincronización perfecta entre múltiples pestañas
- ✅ UX óptima: balance entre seguridad y conveniencia
- ✅ Performance excelente (no impacta la app)

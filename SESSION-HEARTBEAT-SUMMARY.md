# ✅ Session Heartbeat - Resumen de Implementación

## �� Objetivo

Mantener la sesión activa automáticamente mientras el usuario interactúa con la aplicación, sin desperdiciar recursos cuando está inactivo.

## 📦 Tecnologías

- **Backend:** NestJS + Redis + express-session
- **Frontend:** Next.js 14 + react-idle-timer
- **Session Store:** Redis con TTL automático

## 🏗️ Componentes

### Backend: Endpoint `/auth/ping`

```typescript
// apps/backend-passport-strategies/src/auth/controllers/common-auth.controller.ts

@Get('ping')
async ping(@Req() req: Request, @Res() res: Response) {
  const session = (req as any).session;
  
  session.touch();  // ✅ Resetea TTL en Redis
  
  session.save((err: any) => {
    res.json({ 
      message: 'pong',
      session: {
        renewed: true,
        expiresAt: session.cookie.expires,
      }
    });
  });
}
```

**Características:**
- No requiere autenticación (funciona siempre)
- Resetea TTL de Redis
- Renueva cookie del navegador
- Retorna info de sesión

### Frontend: SessionHeartbeat Component

```typescript
// apps/frontend-passport-strategies/app/components/SessionHeartbeat.tsx

export function SessionHeartbeat() {
  const onAction = () => {
    fetch('http://localhost:3001/auth/ping', {
      method: 'GET',
      credentials: 'include',
      keepalive: true,
    });
  };

  useIdleTimer({
    timeout: 1000 * 60 * 3,  // 3 min sin actividad
    onAction,                 // Ejecuta en cada acción
    debounce: 500,           // Evita spam
    crossTab: true,          // Sincroniza pestañas
  });

  return null;
}
```

**Características:**
- Detecta actividad real del usuario (mouse, teclado, scroll)
- Debounce de 500ms entre eventos
- Solo hace ping si hay actividad
- Sincroniza entre múltiples pestañas
- No impacta performance

## 📊 Flujo Completo

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Login                                                     │
│    - Usuario se autentica (Azure/Google/Local)              │
│    - Redis crea sesión con TTL 3600s (1 hora)               │
│    - Cookie: axis-session=abc123 Max-Age=3600               │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. Usuario Activo                                           │
│    - Mueve mouse, escribe, scrollea                         │
│    - react-idle-timer detecta actividad                     │
│    - Debounce 500ms → hace ping                             │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. Backend Renueva Sesión                                   │
│    - session.touch() → Redis TTL reset a 3600s              │
│    - session.save() → Cookie renovada                       │
│    - Response: { renewed: true, expiresAt: ... }            │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. Loop mientras usuario activo                             │
│    - Cada acción → Ping (debounced)                         │
│    - TTL siempre en 3600s                                   │
│    - Sesión NUNCA expira ✅                                 │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│ 5. Usuario Inactivo (3+ minutos)                            │
│    - Timer detecta idle                                     │
│    - NO hace más pings ❌                                   │
│    - TTL de Redis empieza a decrementar                     │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│ 6. Sesión Expira (después de 1 hora desde último ping)      │
│    - Redis elimina sesión (TTL = 0)                         │
│    - Próximo request → 401 Unauthorized                     │
│    - Usuario debe hacer login de nuevo                      │
└─────────────────────────────────────────────────────────────┘
```

## ⚙️ Configuración

### Variables de Entorno

```env
# Backend (.env)
SESSION_COOKIE_MAX_AGE=3600000  # 1 hora en ms
REDIS_URL=redis://localhost:6379
SESSION_COOKIE_NAME=axis-session
```

### Parámetros Ajustables

| Parámetro | Valor Actual | Descripción |
|-----------|-------------|-------------|
| **Session Duration** | 1 hora (3600s) | Duración total de sesión |
| **Idle Timeout** | 3 minutos | Tiempo sin actividad para considerar idle |
| **Debounce** | 500ms | Tiempo entre pings consecutivos |
| **CrossTab** | Habilitado | Sincroniza entre pestañas |

## 🔍 Testing

### 1. Test de Actividad

```bash
# Login en la app
# Abrir DevTools → Network tab
# Mover mouse → Ver ping en Network
```

**Esperado:**
- ✅ Ping después de 500ms de última actividad
- ✅ No pings si no hay actividad
- ✅ Response 200 OK con session.renewed = true

### 2. Test de Inactividad

```bash
# Login en la app
# No tocar nada por 3+ minutos
# Ver Network tab
```

**Esperado:**
- ❌ No hay pings después de 3 min sin actividad
- ✅ Console log: "Usuario inactivo" (si implementado onIdle)

### 3. Test de Redis

```bash
# Terminal 1: Login en la app
redis-cli
> KEYS axis-session:*
> TTL axis-session:abc123...
3600  # 1 hora

# Terminal 2: Mueve mouse en la app

# Terminal 1: Check TTL de nuevo
> TTL axis-session:abc123...
3600  # ✅ Reseteado a 1 hora completa
```

### 4. Test Multi-Tab

```bash
# Abrir 2 pestañas de la app
# Actividad en Pestaña 1 → Ver ping
# Cambiar a Pestaña 2 sin actividad → Sesión sigue activa
# Actividad en Pestaña 2 → Ver ping
```

**Esperado:**
- ✅ Ambas pestañas mantienen sesión sincronizada
- ✅ Solo una hace el ping (no duplicados)

## 📈 Métricas de Éxito

| Métrica | Antes | Después |
|---------|-------|---------|
| **Pings innecesarios** | ∞ (cada 10 min) | 0 (solo con actividad) |
| **UX (sesión expira)** | ❌ Siempre después de 1h | ✅ Solo si inactivo |
| **Recursos CPU** | ⚠️ Alto (timers en background) | ✅ Bajo (event-driven) |
| **Sincronización tabs** | ❌ No | ✅ Sí |
| **Seguridad** | ⚠️ Regular | ✅ Buena (expira con inactividad) |

## 🎯 Ventajas de Esta Implementación

1. **Eficiencia:** No hace pings si el usuario no está activo
2. **UX:** Sesión se mantiene mientras el usuario usa la app
3. **Seguridad:** Sesión expira si el usuario se va
4. **Performance:** No impacta rendering ni recursos
5. **Multi-tab:** Sincronización perfecta entre pestañas
6. **Simple:** Componente drop-in sin configuración compleja

## 🚀 Próximos Pasos (Opcional)

### 1. Modal de Advertencia

```typescript
useIdleTimer({
  onIdle: () => {
    // Mostrar modal: "Tu sesión expirará en X minutos"
  },
});
```

### 2. Renovación de OAuth Tokens

Si llamas APIs externas (Microsoft Graph), agregar middleware para renovar `access_token` cuando expire usando `refresh_token`.

### 3. Analytics

```typescript
const onAction = () => {
  fetch('/auth/ping', { ... })
    .then(() => analytics.track('session_renewed'));
};
```

## 📚 Documentación Adicional

- [SESSION-RENEWAL.md](./SESSION-RENEWAL.md) - Detalles del endpoint /auth/ping
- [REACT-IDLE-TIMER-IMPLEMENTATION.md](./REACT-IDLE-TIMER-IMPLEMENTATION.md) - Guía completa de react-idle-timer
- [react-idle-timer docs](https://github.com/SupremeTechnopriest/react-idle-timer) - Documentación oficial

## ✅ Checklist de Implementación

- [x] Instalar `react-idle-timer` en frontend
- [x] Crear componente `SessionHeartbeat`
- [x] Crear wrapper `ClientProviders`
- [x] Integrar en `layout.tsx`
- [x] Implementar endpoint `/auth/ping` con `session.touch()`
- [x] Configurar debounce (500ms)
- [x] Habilitar crossTab
- [x] Testing manual
- [x] Testing con Redis
- [x] Documentación

**Estado: ✅ COMPLETO**

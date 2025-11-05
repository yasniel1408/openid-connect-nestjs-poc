'use client';

import { useIdleTimer } from 'react-idle-timer';

/**
 * SessionHeartbeat Component
 * 
 * Mantiene la sesión activa automáticamente mientras el usuario interactúa con la app.
 * 
 * Características:
 * - ✅ Solo hace ping cuando hay actividad del usuario (mouse, teclado, scroll, touch)
 * - ✅ Debounce de 500ms para evitar spam de requests
 * - ✅ Sincronización entre pestañas (crossTab)
 * - ✅ Timeout de 3 minutos: si no hay actividad en 3 min, deja de hacer ping
 * 
 * Ventajas vs setInterval:
 * - No hace ping si el usuario está inactivo
 * - No hace ping si la pestaña está en background
 * - Más eficiente en recursos
 * - Mejor UX: la sesión expira si el usuario realmente está inactivo
 */
export function SessionHeartbeat() {
  const onAction = () => {
    // Solo se ejecuta cuando hay actividad del usuario
    fetch('http://localhost:3001/auth/ping', {
      method: 'GET',
      credentials: 'include', // ✅ Envía cookies
      keepalive: true,        // ✅ Request sobrevive si se cierra la pestaña
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.session?.renewed) {
          console.log('✅ [Heartbeat] Sesión renovada:', {
            expiresAt: new Date(data.session.expiresAt).toLocaleTimeString(),
            user: data.session.user?.email,
          });
        }
      })
      .catch((error) => {
        console.error('❌ [Heartbeat] Error renovando sesión:', error);
      });
  };

  useIdleTimer({
    timeout: 1000 * 60 * 3, // 3 minutos sin actividad
    onAction,               // Ejecuta cuando el usuario hace algo
    debounce: 500,          // Espera 500ms entre eventos para evitar spam
    crossTab: true,         // Sincroniza entre pestañas del navegador
    throttle: 0,            // No throttle adicional (ya tenemos debounce)
    eventsThrottle: 200,    // Throttle de eventos de DOM (performance)
  });

  // Este componente no renderiza nada
  return null;
}

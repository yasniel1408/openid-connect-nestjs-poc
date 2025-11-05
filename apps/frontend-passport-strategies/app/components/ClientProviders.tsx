'use client';

import { SessionHeartbeat } from './SessionHeartbeat';

/**
 * ClientProviders
 * 
 * Wrapper para componentes client-side que deben estar activos en toda la app.
 * Se usa en el layout (server component) para inicializar funcionalidades del cliente.
 */
export function ClientProviders({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* SessionHeartbeat mantiene la sesión activa */}
      <SessionHeartbeat />
      
      {/* Aquí puedes agregar más providers/componentes client-side globales */}
      {children}
    </>
  );
}

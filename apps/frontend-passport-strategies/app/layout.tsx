import { cookies } from 'next/headers';
import { decodeUserInfo, getApiBase } from './lib/config';

export const metadata = { title: 'Passport Strategies Frontend' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const c = cookies();
  const logged = c.get('logged')?.value === 'true';
  const info = decodeUserInfo(c.get('user_info')?.value);
  const apiBase = getApiBase();

  return (
    <html lang="es">
      <body style={{ fontFamily: 'system-ui', margin: 0 }}>
        <div style={{ background: '#f4f6f8', borderBottom: '1px solid #e3e7ea', padding: '8px 12px', fontSize: 14 }}>
          {logged ? (
            <>
              <span>Hola, {info?.name || 'usuario'}</span>
              <span style={{ margin: '0 8px' }}>•</span>
              <a href={`${apiBase}/auth/logout`}>Logout</a>
            </>
          ) : (
            <>
              <span>No autenticado</span>
            </>
          )}
        </div>
        {children}
      </body>
    </html>
  );
}

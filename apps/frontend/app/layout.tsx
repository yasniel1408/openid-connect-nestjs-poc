import { cookies } from 'next/headers';

export const metadata = { title: 'Demo OIDC + Productos' };

function decodeUserInfo(value?: string) {
  try {
    if (!value) return undefined;
    const json = Buffer.from(value.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
    return JSON.parse(json);
  } catch {
    return undefined;
  }
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const c = cookies();
  const logged = c.get('logged')?.value === 'true';
  const info = decodeUserInfo(c.get('user_info')?.value);
  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001';

  return (
    <html lang="es">
      <body style={{ fontFamily: 'system-ui', margin: 0 }}>
        <div style={{ background: '#f4f6f8', borderBottom: '1px solid #e3e7ea', padding: '8px 12px', fontSize: 14 }}>
          {logged ? (
            <>
              <span>Hola, {info?.name || 'usuario'}</span>
              <span style={{ margin: '0 8px' }}>•</span>
              <a href={`${apiBase}/auth/azure/logout`}>Logout</a>
            </>
          ) : (
            <>
              <span>No autenticado</span>
              <span style={{ margin: '0 8px' }}>•</span>
              <a href={`${apiBase}/auth/azure/login`}>Login</a>
            </>
          )}
        </div>
        {children}
      </body>
    </html>
  );
}


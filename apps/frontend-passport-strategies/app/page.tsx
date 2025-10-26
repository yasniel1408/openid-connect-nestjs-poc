import Link from 'next/link';
import { cookies } from 'next/headers';
import { decodeUserInfo } from './lib/config';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001';

export default function Home() {
  const c = cookies();
  const info = decodeUserInfo(c.get('user_info')?.value);
  const isLoggedIn = c.get('logged')?.value === 'true';

  return (
    <main style={{ maxWidth: 720, margin: '2rem auto', padding: '0 1rem' }}>
      <h1>Frontend Passport Strategies</h1>
      
      {/* User Info */}
      {isLoggedIn && info ? (
        <div style={styles.userCard}>
          <p style={styles.greeting}>👋 Hola, <strong>{info.name || 'Usuario'}</strong></p>
          <p style={styles.detail}>📧 {info.email || 'No email'}</p>
          <p style={styles.detail}>🏢 Provider: {info.identityProvider || 'local'}</p>
          {info.roles && info.roles.length > 0 && (
            <p style={styles.detail}>🔑 Roles: {info.roles.join(', ')}</p>
          )}
          <a
            href={`${API_BASE}/auth/logout`}
            style={styles.logoutButton}
          >
            🚪 Logout
          </a>
        </div>
      ) : (
        <div style={styles.notLoggedIn}>
          <p>No estás autenticado</p>
          <Link href="/login" style={styles.loginButton}>
            🔐 Ir a Login
          </Link>
        </div>
      )}

      <p style={{ marginTop: '2rem' }}>
        Demo de login con múltiples estrategias y vista de productos protegida.
      </p>

      <nav style={{ margin: '16px 0', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
        <Link href="/login" style={styles.navLink}>🔐 Login</Link>
        <Link href="/products" style={styles.navLink}>📦 Productos</Link>
        <Link href="/auth/human" style={styles.navLink}>👤 Auth Humanos</Link>
        <Link href="/auth/system" style={styles.navLink}>🤖 Auth Sistemas</Link>
      </nav>

      {/* Info Section */}
      <div style={styles.infoSection}>
        <h2 style={{ fontSize: '1.25rem', marginBottom: '1rem' }}>📚 Estrategias Implementadas</h2>
        <ul style={{ lineHeight: '1.8' }}>
          <li><strong>Local Username:</strong> Login con usuario y contraseña</li>
          <li><strong>Local JWT:</strong> Autenticación con tokens JWT en cookies</li>
          <li><strong>Azure AD (OIDC PKCE):</strong> Login con Microsoft</li>
          <li><strong>Google (OIDC PKCE):</strong> Login con Google</li>
        </ul>
      </div>

      {/* Quick Start */}
      <div style={styles.quickStart}>
        <h3 style={{ fontSize: '1rem', marginBottom: '0.5rem' }}>🚀 Quick Start</h3>
        <ol style={{ lineHeight: '1.8', paddingLeft: '1.5rem' }}>
          <li>Haz click en "Login"</li>
          <li>Prueba con: <code style={styles.code}>axis</code> / <code style={styles.code}>axis123</code></li>
          <li>O usa Azure/Google OAuth</li>
          <li>Luego visita la página de Productos</li>
        </ol>
      </div>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  userCard: {
    padding: '1.5rem',
    backgroundColor: '#f0f9ff',
    border: '1px solid #0070f3',
    borderRadius: '8px',
    marginTop: '1rem',
  },
  greeting: {
    fontSize: '1.25rem',
    margin: '0 0 0.5rem 0',
  },
  detail: {
    margin: '0.25rem 0',
    color: '#555',
  },
  logoutButton: {
    display: 'inline-block',
    marginTop: '1rem',
    padding: '0.5rem 1rem',
    backgroundColor: '#dc2626',
    color: 'white',
    borderRadius: '4px',
    textDecoration: 'none',
    fontSize: '0.875rem',
    fontWeight: '500',
  },
  notLoggedIn: {
    padding: '1.5rem',
    backgroundColor: '#fef2f2',
    border: '1px solid #fca5a5',
    borderRadius: '8px',
    marginTop: '1rem',
  },
  loginButton: {
    display: 'inline-block',
    marginTop: '1rem',
    padding: '0.5rem 1rem',
    backgroundColor: '#0070f3',
    color: 'white',
    borderRadius: '4px',
    textDecoration: 'none',
    fontSize: '0.875rem',
    fontWeight: '500',
  },
  navLink: {
    padding: '0.5rem 1rem',
    backgroundColor: '#f3f4f6',
    borderRadius: '4px',
    textDecoration: 'none',
    color: '#111',
    fontSize: '0.875rem',
    border: '1px solid #d1d5db',
  },
  infoSection: {
    marginTop: '2rem',
    padding: '1.5rem',
    backgroundColor: '#f9fafb',
    borderRadius: '8px',
    border: '1px solid #e5e7eb',
  },
  quickStart: {
    marginTop: '1.5rem',
    padding: '1rem',
    backgroundColor: '#fef3c7',
    borderRadius: '8px',
    border: '1px solid #fbbf24',
  },
  code: {
    padding: '0.125rem 0.375rem',
    backgroundColor: '#e5e7eb',
    borderRadius: '3px',
    fontFamily: 'monospace',
    fontSize: '0.875rem',
  },
};

'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001';

type LoginMode = 'session' | 'jwt';

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('axis');
  const [password, setPassword] = useState('axis123');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [loginMode, setLoginMode] = useState<LoginMode>('session');
  const [jwtToken, setJwtToken] = useState('');

  // Login con sesión (redirect)
  const handleSessionLogin = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch(`${API_BASE}/auth/local/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ username, password }),
        redirect: 'manual',
      });

      if (response.type === 'opaqueredirect' || response.status === 0) {
        window.location.href = '/';
        return;
      }

      if (response.redirected) {
        window.location.href = response.url;
        return;
      }

      if (response.ok) {
        router.push('/');
        router.refresh();
      } else {
        setError('Credenciales inválidas');
      }
    } catch (err) {
      console.error('Login error:', err);
      setError('Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  // Login con JWT (respuesta JSON)
  const handleJwtLogin = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setJwtToken('');

    try {
      const response = await fetch(`${API_BASE}/auth/jwt/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ username, password }),
      });

      if (response.ok) {
        const data = await response.json();
        setJwtToken(data.accessToken);

        // Opcional: guardar token en localStorage
        // localStorage.setItem('jwt_token', data.accessToken);

        // También puedes redirigir si quieres
        setTimeout(() => {
          router.push('/');
          router.refresh();
        }, 2000);
      } else {
        setError('Credenciales inválidas');
      }
    } catch (err) {
      console.error('Login error:', err);
      setError('Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  const handleOAuthLogin = (provider: 'azure' | 'google') => {
    window.location.href = `${API_BASE}/auth/${provider}/login`;
  };

  const handleSubmit = loginMode === 'session' ? handleSessionLogin : handleJwtLogin;

  return (
    <main style={{ maxWidth: 500, margin: '4rem auto', padding: '0 1rem' }}>
      <h1 style={{ marginBottom: '2rem', textAlign: 'center' }}>🔐 Login</h1>

      {/* Mode Selector */}
      <div style={styles.modeSelector}>
        <button
          type="button"
          onClick={() => setLoginMode('session')}
          style={{
            ...styles.modeButton,
            ...(loginMode === 'session' ? styles.modeButtonActive : {}),
          }}
        >
          🍪 Session + Cookie
        </button>
        <button
          type="button"
          onClick={() => setLoginMode('jwt')}
          style={{
            ...styles.modeButton,
            ...(loginMode === 'jwt' ? styles.modeButtonActive : {}),
          }}
        >
          🔑 JWT Direct
        </button>
      </div>

      {/* Explanation */}
      <div style={styles.explanation}>
        {loginMode === 'session' ? (
          <p style={{ margin: 0, fontSize: '0.875rem' }}>
            <strong>Modo Sesión:</strong> Login tradicional con redirect y cookies.
            El backend redirige al frontend después del login.
            <br />
            Endpoint: <code style={styles.code}>POST /auth/local/login</code>
          </p>
        ) : (
          <p style={{ margin: 0, fontSize: '0.875rem' }}>
            <strong>Modo JWT:</strong> Login API-style que retorna el JWT en la respuesta JSON.
            Ideal para SPAs, mobile apps y APIs.
            <br />
            Endpoint: <code style={styles.code}>POST /auth/jwt/login</code>
          </p>
        )}
      </div>

      {/* Local Login Form */}
      <form onSubmit={handleSubmit} style={styles.form}>
        <h2 style={styles.sectionTitle}>Login con Usuario</h2>

        <div style={styles.inputGroup}>
          <label htmlFor="username" style={styles.label}>
            Username
          </label>
          <input
            id="username"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="axis"
            required
            style={styles.input}
          />
        </div>

        <div style={styles.inputGroup}>
          <label htmlFor="password" style={styles.label}>
            Password
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="axis123"
            required
            style={styles.input}
          />
        </div>

        {error && (
          <div style={styles.error}>
            ❌ {error}
          </div>
        )}

        {jwtToken && (
          <div style={styles.success}>
            <strong>✅ Login exitoso!</strong>
            <p style={{ fontSize: '0.75rem', marginTop: '0.5rem' }}>Token JWT recibido:</p>
            <pre style={styles.tokenDisplay}>
              {jwtToken.substring(0, 50)}...
            </pre>
            <p style={{ fontSize: '0.75rem', marginTop: '0.5rem' }}>
              Token guardado en cookie y disponible en respuesta.
            </p>
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          style={{
            ...styles.button,
            ...(loading ? styles.buttonDisabled : {}),
          }}
        >
          {loading ? 'Iniciando sesión...' : `Login (${loginMode === 'session' ? 'Redirect' : 'JSON'})`}
        </button>

        <div style={styles.hint}>
          💡 Usuario de prueba: <strong>axis</strong> / <strong>axis123</strong>
        </div>
      </form>

      {/* OAuth Providers */}
      <div style={styles.divider}>
        <span>O continúa con</span>
      </div>

      <div style={styles.oauthButtons}>
        <button
          onClick={() => handleOAuthLogin('azure')}
          style={{ ...styles.button, ...styles.azureButton }}
        >
          <span style={styles.buttonIcon}>🔷</span>
          Login con Azure AD
        </button>

        <button
          onClick={() => handleOAuthLogin('google')}
          style={{ ...styles.button, ...styles.googleButton }}
        >
          <span style={styles.buttonIcon}>🔴</span>
          Login con Google
        </button>
      </div>

      {/* Info */}
      <div style={styles.info}>
        <p style={{ margin: '0.5rem 0', fontSize: '0.875rem' }}>
          <strong>Estrategias disponibles:</strong>
        </p>
        <ul style={{ margin: '0.5rem 0', paddingLeft: '1.5rem', fontSize: '0.875rem' }}>
          <li>Local (username/password)</li>
          <li>Azure AD (OIDC PKCE)</li>
          <li>Google (OIDC PKCE)</li>
        </ul>
      </div>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  modeSelector: {
    display: 'flex',
    gap: '0.5rem',
    marginBottom: '1rem',
    padding: '0.5rem',
    backgroundColor: '#f9f9f9',
    borderRadius: '8px',
    border: '1px solid #ddd',
  },
  modeButton: {
    flex: 1,
    padding: '0.75rem',
    border: '2px solid #ddd',
    borderRadius: '6px',
    backgroundColor: 'white',
    cursor: 'pointer',
    fontSize: '0.875rem',
    fontWeight: '500',
    transition: 'all 0.2s',
  },
  modeButtonActive: {
    borderColor: '#0070f3',
    backgroundColor: '#e6f2ff',
    color: '#0070f3',
  },
  explanation: {
    padding: '1rem',
    backgroundColor: '#fffbea',
    borderRadius: '6px',
    border: '1px solid #fbbf24',
    marginBottom: '1rem',
  },
  code: {
    padding: '0.125rem 0.375rem',
    backgroundColor: '#f3f4f6',
    borderRadius: '3px',
    fontFamily: 'monospace',
    fontSize: '0.75rem',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
    padding: '1.5rem',
    border: '1px solid #ddd',
    borderRadius: '8px',
    backgroundColor: '#f9f9f9',
  },
  sectionTitle: {
    fontSize: '1.25rem',
    marginBottom: '0.5rem',
    color: '#333',
  },
  inputGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
  },
  label: {
    fontSize: '0.875rem',
    fontWeight: '500',
    color: '#555',
  },
  input: {
    padding: '0.75rem',
    border: '1px solid #ccc',
    borderRadius: '4px',
    fontSize: '1rem',
  },
  button: {
    padding: '0.75rem 1.5rem',
    border: 'none',
    borderRadius: '4px',
    fontSize: '1rem',
    fontWeight: '500',
    cursor: 'pointer',
    backgroundColor: '#0070f3',
    color: 'white',
    transition: 'background-color 0.2s',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.5rem',
  },
  buttonDisabled: {
    backgroundColor: '#ccc',
    cursor: 'not-allowed',
  },
  error: {
    padding: '0.75rem',
    backgroundColor: '#fee',
    color: '#c00',
    borderRadius: '4px',
    fontSize: '0.875rem',
  },
  success: {
    padding: '0.75rem',
    backgroundColor: '#e6ffe6',
    color: '#006600',
    borderRadius: '4px',
    fontSize: '0.875rem',
    border: '1px solid #00cc00',
  },
  tokenDisplay: {
    margin: '0.5rem 0',
    padding: '0.5rem',
    backgroundColor: '#f3f4f6',
    borderRadius: '4px',
    fontSize: '0.7rem',
    fontFamily: 'monospace',
    wordBreak: 'break-all',
    overflow: 'hidden',
  },
  hint: {
    fontSize: '0.75rem',
    color: '#666',
    textAlign: 'center',
    marginTop: '0.5rem',
  },
  divider: {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
    margin: '2rem 0',
    color: '#666',
    fontSize: '0.875rem',
  },
  oauthButtons: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
  },
  azureButton: {
    backgroundColor: '#0078d4',
  },
  googleButton: {
    backgroundColor: '#4285f4',
  },
  buttonIcon: {
    fontSize: '1.25rem',
  },
  info: {
    marginTop: '2rem',
    padding: '1rem',
    backgroundColor: '#f0f0f0',
    borderRadius: '4px',
    border: '1px solid #ddd',
  },
};

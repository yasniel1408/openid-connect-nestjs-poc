import { getApiBase } from '../../lib/config';

export default function HumanAuthPage() {
  const apiBase = getApiBase();
  return (
    <main style={{ maxWidth: 800, margin: '2rem auto' }}>
      <h1>Auth Humanos</h1>
      <section>
        <h2>OIDC</h2>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <a href={`${apiBase}/auth/azure/login`} style={{ padding: '8px 12px', background: '#111', color: '#fff' }}>Login Entra ID</a>
          <a href={`${apiBase}/auth/google/login`} style={{ padding: '8px 12px', background: '#0b5', color: '#fff' }}>Login Google</a>
        </div>
      </section>
      <section style={{ marginTop: 24 }}>
        <h2>Local</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <form method="post" action={`${apiBase}/auth/local/username`} style={{ display: 'grid', gap: 8 }}>
            <strong>Usuario/Password</strong>
            <input name="username" placeholder="usuario (axis)" defaultValue="axis" />
            <input type="password" name="password" placeholder="password (axis123)" defaultValue="axis123" />
            <button type="submit" style={{ padding: '8px 12px' }}>Login</button>
          </form>
          <form method="post" action={`${apiBase}/auth/local/email`} style={{ display: 'grid', gap: 8 }}>
            <strong>Email/Password</strong>
            <input name="email" placeholder="email (user@demo.com)" defaultValue="user@demo.com" />
            <input type="password" name="password" placeholder="password (demo123)" defaultValue="demo123" />
            <button type="submit" style={{ padding: '8px 12px' }}>Login</button>
          </form>
          <form method="post" action={`${apiBase}/auth/human/code`} style={{ display: 'grid', gap: 8 }}>
            <strong>Código/Password</strong>
            <input name="code" placeholder="cédula/código (12345678)" defaultValue="12345678" />
            <input type="password" name="password" placeholder="password (codepass)" defaultValue="codepass" />
            <button type="submit" style={{ padding: '8px 12px' }}>Login</button>
          </form>
        </div>
      </section>
      <section style={{ marginTop: 24 }}>
        <a href="/">Volver</a>
      </section>
    </main>
  );
}

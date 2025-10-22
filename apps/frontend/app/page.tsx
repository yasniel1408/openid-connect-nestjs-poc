import Link from 'next/link';
import { cookies } from 'next/headers';
const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001';

export default async function Home() {
  const c = cookies();
  const u = c.get('user_info')?.value;
  let name: string | undefined;
  try {
    if (u) {
      const json = JSON.parse(Buffer.from(u.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'));
      name = json?.name;
    }
  } catch {}
  return (
    <main style={{ maxWidth: 640, margin: '2rem auto' }}>
      <h1>Demo OIDC PKCE + Productos</h1>
      {name ? <p>Hola, {name}</p> : null}
      <nav style={{ margin: '16px 0' }}>
        <Link href="/auth/human" style={{ marginRight: 16 }}>Auth Humanos</Link>
        <Link href="/auth/system">Auth Sistemas</Link>
      </nav>
      <p>Login via backend (openid-client + sesiones).</p>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <a href={`${apiBase}/auth/azure/login`} style={{ padding: '8px 12px', background: '#111', color: '#fff' }}>Login con Entra ID</a>
        <a href={`${apiBase}/auth/google/login`} style={{ padding: '8px 12px', background: '#0b5', color: '#fff' }}>Login con Google</a>
        <a href={`${apiBase}/auth/azure/logout`} style={{ padding: '8px 12px', background: '#c00', color: '#fff' }}>Logout</a>
        <a href={`${apiBase}/auth/me`} style={{ padding: '8px 12px', background: '#666', color: '#fff' }}>Ver sesión (JSON)</a>
      </div>
      <div style={{ marginTop: 12 }}>
        <a href={`${apiBase}/products`} style={{ marginRight: 12 }}>Productos (JSON)</a>
        <Link href="/products">Productos (web)</Link>
      </div>
    </main>
  );
}

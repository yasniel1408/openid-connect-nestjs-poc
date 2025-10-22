const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001';

export default function HumanAuthPage() {
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
        <a href="/">Volver</a>
      </section>
    </main>
  );
}

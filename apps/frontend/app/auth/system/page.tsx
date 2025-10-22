import { BearerTester } from '../../components/BearerTester';
const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001';

export default function SystemAuthPage() {
  return (
    <main style={{ maxWidth: 800, margin: '2rem auto' }}>
      <h1>Auth Sistemas</h1>
      <BearerTester />
      <section style={{ marginTop: 24 }}>
        <p>Para probar API Key/HMAC o CCE utiliza el frontend Passport (npm run dev2).</p>
        <a href="/">Volver</a>
      </section>
    </main>
  );
}

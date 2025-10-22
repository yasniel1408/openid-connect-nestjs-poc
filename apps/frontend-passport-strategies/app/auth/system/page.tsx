import { CceTester } from '../../components/CceTester';

export default function SystemAuthPage() {
  return (
    <main style={{ maxWidth: 800, margin: '2rem auto' }}>
      <h1>Auth Sistemas</h1>

      <CceTester />

      <section style={{ marginTop: 24 }}>
        <a href="/">Volver</a>
      </section>
    </main>
  );
}

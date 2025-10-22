import Link from 'next/link';
import { cookies } from 'next/headers';
import { decodeUserInfo } from './lib/config';

export default function Home() {
  const c = cookies();
  const info = decodeUserInfo(c.get('user_info')?.value);
  return (
    <main style={{ maxWidth: 720, margin: '2rem auto' }}>
      <h1>Frontend Passport Strategies</h1>
      {info?.name ? <p>Hola, {info.name}</p> : null}
      <p>Demo de login con múltiples estrategias y vista de productos protegida.</p>

      <nav style={{ margin: '16px 0' }}>
        <Link href="/auth/human" style={{ marginRight: 16 }}>Auth Humanos</Link>
        <Link href="/auth/system">Auth Sistemas</Link>
      </nav>
    </main>
  );
}

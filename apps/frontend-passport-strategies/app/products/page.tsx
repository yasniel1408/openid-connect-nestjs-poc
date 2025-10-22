import { cookies } from 'next/headers';
import { getApiBase } from '../lib/config';

type Product = { id: string; name: string; price: number; currency: string };

export default async function ProductsPage() {
  const apiBase = getApiBase();
  const c = cookies();
  const cookieHeader = c.getAll().map((x) => `${x.name}=${encodeURIComponent(x.value)}`).join('; ');
  let products: Product[] = [];
  let error: string | undefined;
  try {
    const res = await fetch(`${apiBase}/products`, {
      headers: cookieHeader ? { Cookie: cookieHeader, Accept: 'application/json' } : { Accept: 'application/json' },
      cache: 'no-store',
    });
    if (!res.ok) error = `Error ${res.status}`;
    else products = await res.json();
  } catch (e: any) {
    error = e?.message || 'Network error';
  }

  return (
    <main style={{ maxWidth: 720, margin: '2rem auto' }}>
      <h1>Productos</h1>
      {error ? (
        <>
          <p style={{ color: 'red' }}>{error}</p>
          <p>
            Intenta iniciar sesión primero (top navega):
          </p>
          <ul>
            <li><a href={`${apiBase}/auth/azure/login`}>Login Entra ID</a></li>
            <li><a href={`${apiBase}/auth/google/login`}>Login Google</a></li>
          </ul>
        </>
      ) : (
        <ul>
          {products.map((p) => (
            <li key={p.id}>
              <strong>{p.name}</strong> — {p.price} {p.currency}
            </li>
          ))}
        </ul>
      )}
      <p style={{ marginTop: 24 }}>
        <a href="/">Volver</a>
      </p>
    </main>
  );
}

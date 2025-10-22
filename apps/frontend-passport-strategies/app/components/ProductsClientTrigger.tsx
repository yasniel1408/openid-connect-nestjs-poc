"use client";

import { useState } from 'react';
import { getApiBase } from '../lib/config';

type Product = { id: string; name: string; price: number; currency: string };

type Props = {
  cookieHeader: string;
};

export default function ProductsClientTrigger({ cookieHeader }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [products, setProducts] = useState<Product[] | null>(null);
  const apiBase = getApiBase();

  const handleFetch = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${apiBase}/products`, {
        headers: cookieHeader ? { Cookie: cookieHeader, Accept: 'application/json' } : { Accept: 'application/json' },
        credentials: 'include',
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`(${res.status}) ${text}`);
      }
      const data = (await res.json()) as Product[];
      setProducts(data);
    } catch (err: any) {
      setError(err?.message || 'Error desconocido');
      setProducts(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <button onClick={handleFetch} style={{ width: 'fit-content', padding: '8px 12px' }} disabled={loading}>
        {loading ? 'Consultando…' : 'Cargar productos'}
      </button>
      {error ? <p style={{ color: 'red' }}>{error}</p> : null}
      {products ? (
        products.length ? (
          <ul>
            {products.map((p) => (
              <li key={p.id}>
                <strong>{p.name}</strong> — {p.price} {p.currency}
              </li>
            ))}
          </ul>
        ) : (
          <p>No hay productos disponibles.</p>
        )
      ) : null}
    </div>
  );
}

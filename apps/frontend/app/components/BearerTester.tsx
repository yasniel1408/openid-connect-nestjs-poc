"use client";
import { useState } from 'react';

const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001';

export function BearerTester() {
  const [token, setToken] = useState('');

  return (
    <section>
      <h2>Bearer JWT</h2>
      <p>Envía Authorization: Bearer al backend base para acceder a /products</p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          fetch(`${apiBase}/products`, {
            headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
            credentials: 'include',
          })
            .then(async (r) => ({ status: r.status, text: await r.text() }))
            .then((d) => alert(`Status ${d.status}: ${d.text}`))
            .catch((err) => alert(String(err)));
        }}
        style={{ display: 'grid', gap: 8 }}
      >
        <input name="token" placeholder="pega el JWT aquí" value={token} onChange={(e) => setToken(e.target.value)} />
        <button type="submit" style={{ padding: '8px 12px' }}>Probar /products</button>
      </form>
    </section>
  );
}


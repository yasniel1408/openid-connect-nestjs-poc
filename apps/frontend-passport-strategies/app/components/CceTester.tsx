"use client";
import { useState } from 'react';
import { getApiBase } from '../lib/config';

export function CceTester() {
  const apiBase = getApiBase();
  const [result, setResult] = useState('');
  const [scope, setScope] = useState('https://graph.microsoft.com/.default');
  const [lastToken, setLastToken] = useState<string | undefined>(undefined);

  const handleRequestToken = async () => {
    setResult('');
    try {
      const res = await fetch(`${apiBase}/auth/system/cc/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scope }),
        credentials: 'include',
      });
      const data = await res.json().catch(() => ({}));
      if (data?.token) setLastToken(data.token as string);
      setResult(JSON.stringify({ status: res.status, body: data }, null, 2));
    } catch (err: any) {
      setResult(`Error solicitando token: ${err?.message || 'fallo desconocido'}`);
    }
  };

  const handleUseToken = async () => {
    setResult('');
    if (!lastToken) {
      setResult('No hay access_token');
      return;
    }
    try {
      const res = await fetch(`${apiBase}/products`, {
        headers: { Authorization: `Bearer ${lastToken}`, Accept: 'application/json' },
        credentials: 'include',
      });
      const text = await res.text();
      setResult(JSON.stringify({ status: res.status, response: text }, null, 2));
    } catch (err: any) {
      setResult(`Error usando token: ${err?.message || 'fallo desconocido'}`);
    }
  };

  return (
    <section style={{ marginTop: 24 }}>
      <h2>CCE (Custom)</h2>

      <div style={{ borderTop: '1px solid #eee', marginTop: 16, paddingTop: 12 }}>
        <h3>Generar token (Client Credentials)</h3>
        <p>Usa variables del backend (tenant/client/secret de Entra ID). Scope por defecto Graph.</p>
        <label>
          scope
          <input value={scope} onChange={(e) => setScope(e.target.value)} style={{ display: 'block', width: '100%', marginTop: 8 }} />
        </label>
        <button onClick={handleRequestToken} style={{ marginTop: 8, padding: '8px 12px' }}>
          Solicitar token
        </button>

        <div style={{ marginTop: 8, display: 'grid', gap: 8 }}>
          <label>
            access_token
            <input value={lastToken || ''} onChange={(e) => setLastToken(e.target.value)} placeholder="access_token" style={{ display: 'block', width: '100%', marginTop: 8 }} />
          </label>
          <button onClick={handleUseToken} style={{ padding: '8px 12px' }}>
            Usar token en /products
          </button>
        </div>

        {result ? (
          <pre style={{ background: '#f7f7f7', padding: 12, marginTop: 16, overflowX: 'auto' }}>{result}</pre>
        ) : null}
      </div>
    </section>
  );
}

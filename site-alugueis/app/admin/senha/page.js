'use client';

import { useState } from 'react';
import AdminShell from '@/components/AdminShell';
import { getSupabase } from '@/lib/supabase';

function ChangePassword() {
  const [a, setA] = useState('');
  const [b, setB] = useState('');
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    if (a.length < 8) return setMsg({ t: 'err', m: 'Use pelo menos 8 caracteres.' });
    if (a !== b) return setMsg({ t: 'err', m: 'As duas senhas não são iguais.' });
    setBusy(true);
    const { error } = await getSupabase().auth.updateUser({ password: a });
    setBusy(false);
    if (error) setMsg({ t: 'err', m: 'Não foi possível trocar: ' + error.message });
    else {
      setMsg({ t: 'ok', m: 'Senha trocada! Use a nova senha no próximo login.' });
      setA('');
      setB('');
    }
  }

  return (
    <form onSubmit={submit} className="card pad stack" style={{ maxWidth: 440 }}>
      <h1 style={{ fontSize: '1.5rem' }}>Trocar senha</h1>
      <label className="f">Nova senha
        <input type="password" autoComplete="new-password" value={a} onChange={(e) => setA(e.target.value)} />
      </label>
      <label className="f">Repita a nova senha
        <input type="password" autoComplete="new-password" value={b} onChange={(e) => setB(e.target.value)} />
      </label>
      {msg && <div className={`alert ${msg.t}`}>{msg.m}</div>}
      <button className="btn" disabled={busy}>{busy ? 'Salvando…' : 'Salvar nova senha'}</button>
    </form>
  );
}

export default function Page() {
  return (
    <AdminShell>
      <ChangePassword />
    </AdminShell>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabase } from '@/lib/supabase';
import { BRAND } from '@/lib/constants';

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [info, setInfo] = useState('');
  const [busy, setBusy] = useState(false);
  const [recovery, setRecovery] = useState(false);
  const [newPass, setNewPass] = useState('');

  useEffect(() => {
    const sb = getSupabase();
    const isRecovery = window.location.hash.includes('type=recovery');
    if (isRecovery) setRecovery(true);
    const { data: sub } = sb.auth.onAuthStateChange((evt) => {
      if (evt === 'PASSWORD_RECOVERY') setRecovery(true);
    });
    sb.auth.getSession().then(({ data }) => {
      if (data.session && !isRecovery) router.replace('/admin');
    });
    return () => sub.subscription.unsubscribe();
  }, [router]);

  async function saveNewPassword(e) {
    e.preventDefault();
    setErr('');
    if (newPass.length < 8) {
      setErr('Use pelo menos 8 caracteres.');
      return;
    }
    const { error } = await getSupabase().auth.updateUser({ password: newPass });
    if (error) setErr('Não foi possível trocar a senha. Peça um novo link.');
    else router.replace('/admin');
  }

  async function submit(e) {
    e.preventDefault();
    setErr('');
    setBusy(true);
    const { error } = await getSupabase().auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (error) setErr('E-mail ou senha incorretos.');
    else router.replace('/admin');
  }

  async function forgot() {
    setErr('');
    if (!email.trim()) {
      setErr('Digite seu e-mail acima e clique de novo em "Esqueci a senha".');
      return;
    }
    const { error } = await getSupabase().auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/admin/login`,
    });
    if (error) setErr('Não foi possível enviar o e-mail agora.');
    else setInfo('Enviamos um link para redefinir a senha no seu e-mail.');
  }

  if (recovery)
    return (
      <div className="center-screen" style={{ background: 'var(--ocean)', minHeight: '100vh' }}>
        <form onSubmit={saveNewPassword} className="card pad stack" style={{ width: '100%', maxWidth: 400 }}>
          <h1 style={{ fontSize: '1.4rem' }}>Criar nova senha</h1>
          <label className="f">Nova senha
            <input type="password" autoComplete="new-password" value={newPass} onChange={(e) => setNewPass(e.target.value)} required />
          </label>
          {err && <div className="alert err">{err}</div>}
          <button className="btn block">Salvar nova senha</button>
        </form>
      </div>
    );

  return (
    <div className="center-screen" style={{ background: 'var(--ocean)', minHeight: '100vh' }}>
      <form onSubmit={submit} className="card pad stack" style={{ width: '100%', maxWidth: 400 }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', marginBottom: 2 }}>Painel administrativo</h1>
          <span className="muted small">{BRAND.name} • Aluguel de temporada</span>
        </div>
        <label className="f">E-mail
          <input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label className="f">Senha
          <input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </label>
        {err && <div className="alert err">{err}</div>}
        {info && <div className="alert ok">{info}</div>}
        <button className="btn block" disabled={busy}>{busy ? 'Entrando…' : 'Entrar'}</button>
        <button type="button" className="btn ghost small" onClick={forgot}>Esqueci a senha</button>
      </form>
    </div>
  );
}

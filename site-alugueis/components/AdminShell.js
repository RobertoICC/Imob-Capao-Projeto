'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { getSupabase } from '@/lib/supabase';

/** Protege as páginas do painel: exige login E estar na lista de administradores. */
export default function AdminShell({ children }) {
  const router = useRouter();
  const path = usePathname();
  const [state, setState] = useState('loading'); // loading | ok | denied
  const [email, setEmail] = useState('');

  useEffect(() => {
    const sb = getSupabase();
    let alive = true;
    (async () => {
      const { data } = await sb.auth.getSession();
      if (!data.session) {
        router.replace('/admin/login');
        return;
      }
      const { data: ok } = await sb.rpc('is_admin');
      if (!alive) return;
      setEmail(data.session.user.email);
      setState(ok ? 'ok' : 'denied');
    })();
    const { data: sub } = sb.auth.onAuthStateChange((evt) => {
      if (evt === 'SIGNED_OUT') router.replace('/admin/login');
    });
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, [router]);

  async function logout() {
    await getSupabase().auth.signOut();
    router.replace('/admin/login');
  }

  if (state === 'loading') return <div className="center-screen muted">Carregando painel…</div>;
  if (state === 'denied')
    return (
      <div className="center-screen">
        <div className="card pad" style={{ maxWidth: 420 }}>
          <h2>Acesso não autorizado</h2>
          <p className="muted">O usuário {email} não está na lista de administradores.</p>
          <button className="btn" onClick={logout}>Sair</button>
        </div>
      </div>
    );

  const nav = [
    ['/admin', 'Imóveis'],
    ['/admin/reservas', 'Reservas e bloqueios'],
    ['/admin/senha', 'Trocar senha'],
  ];
  return (
    <>
      <header className="admin-top">
        <div className="wrap">
          <strong style={{ fontFamily: 'var(--serif)' }}>Painel • Temporada</strong>
          <nav>
            {nav.map(([href, label]) => (
              <Link key={href} href={href} className={path === href ? 'on' : ''}>{label}</Link>
            ))}
            <a href="/" target="_blank" rel="noopener noreferrer">Ver catálogo ↗</a>
            <button className="btn small ghost" style={{ color: '#fff', borderColor: 'rgba(255,255,255,.3)' }} onClick={logout}>Sair</button>
          </nav>
        </div>
      </header>
      <main className="wrap admin-main">{children}</main>
    </>
  );
}

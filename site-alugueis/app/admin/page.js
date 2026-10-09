'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import AdminShell from '@/components/AdminShell';
import { getSupabase } from '@/lib/supabase';
import { STATUS } from '@/lib/constants';
import { money, coverOf, norm } from '@/lib/format';

const TABS = [
  ['active', 'Ativos'],
  ['published', 'Publicados'],
  ['draft', 'Rascunhos'],
  ['reserved', 'Reservados'],
  ['unavailable', 'Indisponíveis'],
  ['archived', 'Arquivados'],
  ['all', 'Todos'],
];

function AdminList() {
  const router = useRouter();
  const [rows, setRows] = useState([]);
  const [pending, setPending] = useState(0);
  const [q, setQ] = useState('');
  const [tab, setTab] = useState('active');
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState(null);

  const load = useCallback(async () => {
    const sb = getSupabase();
    const [{ data, error }, { count }] = await Promise.all([
      sb.from('properties')
        .select('id, code, title, city, neighborhood, status, capacity, bedrooms, price_per_night, photos, cover_photo, updated_at, property_private(owner_name, manager_name)')
        .order('code'),
      sb.from('bookings').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    ]);
    if (error) setMsg({ t: 'err', m: 'Erro ao carregar: ' + error.message });
    setRows(data || []);
    setPending(count || 0);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function setStatus(p, status) {
    const { error } = await getSupabase().from('properties').update({ status }).eq('id', p.id);
    if (error) setMsg({ t: 'err', m: error.message });
    else {
      setMsg({ t: 'ok', m: `${p.code} agora está como "${STATUS[status].label}".` });
      load();
    }
  }

  async function duplicate(p) {
    const sb = getSupabase();
    const { data: full, error } = await sb.from('properties').select('*').eq('id', p.id).single();
    if (error) return setMsg({ t: 'err', m: error.message });
    // eslint-disable-next-line no-unused-vars
    const { id, code, created_at, updated_at, active, ...rest } = full;
    const { data: copy, error: e2 } = await sb
      .from('properties')
      .insert({ ...rest, title: `${full.title} (cópia)`, status: 'draft', photos: [], cover_photo: null })
      .select('id')
      .single();
    if (e2) return setMsg({ t: 'err', m: e2.message });
    const [{ data: rates }, { data: priv }] = await Promise.all([
      sb.from('property_rates').select('label, kind, start_date, end_date, price_per_night, min_nights').eq('property_id', p.id),
      sb.from('property_private').select('*').eq('property_id', p.id).maybeSingle(),
    ]);
    if (rates?.length) await sb.from('property_rates').insert(rates.map((r) => ({ ...r, property_id: copy.id })));
    if (priv) {
      // eslint-disable-next-line no-unused-vars
      const { property_id, updated_at: u, ...pr } = priv;
      await sb.from('property_private').insert({ ...pr, property_id: copy.id });
    }
    router.push(`/admin/imoveis/${copy.id}`);
  }

  const list = rows.filter((p) => {
    if (tab === 'active' && p.status === 'archived') return false;
    if (!['active', 'all'].includes(tab) && p.status !== tab) return false;
    if (!q) return true;
    const hay = norm([p.code, p.title, p.city, p.neighborhood, p.property_private?.owner_name, p.property_private?.manager_name].join(' '));
    return norm(q).split(/\s+/).every((w) => hay.includes(w));
  });

  return (
    <div className="stack">
      <div className="row between">
        <div>
          <h1 style={{ marginBottom: 0 }}>Imóveis</h1>
          <span className="muted small">{rows.filter((r) => r.status === 'published').length} publicados • {rows.length} no total</span>
        </div>
        <div className="row">
          {pending > 0 && <Link className="btn ghost" href="/admin/reservas">🔔 {pending} solicitação{pending > 1 ? 'ões' : ''} nova{pending > 1 ? 's' : ''}</Link>}
          <Link className="btn sun" href="/admin/imoveis/novo">+ Cadastrar imóvel</Link>
        </div>
      </div>

      <div className="card pad stack">
        <input placeholder="Buscar por código, título, bairro ou proprietário…" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="tabs">
          {TABS.map(([k, l]) => (
            <button key={k} className={`chip ${tab === k ? 'on' : ''}`} onClick={() => setTab(k)}>{l}</button>
          ))}
        </div>
      </div>

      {msg && <div className={`alert ${msg.t}`}>{msg.m}</div>}

      <div className="card" style={{ overflowX: 'auto' }}>
        {loading ? (
          <div className="pad muted">Carregando…</div>
        ) : list.length === 0 ? (
          <div className="pad muted">Nenhum imóvel encontrado.</div>
        ) : (
          <table className="tbl resp">
            <thead>
              <tr><th></th><th>Código</th><th>Imóvel</th><th>Proprietário</th><th>Diária</th><th>Status</th><th>Ações</th></tr>
            </thead>
            <tbody>
              {list.map((p) => {
                const img = coverOf(p);
                return (
                  <tr key={p.id}>
                    <td>{img ? <img className="thumb-sm" src={img} alt="" /> : <div className="thumb-sm" />}</td>
                    <td data-l="Código"><b>{p.code}</b></td>
                    <td data-l="Imóvel">
                      <Link href={`/admin/imoveis/${p.id}`}><b>{p.title}</b></Link>
                      <div className="small muted">{[p.neighborhood, p.city].filter(Boolean).join(', ')} • {p.capacity} hósp. • {(p.photos || []).length} fotos</div>
                    </td>
                    <td data-l="Proprietário" className="small">{p.property_private?.owner_name || <span className="muted">—</span>}</td>
                    <td data-l="Diária">{money(p.price_per_night)}</td>
                    <td data-l="Status"><span className={`badge ${STATUS[p.status]?.tone}`}>{STATUS[p.status]?.label}</span></td>
                    <td>
                      <div className="row" style={{ gap: 4 }}>
                        <Link className="btn small" href={`/admin/imoveis/${p.id}`}>Editar</Link>
                        {p.status === 'published' ? (
                          <button className="btn small ghost" onClick={() => setStatus(p, 'draft')}>Despublicar</button>
                        ) : p.status !== 'archived' ? (
                          <button className="btn small ghost" onClick={() => setStatus(p, 'published')}>Publicar</button>
                        ) : (
                          <button className="btn small ghost" onClick={() => setStatus(p, 'draft')}>Restaurar</button>
                        )}
                        <button className="btn small ghost" onClick={() => duplicate(p)}>Duplicar</button>
                        {p.status !== 'archived' && (
                          <button className="btn small danger" onClick={() => confirm(`Arquivar ${p.code}? Ele sai do catálogo, mas nada é apagado.`) && setStatus(p, 'archived')}>Arquivar</button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export default function Page() {
  return (
    <AdminShell>
      <AdminList />
    </AdminShell>
  );
}

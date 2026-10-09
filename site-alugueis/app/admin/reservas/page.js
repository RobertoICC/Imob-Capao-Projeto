'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import AdminShell from '@/components/AdminShell';
import { getSupabase } from '@/lib/supabase';
import { BOOKING_STATUS } from '@/lib/constants';
import { money, brDate, nightsBetween, todayISO, whatsappLink } from '@/lib/format';

const TABS = [
  ['upcoming', 'Próximas'],
  ['pending', 'Solicitações'],
  ['confirmed', 'Confirmadas'],
  ['blocked', 'Bloqueios'],
  ['closed', 'Recusadas/canceladas'],
  ['all', 'Todas'],
];

function conflictMsg(error) {
  if (!error) return '';
  if (error.code === '23P01' || /no_overlapping_bookings|exclusion/i.test(error.message))
    return 'Conflito de datas: já existe uma reserva confirmada ou bloqueio nesse período para este imóvel.';
  if (/end_date|bookings_check/.test(error.message)) return 'A data de saída precisa ser depois da entrada.';
  return error.message;
}

function Reservas() {
  const params = useSearchParams();
  const [props, setProps] = useState([]);
  const [rows, setRows] = useState([]);
  const [filterProp, setFilterProp] = useState(params.get('imovel') || '');
  const [tab, setTab] = useState('upcoming');
  const [msg, setMsg] = useState(null);
  const [form, setForm] = useState({
    property_id: params.get('imovel') || '', kind: 'confirmed', start_date: '', end_date: '',
    guest_name: '', phone: '', email: '', guests: '', total_price: '', notes: '',
  });
  const [quoteInfo, setQuoteInfo] = useState('');

  const load = useCallback(async () => {
    const sb = getSupabase();
    const [{ data: ps }, { data: bs, error }] = await Promise.all([
      sb.from('properties').select('id, code, title, status').neq('status', 'archived').order('code'),
      sb.from('bookings').select('*, properties(code, title)').order('start_date'),
    ]);
    if (error) setMsg({ t: 'err', m: error.message });
    setProps(ps || []);
    setRows(bs || []);
  }, []);

  useEffect(() => { load(); }, [load]);

  // cotação automática para o formulário
  useEffect(() => {
    setQuoteInfo('');
    if (!form.property_id || !form.start_date || !form.end_date || form.end_date <= form.start_date) return;
    getSupabase()
      .rpc('quote_stay', { p_property_id: form.property_id, p_check_in: form.start_date, p_check_out: form.end_date })
      .then(({ data }) => {
        if (!data || data.error === 'Imóvel não disponível') return;
        setQuoteInfo(
          `${data.nights} noites • valor pelo site: ${money(data.total)}` +
            (data.available ? '' : ' • ⚠️ já existe reserva confirmada ou bloqueio nessas datas') +
            (data.available && !data.ok && data.error ? ` • ${data.error}` : '')
        );
        if (form.total_price === '' && form.kind !== 'blocked') setForm((f) => ({ ...f, total_price: data.total }));
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.property_id, form.start_date, form.end_date]);

  async function setStatus(b, status) {
    const { error } = await getSupabase().from('bookings').update({ status }).eq('id', b.id);
    if (error) setMsg({ t: 'err', m: conflictMsg(error) });
    else {
      setMsg({ t: 'ok', m: `Reserva de ${b.guest_name} (${brDate(b.start_date)}) agora está "${BOOKING_STATUS[status].label}".` });
      load();
    }
  }

  async function create(e) {
    e.preventDefault();
    setMsg(null);
    const f = form;
    if (!f.property_id || !f.start_date || !f.end_date) return setMsg({ t: 'err', m: 'Escolha o imóvel e as datas.' });
    if (f.end_date <= f.start_date) return setMsg({ t: 'err', m: 'A data de saída precisa ser depois da entrada.' });
    if (f.kind !== 'blocked' && !f.guest_name.trim()) return setMsg({ t: 'err', m: 'Informe o nome do hóspede.' });
    const { error } = await getSupabase().from('bookings').insert({
      property_id: f.property_id,
      status: f.kind,
      source: 'manual',
      start_date: f.start_date,
      end_date: f.end_date,
      guest_name: f.kind === 'blocked' ? (f.guest_name.trim() || 'Bloqueio') : f.guest_name.trim(),
      phone: f.phone.trim() || null,
      email: f.email.trim() || null,
      guests: f.guests ? Number(f.guests) : null,
      total_price: f.total_price === '' || f.kind === 'blocked' ? null : Number(f.total_price),
      notes: f.notes.trim() || null,
    });
    if (error) return setMsg({ t: 'err', m: conflictMsg(error) });
    setMsg({ t: 'ok', m: f.kind === 'blocked' ? 'Datas bloqueadas.' : 'Reserva registrada.' });
    setForm({ ...form, start_date: '', end_date: '', guest_name: '', phone: '', email: '', guests: '', total_price: '', notes: '' });
    load();
  }

  const today = todayISO();
  const confirmedRanges = rows.filter((r) => ['confirmed', 'blocked'].includes(r.status));
  const overlapsConfirmed = (b) =>
    confirmedRanges.some((c) => c.id !== b.id && c.property_id === b.property_id && c.start_date < b.end_date && b.start_date < c.end_date);

  const list = rows.filter((b) => {
    if (filterProp && b.property_id !== filterProp) return false;
    if (tab === 'upcoming') return b.end_date >= today && ['pending', 'confirmed', 'blocked'].includes(b.status);
    if (tab === 'closed') return ['declined', 'cancelled'].includes(b.status);
    if (tab === 'all') return true;
    return b.status === tab;
  });

  return (
    <div className="stack">
      <h1 style={{ marginBottom: 0 }}>Reservas e bloqueios</h1>
      <p className="muted small" style={{ margin: 0 }}>
        Só reservas <b>confirmadas</b> e <b>bloqueios</b> ocupam o calendário do site. Solicitações podem coexistir nas mesmas datas — ao confirmar uma, o sistema impede conflito.
      </p>

      <form onSubmit={create} className="card pad stack">
        <h2 style={{ fontFamily: 'var(--sans)', fontSize: '1rem', textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--ocean)', margin: 0 }}>
          Lançar reserva ou bloquear datas
        </h2>
        <div className="grid g4">
          <label className="f" style={{ gridColumn: 'span 2' }}>Imóvel
            <select value={form.property_id} onChange={(e) => setForm({ ...form, property_id: e.target.value, total_price: '' })}>
              <option value="">Selecione…</option>
              {props.map((p) => <option key={p.id} value={p.id}>{p.code} – {p.title}</option>)}
            </select>
          </label>
          <label className="f">Tipo
            <select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}>
              <option value="confirmed">Reserva confirmada</option>
              <option value="pending">Solicitação (pendente)</option>
              <option value="blocked">Bloqueio (proprietário/manutenção)</option>
            </select>
          </label>
          <label className="f">Hóspedes
            <input type="number" min="1" value={form.guests} onChange={(e) => setForm({ ...form, guests: e.target.value })} disabled={form.kind === 'blocked'} />
          </label>
          <label className="f">Entrada
            <input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value, total_price: '' })} />
          </label>
          <label className="f">Saída
            <input type="date" value={form.end_date} min={form.start_date} onChange={(e) => setForm({ ...form, end_date: e.target.value, total_price: '' })} />
          </label>
          <label className="f">{form.kind === 'blocked' ? 'Motivo' : 'Nome do hóspede'}
            <input value={form.guest_name} onChange={(e) => setForm({ ...form, guest_name: e.target.value })} placeholder={form.kind === 'blocked' ? 'Ex.: uso do proprietário' : ''} />
          </label>
          <label className="f">WhatsApp
            <input inputMode="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} disabled={form.kind === 'blocked'} />
          </label>
          <label className="f">Valor total (R$)
            <input type="number" min="0" value={form.total_price} onChange={(e) => setForm({ ...form, total_price: e.target.value })} disabled={form.kind === 'blocked'} />
          </label>
          <label className="f" style={{ gridColumn: 'span 3' }}>Observações
            <input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Sinal recebido, forma de pagamento…" />
          </label>
        </div>
        {quoteInfo && <div className="small muted">{quoteInfo}</div>}
        <div><button className="btn sun">{form.kind === 'blocked' ? 'Bloquear datas' : 'Registrar'}</button></div>
      </form>

      {msg && <div className={`alert ${msg.t}`}>{msg.m}</div>}

      <div className="card pad stack">
        <div className="row between">
          <div className="tabs">
            {TABS.map(([k, l]) => (
              <button key={k} className={`chip ${tab === k ? 'on' : ''}`} onClick={() => setTab(k)}>
                {l}{k === 'pending' && rows.filter((r) => r.status === 'pending').length ? ` (${rows.filter((r) => r.status === 'pending').length})` : ''}
              </button>
            ))}
          </div>
          <select style={{ maxWidth: 320 }} value={filterProp} onChange={(e) => setFilterProp(e.target.value)}>
            <option value="">Todos os imóveis</option>
            {props.map((p) => <option key={p.id} value={p.id}>{p.code} – {p.title}</option>)}
          </select>
        </div>

        {list.length === 0 ? (
          <div className="muted">Nada por aqui.</div>
        ) : (
          <table className="tbl resp">
            <thead><tr><th>Imóvel</th><th>Datas</th><th>Hóspede</th><th>Valor</th><th>Status</th><th>Ações</th></tr></thead>
            <tbody>
              {list.map((b) => {
                const clash = b.status === 'pending' && overlapsConfirmed(b);
                return (
                  <tr key={b.id}>
                    <td data-l="Imóvel"><Link href={`/admin/imoveis/${b.property_id}`}><b>{b.properties?.code}</b></Link><div className="small muted">{b.properties?.title}</div></td>
                    <td data-l="Datas">{brDate(b.start_date)} → {brDate(b.end_date)}<div className="small muted">{nightsBetween(b.start_date, b.end_date)} noites</div></td>
                    <td data-l="Hóspede">
                      {b.guest_name}{b.guests ? ` • ${b.guests} pess.` : ''}
                      <div className="small">
                        {b.phone && <a href={whatsappLink(b.phone.replace(/\D/g, '').replace(/^(?!55)/, '55'), `Olá ${b.guest_name}! Aqui é da Imobiliária Capão da Canoa, sobre sua solicitação de ${brDate(b.start_date)} a ${brDate(b.end_date)}.`)} target="_blank" rel="noopener noreferrer">{b.phone}</a>}
                        {b.email && <div className="muted">{b.email}</div>}
                      </div>
                      {b.notes && <div className="small muted">{b.notes}</div>}
                    </td>
                    <td data-l="Valor">{b.total_price ? money(b.total_price) : '—'}</td>
                    <td data-l="Status">
                      <span className={`badge ${BOOKING_STATUS[b.status]?.tone}`}>{BOOKING_STATUS[b.status]?.label}</span>
                      {clash && <div className="small" style={{ color: 'var(--red)' }}>⚠️ datas já ocupadas</div>}
                      <div className="small muted">{b.source === 'site' ? 'via site' : 'manual'}</div>
                    </td>
                    <td>
                      <div className="row" style={{ gap: 4 }}>
                        {b.status === 'pending' && <button className="btn small" onClick={() => setStatus(b, 'confirmed')}>Confirmar</button>}
                        {b.status === 'pending' && <button className="btn small ghost" onClick={() => setStatus(b, 'declined')}>Recusar</button>}
                        {['confirmed', 'blocked'].includes(b.status) && (
                          <button className="btn small danger" onClick={() => confirm('Cancelar e liberar estas datas no calendário?') && setStatus(b, 'cancelled')}>
                            {b.status === 'blocked' ? 'Desbloquear' : 'Cancelar'}
                          </button>
                        )}
                        {['declined', 'cancelled'].includes(b.status) && <button className="btn small ghost" onClick={() => setStatus(b, 'pending')}>Reabrir</button>}
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
      <Suspense fallback={<div className="muted">Carregando…</div>}>
        <Reservas />
      </Suspense>
    </AdminShell>
  );
}

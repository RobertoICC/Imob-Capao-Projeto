'use client';

import { useEffect, useMemo, useState } from 'react';
import Calendar from '@/components/Calendar';
import { getSupabase } from '@/lib/supabase';
import { BRAND } from '@/lib/constants';
import { money, brDate, busySet, nightsBetween, whatsappLink } from '@/lib/format';

export default function BookingBox({ property, busy, packages, initial }) {
  const busyDays = useMemo(() => busySet(busy), [busy]);
  const [checkIn, setCheckIn] = useState(initial.checkIn || '');
  const [checkOut, setCheckOut] = useState(initial.checkOut || '');
  const [guests, setGuests] = useState(initial.guests ? String(Math.min(Number(initial.guests), property.capacity)) : '');
  const [quote, setQuote] = useState(null);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '', email: '' });
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState('');
  const [origin, setOrigin] = useState('');

  useEffect(() => setOrigin(window.location.origin), []);

  useEffect(() => {
    setQuote(null);
    setSent(false);
    if (!checkIn || !checkOut) return;
    let alive = true;
    setLoading(true);
    getSupabase()
      .rpc('quote_stay', { p_property_id: property.id, p_check_in: checkIn, p_check_out: checkOut })
      .then(({ data, error }) => {
        if (!alive) return;
        setLoading(false);
        setQuote(error ? { ok: false, error: 'Não foi possível calcular agora.' } : data);
      });
    return () => { alive = false; };
  }, [checkIn, checkOut, property.id]);

  const nights = nightsBetween(checkIn, checkOut);
  const g = Number(guests) || 0;

  const waText = [
    `Olá! Tenho interesse no imóvel ${property.code} – ${property.title}.`,
    checkIn && checkOut ? `Entrada: ${brDate(checkIn)} | Saída: ${brDate(checkOut)} (${nights} noites)` : 'Ainda estou definindo as datas.',
    g ? `Hóspedes: ${g}` : null,
    quote?.ok ? `Valor calculado no site: ${money(quote.total)}` : null,
    origin ? `${origin}/imovel/${property.code}` : null,
  ].filter(Boolean).join('\n');

  async function requestBooking(e) {
    e.preventDefault();
    setErr('');
    if (!form.name.trim() || (!form.phone.trim() && !form.email.trim())) {
      setErr('Informe seu nome e um telefone (WhatsApp) ou e-mail.');
      return;
    }
    if (!g) {
      setErr('Informe o número de hóspedes.');
      return;
    }
    setSending(true);
    const { error } = await getSupabase().from('bookings').insert({
      property_id: property.id,
      guest_name: form.name.trim(),
      phone: form.phone.trim() || null,
      email: form.email.trim() || null,
      start_date: checkIn,
      end_date: checkOut,
      guests: g,
      total_price: quote?.total ?? null,
      status: 'pending',
      source: 'site',
      notes: 'Solicitação feita pelo catálogo online',
    });
    setSending(false);
    if (error) setErr('Não conseguimos registrar agora. Fale conosco pelo WhatsApp.');
    else setSent(true);
  }

  return (
    <div className="card pad stack">
      <h2 style={{ marginBottom: 0 }}>Consultar datas</h2>
      <Calendar busy={busyDays} checkIn={checkIn} checkOut={checkOut} onChange={(a, b) => { setCheckIn(a); setCheckOut(b); }} />

      {packages.length > 0 && (
        <div className="stack">
          {packages.map((k) => (
            <button key={k.id} type="button" className="btn ghost small block" onClick={() => { setCheckIn(k.check_in); setCheckOut(k.check_out); }}>
              🎆 {k.label}: {brDate(k.check_in)} a {brDate(k.check_out)}
            </button>
          ))}
        </div>
      )}

      <label className="f">
        Hóspedes (máximo {property.capacity})
        <select value={guests} onChange={(e) => setGuests(e.target.value)}>
          <option value="">Selecione</option>
          {Array.from({ length: property.capacity }, (_, i) => i + 1).map((n) => (
            <option key={n} value={n}>{n} {n === 1 ? 'pessoa' : 'pessoas'}</option>
          ))}
        </select>
      </label>

      {checkIn && checkOut && (
        <div className="quote">
          {loading && <div className="muted small">Calculando…</div>}
          {quote && !loading && (
            <>
              <div className="line"><span>Entrada</span><b>{brDate(checkIn)}</b></div>
              <div className="line"><span>Saída</span><b>{brDate(checkOut)}</b></div>
              {quote.package ? (
                <div className="line"><span>{quote.package}</span><span>{money(quote.subtotal)}</span></div>
              ) : (
                <div className="line"><span>{quote.nights} {quote.nights === 1 ? 'noite' : 'noites'}</span><span>{money(quote.subtotal)}</span></div>
              )}
              <div className="line"><span>Limpeza</span><span>{Number(quote.cleaning_fee) > 0 ? money(quote.cleaning_fee) : 'Inclusa'}</span></div>
              <div className="line total"><span>Total</span><span>{money(quote.total)}</span></div>
              {quote.nights_detail && new Set(quote.nights_detail.map((n) => n.price)).size > 1 && (
                <details className="small muted">
                  <summary>Ver valor de cada noite</summary>
                  {quote.nights_detail.map((n) => (
                    <div className="line" key={n.date}><span>{brDate(n.date)} • {n.label}</span><span>{money(n.price)}</span></div>
                  ))}
                </details>
              )}
              {!quote.ok && quote.error && <div className="alert err" style={{ marginTop: 8 }}>{quote.error}</div>}
            </>
          )}
        </div>
      )}

      <a className="btn wa block" href={whatsappLink(BRAND.whatsapp, waText)} target="_blank" rel="noopener noreferrer">
        Falar no WhatsApp
      </a>

      {quote?.ok && !sent && (
        <form className="stack" onSubmit={requestBooking} style={{ borderTop: '1px solid var(--line)', paddingTop: 12 }}>
          <strong>Ou deixe sua solicitação de reserva</strong>
          <input placeholder="Seu nome" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <input placeholder="WhatsApp com DDD" inputMode="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <input placeholder="E-mail (opcional)" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          {err && <div className="alert err">{err}</div>}
          <button className="btn sun block" disabled={sending}>{sending ? 'Enviando…' : 'Solicitar reserva'}</button>
          <span className="small muted">A reserva só é confirmada após nosso contato e o sinal de 50%.</span>
        </form>
      )}
      {sent && (
        <div className="alert ok">
          Solicitação recebida! Vamos confirmar a disponibilidade e falar com você em breve. Para agilizar, chame no WhatsApp.
        </div>
      )}
    </div>
  );
}

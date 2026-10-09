'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { getSupabase } from '@/lib/supabase';
import { CITIES, PROPERTY_TYPES } from '@/lib/constants';
import { money, coverOf, nightsBetween, todayISO, addDays, brDate } from '@/lib/format';

export default function Catalog({ properties, rates, packages }) {
  const [city, setCity] = useState('');
  const [hood, setHood] = useState('');
  const [guests, setGuests] = useState('');
  const [amen, setAmen] = useState([]);
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [quotes, setQuotes] = useState(null); // { [id]: quote }
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');

  const neighborhoods = useMemo(
    () =>
      [...new Set(properties.filter((p) => !city || p.city === city).map((p) => p.neighborhood).filter(Boolean))].sort(),
    [properties, city]
  );
  const allAmenities = useMemo(() => {
    const count = {};
    properties.forEach((p) => (p.amenities || []).forEach((a) => (count[a] = (count[a] || 0) + 1)));
    return Object.keys(count).sort((a, b) => count[b] - count[a]);
  }, [properties]);

  const fromPrice = useMemo(() => {
    const m = {};
    properties.forEach((p) => {
      const rs = rates.filter((r) => r.property_id === p.id).map((r) => Number(r.price_per_night));
      m[p.id] = Math.min(Number(p.price_per_night) || Infinity, ...rs);
    });
    return m;
  }, [properties, rates]);

  const list = properties.filter((p) => {
    if (city && p.city !== city) return false;
    if (hood && p.neighborhood !== hood) return false;
    if (guests && Number(p.capacity) < Number(guests)) return false;
    if (amen.length && !amen.every((a) => (p.amenities || []).includes(a))) return false;
    if (quotes && !(quotes[p.id] && quotes[p.id].available)) return false;
    return true;
  });

  async function searchDates(e) {
    e?.preventDefault();
    setMsg('');
    if (!checkIn || !checkOut) {
      setQuotes(null);
      return;
    }
    if (nightsBetween(checkIn, checkOut) < 1) {
      setMsg('A data de saída precisa ser depois da entrada.');
      return;
    }
    setLoading(true);
    const sb = getSupabase();
    const results = await Promise.all(
      properties.map((p) =>
        sb.rpc('quote_stay', { p_property_id: p.id, p_check_in: checkIn, p_check_out: checkOut }).then((r) => [p.id, r.data])
      )
    );
    setQuotes(Object.fromEntries(results));
    setLoading(false);
  }

  function clearAll() {
    setCity('');
    setHood('');
    setGuests('');
    setAmen([]);
    setCheckIn('');
    setCheckOut('');
    setQuotes(null);
    setMsg('');
  }

  const nights = nightsBetween(checkIn, checkOut);

  return (
    <>
      <div className="wrap filters">
        <form className="card stack" onSubmit={searchDates}>
          <div className="grid g4">
            <label className="f">
              Entrada
              <input type="date" min={todayISO()} value={checkIn} onChange={(e) => {
                setCheckIn(e.target.value);
                if (!checkOut || checkOut <= e.target.value) setCheckOut(e.target.value ? addDays(e.target.value, 2) : '');
              }} />
            </label>
            <label className="f">
              Saída
              <input type="date" min={checkIn || todayISO()} value={checkOut} onChange={(e) => setCheckOut(e.target.value)} />
            </label>
            <label className="f">
              Hóspedes
              <select value={guests} onChange={(e) => setGuests(e.target.value)}>
                <option value="">Qualquer</option>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 14].map((n) => (
                  <option key={n} value={n}>{n}+ pessoas</option>
                ))}
              </select>
            </label>
            <label className="f">
              Bairro
              <select value={hood} onChange={(e) => setHood(e.target.value)}>
                <option value="">Todos</option>
                {neighborhoods.map((n) => <option key={n}>{n}</option>)}
              </select>
            </label>
          </div>
          <div className="row between">
            <div className="chips">
              <button type="button" className={`chip ${!city ? 'on' : ''}`} onClick={() => { setCity(''); setHood(''); }}>Todas as cidades</button>
              {CITIES.map((c) => (
                <button type="button" key={c} className={`chip ${city === c ? 'on' : ''}`} onClick={() => { setCity(c); setHood(''); }}>{c}</button>
              ))}
            </div>
            <div className="row">
              <button type="button" className="btn ghost small" onClick={clearAll}>Limpar</button>
              <button type="submit" className="btn sun" disabled={loading}>
                {loading ? 'Consultando…' : 'Ver disponíveis'}
              </button>
            </div>
          </div>
          {allAmenities.length > 0 && (
            <div className="chips" aria-label="Comodidades">
              {allAmenities.map((a) => (
                <button type="button" key={a} className={`chip ${amen.includes(a) ? 'on' : ''}`}
                  onClick={() => setAmen(amen.includes(a) ? amen.filter((x) => x !== a) : [...amen, a])}>{a}</button>
              ))}
            </div>
          )}
          {msg && <div className="alert err">{msg}</div>}
        </form>
      </div>

      <div className="wrap">
        <p className="muted small" style={{ marginTop: 18 }}>
          {list.length} {list.length === 1 ? 'imóvel encontrado' : 'imóveis encontrados'}
          {quotes && nights > 0 && ` livres de ${brDate(checkIn)} a ${brDate(checkOut)} (${nights} ${nights === 1 ? 'noite' : 'noites'})`}
        </p>
        {list.length === 0 ? (
          <div className="card pad" style={{ margin: '10px 0 60px' }}>
            Nenhum imóvel com esses filtros. Tente outras datas ou{' '}
            <button className="btn ghost small" onClick={clearAll}>limpe os filtros</button>
          </div>
        ) : (
          <div className="listing">
            {list.map((p) => {
              const q = quotes?.[p.id];
              const pkg = packages.find((k) => k.property_id === p.id);
              const href = `/imovel/${p.code}` + (checkIn && checkOut ? `?entrada=${checkIn}&saida=${checkOut}${guests ? `&hospedes=${guests}` : ''}` : '');
              const img = coverOf(p);
              return (
                <Link key={p.id} href={href} className="card pcard">
                  <div className="ph">
                    {img ? <img src={img} alt={p.title} loading="lazy" /> : <div className="noimg">Fotos em breve</div>}
                    <span className="code">{p.code}</span>
                  </div>
                  <div className="body">
                    <span className="small muted">
                      {PROPERTY_TYPES[p.property_type] || 'Imóvel'} • {[p.neighborhood, p.city].filter(Boolean).join(', ')}
                    </span>
                    <h3>{p.title}</h3>
                    <div className="facts">
                      <span>👥 até {p.capacity}</span>
                      {p.bedrooms ? <span>🛏 {p.bedrooms} dorm.</span> : null}
                      {p.suites ? <span>{p.suites} suíte{p.suites > 1 ? 's' : ''}</span> : null}
                      {p.distance_to_sea_m ? <span>🌊 {p.distance_to_sea_m} m do mar</span> : null}
                    </div>
                    <div className="price">
                      {q && q.available ? (
                        <>
                          <b>{money(q.total)}</b> total • {q.nights} noites
                          {!q.ok && q.error && <div className="small" style={{ color: 'var(--orange)' }}>{q.error}</div>}
                        </>
                      ) : pkg && !Number.isFinite(fromPrice[p.id]) ? (
                        <>Pacote <b>{money(pkg.total_price)}</b></>
                      ) : (
                        <>a partir de <b>{money(fromPrice[p.id])}</b> / diária</>
                      )}
                      {pkg && !q && <div className="small">🎆 {pkg.label}: {money(pkg.total_price)}</div>}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}

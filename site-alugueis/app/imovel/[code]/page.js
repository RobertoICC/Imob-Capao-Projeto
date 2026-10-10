import { notFound } from 'next/navigation';
import Link from 'next/link';
import { serverSupabase, PUBLIC_PROPERTY_FIELDS } from '@/lib/supabase';
import { SiteHeader, SiteFooter } from '@/components/SiteChrome';
import Gallery from '@/components/Gallery';
import BookingBox from '@/components/BookingBox';
import { PROPERTY_TYPES, RATE_KINDS } from '@/lib/constants';
import { money, brDate, nightsBetween } from '@/lib/format';

export const dynamic = 'force-dynamic';

async function load(code) {
  const sb = serverSupabase();
  const { data: p } = await sb
    .from('properties')
    .select(PUBLIC_PROPERTY_FIELDS)
    .eq('code', code)
    .eq('status', 'published')
    .maybeSingle();
  if (!p) return null;
  const [{ data: rates }, { data: packages }, { data: busy }] = await Promise.all([
    sb.from('property_rates').select('*').eq('property_id', p.id).order('start_date'),
    sb.from('property_packages').select('*').eq('property_id', p.id).order('check_in'),
    sb.rpc('get_busy_ranges', { p_property_id: p.id }),
  ]);
  return { p, rates: rates || [], packages: packages || [], busy: busy || [] };
}

export async function generateMetadata({ params }) {
  const { code } = await params;
  const d = await load(code);
  if (!d) return { title: 'Imóvel não encontrado' };
  return {
    title: `${d.p.title} (${d.p.code}) | Aluguel de temporada`,
    description: (d.p.description || '').slice(0, 160),
    openGraph: { images: d.p.cover_photo || d.p.photos?.[0] ? [d.p.cover_photo || d.p.photos[0]] : [] },
  };
}

export default async function PropertyPage({ params, searchParams }) {
  const { code } = await params;
  const sp = await searchParams;
  const d = await load(code);
  if (!d) notFound();
  const { p, rates, packages, busy } = d;

  const photos = [...(p.photos || [])];
  if (p.cover_photo) {
    const i = photos.indexOf(p.cover_photo);
    if (i > 0) photos.splice(i, 1);
    if (i !== 0) photos.unshift(p.cover_photo);
  }

  const facts = [
    PROPERTY_TYPES[p.property_type],
    `até ${p.capacity} hóspedes`,
    p.bedrooms ? `${p.bedrooms} dormitório${p.bedrooms > 1 ? 's' : ''}` : null,
    p.suites ? `${p.suites} suíte${p.suites > 1 ? 's' : ''}` : null,
    p.bathrooms ? `${p.bathrooms} banheiro${p.bathrooms > 1 ? 's' : ''}` : null,
    p.parking_spots ? `${p.parking_spots} vaga${p.parking_spots > 1 ? 's' : ''}` : null,
    p.distance_to_sea_m ? `${p.distance_to_sea_m} m do mar` : null,
  ].filter(Boolean);

  const mapUrl =
    p.latitude && p.longitude
      ? `https://www.google.com/maps?q=${p.latitude},${p.longitude}`
      : p.address
      ? `https://www.google.com/maps/search/${encodeURIComponent(`${p.address}, ${p.city}, RS`)}`
      : null;

  return (
    <>
      <SiteHeader />
      <main className="wrap" style={{ paddingTop: 18 }}>
        <p className="small"><Link href="/">← Todos os imóveis</Link></p>
        <div className="row between" style={{ alignItems: 'flex-end', marginBottom: 12 }}>
          <div>
            <span className="badge blue">{p.code}</span>{' '}
            <span className="small muted">{[p.neighborhood, p.city].filter(Boolean).join(', ')}</span>
            <h1 style={{ marginTop: 6 }}>{p.title}</h1>
          </div>
        </div>

        <Gallery photos={photos} title={p.title} />

        <div className="detail">
          <div className="stack">
            <div className="facts-big">{facts.map((f) => <span key={f}>{f}</span>)}</div>
            <a href="#reservar" className="btn sun block jump">Ver datas livres e calcular valor ↓</a>

            {p.description && (
              <section className="card pad">
                <h2>Sobre o imóvel</h2>
                {p.description.split('\n').filter(Boolean).map((t, i) => <p key={i}>{t}</p>)}
                {mapUrl && (
                  <p className="small">📍 {p.address || p.city} — <a href={mapUrl} target="_blank" rel="noopener noreferrer">ver no mapa</a></p>
                )}
              </section>
            )}

            {p.amenities?.length > 0 && (
              <section className="card pad">
                <h2>Comodidades</h2>
                <ul className="amen">{p.amenities.map((a) => <li key={a}>{a}</li>)}</ul>
              </section>
            )}

            <section className="card pad">
              <h2>Valores da temporada</h2>
              <table className="ptable">
                <tbody>
                  <tr><td>Diária padrão</td><td><b>{money(p.price_per_night)}</b></td></tr>
                  {rates.map((r) => (
                    <tr key={r.id}>
                      <td>
                        {r.label} <span className="muted small">({RATE_KINDS[r.kind] || 'Período'})</span><br />
                        <span className="small muted">
                          noites de {brDate(r.start_date)} a {brDate(r.end_date)} (saída) • mín. {r.min_nights} noite{r.min_nights > 1 ? 's' : ''}
                        </span>
                      </td>
                      <td><b>{money(r.price_per_night)}</b> / diária</td>
                    </tr>
                  ))}
                  {packages.map((k) => (
                    <tr key={k.id}>
                      <td>
                        🎆 {k.label}<br />
                        <span className="small muted">
                          entrada {brDate(k.check_in)} • saída {brDate(k.check_out)} • {nightsBetween(k.check_in, k.check_out)} noites{k.cleaning_included ? ' • limpeza inclusa' : ''}
                        </span>
                      </td>
                      <td><b>{money(k.total_price)}</b> total</td>
                    </tr>
                  ))}
                  <tr><td>Taxa de limpeza</td><td>{Number(p.cleaning_fee) > 0 ? money(p.cleaning_fee) : 'Inclusa'}</td></tr>
                  <tr><td>Estadia mínima</td><td>{p.min_nights} noite{p.min_nights > 1 ? 's' : ''}</td></tr>
                </tbody>
              </table>
              <p className="small muted" style={{ marginTop: 10, marginBottom: 0 }}>
                Reserva mediante sinal de 50%. Valores confirmados no atendimento.
              </p>
            </section>

            {p.rules && (
              <section className="card pad">
                <h2>Regras da casa</h2>
                {p.rules.split('\n').filter(Boolean).map((t, i) => <p key={i}>{t}</p>)}
              </section>
            )}
          </div>

          <aside className="sticky" id="reservar">
            <BookingBox
              property={{ id: p.id, code: p.code, title: p.title, capacity: p.capacity, min_nights: p.min_nights }}
              busy={busy}
              packages={packages}
              initial={{ checkIn: sp?.entrada || '', checkOut: sp?.saida || '', guests: sp?.hospedes || '' }}
            />
          </aside>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}

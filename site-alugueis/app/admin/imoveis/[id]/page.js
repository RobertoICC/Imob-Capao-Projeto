'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import AdminShell from '@/components/AdminShell';
import { getSupabase } from '@/lib/supabase';
import {
  AMENITIES, CITIES, NEIGHBORHOODS, PROPERTY_TYPES, RATE_KINDS, STATUS, BOOKING_STATUS, REVEILLON_DEFAULT,
} from '@/lib/constants';
import { money, brDate, nightsBetween, todayISO, toNum } from '@/lib/format';

const EMPTY = {
  title: '', property_type: 'apartamento', city: 'Capão da Canoa', neighborhood: '', address: '',
  latitude: '', longitude: '', distance_to_sea_m: '', capacity: 4, bedrooms: '', suites: '', bathrooms: '',
  parking_spots: '', description: '', rules: '', amenities: [], price_per_night: '', price_holiday: '',
  cleaning_fee: 350, min_nights: 2, status: 'draft', photos: [], cover_photo: null,
};
const EMPTY_PRIV = {
  owner_name: '', owner_phone: '', manager_name: '', manager_phone: '', owner_net_price: '',
  owner_net_price_holiday: '', commission_pct: 20, commercial_terms: '', internal_notes: '',
};
const EDITABLE = Object.keys(EMPTY);
const NUMERIC = ['latitude', 'longitude', 'distance_to_sea_m', 'capacity', 'bedrooms', 'suites', 'bathrooms',
  'parking_spots', 'price_per_night', 'price_holiday', 'cleaning_fee', 'min_nights',
  'owner_net_price', 'owner_net_price_holiday', 'commission_pct'];

function clean(obj, keys) {
  const out = {};
  for (const k of keys) {
    let v = obj[k];
    if (NUMERIC.includes(k)) v = toNum(v);
    else if (typeof v === 'string') v = v.trim() === '' && !['description', 'rules', 'title'].includes(k) ? null : v;
    out[k] = v;
  }
  return out;
}

function nullsToEmpty(o) {
  const r = {};
  for (const k in o) r[k] = o[k] === null ? '' : o[k];
  return r;
}

/** Reduz fotos grandes do celular (máx. 1920 px, JPEG) antes de enviar. */
async function shrink(file) {
  if (!file.type.startsWith('image/') || file.type === 'image/gif') return file;
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, 1920 / Math.max(bmp.width, bmp.height));
    if (scale === 1 && file.size < 900_000) return file;
    const c = document.createElement('canvas');
    c.width = Math.round(bmp.width * scale);
    c.height = Math.round(bmp.height * scale);
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    const blob = await new Promise((res) => c.toBlob(res, 'image/jpeg', 0.84));
    return blob ? new File([blob], file.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' }) : file;
  } catch {
    return file;
  }
}

function LocField({ lat, lng, onChange }) {
  const [text, setText] = useState(lat !== '' && lng !== '' ? `${lat}, ${lng}` : '');
  const [bad, setBad] = useState(false);
  function change(v) {
    setText(v);
    if (!v.trim()) { setBad(false); onChange('', ''); return; }
    const m = v.match(/(-?\d+(?:\.\d+)?)\s*[,;\s]\s*(-?\d+(?:\.\d+)?)/);
    setBad(!m);
    if (m) onChange(m[1], m[2]);
  }
  return (
    <label className="f">Localização (Google Maps)
      <input value={text} onChange={(e) => change(e.target.value)} placeholder="-29.7469, -50.0094" />
      {bad && <span className="small" style={{ color: 'var(--orange)' }}>Cole no formato: latitude, longitude</span>}
    </label>
  );
}

function Editor() {
  const { id } = useParams();
  const isNew = id === 'novo';
  const router = useRouter();
  const sb = getSupabase();

  const [p, setP] = useState(EMPTY);
  const [priv, setPriv] = useState(EMPTY_PRIV);
  const [rates, setRates] = useState([]);
  const [packages, setPackages] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [code, setCode] = useState('');
  const [loaded, setLoaded] = useState(isNew);
  const [save, setSave] = useState({ state: 'idle', msg: '' }); // idle | dirty | saving | saved | error
  const [uploading, setUploading] = useState('');
  const dirtyP = useRef(false);
  const dirtyPriv = useRef(false);

  const load = useCallback(async () => {
    if (isNew) return;
    const [{ data: prop, error }, { data: pr }, { data: rt }, { data: pk }, { data: bk }] = await Promise.all([
      sb.from('properties').select('*').eq('id', id).single(),
      sb.from('property_private').select('*').eq('property_id', id).maybeSingle(),
      sb.from('property_rates').select('*').eq('property_id', id).order('start_date'),
      sb.from('property_packages').select('*').eq('property_id', id).order('check_in'),
      sb.from('bookings').select('*').eq('property_id', id).gte('end_date', todayISO()).order('start_date'),
    ]);
    if (error) {
      setSave({ state: 'error', msg: 'Imóvel não encontrado.' });
      setLoaded(true);
      return;
    }
    setP({ ...EMPTY, ...nullsToEmpty(prop), amenities: prop.amenities || [], photos: prop.photos || [] });
    setCode(prop.code);
    if (pr) setPriv({ ...EMPTY_PRIV, ...nullsToEmpty(pr) });
    setRates(rt || []);
    setPackages(pk || []);
    setBookings(bk || []);
    setLoaded(true);
  }, [id, isNew, sb]);

  useEffect(() => { load(); }, [load]);

  function validate(v) {
    if (!v.title.trim()) return 'Informe o título do imóvel.';
    if (!(Number(v.capacity) > 0)) return 'Informe a capacidade de hóspedes.';
    const pr = toNum(v.price_per_night);
    if (pr === null || Number.isNaN(pr) || pr < 0) return 'Informe a diária padrão (somente números, ex.: 980).';
    for (const k of ['price_holiday', 'cleaning_fee']) if (Number.isNaN(toNum(v[k]))) return 'Valor inválido em preços. Use só números, ex.: 1.200';
    return '';
  }

  const persist = useCallback(async () => {
    if (isNew) return;
    const problem = validate(p);
    if (problem) {
      setSave({ state: 'error', msg: problem });
      return;
    }
    setSave({ state: 'saving', msg: '' });
    const tasks = [];
    if (dirtyP.current) {
      dirtyP.current = false;
      const payload = clean(p, EDITABLE.filter((k) => !['photos', 'cover_photo'].includes(k)));
      tasks.push(sb.from('properties').update(payload).eq('id', id));
    }
    if (dirtyPriv.current) {
      dirtyPriv.current = false;
      tasks.push(sb.from('property_private').upsert({ property_id: id, ...clean(priv, Object.keys(EMPTY_PRIV)), updated_at: new Date().toISOString() }));
    }
    const results = await Promise.all(tasks);
    const failed = results.find((r) => r.error);
    if (failed) setSave({ state: 'error', msg: 'Erro ao salvar: ' + failed.error.message });
    else setSave({ state: 'saved', msg: '' });
  }, [id, isNew, p, priv, sb]);

  // Salvamento automático 1,2 s depois da última alteração
  useEffect(() => {
    if (save.state !== 'dirty') return;
    const t = setTimeout(persist, 1200);
    return () => clearTimeout(t);
  }, [save.state, persist, p, priv]);

  function set(k, v) {
    setP((old) => ({ ...old, [k]: v }));
    dirtyP.current = true;
    if (!isNew) setSave({ state: 'dirty', msg: '' });
  }
  function setPv(k, v) {
    setPriv((old) => ({ ...old, [k]: v }));
    dirtyPriv.current = true;
    if (!isNew) setSave({ state: 'dirty', msg: '' });
  }

  async function createDraft() {
    const problem = validate(p);
    if (problem) return setSave({ state: 'error', msg: problem });
    setSave({ state: 'saving', msg: '' });
    const payload = clean(p, EDITABLE);
    const { data, error } = await sb.from('properties').insert({ ...payload, photos: [], cover_photo: null }).select('id').single();
    if (error) return setSave({ state: 'error', msg: error.message });
    const privData = clean(priv, Object.keys(EMPTY_PRIV));
    if (Object.entries(privData).some(([k, v]) => v !== null && k !== 'commission_pct')) {
      await sb.from('property_private').insert({ property_id: data.id, ...privData });
    }
    router.replace(`/admin/imoveis/${data.id}`);
  }

  async function setStatusNow(status) {
    const problem = validate(p);
    if (status === 'published' && problem) return setSave({ state: 'error', msg: problem });
    setP((o) => ({ ...o, status }));
    const { error } = await sb.from('properties').update({ status }).eq('id', id);
    setSave(error ? { state: 'error', msg: error.message } : { state: 'saved', msg: `Status: ${STATUS[status].label}` });
  }

  // ---------- Fotos ----------
  async function savePhotos(photos, cover) {
    setP((o) => ({ ...o, photos, cover_photo: cover }));
    const { error } = await sb.from('properties').update({ photos, cover_photo: cover }).eq('id', id);
    setSave(error ? { state: 'error', msg: error.message } : { state: 'saved', msg: '' });
  }

  async function upload(files) {
    const list = Array.from(files || []);
    if (!list.length) return;
    const added = [];
    for (let i = 0; i < list.length; i++) {
      setUploading(`Enviando foto ${i + 1} de ${list.length}…`);
      const f = await shrink(list[i]);
      const ext = (f.name.split('.').pop() || 'jpg').toLowerCase();
      const path = `${id}/${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${ext}`;
      const { error } = await sb.storage.from('property-photos').upload(path, f, { contentType: f.type, upsert: false });
      if (error) {
        setUploading('');
        setSave({ state: 'error', msg: `Erro ao enviar ${list[i].name}: ${error.message}` });
        break;
      }
      added.push(sb.storage.from('property-photos').getPublicUrl(path).data.publicUrl);
    }
    setUploading('');
    if (added.length) {
      const photos = [...p.photos, ...added];
      await savePhotos(photos, p.cover_photo || photos[0]);
    }
  }

  async function removePhoto(url) {
    if (!confirm('Remover esta foto?')) return;
    const photos = p.photos.filter((u) => u !== url);
    const cover = p.cover_photo === url ? photos[0] || null : p.cover_photo;
    await savePhotos(photos, cover);
    const marker = '/property-photos/';
    const i = url.indexOf(marker);
    if (i > 0) await sb.storage.from('property-photos').remove([decodeURIComponent(url.slice(i + marker.length))]);
  }

  function makeCover(url) {
    const photos = [url, ...p.photos.filter((u) => u !== url)];
    savePhotos(photos, url);
  }

  function move(i, dir) {
    const photos = [...p.photos];
    const j = i + dir;
    if (j < 0 || j >= photos.length) return;
    [photos[i], photos[j]] = [photos[j], photos[i]];
    savePhotos(photos, p.cover_photo);
  }

  // ---------- Períodos ----------
  const [nr, setNr] = useState({ label: '', kind: 'alta', start_date: '', end_date: '', price_per_night: '', min_nights: 2 });
  const [rateErr, setRateErr] = useState('');
  async function addRate(e) {
    e.preventDefault();
    setRateErr('');
    if (!nr.label || !nr.start_date || !nr.end_date || nr.price_per_night === '') return setRateErr('Preencha nome, datas e valor.');
    if (Number.isNaN(toNum(nr.price_per_night))) return setRateErr('Valor inválido. Use só números, ex.: 1.200');
    if (nr.end_date <= nr.start_date) return setRateErr('A data final precisa ser depois da inicial.');
    const { error } = await sb.from('property_rates').insert({
      property_id: id, ...nr, price_per_night: toNum(nr.price_per_night), min_nights: Number(nr.min_nights) || 1,
    });
    if (error) return setRateErr(error.message);
    setNr({ label: '', kind: 'alta', start_date: '', end_date: '', price_per_night: '', min_nights: 2 });
    load();
  }
  async function delRate(r) {
    if (!confirm(`Excluir o período "${r.label}"?`)) return;
    await sb.from('property_rates').delete().eq('id', r.id);
    load();
  }
  async function editRatePrice(r) {
    const v = prompt(`Nova diária para "${r.label}" (somente números):`, r.price_per_night);
    if (v === null || v.trim() === '' || isNaN(Number(v))) return;
    await sb.from('property_rates').update({ price_per_night: Number(v) }).eq('id', r.id);
    load();
  }

  // ---------- Pacotes ----------
  const [nk, setNk] = useState({ label: '', check_in: '', check_out: '', total_price: '', notes: '', cleaning_included: true });
  const [pkErr, setPkErr] = useState('');
  async function addPackage(e) {
    e.preventDefault();
    setPkErr('');
    if (!nk.label || !nk.check_in || !nk.check_out || nk.total_price === '') return setPkErr('Preencha nome, datas e valor total.');
    if (nk.check_out <= nk.check_in) return setPkErr('A saída precisa ser depois da entrada.');
    if (Number.isNaN(toNum(nk.total_price))) return setPkErr('Valor inválido. Use só números, ex.: 15.800');
    const { error } = await sb.from('property_packages').insert({
      property_id: id, ...nk, total_price: toNum(nk.total_price), min_nights: nightsBetween(nk.check_in, nk.check_out), notes: nk.notes || null,
    });
    if (error) return setPkErr(error.message);
    setNk({ label: '', check_in: '', check_out: '', total_price: '', notes: '', cleaning_included: true });
    load();
  }
  async function delPackage(k) {
    if (!confirm(`Excluir o pacote "${k.label}"?`)) return;
    await sb.from('property_packages').delete().eq('id', k.id);
    load();
  }

  if (!loaded) return <div className="muted">Carregando…</div>;

  const saveLabel = {
    idle: '', dirty: 'Alterações pendentes…', saving: 'Salvando…', saved: 'Tudo salvo ✓', error: '',
  }[save.state];

  const commission = Number(priv.commission_pct) || 0;
  const suggested = toNum(priv.owner_net_price) ? Math.round(toNum(priv.owner_net_price) * (1 + commission / 100)) : null;

  return (
    <div>
      <div className="savebar">
        <div className="row between">
          <div className="row">
            <Link href="/admin" className="btn ghost small">← Imóveis</Link>
            <strong>{isNew ? 'Novo imóvel' : `${code} • ${p.title || 'Sem título'}`}</strong>
            {!isNew && <span className={`badge ${STATUS[p.status]?.tone}`}>{STATUS[p.status]?.label}</span>}
          </div>
          <div className="row">
            <span className="small muted">{saveLabel || save.msg}</span>
            {isNew ? (
              <button className="btn sun" onClick={createDraft}>Criar rascunho</button>
            ) : (
              <>
                {save.state === 'dirty' && <button className="btn small" onClick={persist}>Salvar agora</button>}
                {p.status !== 'published' ? (
                  <button className="btn sun small" onClick={() => setStatusNow('published')}>Publicar no catálogo</button>
                ) : (
                  <>
                    <a className="btn ghost small" href={`/imovel/${code}`} target="_blank" rel="noopener noreferrer">Ver no site ↗</a>
                    <button className="btn ghost small" onClick={() => setStatusNow('draft')}>Despublicar</button>
                  </>
                )}
                <select style={{ width: 'auto', minHeight: 34, padding: '4px 8px' }} value={p.status} onChange={(e) => setStatusNow(e.target.value)} aria-label="Status">
                  {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </>
            )}
          </div>
        </div>
        {save.state === 'error' && <div className="alert err" style={{ marginTop: 8 }}>{save.msg}</div>}
        {isNew && <div className="alert info" style={{ marginTop: 8 }}>Preencha os dados básicos e clique em <b>Criar rascunho</b>. Depois disso tudo é salvo automaticamente e você poderá enviar fotos.</div>}
      </div>

      <section className="card pad section">
        <h2>1. Dados principais</h2>
        <div className="grid">
          <label className="f">Título do anúncio *
            <input value={p.title} onChange={(e) => set('title', e.target.value)} placeholder="Ex.: Apartamento 2 dormitórios com vista para o mar" />
          </label>
          <div className="grid g3">
            <label className="f">Tipo
              <select value={p.property_type} onChange={(e) => set('property_type', e.target.value)}>
                {Object.entries(PROPERTY_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </label>
            <label className="f">Cidade
              <select value={p.city} onChange={(e) => set('city', e.target.value)}>
                {CITIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </label>
            <label className="f">Bairro
              <input list="hoods" value={p.neighborhood} onChange={(e) => set('neighborhood', e.target.value)} placeholder="Escolha ou digite" />
              <datalist id="hoods">{NEIGHBORHOODS.map((n) => <option key={n} value={n} />)}</datalist>
            </label>
          </div>
          <div className="grid g4">
            <label className="f" style={{ gridColumn: 'span 2' }}>Endereço
              <input value={p.address} onChange={(e) => set('address', e.target.value)} placeholder="Rua, número – bairro" />
            </label>
            <label className="f">Distância do mar (m)
              <input type="number" min="0" inputMode="numeric" value={p.distance_to_sea_m} onChange={(e) => set('distance_to_sea_m', e.target.value)} />
            </label>
            <LocField lat={p.latitude} lng={p.longitude} onChange={(a, b) => { set('latitude', a); set('longitude', b); }} />
          </div>
        </div>
      </section>

      <section className="card pad section">
        <h2>2. Características</h2>
        <div className="grid g3">
          <label className="f">Capacidade máx. de hóspedes *
            <input type="number" min="1" inputMode="numeric" value={p.capacity} onChange={(e) => set('capacity', e.target.value)} />
          </label>
          <label className="f">Dormitórios
            <input type="number" min="0" inputMode="numeric" value={p.bedrooms} onChange={(e) => set('bedrooms', e.target.value)} />
          </label>
          <label className="f">Suítes
            <input type="number" min="0" inputMode="numeric" value={p.suites} onChange={(e) => set('suites', e.target.value)} />
          </label>
          <label className="f">Banheiros
            <input type="number" min="0" inputMode="numeric" value={p.bathrooms} onChange={(e) => set('bathrooms', e.target.value)} />
          </label>
          <label className="f">Vagas de garagem
            <input type="number" min="0" inputMode="numeric" value={p.parking_spots} onChange={(e) => set('parking_spots', e.target.value)} />
          </label>
        </div>
        <h3 style={{ marginTop: 16 }}>Comodidades</h3>
        <div className="checks">
          {[...new Set([...AMENITIES, ...p.amenities])].map((a) => (
            <label key={a}>
              <input type="checkbox" checked={p.amenities.includes(a)}
                onChange={(e) => set('amenities', e.target.checked ? [...p.amenities, a] : p.amenities.filter((x) => x !== a))} />
              {a}
            </label>
          ))}
        </div>
        <div className="row" style={{ marginTop: 8 }}>
          <input id="newamen" placeholder="Outra comodidade…" style={{ maxWidth: 280 }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                const v = e.currentTarget.value.trim();
                if (v && !p.amenities.includes(v)) set('amenities', [...p.amenities, v]);
                e.currentTarget.value = '';
              }
            }} />
          <span className="small muted">digite e aperte Enter</span>
        </div>
      </section>

      <section className="card pad section">
        <h2>3. Descrição e regras</h2>
        <div className="grid">
          <label className="f">Descrição (aparece no site)
            <textarea rows={6} value={p.description} onChange={(e) => set('description', e.target.value)} />
          </label>
          <label className="f">Regras da casa
            <textarea rows={4} value={p.rules} onChange={(e) => set('rules', e.target.value)} placeholder="Ex.: Entrada a partir das 14h, saída até 11h. Não é permitido fumar. Proibido festas." />
          </label>
        </div>
      </section>

      <section className="card pad section">
        <h2>4. Preços (valor final ao hóspede, já com comissão)</h2>
        <div className="grid g4">
          <label className="f">Diária padrão *
            <input type="text" inputMode="decimal" placeholder="Ex.: 980" value={p.price_per_night} onChange={(e) => set('price_per_night', e.target.value)} />
          </label>
          <label className="f">Diária festas (referência)
            <input type="text" inputMode="decimal" placeholder="Ex.: 980" value={p.price_holiday} onChange={(e) => set('price_holiday', e.target.value)} />
          </label>
          <label className="f">Taxa de limpeza
            <input type="text" inputMode="decimal" placeholder="Ex.: 980" value={p.cleaning_fee} onChange={(e) => set('cleaning_fee', e.target.value)} />
          </label>
          <label className="f">Estadia mínima (noites)
            <input type="number" min="1" inputMode="numeric" value={p.min_nights} onChange={(e) => set('min_nights', e.target.value)} />
          </label>
        </div>
        <p className="small muted" style={{ marginTop: 8, marginBottom: 0 }}>
          Limpeza padrão: R$ 250 (1 dormitório/JK) • R$ 350 (2 quartos) • a partir de R$ 350 (3+ quartos). Use 0 quando a limpeza estiver inclusa.
        </p>
      </section>

      {!isNew && (
        <>
          <section className="card pad section">
            <h2>5. Preços por período (alta temporada, Réveillon, Carnaval)</h2>
            <p className="small muted">Cada noite dentro do período usa esta diária. A "data final" é o dia da saída. O Réveillon tem prioridade quando há sobreposição.</p>
            {rates.length > 0 && (
              <table className="tbl resp" style={{ marginBottom: 12 }}>
                <thead><tr><th>Período</th><th>Tipo</th><th>Noites</th><th>Diária</th><th>Mín.</th><th></th></tr></thead>
                <tbody>
                  {rates.map((r) => (
                    <tr key={r.id}>
                      <td data-l="Período"><b>{r.label}</b></td>
                      <td data-l="Tipo">{RATE_KINDS[r.kind]}</td>
                      <td data-l="Noites">{brDate(r.start_date)} → {brDate(r.end_date)}</td>
                      <td data-l="Diária">{money(r.price_per_night)}</td>
                      <td data-l="Mínimo">{r.min_nights} noites</td>
                      <td><div className="row" style={{ gap: 4 }}>
                        <button className="btn small ghost" onClick={() => editRatePrice(r)}>Alterar valor</button>
                        <button className="btn small danger" onClick={() => delRate(r)}>Excluir</button>
                      </div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <form onSubmit={addRate} className="stack">
              <div className="grid g3">
                <label className="f">Nome
                  <input value={nr.label} onChange={(e) => setNr({ ...nr, label: e.target.value })} placeholder="Ex.: Janeiro 2027" />
                </label>
                <label className="f">Tipo
                  <select value={nr.kind} onChange={(e) => setNr({ ...nr, kind: e.target.value })}>
                    {Object.entries(RATE_KINDS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </label>
                <label className="f">Diária no período
                  <input type="text" inputMode="decimal" placeholder="Ex.: 1.200" value={nr.price_per_night} onChange={(e) => setNr({ ...nr, price_per_night: e.target.value })} />
                </label>
                <label className="f">Primeira noite
                  <input type="date" value={nr.start_date} onChange={(e) => setNr({ ...nr, start_date: e.target.value })} />
                </label>
                <label className="f">Data de saída (fim)
                  <input type="date" value={nr.end_date} onChange={(e) => setNr({ ...nr, end_date: e.target.value })} />
                </label>
                <label className="f">Estadia mínima
                  <input type="number" min="1" value={nr.min_nights} onChange={(e) => setNr({ ...nr, min_nights: e.target.value })} />
                </label>
              </div>
              {rateErr && <div className="alert err">{rateErr}</div>}
              <div className="row">
                <button className="btn">+ Adicionar período</button>
                <button type="button" className="btn ghost small" onClick={() => setNr({
                  label: 'Réveillon 2026/27', kind: 'reveillon', start_date: REVEILLON_DEFAULT.start, end_date: REVEILLON_DEFAULT.end,
                  price_per_night: p.price_holiday || p.price_per_night, min_nights: REVEILLON_DEFAULT.min,
                })}>Preencher padrão Réveillon</button>
              </div>
            </form>
          </section>

          <section className="card pad section">
            <h2>6. Pacotes (datas fechadas com valor total)</h2>
            {packages.length > 0 && (
              <table className="tbl resp" style={{ marginBottom: 12 }}>
                <thead><tr><th>Pacote</th><th>Entrada</th><th>Saída</th><th>Total</th><th></th></tr></thead>
                <tbody>
                  {packages.map((k) => (
                    <tr key={k.id}>
                      <td data-l="Pacote"><b>{k.label}</b>{k.notes && <div className="small muted">{k.notes}</div>}</td>
                      <td data-l="Entrada">{brDate(k.check_in)}</td>
                      <td data-l="Saída">{brDate(k.check_out)} ({nightsBetween(k.check_in, k.check_out)} noites)</td>
                      <td data-l="Total">{money(k.total_price)}<div className="small muted">{k.cleaning_included ? 'limpeza inclusa' : '+ limpeza'}</div></td>
                      <td><button className="btn small danger" onClick={() => delPackage(k)}>Excluir</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <form onSubmit={addPackage} className="stack">
              <div className="grid g4">
                <label className="f">Nome do pacote
                  <input value={nk.label} onChange={(e) => setNk({ ...nk, label: e.target.value })} placeholder="Pacote Réveillon" />
                </label>
                <label className="f">Entrada
                  <input type="date" value={nk.check_in} onChange={(e) => setNk({ ...nk, check_in: e.target.value })} />
                </label>
                <label className="f">Saída
                  <input type="date" value={nk.check_out} onChange={(e) => setNk({ ...nk, check_out: e.target.value })} />
                </label>
                <label className="f">Valor total
                  <input type="text" inputMode="decimal" placeholder="Ex.: 15.800" value={nk.total_price} onChange={(e) => setNk({ ...nk, total_price: e.target.value })} />
                </label>
              </div>
              <label className="row small" style={{ gap: 8, cursor: 'pointer' }}>
                <input type="checkbox" style={{ width: 18, height: 18, minHeight: 0 }} checked={nk.cleaning_included}
                  onChange={(e) => setNk({ ...nk, cleaning_included: e.target.checked })} />
                Limpeza já inclusa no valor do pacote
              </label>
              {pkErr && <div className="alert err">{pkErr}</div>}
              <div><button className="btn">+ Adicionar pacote</button></div>
            </form>
          </section>

          <section className="card pad section">
            <h2>7. Fotos</h2>
            <div className="row" style={{ marginBottom: 12 }}>
              <label className="btn sun" style={{ cursor: 'pointer' }}>
                + Enviar fotos
                <input type="file" accept="image/*" multiple hidden onChange={(e) => { upload(e.target.files); e.target.value = ''; }} />
              </label>
              <span className="small muted">{uploading || `${p.photos.length} foto(s). Selecione várias de uma vez. ★ define a foto principal.`}</span>
            </div>
            {p.photos.length > 0 && (
              <div className="photos">
                {p.photos.map((url, i) => (
                  <div className="photo" key={url}>
                    <img src={url} alt={`Foto ${i + 1}`} loading="lazy" />
                    {(p.cover_photo === url || (!p.cover_photo && i === 0)) && <span className="badge green cover-tag">Principal</span>}
                    <div className="tools">
                      <button onClick={() => move(i, -1)} aria-label="Mover para esquerda">◀</button>
                      <button onClick={() => makeCover(url)} title="Tornar principal">★</button>
                      <button onClick={() => removePhoto(url)} title="Remover">✕</button>
                      <button onClick={() => move(i, 1)} aria-label="Mover para direita">▶</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}

      <section className="card pad section private">
        <h2>🔒 Proprietário e condições comerciais (nunca aparece no site)</h2>
        <div className="grid g4">
          <label className="f">Proprietário
            <input value={priv.owner_name} onChange={(e) => setPv('owner_name', e.target.value)} />
          </label>
          <label className="f">Telefone do proprietário
            <input inputMode="tel" value={priv.owner_phone} onChange={(e) => setPv('owner_phone', e.target.value)} />
          </label>
          <label className="f">Administração / chaves
            <input value={priv.manager_name} onChange={(e) => setPv('manager_name', e.target.value)} />
          </label>
          <label className="f">Telefone administração
            <input inputMode="tel" value={priv.manager_phone} onChange={(e) => setPv('manager_phone', e.target.value)} />
          </label>
          <label className="f">Líquido proprietário (diária)
            <input type="text" inputMode="decimal" value={priv.owner_net_price} onChange={(e) => setPv('owner_net_price', e.target.value)} />
          </label>
          <label className="f">Líquido proprietário (festas)
            <input type="text" inputMode="decimal" value={priv.owner_net_price_holiday} onChange={(e) => setPv('owner_net_price_holiday', e.target.value)} />
          </label>
          <label className="f">Comissão (%)
            <input type="number" min="0" value={priv.commission_pct} onChange={(e) => setPv('commission_pct', e.target.value)} />
          </label>
          <div className="f small">
            <span>Sugestão com comissão</span>
            <div style={{ paddingTop: 10 }}>
              {suggested ? <><b>{money(suggested)}</b>{' '}
                <button type="button" className="btn small ghost" onClick={() => set('price_per_night', suggested)}>usar como diária</button></> : '—'}
            </div>
          </div>
        </div>
        <div className="grid g2" style={{ marginTop: 12 }}>
          <label className="f">Condições comerciais
            <textarea rows={3} value={priv.commercial_terms} onChange={(e) => setPv('commercial_terms', e.target.value)} placeholder="Sinal, forma de pagamento, repasse…" />
          </label>
          <label className="f">Anotações internas
            <textarea rows={3} value={priv.internal_notes} onChange={(e) => setPv('internal_notes', e.target.value)} />
          </label>
        </div>
      </section>

      {!isNew && (
        <section className="card pad section">
          <div className="row between">
            <h2 style={{ margin: 0 }}>8. Próximas reservas e bloqueios</h2>
            <Link className="btn small" href={`/admin/reservas?imovel=${id}`}>Gerenciar</Link>
          </div>
          {bookings.length === 0 ? (
            <p className="muted small" style={{ marginTop: 10 }}>Nenhuma reserva futura.</p>
          ) : (
            <table className="tbl resp" style={{ marginTop: 10 }}>
              <tbody>
                {bookings.map((b) => (
                  <tr key={b.id}>
                    <td data-l="Datas">{brDate(b.start_date)} → {brDate(b.end_date)}</td>
                    <td data-l="Hóspede">{b.guest_name}</td>
                    <td data-l="Status"><span className={`badge ${BOOKING_STATUS[b.status]?.tone}`}>{BOOKING_STATUS[b.status]?.label}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      )}
    </div>
  );
}

export default function Page() {
  return (
    <AdminShell>
      <Editor />
    </AdminShell>
  );
}

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

export function money(v) {
  if (v === null || v === undefined || v === '' || isNaN(Number(v))) return '—';
  return brl.format(Number(v));
}

/** 'YYYY-MM-DD' -> 'DD/MM/AAAA' sem fuso horário. */
export function brDate(iso) {
  if (!iso) return '';
  const [y, m, d] = String(iso).slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}

export function shortDate(iso) {
  if (!iso) return '';
  const [, m, d] = String(iso).slice(0, 10).split('-');
  return `${d}/${m}`;
}

/** Datas como texto 'YYYY-MM-DD' (evita problemas de fuso). */
export function toISO(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function fromISO(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(iso, n) {
  const dt = fromISO(iso);
  dt.setDate(dt.getDate() + n);
  return toISO(dt);
}

export function nightsBetween(a, b) {
  if (!a || !b) return 0;
  return Math.round((fromISO(b) - fromISO(a)) / 86400000);
}

export function todayISO() {
  return toISO(new Date());
}

/** Datas ocupadas (noites) a partir de intervalos [start, end). */
export function busySet(ranges) {
  const s = new Set();
  for (const r of ranges || []) {
    let d = r.start_date;
    while (d < r.end_date) {
      s.add(d);
      d = addDays(d, 1);
    }
  }
  return s;
}

export function coverOf(p) {
  return p?.cover_photo || (p?.photos && p.photos[0]) || null;
}

export function whatsappLink(number, text) {
  return `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
}

/** Normaliza texto para busca (sem acento, minúsculo). */
export function norm(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

/**
 * Converte valores digitados do jeito brasileiro em número:
 * "15.800" -> 15800 • "1.200,50" -> 1200.5 • "R$ 980" -> 980 • "980.5" -> 980.5
 */
export function toNum(v) {
  if (v === null || v === undefined) return null;
  if (typeof v === 'number') return v;
  let s = String(v).replace(/[R$\s]/g, '');
  if (s === '') return null;
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
}

import { createClient } from '@supabase/supabase-js';

// Chaves PÚBLICAS (publishable). A segurança vem das regras RLS no banco:
// visitantes só leem imóveis publicados; só administradores alteram dados.
// Nunca coloque a service_role key neste projeto.
export const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://kbfkdzdkjmderscrehwy.supabase.co';
export const SUPABASE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_KEY || 'sb_publishable_7WLEBpmzeWJUEJyBf-Z4SA_GZHYJsty';

let browserClient;

/** Cliente do navegador (mantém a sessão do admin). */
export function getSupabase() {
  if (typeof window === 'undefined') return serverSupabase();
  if (!browserClient) {
    browserClient = createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, storageKey: 'icc-admin-auth' },
    });
  }
  return browserClient;
}

/** Cliente do servidor para páginas públicas (sem sessão, sem cache). */
export function serverSupabase() {
  return createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: (url, opts) => fetch(url, { ...opts, cache: 'no-store' }) },
  });
}

export const PUBLIC_PROPERTY_FIELDS =
  'id, code, title, description, rules, property_type, city, neighborhood, address, latitude, longitude, ' +
  'distance_to_sea_m, capacity, bedrooms, suites, bathrooms, parking_spots, amenities, photos, cover_photo, ' +
  'price_per_night, price_holiday, cleaning_fee, min_nights, status';

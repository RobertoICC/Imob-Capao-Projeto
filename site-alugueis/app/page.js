import { serverSupabase, PUBLIC_PROPERTY_FIELDS } from '@/lib/supabase';
import { SiteHeader, SiteFooter } from '@/components/SiteChrome';
import Catalog from '@/components/Catalog';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const sb = serverSupabase();
  const [{ data: properties, error }, { data: rates }, { data: packages }] = await Promise.all([
    sb.from('properties').select(PUBLIC_PROPERTY_FIELDS).eq('status', 'published').order('code'),
    sb.from('property_rates').select('property_id, kind, label, price_per_night, start_date, end_date, min_nights'),
    sb.from('property_packages').select('property_id, label, total_price, check_in, check_out'),
  ]);

  return (
    <>
      <SiteHeader />
      <section className="hero">
        <div className="wrap">
          <h1>Sua temporada de verão no litoral gaúcho</h1>
          <p>
            Apartamentos e casas selecionados em Capão da Canoa e Xangri-Lá. Escolha as datas, veja o valor total
            na hora e fale direto com a gente pelo WhatsApp.
          </p>
        </div>
      </section>
      {error ? (
        <div className="wrap" style={{ margin: '30px auto' }}>
          <div className="alert err">Não foi possível carregar os imóveis agora. Tente novamente em instantes.</div>
        </div>
      ) : (
        <Catalog properties={properties || []} rates={rates || []} packages={packages || []} />
      )}
      <SiteFooter />
    </>
  );
}

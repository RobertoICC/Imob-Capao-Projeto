import Link from 'next/link';
import { SiteHeader, SiteFooter } from '@/components/SiteChrome';

export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <main className="wrap center-screen">
        <div className="card pad" style={{ textAlign: 'center', maxWidth: 460 }}>
          <h1>Imóvel não encontrado</h1>
          <p className="muted">Ele pode ter sido alugado ou retirado do catálogo.</p>
          <Link className="btn" href="/">Ver imóveis disponíveis</Link>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}

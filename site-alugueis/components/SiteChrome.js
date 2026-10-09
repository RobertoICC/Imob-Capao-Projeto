import Link from 'next/link';
import { BRAND } from '@/lib/constants';
import { whatsappLink } from '@/lib/format';

export function SiteHeader() {
  return (
    <header className="topbar">
      <div className="wrap">
        <Link href="/" className="brand">
          <strong>{BRAND.name}</strong>
          <span>Aluguel de temporada • Capão da Canoa e Xangri-Lá</span>
        </Link>
        <nav>
          <a
            className="btn wa small"
            href={whatsappLink(BRAND.whatsapp, 'Olá! Quero informações sobre aluguel de temporada.')}
            target="_blank"
            rel="noopener noreferrer"
          >
            WhatsApp {BRAND.whatsappLabel}
          </a>
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="site">
      <div className="wrap stack">
        <div>
          <strong style={{ color: '#fff' }}>{BRAND.name}</strong> — {BRAND.slogan}
        </div>
        <div>
          {BRAND.address} • Atendimento de domingo a domingo • {BRAND.creci}
        </div>
        <div>
          Atendimento em português, español e English •{' '}
          <a href={whatsappLink(BRAND.whatsapp, 'Olá!')} target="_blank" rel="noopener noreferrer">
            WhatsApp {BRAND.whatsappLabel}
          </a>
        </div>
      </div>
    </footer>
  );
}

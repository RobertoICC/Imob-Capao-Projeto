import './globals.css';

export const metadata = {
  title: 'Aluguel de Temporada em Capão da Canoa e Xangri-Lá | Imobiliária Capão da Canoa',
  description:
    'Apartamentos e casas para aluguel de temporada no verão em Capão da Canoa e Xangri-Lá. Consulte disponibilidade, valores do Réveillon e reserve pelo WhatsApp.',
};

export const viewport = { width: 'device-width', initialScale: 1, themeColor: '#0e4a5c' };

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}

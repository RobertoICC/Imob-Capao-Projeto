export const BRAND = {
  name: 'Imobiliária Capão da Canoa',
  slogan: 'Confiança e Honestidade você encontra aqui',
  whatsapp: '5551984211346',
  whatsappLabel: '(51) 98421-1346',
  address: 'Rua Sepé, 2222 – Loja 06, Centro – Capão da Canoa/RS',
  creci: 'CRECI 33.859',
};

export const CITIES = ['Capão da Canoa', 'Xangri-Lá'];

export const NEIGHBORHOODS = [
  'Centro', 'Zona Nova', 'Navegantes', 'Araçá', 'Arco-Íris', 'Guarani', 'Capão Novo',
  'Santa Luzia', 'Parque Antártica', 'Zona Norte', 'Atlântida', 'Rainha do Mar', 'Remanso',
];

export const PROPERTY_TYPES = {
  apartamento: 'Apartamento',
  casa: 'Casa',
  casa_condominio: 'Casa em condomínio',
  cobertura: 'Cobertura',
  jk: 'JK / Kitnet',
  flat: 'Flat',
  sobrado: 'Sobrado',
};

export const AMENITIES = [
  'Wi-Fi', 'Ar-condicionado', 'Ventilador de teto', 'Smart TV', 'Vista mar', 'Sacada',
  'Churrasqueira', 'Piscina', 'Garagem', 'Elevador', 'Lavadora', 'Condomínio fechado',
  'Salão de festas', 'Sala de jogos', 'Academia', 'Cadeiras de praia e guarda-sol',
  'Aceita pet', 'Roupa de cama', 'Cozinha equipada', 'Microondas', 'Portaria 24h',
];

export const STATUS = {
  draft: { label: 'Rascunho', tone: 'gray' },
  published: { label: 'Publicado', tone: 'green' },
  reserved: { label: 'Reservado', tone: 'blue' },
  unavailable: { label: 'Indisponível', tone: 'orange' },
  archived: { label: 'Arquivado', tone: 'gray' },
};

export const RATE_KINDS = {
  alta: 'Alta temporada',
  reveillon: 'Réveillon',
  carnaval: 'Carnaval',
  periodo: 'Período especial',
  baixa: 'Baixa temporada',
};

export const BOOKING_STATUS = {
  pending: { label: 'Solicitação', tone: 'orange' },
  confirmed: { label: 'Confirmada', tone: 'green' },
  blocked: { label: 'Bloqueio', tone: 'blue' },
  declined: { label: 'Recusada', tone: 'gray' },
  cancelled: { label: 'Cancelada', tone: 'gray' },
};

// Padrão sugerido para o Réveillon (editável em cada imóvel)
export const REVEILLON_DEFAULT = { start: '2026-12-27', end: '2027-01-03', min: 5 };

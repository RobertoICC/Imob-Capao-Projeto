# Site de aluguéis de temporada — Imobiliária Capão da Canoa

Catálogo público + painel administrativo (Next.js 16 + Supabase).

- `/` catálogo com filtros (cidade, bairro, hóspedes, comodidades, período)
- `/imovel/ICC-001` página do imóvel: galeria, preços por período, calendário, cálculo do total, WhatsApp e solicitação de reserva
- `/admin` painel (login Supabase + lista `admins`): cadastrar, editar (salva sozinho), duplicar, publicar, despublicar, arquivar, fotos com foto principal, períodos, pacotes, dados privados do proprietário
- `/admin/reservas` solicitações, confirmações e bloqueios (o banco impede conflito de datas confirmadas)

Segurança: só chaves públicas no navegador; as permissões ficam nas regras RLS do Supabase
(`is_admin()`), e os dados do proprietário ficam em `property_private`, que o público não lê.

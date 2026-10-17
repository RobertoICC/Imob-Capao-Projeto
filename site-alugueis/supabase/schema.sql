-- =====================================================================
-- ESTRUTURA COMPLETA DO BANCO — Site de Aluguéis de Temporada
-- Imobiliária Capão da Canoa • cópia de segurança de 17/10/2026
--
-- Use em um projeto NOVO do Supabase:
--   SQL Editor > New query > colar este arquivo inteiro > Run
-- Antes, crie o usuário administrador em Authentication > Users > Add user
-- e troque o e-mail na seção 10 (ADMINISTRADOR).
-- =====================================================================

create extension if not exists btree_gist;
create extension if not exists pgcrypto;

-- 1) FUNÇÕES AUXILIARES ------------------------------------------------
create or replace function public.set_updated_at() returns trigger
language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

-- 2) IMÓVEIS ------------------------------------------------------------
create table if not exists public.properties (
  id uuid primary key default gen_random_uuid(),
  code text unique,
  title text not null,
  description text not null default '',
  rules text not null default '',
  property_type text not null default 'apartamento'
    check (property_type in ('apartamento','casa','casa_condominio','cobertura','jk','flat','sobrado')),
  city text not null default 'Capão da Canoa',
  neighborhood text,
  address text,
  latitude numeric,
  longitude numeric,
  distance_to_sea_m int check (distance_to_sea_m >= 0),
  capacity int not null check (capacity > 0),
  bedrooms int check (bedrooms >= 0),
  suites int check (suites >= 0),
  bathrooms int check (bathrooms >= 0),
  parking_spots int check (parking_spots >= 0),
  amenities text[] not null default '{}',
  photos text[] not null default '{}',
  cover_photo text,
  price_per_night numeric(10,2) not null check (price_per_night >= 0),   -- diária padrão (já com comissão)
  price_holiday numeric check (price_holiday is null or price_holiday >= 0), -- referência de festas
  cleaning_fee numeric not null default 350 check (cleaning_fee >= 0),
  min_nights int not null default 2 check (min_nights >= 1),
  status text not null default 'draft'
    check (status in ('draft','published','reserved','unavailable','archived')),
  active boolean not null default true,   -- espelho de status = 'published'
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace trigger set_properties_updated_at before update on public.properties
  for each row execute function public.set_updated_at();

create or replace function public.sync_property_active() returns trigger language plpgsql as $$
begin new.active := (new.status = 'published'); return new; end $$;
create or replace trigger sync_property_active before insert or update of status on public.properties
  for each row execute function public.sync_property_active();

create sequence if not exists public.property_code_seq;
create or replace function public.set_property_code() returns trigger language plpgsql as $$
begin
  if new.code is null or new.code = '' then
    new.code := 'ICC-' || lpad(nextval('public.property_code_seq')::text, 3, '0');
  end if;
  return new;
end $$;
create or replace trigger set_property_code before insert on public.properties
  for each row execute function public.set_property_code();

-- 3) DADOS PRIVADOS DO PROPRIETÁRIO (só admin) -------------------------
create table if not exists public.property_private (
  property_id uuid primary key references public.properties(id) on delete cascade,
  owner_name text, owner_phone text,
  manager_name text, manager_phone text,
  owner_net_price numeric, owner_net_price_holiday numeric,
  commission_pct numeric not null default 20,
  commercial_terms text, internal_notes text,
  updated_at timestamptz not null default now()
);

-- 4) PREÇOS POR PERÍODO -------------------------------------------------
create table if not exists public.property_rates (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  label text not null,
  kind text not null default 'periodo' check (kind in ('periodo','alta','reveillon','carnaval','baixa')),
  start_date date not null,     -- primeira noite
  end_date date not null,       -- data de saída
  price_per_night numeric not null check (price_per_night >= 0),
  min_nights int not null default 1 check (min_nights >= 1),
  created_at timestamptz not null default now(),
  check (end_date > start_date)
);
create index if not exists property_rates_prop on public.property_rates(property_id, start_date);

-- 5) PACOTES -------------------------------------------------------------
create table if not exists public.property_packages (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  label text not null,
  check_in date not null,
  check_out date not null,
  total_price numeric not null check (total_price >= 0),
  min_nights int,
  notes text,
  cleaning_included boolean not null default false,
  created_at timestamptz not null default now(),
  check (check_out > check_in)
);

-- 6) RESERVAS, SOLICITAÇÕES E BLOQUEIOS ---------------------------------
create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  guest_name text not null,
  phone text, email text,
  start_date date not null,
  end_date date not null,
  guests int check (guests > 0),
  total_price numeric check (total_price >= 0),
  status text not null default 'pending'
    check (status in ('pending','confirmed','declined','cancelled','blocked')),
  source text not null default 'site' check (source in ('site','manual','whatsapp','block')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date > start_date),
  constraint contact_required_for_site_bookings check (source = 'manual' or phone is not null or email is not null),
  -- só reservas confirmadas e bloqueios travam o calendário
  constraint no_overlapping_bookings exclude using gist
    (property_id with =, daterange(start_date, end_date, '[)') with &&)
    where (status in ('confirmed','blocked'))
);
create or replace trigger set_bookings_updated_at before update on public.bookings
  for each row execute function public.set_updated_at();

-- 7) ADMINISTRADORES + SEGURANÇA (RLS) ----------------------------------
create table if not exists public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;
grant execute on function public.is_admin() to anon, authenticated;

alter table public.properties enable row level security;
alter table public.property_private enable row level security;
alter table public.property_rates enable row level security;
alter table public.property_packages enable row level security;
alter table public.bookings enable row level security;
alter table public.admins enable row level security;

drop policy if exists admins_self_read on public.admins;
create policy admins_self_read on public.admins for select to authenticated using (user_id = auth.uid());

drop policy if exists properties_public_read on public.properties;
create policy properties_public_read on public.properties for select to anon, authenticated using (active = true);
drop policy if exists properties_admin_all on public.properties;
create policy properties_admin_all on public.properties for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists property_private_admin_all on public.property_private;
create policy property_private_admin_all on public.property_private for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists property_rates_public_read on public.property_rates;
create policy property_rates_public_read on public.property_rates for select to anon, authenticated
  using (exists (select 1 from public.properties p where p.id = property_id and p.status = 'published'));
drop policy if exists property_rates_admin_all on public.property_rates;
create policy property_rates_admin_all on public.property_rates for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists property_packages_public_read on public.property_packages;
create policy property_packages_public_read on public.property_packages for select to anon, authenticated
  using (exists (select 1 from public.properties p where p.id = property_id and p.status = 'published'));
drop policy if exists property_packages_admin_all on public.property_packages;
create policy property_packages_admin_all on public.property_packages for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists bookings_public_insert on public.bookings;
create policy bookings_public_insert on public.bookings for insert to anon
  with check (status = 'pending' and source = 'site');
drop policy if exists bookings_admin_all on public.bookings;
create policy bookings_admin_all on public.bookings for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- 8) FOTOS (Storage) -----------------------------------------------------
insert into storage.buckets (id, name, public) values ('property-photos', 'property-photos', true)
  on conflict (id) do nothing;

drop policy if exists property_photos_public_read on storage.objects;
create policy property_photos_public_read on storage.objects for select to anon, authenticated
  using (bucket_id = 'property-photos');
drop policy if exists property_photos_admin_write on storage.objects;
create policy property_photos_admin_write on storage.objects for insert to authenticated
  with check (bucket_id = 'property-photos' and public.is_admin());
drop policy if exists property_photos_admin_update on storage.objects;
create policy property_photos_admin_update on storage.objects for update to authenticated
  using (bucket_id = 'property-photos' and public.is_admin());
drop policy if exists property_photos_admin_delete on storage.objects;
create policy property_photos_admin_delete on storage.objects for delete to authenticated
  using (bucket_id = 'property-photos' and public.is_admin());

-- 9) FUNÇÕES PÚBLICAS: datas ocupadas e cálculo da estadia ---------------
create or replace function public.get_busy_ranges(p_property_id uuid)
returns table(start_date date, end_date date)
language sql stable security definer set search_path = public as $$
  select b.start_date, b.end_date from public.bookings b
  join public.properties p on p.id = b.property_id and p.status = 'published'
  where b.property_id = p_property_id
    and b.status in ('confirmed','blocked')
    and b.end_date >= current_date
  order by b.start_date;
$$;
grant execute on function public.get_busy_ranges(uuid) to anon, authenticated;

create or replace function public.quote_stay(p_property_id uuid, p_check_in date, p_check_out date)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  prop public.properties%rowtype;
  pkg  public.property_packages%rowtype;
  r    public.property_rates%rowtype;
  d date; nightly numeric; lbl text; fee numeric;
  subtotal numeric := 0; nights int; min_req int; busy boolean;
  breakdown jsonb := '[]'::jsonb;
begin
  select * into prop from public.properties where id = p_property_id and status = 'published';
  if not found then return jsonb_build_object('ok', false, 'error', 'Imóvel não disponível'); end if;
  if p_check_in is null or p_check_out is null or p_check_out <= p_check_in then
    return jsonb_build_object('ok', false, 'error', 'A saída deve ser depois da entrada');
  end if;
  nights  := p_check_out - p_check_in;
  min_req := prop.min_nights;

  select exists (select 1 from public.bookings b
     where b.property_id = p_property_id and b.status in ('confirmed','blocked')
       and daterange(b.start_date, b.end_date, '[)') && daterange(p_check_in, p_check_out, '[)'))
    into busy;

  select * into pkg from public.property_packages
   where property_id = p_property_id and check_in = p_check_in and check_out = p_check_out limit 1;
  if found then
    fee := case when pkg.cleaning_included then 0 else prop.cleaning_fee end;
    return jsonb_build_object('ok', not busy, 'available', not busy, 'nights', nights,
      'package', pkg.label, 'subtotal', pkg.total_price, 'cleaning_fee', fee,
      'cleaning_included', pkg.cleaning_included,
      'total', pkg.total_price + fee, 'min_nights', coalesce(pkg.min_nights, nights),
      'error', case when busy then 'Datas indisponíveis' end);
  end if;

  d := p_check_in;
  while d < p_check_out loop
    select * into r from public.property_rates
     where property_id = p_property_id and d >= start_date and d < end_date
     order by (kind = 'reveillon') desc, (end_date - start_date) asc limit 1;
    if found then
      nightly := r.price_per_night; lbl := r.label; min_req := greatest(min_req, r.min_nights);
    else
      nightly := prop.price_per_night; lbl := 'Diária';
    end if;
    subtotal  := subtotal + nightly;
    breakdown := breakdown || jsonb_build_object('date', d, 'price', nightly, 'label', lbl);
    d := d + 1;
  end loop;

  return jsonb_build_object(
    'ok', (not busy) and nights >= min_req,
    'available', not busy, 'nights', nights, 'min_nights', min_req,
    'subtotal', subtotal, 'cleaning_fee', prop.cleaning_fee,
    'total', subtotal + prop.cleaning_fee, 'nights_detail', breakdown,
    'error', case when busy then 'Datas indisponíveis'
                  when nights < min_req then 'Estadia mínima de ' || min_req || ' noites para este período' end);
end $$;
grant execute on function public.quote_stay(uuid, date, date) to anon, authenticated;

-- 10) ADMINISTRADOR -------------------------------------------------------
-- Troque o e-mail abaixo pelo do usuário criado em Authentication > Users.
insert into public.admins(user_id)
  select id from auth.users where email = 'SEU-EMAIL@exemplo.com'
  on conflict do nothing;

-- Conferência: deve mostrar o e-mail do administrador
select u.email as administrador from public.admins a join auth.users u on u.id = a.user_id;

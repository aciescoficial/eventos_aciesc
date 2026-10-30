-- Fase 3 — Eventos, datas, tipos de ingresso, regras de preço por perfil, lotes e cupons.

create type public.event_kind as enum ('free_course', 'paid', 'open_free');
create type public.event_format as enum ('in_person', 'online', 'hybrid');
create type public.event_visibility as enum ('public', 'associates', 'associates_adepts', 'private');
create type public.event_status as enum ('draft', 'published', 'closed', 'cancelled');
create type public.price_mode as enum ('free', 'percent', 'fixed', 'full', 'blocked');
create type public.lot_trigger as enum ('quantity', 'date', 'manual');
create type public.lot_status as enum ('scheduled', 'active', 'closed');
create type public.coupon_kind as enum ('percent', 'fixed');

create table public.venues (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text not null,
  city text not null,
  maps_url text,
  parking_info text,
  lat double precision,
  lng double precision,
  created_at timestamptz not null default now()
);

-- Regras dos cursos gratuitos (seção 8). Cada chave é um interruptor do painel.
create or replace function private.default_event_rules()
returns jsonb language sql immutable set search_path = '' as $$
  select jsonb_build_object(
    'free_only_active_associates', false,
    'one_per_cpf', false,
    'confirm_presence_48h', false,
    'release_unconfirmed_24h', false,
    'require_checkout', false,
    'register_absence', false,
    'waitlist_enabled', true,
    'waitlist_accept_hours', 4
  );
$$;

create table public.events (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title text not null check (length(trim(title)) between 3 and 160),
  kind public.event_kind not null default 'free_course',
  category text,
  summary text,
  description text,
  cover_url text,
  format public.event_format not null default 'in_person',
  venue_id uuid references public.venues (id) on delete set null,
  visibility public.event_visibility not null default 'public',
  certificate_hours numeric(5, 1) not null default 0 check (certificate_hours >= 0),
  status public.event_status not null default 'draft',
  rules jsonb not null default private.default_event_rules(),
  featured boolean not null default false,
  auto_messages jsonb not null default jsonb_build_object(
    'ticket', true, 'confirm_48h', true, 'reminder_2h', true, 'certificate', true),
  certificate_background_url text,
  published_at timestamptz,
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index events_status_idx on public.events (status, visibility);

-- Dados só para quem tem ingresso (link da transmissão online).
create table public.event_secrets (
  event_id uuid primary key references public.events (id) on delete cascade,
  online_url text,
  attendee_instructions text
);

create table public.event_dates (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  label text,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  capacity int not null check (capacity > 0),
  constraint event_dates_range check (ends_at > starts_at)
);
create index event_dates_event_idx on public.event_dates (event_id, starts_at);

create table public.speakers (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  name text not null,
  bio text,
  photo_url text,
  sort int not null default 0
);

create table public.ticket_types (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  name text not null,
  description text,
  people_per_ticket int not null default 1 check (people_per_ticket between 1 and 50),
  max_per_order int not null default 10 check (max_per_order between 1 and 100),
  visible boolean not null default true,
  sort int not null default 0
);
create index ticket_types_event_idx on public.ticket_types (event_id, sort);

create table public.tier_rules (
  id uuid primary key default gen_random_uuid(),
  ticket_type_id uuid not null references public.ticket_types (id) on delete cascade,
  tier public.membership_tier not null,
  mode public.price_mode not null,
  value numeric(10, 2),
  reserved_seats int not null default 0 check (reserved_seats >= 0),
  constraint tier_rules_unique unique (ticket_type_id, tier),
  constraint tier_rules_value check (
    (mode = 'percent' and value between 0 and 100) or
    (mode = 'fixed' and value >= 0) or
    (mode in ('free', 'full', 'blocked'))
  )
);

create table public.lots (
  id uuid primary key default gen_random_uuid(),
  ticket_type_id uuid not null references public.ticket_types (id) on delete cascade,
  event_date_id uuid not null references public.event_dates (id) on delete cascade,
  name text not null,
  base_price numeric(10, 2) not null default 0 check (base_price >= 0),
  quantity int not null check (quantity > 0),
  trigger public.lot_trigger not null default 'quantity',
  trigger_at timestamptz,
  status public.lot_status not null default 'scheduled',
  sort int not null default 0,
  activated_at timestamptz,
  closed_at timestamptz,
  constraint lots_trigger_at check (trigger <> 'date' or trigger_at is not null)
);
create index lots_type_date_idx on public.lots (ticket_type_id, event_date_id, sort);
create unique index lots_one_active on public.lots (ticket_type_id, event_date_id) where status = 'active';

create table public.coupons (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  code text not null check (code = upper(code) and code ~ '^[A-Z0-9_-]{3,30}$'),
  kind public.coupon_kind not null,
  value numeric(10, 2) not null check (value > 0),
  max_uses int,
  used int not null default 0,
  valid_until timestamptz,
  active boolean not null default true,
  constraint coupons_unique unique (event_id, code),
  constraint coupons_percent check (kind <> 'percent' or value <= 100)
);

create trigger events_touch before update on public.events
  for each row execute function private.touch_updated_at();

-- Publicação registra data e auditoria.
create or replace function private.events_status_change()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status is distinct from old.status then
    if new.status = 'published' and new.published_at is null then
      new.published_at := now();
    end if;
    perform private.audit('event.status', 'events', new.id::text,
      jsonb_build_object('from', old.status, 'to', new.status));
  end if;
  return new;
end;
$$;
create trigger events_status_change before update on public.events
  for each row execute function private.events_status_change();

-- Evento é visível ao público?
create or replace function private.event_is_public(p_event_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.events where id = p_event_id and status in ('published', 'closed'));
$$;
grant execute on function private.event_is_public(uuid) to anon, authenticated;

-- Pode gerenciar o evento (organizer global/admin ou organizer do evento).
create or replace function private.can_manage_event(p_event_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select private.has_role('organizer', p_event_id);
$$;
grant execute on function private.can_manage_event(uuid) to authenticated;

-- RLS ------------------------------------------------------------------------
alter table public.venues enable row level security;
alter table public.events enable row level security;
alter table public.event_secrets enable row level security;
alter table public.event_dates enable row level security;
alter table public.speakers enable row level security;
alter table public.ticket_types enable row level security;
alter table public.tier_rules enable row level security;
alter table public.lots enable row level security;
alter table public.coupons enable row level security;

create policy "venues: todos leem" on public.venues for select to anon, authenticated using (true);
create policy "venues: equipe escreve" on public.venues for all to authenticated
  using ((select private.is_staff())) with check ((select private.is_staff()));

create policy "events: público lê publicados" on public.events for select to anon, authenticated
  using (status in ('published', 'closed') or (select private.can_manage_event(id))
         or (select private.has_role('door', id)) or (select private.has_role('finance', id)));
create policy "events: equipe cria" on public.events for insert to authenticated
  with check ((select private.is_staff()));
create policy "events: equipe altera" on public.events for update to authenticated
  using ((select private.can_manage_event(id))) with check ((select private.can_manage_event(id)));
create policy "events: admin exclui rascunho" on public.events for delete to authenticated
  using ((select private.is_admin()) and status = 'draft');

create policy "event_secrets: equipe" on public.event_secrets for all to authenticated
  using ((select private.can_manage_event(event_id))) with check ((select private.can_manage_event(event_id)));

-- Tabelas filhas: leitura pública se o evento é público; escrita pela equipe do evento.
create policy "event_dates: leitura" on public.event_dates for select to anon, authenticated
  using ((select private.event_is_public(event_id)) or (select private.can_manage_event(event_id))
         or (select private.has_role('door', event_id)));
create policy "event_dates: escrita" on public.event_dates for all to authenticated
  using ((select private.can_manage_event(event_id))) with check ((select private.can_manage_event(event_id)));

create policy "speakers: leitura" on public.speakers for select to anon, authenticated
  using ((select private.event_is_public(event_id)) or (select private.can_manage_event(event_id)));
create policy "speakers: escrita" on public.speakers for all to authenticated
  using ((select private.can_manage_event(event_id))) with check ((select private.can_manage_event(event_id)));

create policy "ticket_types: leitura" on public.ticket_types for select to anon, authenticated
  using (((select private.event_is_public(event_id)) and visible) or (select private.can_manage_event(event_id)));
create policy "ticket_types: escrita" on public.ticket_types for all to authenticated
  using ((select private.can_manage_event(event_id))) with check ((select private.can_manage_event(event_id)));

create or replace function private.ticket_type_event(p_ticket_type_id uuid)
returns uuid language sql stable security definer set search_path = '' as $$
  select event_id from public.ticket_types where id = p_ticket_type_id;
$$;
grant execute on function private.ticket_type_event(uuid) to anon, authenticated;

create policy "tier_rules: leitura" on public.tier_rules for select to anon, authenticated
  using ((select private.event_is_public(private.ticket_type_event(ticket_type_id)))
         or (select private.can_manage_event(private.ticket_type_event(ticket_type_id))));
create policy "tier_rules: escrita" on public.tier_rules for all to authenticated
  using ((select private.can_manage_event(private.ticket_type_event(ticket_type_id))))
  with check ((select private.can_manage_event(private.ticket_type_event(ticket_type_id))));

create policy "lots: leitura" on public.lots for select to anon, authenticated
  using ((select private.event_is_public(private.ticket_type_event(ticket_type_id)))
         or (select private.can_manage_event(private.ticket_type_event(ticket_type_id))));
create policy "lots: escrita" on public.lots for all to authenticated
  using ((select private.can_manage_event(private.ticket_type_event(ticket_type_id))))
  with check ((select private.can_manage_event(private.ticket_type_event(ticket_type_id))));

-- Cupons nunca são listados ao público (evita descoberta); validação só via RPC.
create policy "coupons: equipe" on public.coupons for all to authenticated
  using ((select private.can_manage_event(event_id))) with check ((select private.can_manage_event(event_id)));

revoke insert, update, delete on public.venues, public.events, public.event_dates, public.speakers,
  public.ticket_types, public.tier_rules, public.lots from anon;
revoke all on public.coupons, public.event_secrets from anon;

-- Auditoria de alteração de preço/regra.
create or replace function private.price_audit()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform private.audit('price.' || lower(tg_op), tg_table_name,
    coalesce(new.id, old.id)::text,
    jsonb_build_object('old', case when tg_op <> 'INSERT' then to_jsonb(old) end,
                       'new', case when tg_op <> 'DELETE' then to_jsonb(new) end));
  return coalesce(new, old);
end;
$$;
create trigger tier_rules_audit after insert or update or delete on public.tier_rules
  for each row execute function private.price_audit();
create trigger lots_price_audit after update of base_price, quantity on public.lots
  for each row execute function private.price_audit();

-- ---------------------------------------------------------------------------
-- Preço
-- ---------------------------------------------------------------------------

-- Regra de perfil aplicada ao valor do lote. Sem taxa de serviço; nunca negativo.
create or replace function private.tier_price(p_base numeric, p_mode public.price_mode, p_value numeric)
returns numeric language sql immutable set search_path = '' as $$
  select case p_mode
    when 'free' then 0::numeric
    when 'full' then p_base
    when 'fixed' then greatest(p_value, 0)
    when 'percent' then greatest(round(p_base * (1 - p_value / 100.0), 2), 0)
    else null
  end;
$$;

create or replace function private.coupon_price(p_base numeric, p_kind public.coupon_kind, p_value numeric)
returns numeric language sql immutable set search_path = '' as $$
  select greatest(case p_kind
    when 'percent' then round(p_base * (1 - p_value / 100.0), 2)
    else round(p_base - p_value, 2) end, 0);
$$;

-- Preço final de um tipo de ingresso num lote para um perfil.
-- Retorna blocked=true quando o perfil não pode comprar.
create or replace function public.compute_price(p_ticket_type_id uuid, p_lot_id uuid,
                                                p_tier public.membership_tier, p_coupon_code text default null)
returns table (unit_price numeric, base_price numeric, tier_price numeric, blocked boolean,
               coupon_applied boolean, coupon_id uuid)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_lot public.lots;
  v_rule public.tier_rules;
  v_tier_price numeric;
  v_coupon public.coupons;
  v_coupon_price numeric;
  v_final numeric;
  v_stack boolean := coalesce((private.setting('coupon_stacks_with_tier'))::boolean, false);
  v_event uuid;
begin
  select * into v_lot from public.lots where id = p_lot_id and ticket_type_id = p_ticket_type_id;
  if not found then
    raise exception 'Lote inválido.' using errcode = '22023';
  end if;
  select * into v_rule from public.tier_rules where ticket_type_id = p_ticket_type_id and tier = p_tier;
  if not found then
    v_rule.mode := 'full';
  end if;
  if v_rule.mode = 'blocked' then
    return query select null::numeric, v_lot.base_price, null::numeric, true, false, null::uuid;
    return;
  end if;
  v_tier_price := private.tier_price(v_lot.base_price, v_rule.mode, v_rule.value);
  v_final := v_tier_price;

  if nullif(trim(p_coupon_code), '') is not null then
    v_event := private.ticket_type_event(p_ticket_type_id);
    select * into v_coupon from public.coupons
    where event_id = v_event and code = upper(trim(p_coupon_code)) and active
      and (valid_until is null or valid_until > now())
      and (max_uses is null or used < max_uses);
    if found then
      if v_stack then
        v_coupon_price := private.coupon_price(v_tier_price, v_coupon.kind, v_coupon.value);
      else
        v_coupon_price := private.coupon_price(v_lot.base_price, v_coupon.kind, v_coupon.value);
      end if;
      if v_coupon_price < v_final then
        v_final := v_coupon_price;
        return query select v_final, v_lot.base_price, v_tier_price, false, true, v_coupon.id;
        return;
      end if;
    end if;
  end if;

  return query select v_final, v_lot.base_price, v_tier_price, false, false, null::uuid;
end;
$$;
revoke all on function public.compute_price(uuid, uuid, public.membership_tier, text) from public;
grant execute on function public.compute_price(uuid, uuid, public.membership_tier, text) to anon, authenticated;

-- Valida cupom (com limite de taxa) — o front só mostra se é válido.
create or replace function public.check_coupon(p_event_id uuid, p_code text)
returns table (valid boolean, kind public.coupon_kind, value numeric)
language plpgsql security definer set search_path = '' as $$
begin
  perform private.rate_limit('check_coupon', 15, 10);
  return query
    select true, c.kind, c.value from public.coupons c
    where c.event_id = p_event_id and c.code = upper(trim(p_code)) and c.active
      and (c.valid_until is null or c.valid_until > now())
      and (c.max_uses is null or c.used < c.max_uses);
  if not found then
    return query select false, null::public.coupon_kind, null::numeric;
  end if;
end;
$$;
revoke all on function public.check_coupon(uuid, text) from public;
grant execute on function public.check_coupon(uuid, text) to anon, authenticated;

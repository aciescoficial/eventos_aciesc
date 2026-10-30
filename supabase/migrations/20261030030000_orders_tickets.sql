-- Fases 4–8 — Reservas, pedidos, ingressos, check-in, lista de espera, presença, faltas,
-- certificados, formulários e fila de mensagens.

create type public.reservation_status as enum ('open', 'converted', 'expired', 'cancelled');
create type public.order_status as enum ('pending', 'paid', 'failed', 'refunded', 'cancelled');
create type public.payment_method as enum ('pix', 'card', 'free');
create type public.ticket_status as enum ('pending', 'valid', 'used', 'cancelled', 'transferred');
create type public.checkin_kind as enum ('in', 'out');
create type public.waitlist_status as enum ('waiting', 'offered', 'accepted', 'expired', 'removed');
create type public.message_channel as enum ('email', 'whatsapp');
create type public.message_status as enum ('queued', 'sent', 'failed', 'skipped');

-- Segredos internos (nunca expostos pela API).
create table private.secrets (
  name text primary key,
  value text not null
);
insert into private.secrets (name, value)
values ('ticket_hmac', encode(extensions.gen_random_bytes(32), 'hex'));

-- ---------------------------------------------------------------------------
-- Tabelas
-- ---------------------------------------------------------------------------
create table public.reservations (
  id uuid primary key default gen_random_uuid(),
  event_date_id uuid not null references public.event_dates (id) on delete cascade,
  user_id uuid references auth.users (id) on delete set null default auth.uid(),
  expires_at timestamptz not null,
  status public.reservation_status not null default 'open',
  waitlist_id uuid,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  device text,
  created_at timestamptz not null default now()
);
create index reservations_open_idx on public.reservations (event_date_id) where status = 'open';

create table public.reservation_items (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid not null references public.reservations (id) on delete cascade,
  ticket_type_id uuid not null references public.ticket_types (id),
  lot_id uuid not null references public.lots (id),
  quantity int not null check (quantity > 0)
);
create index reservation_items_lot_idx on public.reservation_items (lot_id);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid unique references public.reservations (id) on delete set null,
  event_id uuid not null references public.events (id) on delete cascade,
  event_date_id uuid not null references public.event_dates (id) on delete cascade,
  buyer_person_id uuid not null references public.people (id),
  buyer_email text not null,
  total numeric(10, 2) not null check (total >= 0),
  payment_method public.payment_method not null,
  installments int not null default 1,
  provider text,
  provider_ref text,
  status public.order_status not null default 'pending',
  coupon_id uuid references public.coupons (id) on delete set null,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  device text,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  cancelled_at timestamptz
);
create index orders_event_idx on public.orders (event_id, status);
create index orders_buyer_idx on public.orders (buyer_person_id);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  ticket_type_id uuid not null references public.ticket_types (id),
  lot_id uuid not null references public.lots (id),
  tier_applied public.membership_tier not null,
  base_price numeric(10, 2) not null,
  unit_price numeric(10, 2) not null check (unit_price >= 0),
  quantity int not null default 1 check (quantity = 1)
);
create index order_items_order_idx on public.order_items (order_id);
create index order_items_lot_idx on public.order_items (lot_id);

create table public.order_payments (
  order_id uuid primary key references public.orders (id) on delete cascade,
  method public.payment_method not null,
  pix_qr_image text,
  pix_copy_paste text,
  checkout_url text,
  expires_at timestamptz,
  updated_at timestamptz not null default now()
);

create table public.payment_events (
  id bigint generated always as identity primary key,
  provider text not null,
  event_id text not null,
  order_id uuid references public.orders (id) on delete set null,
  payload jsonb,
  received_at timestamptz not null default now(),
  constraint payment_events_unique unique (provider, event_id)
);

create table public.tickets (
  id uuid primary key default gen_random_uuid(),
  order_item_id uuid not null references public.order_items (id) on delete cascade,
  order_id uuid not null references public.orders (id) on delete cascade,
  event_id uuid not null references public.events (id) on delete cascade,
  event_date_id uuid not null references public.event_dates (id) on delete cascade,
  attendee_person_id uuid not null references public.people (id),
  attendee_name text not null,
  code text not null unique default upper(substr(md5(gen_random_uuid()::text), 1, 10)),
  status public.ticket_status not null default 'pending',
  presence_confirmed boolean,
  presence_token uuid not null unique default gen_random_uuid(),
  presence_requested_at timestamptz,
  reminder_sent_at timestamptz,
  cancel_reason text,
  created_at timestamptz not null default now()
);
create index tickets_date_idx on public.tickets (event_date_id, status);
create index tickets_attendee_idx on public.tickets (attendee_person_id);

create table public.checkins (
  id bigint generated always as identity primary key,
  ticket_id uuid not null references public.tickets (id) on delete cascade,
  kind public.checkin_kind not null,
  at timestamptz not null default now(),
  by_user_id uuid references auth.users (id) on delete set null default auth.uid(),
  device_id text,
  offline boolean not null default false,
  undone_at timestamptz,
  undone_by uuid references auth.users (id) on delete set null
);
create unique index checkins_one_active on public.checkins (ticket_id, kind) where undone_at is null;

create table public.waitlist (
  id uuid primary key default gen_random_uuid(),
  event_date_id uuid not null references public.event_dates (id) on delete cascade,
  person_id uuid not null references public.people (id) on delete cascade,
  status public.waitlist_status not null default 'waiting',
  token uuid not null unique default gen_random_uuid(),
  offered_at timestamptz,
  expires_at timestamptz,
  reservation_id uuid references public.reservations (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint waitlist_unique unique (event_date_id, person_id)
);
alter table public.reservations
  add constraint reservations_waitlist_fk foreign key (waitlist_id) references public.waitlist (id) on delete set null;

create table public.absences (
  id bigint generated always as identity primary key,
  person_id uuid not null references public.people (id) on delete cascade,
  ticket_id uuid not null unique references public.tickets (id) on delete cascade,
  event_date_id uuid not null references public.event_dates (id) on delete cascade,
  created_at timestamptz not null default now()
);
create index absences_person_idx on public.absences (person_id, created_at);

create table public.certificates (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null unique references public.tickets (id) on delete cascade,
  code text not null unique default upper(substr(md5(gen_random_uuid()::text), 1, 12)),
  person_name text not null,
  event_title text not null,
  event_date date not null,
  hours numeric(5, 1) not null,
  issued_at timestamptz not null default now(),
  revoked_at timestamptz
);

create table public.form_questions (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  label text not null,
  type text not null default 'text' check (type in ('text', 'select', 'checkbox')),
  required boolean not null default false,
  options jsonb not null default '[]'::jsonb,
  sort int not null default 0
);

create table public.form_answers (
  ticket_id uuid not null references public.tickets (id) on delete cascade,
  question_id uuid not null references public.form_questions (id) on delete cascade,
  value text,
  primary key (ticket_id, question_id)
);

create table public.messages_log (
  id bigint generated always as identity primary key,
  person_id uuid references public.people (id) on delete set null,
  ticket_id uuid references public.tickets (id) on delete set null,
  event_id uuid references public.events (id) on delete set null,
  channel public.message_channel not null,
  template text not null,
  to_address text not null,
  payload jsonb not null default '{}'::jsonb,
  status public.message_status not null default 'queued',
  error text,
  attempts int not null default 0,
  dedupe_key text unique,
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  sent_at timestamptz
);
create index messages_queue_idx on public.messages_log (created_at) where status = 'queued';

-- Datas com marcação de jobs já processados.
alter table public.event_dates
  add column absences_processed_at timestamptz,
  add column certificates_processed_at timestamptz;

-- ---------------------------------------------------------------------------
-- Helpers de estoque
-- ---------------------------------------------------------------------------

-- Unidades do lote em uso: reservas abertas + itens de pedidos pendentes/pagos.
create or replace function private.lot_used(p_lot_id uuid)
returns int language sql stable security definer set search_path = '' as $$
  select coalesce((select sum(ri.quantity) from public.reservation_items ri
                   join public.reservations r on r.id = ri.reservation_id
                   where ri.lot_id = p_lot_id and r.status = 'open' and r.expires_at > now()), 0)::int
       + coalesce((select count(*) from public.order_items oi
                   join public.orders o on o.id = oi.order_id
                   where oi.lot_id = p_lot_id and o.status in ('pending', 'paid')), 0)::int;
$$;

-- Pessoas ocupando vagas da data (exclui opcionalmente uma reserva).
create or replace function private.date_used(p_event_date_id uuid, p_exclude_reservation uuid default null)
returns int language sql stable security definer set search_path = '' as $$
  select coalesce((select sum(ri.quantity * tt.people_per_ticket) from public.reservation_items ri
                   join public.reservations r on r.id = ri.reservation_id
                   join public.ticket_types tt on tt.id = ri.ticket_type_id
                   where r.event_date_id = p_event_date_id and r.status = 'open' and r.expires_at > now()
                     and r.id is distinct from p_exclude_reservation), 0)::int
       + coalesce((select count(*) from public.tickets t
                   where t.event_date_id = p_event_date_id and t.status in ('pending', 'valid', 'used')), 0)::int;
$$;

create or replace function private.date_remaining(p_event_date_id uuid, p_exclude_reservation uuid default null)
returns int language sql stable security definer set search_path = '' as $$
  select greatest(ed.capacity - private.date_used(ed.id, p_exclude_reservation), 0)
  from public.event_dates ed where ed.id = p_event_date_id;
$$;

-- Vira o lote: fecha o atual e ativa o próximo agendado (atômico, auditado).
create or replace function private.turn_lot(p_lot_id uuid, p_reason text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_lot public.lots;
  v_next uuid;
begin
  select * into v_lot from public.lots where id = p_lot_id for update;
  if not found or v_lot.status <> 'active' then
    return null;
  end if;
  update public.lots set status = 'closed', closed_at = now() where id = p_lot_id;
  select id into v_next from public.lots
  where ticket_type_id = v_lot.ticket_type_id and event_date_id = v_lot.event_date_id
    and status = 'scheduled'
  order by sort, id limit 1 for update;
  if v_next is not null then
    update public.lots set status = 'active', activated_at = now() where id = v_next;
  end if;
  perform private.audit('lot.turned', 'lots', p_lot_id::text,
    jsonb_build_object('reason', p_reason, 'next_lot', v_next, 'ticket_type_id', v_lot.ticket_type_id,
                       'event_date_id', v_lot.event_date_id));
  return v_next;
end;
$$;

-- Garante um lote ativo por tipo/data e vira lotes vencidos ou esgotados.
create or replace function private.sync_lots(p_event_date_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  r record;
  v_active public.lots;
  v_guard int;
begin
  for r in
    select distinct l.ticket_type_id from public.lots l where l.event_date_id = p_event_date_id
  loop
    v_guard := 0;
    loop
      v_guard := v_guard + 1;
      exit when v_guard > 20;
      select * into v_active from public.lots
      where ticket_type_id = r.ticket_type_id and event_date_id = p_event_date_id and status = 'active';
      if not found then
        update public.lots set status = 'active', activated_at = now()
        where id = (select id from public.lots
                    where ticket_type_id = r.ticket_type_id and event_date_id = p_event_date_id
                      and status = 'scheduled'
                    order by sort, id limit 1);
        exit;
      end if;
      if v_active.trigger = 'date' and v_active.trigger_at <= now() then
        perform private.turn_lot(v_active.id, 'date');
      elsif private.lot_used(v_active.id) >= v_active.quantity then
        perform private.turn_lot(v_active.id, 'quantity');
      else
        exit;
      end if;
    end loop;
  end loop;
end;
$$;

-- Virada manual (botão "Virar lote agora").
create or replace function public.turn_lot(p_lot_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_event uuid;
begin
  select private.ticket_type_event(ticket_type_id) into v_event from public.lots where id = p_lot_id;
  if v_event is null or not private.can_manage_event(v_event) then
    raise exception 'Sem permissão.' using errcode = '42501';
  end if;
  return private.turn_lot(p_lot_id, 'manual');
end;
$$;
revoke all on function public.turn_lot(uuid) from public, anon;
grant execute on function public.turn_lot(uuid) to authenticated;

-- Ativa o primeiro lote de cada tipo quando o evento é publicado.
create or replace function public.publish_event(p_event_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  d record;
begin
  if not private.can_manage_event(p_event_id) then
    raise exception 'Sem permissão.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.event_dates where event_id = p_event_id) then
    raise exception 'Cadastre ao menos uma data antes de publicar.' using errcode = '22023';
  end if;
  if not exists (select 1 from public.lots l join public.ticket_types tt on tt.id = l.ticket_type_id
                 where tt.event_id = p_event_id) then
    raise exception 'Cadastre ao menos um ingresso com lote antes de publicar.' using errcode = '22023';
  end if;
  update public.events set status = 'published' where id = p_event_id;
  for d in select id from public.event_dates where event_id = p_event_id loop
    perform private.sync_lots(d.id);
  end loop;
end;
$$;
revoke all on function public.publish_event(uuid) from public, anon;
grant execute on function public.publish_event(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Oferta pública do evento (página do evento): datas, ingressos, lote ativo,
-- preço por perfil e disponibilidade. Também aplica viradas de lote vencidas.
-- ---------------------------------------------------------------------------
create or replace function public.event_offer(p_event_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_event public.events;
  d record;
  v_dates jsonb := '[]'::jsonb;
  v_types jsonb;
  t record;
  v_lot public.lots;
  v_prices jsonb;
  v_tier public.membership_tier;
  p record;
  v_min numeric;
  v_max numeric;
  v_remaining int;
begin
  select * into v_event from public.events where id = p_event_id;
  if not found or (v_event.status not in ('published', 'closed') and not private.can_manage_event(p_event_id)) then
    return null;
  end if;

  for d in select * from public.event_dates where event_id = p_event_id order by starts_at loop
    if v_event.status = 'published' and d.ends_at > now() then
      perform private.sync_lots(d.id);
    end if;
    v_remaining := private.date_remaining(d.id);
    v_types := '[]'::jsonb;
    for t in select * from public.ticket_types where event_id = p_event_id and visible order by sort, name loop
      select * into v_lot from public.lots where ticket_type_id = t.id and event_date_id = d.id and status = 'active';
      v_prices := '{}'::jsonb;
      if found then
        foreach v_tier in array array['associate', 'adept', 'other']::public.membership_tier[] loop
          select * into p from public.compute_price(t.id, v_lot.id, v_tier, null);
          v_prices := v_prices || jsonb_build_object(v_tier::text,
            jsonb_build_object('price', p.unit_price, 'blocked', p.blocked));
          if not p.blocked then
            v_min := least(coalesce(v_min, p.unit_price), p.unit_price);
            v_max := greatest(coalesce(v_max, p.unit_price), p.unit_price);
          end if;
        end loop;
      end if;
      v_types := v_types || jsonb_build_object(
        'id', t.id, 'name', t.name, 'description', t.description,
        'people_per_ticket', t.people_per_ticket, 'max_per_order', t.max_per_order,
        'lot', case when v_lot.id is not null then jsonb_build_object(
          'id', v_lot.id, 'name', v_lot.name, 'base_price', v_lot.base_price,
          'quantity', v_lot.quantity, 'used', private.lot_used(v_lot.id),
          'trigger', v_lot.trigger, 'trigger_at', v_lot.trigger_at) end,
        'prices', v_prices,
        'next_lot', (select jsonb_build_object('name', n.name, 'base_price', n.base_price)
                     from public.lots n where n.ticket_type_id = t.id and n.event_date_id = d.id
                       and n.status = 'scheduled' order by n.sort limit 1));
      v_lot := null;
    end loop;
    v_dates := v_dates || jsonb_build_object(
      'id', d.id, 'label', d.label, 'starts_at', d.starts_at, 'ends_at', d.ends_at,
      'capacity', d.capacity, 'remaining', v_remaining,
      'sales_open', v_event.status = 'published' and d.starts_at > now(),
      'ticket_types', v_types);
  end loop;

  return jsonb_build_object('event_id', p_event_id, 'status', v_event.status,
    'visibility', v_event.visibility, 'rules', v_event.rules,
    'min_price', v_min, 'max_price', v_max, 'dates', v_dates);
end;
$$;
revoke all on function public.event_offer(uuid) from public;
grant execute on function public.event_offer(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Reserva (15 minutos)
-- ---------------------------------------------------------------------------
create or replace function private.create_reservation_internal(
  p_event_date_id uuid, p_items jsonb, p_expires_at timestamptz, p_utm jsonb, p_waitlist uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_date public.event_dates;
  v_event public.events;
  it jsonb;
  v_type public.ticket_types;
  v_lot public.lots;
  v_qty int;
  v_people int := 0;
  v_res uuid;
begin
  select * into v_date from public.event_dates where id = p_event_date_id for update;
  if not found then
    raise exception 'Data não encontrada.' using errcode = 'P0002';
  end if;
  select * into v_event from public.events where id = v_date.event_id;
  if v_event.status <> 'published' or v_date.starts_at <= now() then
    raise exception 'As inscrições para esta data estão encerradas.' using errcode = 'P0001';
  end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Escolha ao menos um ingresso.' using errcode = '22023';
  end if;

  perform private.sync_lots(p_event_date_id);

  insert into public.reservations (event_date_id, expires_at, waitlist_id,
                                   utm_source, utm_medium, utm_campaign, device)
  values (p_event_date_id, p_expires_at, p_waitlist,
          left(p_utm ->> 'utm_source', 100), left(p_utm ->> 'utm_medium', 100),
          left(p_utm ->> 'utm_campaign', 100), left(p_utm ->> 'device', 50))
  returning id into v_res;

  for it in select * from jsonb_array_elements(p_items) loop
    v_qty := (it ->> 'quantity')::int;
    continue when coalesce(v_qty, 0) = 0;
    select * into v_type from public.ticket_types
    where id = (it ->> 'ticket_type_id')::uuid and event_id = v_event.id and visible;
    if not found then
      raise exception 'Ingresso inválido.' using errcode = '22023';
    end if;
    if v_qty < 1 or v_qty > v_type.max_per_order then
      raise exception 'Quantidade inválida para "%". Máximo por pedido: %.', v_type.name, v_type.max_per_order
        using errcode = '22023';
    end if;
    select * into v_lot from public.lots
    where ticket_type_id = v_type.id and event_date_id = p_event_date_id and status = 'active' for update;
    if not found or private.lot_used(v_lot.id) + v_qty > v_lot.quantity then
      raise exception 'Ingresso "%" esgotado neste lote.', v_type.name using errcode = 'P0001';
    end if;
    insert into public.reservation_items (reservation_id, ticket_type_id, lot_id, quantity)
    values (v_res, v_type.id, v_lot.id, v_qty);
    v_people := v_people + v_qty * v_type.people_per_ticket;
  end loop;

  if v_people = 0 then
    raise exception 'Escolha ao menos um ingresso.' using errcode = '22023';
  end if;
  if private.date_remaining(p_event_date_id, v_res) < v_people then
    raise exception 'Vagas esgotadas para esta data.' using errcode = 'P0001';
  end if;
  return v_res;
end;
$$;

create or replace function public.create_reservation(p_event_date_id uuid, p_items jsonb, p_utm jsonb default '{}')
returns uuid language plpgsql security definer set search_path = '' as $$
begin
  perform private.rate_limit('create_reservation', 10, 10);
  return private.create_reservation_internal(p_event_date_id, p_items, now() + interval '15 minutes',
                                             coalesce(p_utm, '{}'::jsonb), null);
end;
$$;
revoke all on function public.create_reservation(uuid, jsonb, jsonb) from public;
grant execute on function public.create_reservation(uuid, jsonb, jsonb) to anon, authenticated;

-- Dados da reserva para o checkout (o id é o próprio "token" da reserva).
create or replace function public.get_reservation(p_reservation_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', r.id, 'status', case when r.status = 'open' and r.expires_at <= now() then 'expired' else r.status::text end,
    'expires_at', r.expires_at,
    'event', jsonb_build_object('id', e.id, 'slug', e.slug, 'title', e.title, 'visibility', e.visibility,
                                'kind', e.kind, 'cover_url', e.cover_url, 'rules', e.rules),
    'date', jsonb_build_object('id', d.id, 'label', d.label, 'starts_at', d.starts_at, 'ends_at', d.ends_at),
    'order_id', (select o.id from public.orders o where o.reservation_id = r.id),
    'items', (select jsonb_agg(jsonb_build_object(
                'ticket_type_id', tt.id, 'name', tt.name, 'people_per_ticket', tt.people_per_ticket,
                'quantity', ri.quantity, 'lot_id', l.id, 'lot_name', l.name, 'base_price', l.base_price,
                'prices', (select jsonb_object_agg(tier, jsonb_build_object('price', cp.unit_price, 'blocked', cp.blocked))
                           from unnest(array['associate', 'adept', 'other']::public.membership_tier[]) tier,
                                lateral public.compute_price(tt.id, l.id, tier, null) cp))
              order by tt.sort)
              from public.reservation_items ri
              join public.ticket_types tt on tt.id = ri.ticket_type_id
              join public.lots l on l.id = ri.lot_id
              where ri.reservation_id = r.id),
    'questions', (select coalesce(jsonb_agg(jsonb_build_object('id', q.id, 'label', q.label, 'type', q.type,
                                                               'required', q.required, 'options', q.options)
                                            order by q.sort), '[]'::jsonb)
                  from public.form_questions q where q.event_id = e.id))
  from public.reservations r
  join public.event_dates d on d.id = r.event_date_id
  join public.events e on e.id = d.event_id
  where r.id = p_reservation_id;
$$;
revoke all on function public.get_reservation(uuid) from public;
grant execute on function public.get_reservation(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Mensagens (fila processada pela Edge Function process-outbox)
-- ---------------------------------------------------------------------------
create or replace function private.enqueue_message(
  p_template text, p_person_id uuid, p_ticket_id uuid, p_event_id uuid, p_payload jsonb,
  p_dedupe text, p_channels public.message_channel[] default array['email', 'whatsapp']::public.message_channel[])
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_person public.people;
begin
  select * into v_person from public.people where id = p_person_id;
  if not found then
    return;
  end if;
  if 'email' = any(p_channels) and v_person.email is not null then
    insert into public.messages_log (person_id, ticket_id, event_id, channel, template, to_address, payload, dedupe_key)
    values (p_person_id, p_ticket_id, p_event_id, 'email', p_template, v_person.email, coalesce(p_payload, '{}'),
            case when p_dedupe is not null then 'email:' || p_dedupe end)
    on conflict (dedupe_key) do nothing;
  end if;
  if 'whatsapp' = any(p_channels) and v_person.phone is not null then
    insert into public.messages_log (person_id, ticket_id, event_id, channel, template, to_address, payload, dedupe_key)
    values (p_person_id, p_ticket_id, p_event_id, 'whatsapp', p_template, v_person.phone, coalesce(p_payload, '{}'),
            case when p_dedupe is not null then 'whatsapp:' || p_dedupe end)
    on conflict (dedupe_key) do nothing;
  end if;
end;
$$;

create or replace function private.site_url()
returns text language sql stable security definer set search_path = '' as $$
  select coalesce(private.setting('site_url') #>> '{}', 'http://localhost:3000');
$$;

-- Dados comuns de mensagem de um ingresso.
create or replace function private.ticket_payload(p_ticket_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'name', t.attendee_name, 'event_title', e.title, 'event_slug', e.slug,
    'starts_at', d.starts_at, 'ends_at', d.ends_at, 'date_label', d.label,
    'venue', case when v.id is not null then jsonb_build_object('name', v.name, 'address', v.address,
                  'city', v.city, 'maps_url', v.maps_url, 'parking_info', v.parking_info) end,
    'format', e.format, 'ticket_code', t.code,
    'tickets_url', private.site_url() || '/meus-ingressos/',
    'presence_url', private.site_url() || '/presenca/?t=' || t.presence_token)
  from public.tickets t
  join public.events e on e.id = t.event_id
  join public.event_dates d on d.id = t.event_date_id
  left join public.venues v on v.id = e.venue_id
  where t.id = p_ticket_id;
$$;

-- ---------------------------------------------------------------------------
-- Checkout
-- ---------------------------------------------------------------------------
create or replace function private.upsert_person(p jsonb, p_source text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_cpf text := private.normalize_cpf(p ->> 'cpf');
  v_id uuid;
begin
  if not private.is_valid_cpf(v_cpf) then
    raise exception 'CPF inválido: %.', coalesce(p ->> 'cpf', '(vazio)') using errcode = '22023';
  end if;
  if coalesce(length(trim(p ->> 'full_name')), 0) < 3 then
    raise exception 'Informe o nome completo.' using errcode = '22023';
  end if;
  select id into v_id from public.people where cpf = v_cpf;
  if v_id is null then
    insert into public.people (cpf, full_name, email, phone, creci, company, city, source)
    values (v_cpf, trim(p ->> 'full_name'), nullif(lower(trim(p ->> 'email')), ''),
            nullif(regexp_replace(coalesce(p ->> 'phone', ''), '\D', '', 'g'), ''),
            nullif(trim(p ->> 'creci'), ''), nullif(trim(p ->> 'company'), ''),
            nullif(trim(p ->> 'city'), ''), p_source)
    returning id into v_id;
  else
    -- Completa dados faltantes; não sobrescreve cadastro existente.
    update public.people set
      email = coalesce(email, nullif(lower(trim(p ->> 'email')), '')),
      phone = coalesce(phone, nullif(regexp_replace(coalesce(p ->> 'phone', ''), '\D', '', 'g'), '')),
      creci = coalesce(creci, nullif(trim(p ->> 'creci'), '')),
      company = coalesce(company, nullif(trim(p ->> 'company'), '')),
      city = coalesce(city, nullif(trim(p ->> 'city'), ''))
    where id = v_id;
  end if;
  return v_id;
end;
$$;

create or replace function private.confirm_order(p_order_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_order public.orders;
  v_event public.events;
  t record;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found or v_order.status = 'paid' then
    return;
  end if;
  if v_order.status <> 'pending' then
    raise exception 'Pedido não está pendente.' using errcode = 'P0001';
  end if;
  update public.orders set status = 'paid', paid_at = now() where id = p_order_id;
  update public.tickets set status = 'valid' where order_id = p_order_id and status = 'pending';
  if v_order.coupon_id is not null then
    update public.coupons set used = used + 1 where id = v_order.coupon_id;
  end if;
  select * into v_event from public.events where id = v_order.event_id;
  if coalesce((v_event.auto_messages ->> 'ticket')::boolean, true) then
    for t in select id, attendee_person_id from public.tickets where order_id = p_order_id loop
      perform private.enqueue_message('ticket', t.attendee_person_id, t.id, v_order.event_id,
                                      private.ticket_payload(t.id), 'ticket:' || t.id);
    end loop;
  end if;
  perform private.audit('order.paid', 'orders', p_order_id::text,
    jsonb_build_object('total', v_order.total, 'method', v_order.payment_method));
end;
$$;

-- p_data:
-- { buyer: {cpf, full_name, email, phone, creci, company, city},
--   become_adept: bool, accept_terms: bool, whatsapp_opt_in: bool, coupon: text,
--   payment_method: 'pix'|'card', installments: int,
--   units: [{ticket_type_id, people: [{full_name, cpf, email, phone, creci}]}],
--   answers: [{unit: int, person: int, question_id, value}] }
create or replace function public.checkout(p_reservation_id uuid, p_data jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_res public.reservations;
  v_date public.event_dates;
  v_event public.events;
  v_buyer uuid;
  v_buyer_tier public.membership_tier;
  v_price_tier_override public.membership_tier;
  v_order uuid;
  v_total numeric := 0;
  v_coupon uuid;
  u jsonb;
  pp jsonb;
  v_unit_idx int := -1;
  v_person_idx int;
  v_type public.ticket_types;
  v_lot_id uuid;
  v_counts jsonb := '{}'::jsonb;
  v_expected jsonb := '{}'::jsonb;
  v_tier public.membership_tier;
  v_rule_mode public.price_mode;
  p record;
  v_item uuid;
  v_ticket uuid;
  v_person uuid;
  v_people_ids uuid[] := '{}'::uuid[];
  v_tickets jsonb := '[]'::jsonb;
  v_needed int := 0;
  v_avail int;
  v_reserved_other int;
  v_method public.payment_method;
  v_terms text := private.setting('terms_version') #>> '{}';
  a jsonb;
  ri record;
begin
  perform private.rate_limit('checkout', 10, 10);

  select * into v_res from public.reservations where id = p_reservation_id for update;
  if not found then
    raise exception 'Reserva não encontrada.' using errcode = 'P0002';
  end if;
  if v_res.status <> 'open' or v_res.expires_at <= now() then
    raise exception 'Sua reserva expirou. Escolha os ingressos novamente.' using errcode = 'P0001';
  end if;
  select * into v_date from public.event_dates where id = v_res.event_date_id for update;
  select * into v_event from public.events where id = v_date.event_id;

  if not coalesce((p_data ->> 'accept_terms')::boolean, false) then
    raise exception 'É preciso aceitar os termos de uso e a política de privacidade.' using errcode = '22023';
  end if;

  -- Comprador e vínculo
  v_buyer := private.upsert_person(p_data -> 'buyer', 'checkout');
  if coalesce((p_data ->> 'whatsapp_opt_in')::boolean, false) then
    update public.people set whatsapp_opt_in = true, whatsapp_opt_in_at = coalesce(whatsapp_opt_in_at, now())
    where id = v_buyer;
  end if;
  v_buyer_tier := private.effective_tier(v_buyer);
  if v_buyer_tier = 'other' and coalesce((p_data ->> 'become_adept')::boolean, false) then
    perform set_config('app.membership_reason', 'checkout:adept_signup', true);
    update public.memberships set tier = 'adept', status = 'active', source = 'platform',
      adept_since = now(), terms_version = v_terms, terms_accepted_at = now(), terms_ip = private.client_ip()
    where person_id = v_buyer;
    if not coalesce((private.setting('adept_signup_applies_price'))::boolean, true) then
      v_price_tier_override := 'other';
    end if;
    v_buyer_tier := 'adept';
  end if;

  -- Quantidades esperadas por tipo
  for ri in select ticket_type_id, sum(quantity) q from public.reservation_items
            where reservation_id = v_res.id group by ticket_type_id loop
    v_expected := v_expected || jsonb_build_object(ri.ticket_type_id::text, ri.q);
  end loop;

  insert into public.orders (reservation_id, event_id, event_date_id, buyer_person_id, buyer_email, total,
                             payment_method, installments, status, utm_source, utm_medium, utm_campaign, device)
  values (v_res.id, v_event.id, v_date.id, v_buyer,
          coalesce(nullif(lower(trim(p_data -> 'buyer' ->> 'email')), ''), ''), 0, 'free',
          greatest(coalesce((p_data ->> 'installments')::int, 1), 1), 'pending',
          v_res.utm_source, v_res.utm_medium, v_res.utm_campaign, v_res.device)
  returning id into v_order;

  if (select buyer_email from public.orders where id = v_order) = '' then
    raise exception 'Informe o e-mail do comprador.' using errcode = '22023';
  end if;

  for u in select * from jsonb_array_elements(coalesce(p_data -> 'units', '[]'::jsonb)) loop
    v_unit_idx := v_unit_idx + 1;
    select * into v_type from public.ticket_types where id = (u ->> 'ticket_type_id')::uuid;
    if not found or not (v_expected ? v_type.id::text) then
      raise exception 'Ingresso não pertence à reserva.' using errcode = '22023';
    end if;
    v_counts := jsonb_set(v_counts, array[v_type.id::text],
                          to_jsonb(coalesce((v_counts ->> v_type.id::text)::int, 0) + 1));
    if jsonb_array_length(coalesce(u -> 'people', '[]'::jsonb)) <> v_type.people_per_ticket then
      raise exception 'Informe os % participante(s) de "%".', v_type.people_per_ticket, v_type.name
        using errcode = '22023';
    end if;
    select lot_id into v_lot_id from public.reservation_items
    where reservation_id = v_res.id and ticket_type_id = v_type.id limit 1;

    -- Perfil para preço: participante (ingresso individual) ou comprador (pacote).
    if v_type.people_per_ticket = 1 then
      v_person := private.upsert_person(u -> 'people' -> 0, 'checkout');
      v_tier := case when v_person = v_buyer then v_buyer_tier else private.effective_tier(v_person) end;
    else
      v_tier := v_buyer_tier;
    end if;
    if v_price_tier_override is not null and v_tier = 'adept' and
       (v_type.people_per_ticket > 1 or v_person = v_buyer) then
      v_tier := v_price_tier_override;
    end if;

    -- Visibilidade do evento
    if v_event.visibility = 'associates' and v_tier <> 'associate' then
      raise exception 'Este evento é exclusivo para associados ACIESC com anuidade em dia.' using errcode = 'P0001';
    end if;
    if v_event.visibility = 'associates_adepts' and v_tier = 'other' then
      raise exception 'Este evento é exclusivo para associados e adeptos ACIESC.' using errcode = 'P0001';
    end if;

    select mode into v_rule_mode from public.tier_rules where ticket_type_id = v_type.id and tier = v_tier;
    if coalesce((v_event.rules ->> 'free_only_active_associates')::boolean, false)
       and v_tier <> 'associate' and v_rule_mode = 'free' then
      raise exception 'As vagas gratuitas de "%" são exclusivas para associados ativos.', v_type.name
        using errcode = 'P0001';
    end if;

    select * into p from public.compute_price(v_type.id, v_lot_id, v_tier, p_data ->> 'coupon');
    if p.blocked then
      raise exception 'O ingresso "%" não está disponível para o seu perfil.', v_type.name using errcode = 'P0001';
    end if;
    if p.coupon_applied then
      v_coupon := p.coupon_id;
    end if;

    insert into public.order_items (order_id, ticket_type_id, lot_id, tier_applied, base_price, unit_price)
    values (v_order, v_type.id, v_lot_id, v_tier, p.base_price, p.unit_price)
    returning id into v_item;
    v_total := v_total + p.unit_price;

    v_person_idx := -1;
    for pp in select * from jsonb_array_elements(u -> 'people') loop
      v_person_idx := v_person_idx + 1;
      v_person := private.upsert_person(pp, 'checkout');
      if v_person = any(v_people_ids) then
        raise exception 'O mesmo CPF foi informado para mais de um participante.' using errcode = '22023';
      end if;
      v_people_ids := v_people_ids || v_person;
      if coalesce((v_event.rules ->> 'one_per_cpf')::boolean, false) and exists (
        select 1 from public.tickets t where t.event_date_id = v_date.id and t.attendee_person_id = v_person
          and t.status in ('pending', 'valid', 'used')) then
        raise exception 'O CPF de % já tem inscrição nesta data.', trim(pp ->> 'full_name') using errcode = 'P0001';
      end if;
      insert into public.tickets (order_item_id, order_id, event_id, event_date_id, attendee_person_id, attendee_name)
      values (v_item, v_order, v_event.id, v_date.id, v_person, trim(pp ->> 'full_name'))
      returning id into v_ticket;
      v_needed := v_needed + 1;

      for a in select * from jsonb_array_elements(coalesce(p_data -> 'answers', '[]'::jsonb))
               where (value ->> 'unit')::int = v_unit_idx and (value ->> 'person')::int = v_person_idx loop
        insert into public.form_answers (ticket_id, question_id, value)
        select v_ticket, q.id, left(a ->> 'value', 2000) from public.form_questions q
        where q.id = (a ->> 'question_id')::uuid and q.event_id = v_event.id
        on conflict do nothing;
      end loop;
    end loop;
  end loop;

  if v_counts <> v_expected then
    raise exception 'Preencha os participantes de todos os ingressos.' using errcode = '22023';
  end if;

  -- Respostas obrigatórias
  if exists (select 1 from public.form_questions q, public.tickets t
             where q.event_id = v_event.id and q.required and t.order_id = v_order
               and not exists (select 1 from public.form_answers fa
                               where fa.ticket_id = t.id and fa.question_id = q.id
                                 and coalesce(trim(fa.value), '') <> '')) then
    raise exception 'Responda as perguntas obrigatórias de todos os participantes.' using errcode = '22023';
  end if;

  -- Capacidade com vagas reservadas por perfil (excluindo a própria reserva).
  select coalesce(sum(greatest(tr.reserved_seats - (
           select count(*) from public.tickets t join public.order_items oi on oi.id = t.order_item_id
           where oi.ticket_type_id = tr.ticket_type_id and oi.tier_applied = tr.tier
             and t.event_date_id = v_date.id and t.status in ('pending', 'valid', 'used')
             and t.order_id <> v_order), 0)), 0)
    into v_reserved_other
  from public.tier_rules tr join public.ticket_types tt on tt.id = tr.ticket_type_id
  where tt.event_id = v_event.id and tr.reserved_seats > 0
    and not exists (select 1 from public.order_items oi where oi.order_id = v_order
                    and oi.ticket_type_id = tr.ticket_type_id and oi.tier_applied = tr.tier);
  v_avail := v_date.capacity - (private.date_used(v_date.id, v_res.id) - v_needed) - v_reserved_other;
  if v_avail < v_needed then
    raise exception 'Vagas esgotadas para o seu perfil nesta data.' using errcode = 'P0001';
  end if;

  update public.reservations set status = 'converted' where id = v_res.id;
  if v_res.waitlist_id is not null then
    update public.waitlist set status = 'accepted' where id = v_res.waitlist_id;
  end if;

  if v_total = 0 then
    update public.orders set total = 0, payment_method = 'free', coupon_id = v_coupon where id = v_order;
    perform private.confirm_order(v_order);
  else
    if not coalesce((private.setting('payments_enabled'))::boolean, false) then
      raise exception 'O pagamento online ainda não está disponível. Fale com a ACIESC.' using errcode = 'P0001';
    end if;
    v_method := coalesce(nullif(p_data ->> 'payment_method', ''), 'pix')::public.payment_method;
    if v_method = 'free' then
      raise exception 'Forma de pagamento inválida.' using errcode = '22023';
    end if;
    if v_method = 'card' and (select installments from public.orders where id = v_order)
       > coalesce((private.setting('max_installments'))::int, 12) then
      raise exception 'Número de parcelas inválido.' using errcode = '22023';
    end if;
    update public.orders set total = v_total, payment_method = v_method, coupon_id = v_coupon,
      installments = case when v_method = 'card' then installments else 1 end,
      expires_at = now() + interval '15 minutes'
    where id = v_order;
  end if;

  select coalesce(jsonb_agg(jsonb_build_object('id', t.id, 'name', t.attendee_name)), '[]'::jsonb)
    into v_tickets from public.tickets t where t.order_id = v_order;

  return jsonb_build_object('order_id', v_order, 'total', v_total,
    'status', (select status from public.orders where id = v_order),
    'requires_payment', v_total > 0, 'tickets', v_tickets);
end;
$$;
revoke all on function public.checkout(uuid, jsonb) from public;
grant execute on function public.checkout(uuid, jsonb) to anon, authenticated;

-- Assinatura do QR (HMAC-SHA256, 16 hex).
create or replace function private.ticket_sig(p_code text)
returns text language sql stable security definer set search_path = '' as $$
  select substr(encode(extensions.hmac(p_code, (select value from private.secrets where name = 'ticket_hmac'),
                                       'sha256'), 'hex'), 1, 16);
$$;

-- Pedido (o id é o token de acesso, enviado só ao comprador).
create or replace function public.get_order(p_order_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', o.id, 'status', o.status, 'total', o.total, 'payment_method', o.payment_method,
    'installments', o.installments, 'expires_at', o.expires_at, 'created_at', o.created_at, 'paid_at', o.paid_at,
    'event', jsonb_build_object('title', e.title, 'slug', e.slug, 'cover_url', e.cover_url),
    'date', jsonb_build_object('starts_at', d.starts_at, 'ends_at', d.ends_at, 'label', d.label),
    'payment', (select to_jsonb(op) - 'order_id' from public.order_payments op where op.order_id = o.id),
    'tickets', (select jsonb_agg(jsonb_build_object(
                  'id', t.id, 'name', t.attendee_name, 'status', t.status, 'type', tt.name,
                  'qr', case when o.status = 'paid' and t.status in ('valid', 'used')
                             then t.code || '.' || private.ticket_sig(t.code) end) order by t.created_at)
                from public.tickets t
                join public.order_items oi on oi.id = t.order_item_id
                join public.ticket_types tt on tt.id = oi.ticket_type_id
                where t.order_id = o.id))
  from public.orders o
  join public.events e on e.id = o.event_id
  join public.event_dates d on d.id = o.event_date_id
  where o.id = p_order_id;
$$;
revoke all on function public.get_order(uuid) from public;
grant execute on function public.get_order(uuid) to anon, authenticated;

-- Confirmação de pagamento — só service_role (webhook do gateway). Idempotente por evento.
create or replace function public.payment_confirm(p_provider text, p_event_id text, p_order_id uuid,
                                                  p_provider_ref text, p_status text, p_payload jsonb)
returns text language plpgsql security definer set search_path = '' as $$
declare
  v_inserted int;
begin
  insert into public.payment_events (provider, event_id, order_id, payload)
  values (p_provider, p_event_id, p_order_id, p_payload)
  on conflict on constraint payment_events_unique do nothing;
  get diagnostics v_inserted = row_count;
  if v_inserted = 0 then
    return 'duplicate';
  end if;
  update public.orders set provider = p_provider, provider_ref = coalesce(p_provider_ref, provider_ref)
  where id = p_order_id;
  if p_status = 'paid' then
    perform private.confirm_order(p_order_id);
  elsif p_status in ('failed', 'cancelled') then
    perform private.cancel_order(p_order_id, 'payment_' || p_status);
  elsif p_status = 'refunded' then
    perform private.cancel_order(p_order_id, 'refunded');
  end if;
  return 'ok';
end;
$$;
revoke all on function public.payment_confirm(text, text, uuid, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.payment_confirm(text, text, uuid, text, text, jsonb) to service_role;

create or replace function private.cancel_order(p_order_id uuid, p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_order public.orders;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found or v_order.status in ('cancelled', 'refunded') then
    return;
  end if;
  update public.orders set
    status = case when p_reason = 'refunded' then 'refunded'::public.order_status
                  when p_reason like 'payment_failed%' then 'failed'::public.order_status
                  else 'cancelled'::public.order_status end,
    cancelled_at = now()
  where id = p_order_id;
  update public.tickets set status = 'cancelled', cancel_reason = p_reason
  where order_id = p_order_id and status in ('pending', 'valid');
  if v_order.status = 'paid' and v_order.coupon_id is not null then
    update public.coupons set used = greatest(used - 1, 0) where id = v_order.coupon_id;
  end if;
  perform private.audit('order.cancelled', 'orders', p_order_id::text, jsonb_build_object('reason', p_reason));
end;
$$;

-- Cancelamento pela equipe (política de reembolso pendente — decisão #8).
create or replace function public.cancel_order(p_order_id uuid, p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not private.can_manage_event((select event_id from public.orders where id = p_order_id)) then
    raise exception 'Sem permissão.' using errcode = '42501';
  end if;
  perform private.cancel_order(p_order_id, coalesce(nullif(trim(p_reason), ''), 'staff'));
end;
$$;
revoke all on function public.cancel_order(uuid, text) from public, anon;
grant execute on function public.cancel_order(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Área do participante
-- ---------------------------------------------------------------------------
create or replace function public.my_tickets()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_person uuid;
begin
  v_person := public.claim_person();
  if v_person is null then
    return '[]'::jsonb;
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', t.id, 'name', t.attendee_name, 'status', t.status, 'code', t.code,
      'qr', case when t.status in ('valid', 'used') then t.code || '.' || private.ticket_sig(t.code) end,
      'presence_confirmed', t.presence_confirmed, 'presence_token', t.presence_token,
      'type', tt.name, 'order_id', t.order_id, 'order_status', o.status,
      'event', jsonb_build_object('id', e.id, 'title', e.title, 'slug', e.slug, 'cover_url', e.cover_url,
                                  'format', e.format, 'certificate_hours', e.certificate_hours),
      'date', jsonb_build_object('starts_at', d.starts_at, 'ends_at', d.ends_at, 'label', d.label),
      'venue', (select jsonb_build_object('name', v.name, 'address', v.address, 'city', v.city,
                                          'maps_url', v.maps_url, 'parking_info', v.parking_info)
                from public.venues v where v.id = e.venue_id),
      'online_url', case when t.status in ('valid', 'used') then es.online_url end,
      'instructions', case when t.status in ('valid', 'used') then es.attendee_instructions end,
      'checked_in_at', (select c.at from public.checkins c where c.ticket_id = t.id and c.kind = 'in'
                        and c.undone_at is null),
      'certificate', (select jsonb_build_object('code', c.code, 'hours', c.hours, 'issued_at', c.issued_at)
                      from public.certificates c where c.ticket_id = t.id and c.revoked_at is null))
      order by d.starts_at desc)
    from public.tickets t
    join public.orders o on o.id = t.order_id
    join public.order_items oi on oi.id = t.order_item_id
    join public.ticket_types tt on tt.id = oi.ticket_type_id
    join public.events e on e.id = t.event_id
    join public.event_dates d on d.id = t.event_date_id
    left join public.event_secrets es on es.event_id = e.id
    where (t.attendee_person_id = v_person or o.buyer_person_id = v_person)
      and (t.status <> 'pending' or o.status = 'pending')
  ), '[]'::jsonb);
end;
$$;
revoke all on function public.my_tickets() from public, anon;
grant execute on function public.my_tickets() to authenticated;

-- Confirmação de presença por link (token do ingresso).
create or replace function public.presence_info(p_token uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('name', t.attendee_name, 'event_title', e.title, 'starts_at', d.starts_at,
                            'status', t.status, 'presence_confirmed', t.presence_confirmed,
                            'open', t.status = 'valid' and d.starts_at > now())
  from public.tickets t join public.events e on e.id = t.event_id
  join public.event_dates d on d.id = t.event_date_id
  where t.presence_token = p_token;
$$;
revoke all on function public.presence_info(uuid) from public;
grant execute on function public.presence_info(uuid) to anon, authenticated;

create or replace function public.confirm_presence(p_token uuid, p_going boolean)
returns text language plpgsql security definer set search_path = '' as $$
declare
  v_ticket public.tickets;
  v_starts timestamptz;
begin
  perform private.rate_limit('confirm_presence', 20, 10);
  select * into v_ticket from public.tickets where presence_token = p_token for update;
  if not found then
    raise exception 'Link inválido.' using errcode = 'P0002';
  end if;
  select starts_at into v_starts from public.event_dates where id = v_ticket.event_date_id;
  if v_ticket.status <> 'valid' or v_starts <= now() then
    raise exception 'Este ingresso não aceita mais confirmação.' using errcode = 'P0001';
  end if;
  update public.tickets set presence_confirmed = p_going where id = v_ticket.id;
  if not p_going then
    update public.tickets set status = 'cancelled', cancel_reason = 'declined' where id = v_ticket.id;
    perform private.audit('ticket.declined', 'tickets', v_ticket.id::text, '{}'::jsonb);
    perform private.offer_waitlist_seats(v_ticket.event_date_id);
    return 'cancelled';
  end if;
  return 'confirmed';
end;
$$;
revoke all on function public.confirm_presence(uuid, boolean) from public;
grant execute on function public.confirm_presence(uuid, boolean) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Lista de espera
-- ---------------------------------------------------------------------------
create or replace function public.join_waitlist(p_event_date_id uuid, p_person jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_date public.event_dates;
  v_event public.events;
  v_person uuid;
  v_id uuid;
  v_pos int;
begin
  perform private.rate_limit('join_waitlist', 10, 10);
  select * into v_date from public.event_dates where id = p_event_date_id;
  select * into v_event from public.events where id = v_date.event_id;
  if v_event.status <> 'published' or v_date.starts_at <= now()
     or not coalesce((v_event.rules ->> 'waitlist_enabled')::boolean, true) then
    raise exception 'Lista de espera indisponível para esta data.' using errcode = 'P0001';
  end if;
  v_person := private.upsert_person(p_person, 'waitlist');
  if exists (select 1 from public.tickets where event_date_id = p_event_date_id and attendee_person_id = v_person
             and status in ('pending', 'valid', 'used')) then
    raise exception 'Você já está inscrito nesta data.' using errcode = 'P0001';
  end if;
  insert into public.waitlist (event_date_id, person_id) values (p_event_date_id, v_person)
  on conflict on constraint waitlist_unique do update set
    status = case when public.waitlist.status in ('expired', 'removed') then 'waiting'::public.waitlist_status
                  else public.waitlist.status end,
    created_at = case when public.waitlist.status in ('expired', 'removed') then now()
                      else public.waitlist.created_at end
  returning id into v_id;
  select count(*) into v_pos from public.waitlist
  where event_date_id = p_event_date_id and status = 'waiting'
    and created_at <= (select created_at from public.waitlist where id = v_id);
  return jsonb_build_object('position', v_pos);
end;
$$;
revoke all on function public.join_waitlist(uuid, jsonb) from public;
grant execute on function public.join_waitlist(uuid, jsonb) to anon, authenticated;

-- Faltas no semestre corrente (para a penalidade configurável).
create or replace function private.semester_absences(p_person_id uuid)
returns int language sql stable security definer set search_path = '' as $$
  select count(*)::int from public.absences
  where person_id = p_person_id
    and created_at >= date_trunc('year', now())
                      + case when extract(month from now()) > 6 then interval '6 months' else interval '0' end;
$$;

-- Oferece vagas livres aos próximos da fila (reserva de N horas com link).
create or replace function private.offer_waitlist_seats(p_event_date_id uuid)
returns int language plpgsql security definer set search_path = '' as $$
declare
  v_date public.event_dates;
  v_event public.events;
  w record;
  v_type uuid;
  v_res uuid;
  v_hours int;
  v_offered int := 0;
  v_penalty boolean := coalesce((private.setting('absence_penalty_enabled'))::boolean, false);
  v_limit int := coalesce((private.setting('absence_limit_per_semester'))::int, 2);
begin
  select * into v_date from public.event_dates where id = p_event_date_id;
  select * into v_event from public.events where id = v_date.event_id;
  if v_event.status <> 'published' or v_date.starts_at <= now()
     or not coalesce((v_event.rules ->> 'waitlist_enabled')::boolean, true) then
    return 0;
  end if;
  v_hours := coalesce((v_event.rules ->> 'waitlist_accept_hours')::int, 4);
  perform private.sync_lots(p_event_date_id);

  for w in
    select wl.* from public.waitlist wl
    where wl.event_date_id = p_event_date_id and wl.status = 'waiting'
    order by case when v_penalty and private.semester_absences(wl.person_id) >= v_limit then 1 else 0 end,
             wl.created_at
  loop
    exit when private.date_remaining(p_event_date_id) < 1;
    select tt.id into v_type from public.ticket_types tt
    join public.lots l on l.ticket_type_id = tt.id and l.event_date_id = p_event_date_id and l.status = 'active'
    where tt.event_id = v_event.id and tt.visible and tt.people_per_ticket = 1
      and private.lot_used(l.id) < l.quantity
    order by tt.sort limit 1;
    exit when v_type is null;

    v_res := private.create_reservation_internal(
      p_event_date_id, jsonb_build_array(jsonb_build_object('ticket_type_id', v_type, 'quantity', 1)),
      least(now() + make_interval(hours => v_hours), v_date.starts_at), '{"utm_source":"waitlist"}', w.id);
    update public.waitlist set status = 'offered', offered_at = now(),
      expires_at = least(now() + make_interval(hours => v_hours), v_date.starts_at), reservation_id = v_res
    where id = w.id;
    perform private.enqueue_message('waitlist_offer', w.person_id, null, v_event.id,
      jsonb_build_object('event_title', v_event.title, 'starts_at', v_date.starts_at, 'hours', v_hours,
                         'accept_url', private.site_url() || '/lista-espera/?t=' || w.token),
      'waitlist_offer:' || w.id || ':' || v_res);
    v_offered := v_offered + 1;
  end loop;
  return v_offered;
end;
$$;

create or replace function public.offer_waitlist_seat(p_event_date_id uuid)
returns int language plpgsql security definer set search_path = '' as $$
begin
  if not private.can_manage_event((select event_id from public.event_dates where id = p_event_date_id)) then
    raise exception 'Sem permissão.' using errcode = '42501';
  end if;
  return private.offer_waitlist_seats(p_event_date_id);
end;
$$;
revoke all on function public.offer_waitlist_seat(uuid) from public, anon;
grant execute on function public.offer_waitlist_seat(uuid) to authenticated;

-- Link da oferta → reserva para o checkout.
create or replace function public.waitlist_offer(p_token uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('status', case when w.status = 'offered' and w.expires_at <= now() then 'expired'
                                           else w.status::text end,
                            'reservation_id', case when w.status = 'offered' and w.expires_at > now()
                                                   then w.reservation_id end,
                            'expires_at', w.expires_at, 'event_title', e.title, 'starts_at', d.starts_at)
  from public.waitlist w join public.event_dates d on d.id = w.event_date_id
  join public.events e on e.id = d.event_id
  where w.token = p_token;
$$;
revoke all on function public.waitlist_offer(uuid) from public;
grant execute on function public.waitlist_offer(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Check-in
-- ---------------------------------------------------------------------------
create or replace function private.can_door(p_event_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select private.has_role('door', p_event_id) or private.has_role('organizer', p_event_id);
$$;
grant execute on function private.can_door(uuid) to authenticated;

-- p_payload: "CODIGO.ASSINATURA" lido do QR, ou só o código (digitado/leitor USB com busca manual).
create or replace function public.checkin(p_payload text, p_event_date_id uuid, p_kind public.checkin_kind default 'in',
                                          p_device_id text default null, p_at timestamptz default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_code text := upper(split_part(trim(p_payload), '.', 1));
  v_sig text := lower(split_part(trim(p_payload), '.', 2));
  v_ticket public.tickets;
  v_order public.orders;
  v_event uuid := (select event_id from public.event_dates where id = p_event_date_id);
  v_prev timestamptz;
begin
  if v_event is null or not private.can_door(v_event) then
    raise exception 'Sem permissão.' using errcode = '42501';
  end if;
  if v_sig <> '' and v_sig <> private.ticket_sig(v_code) then
    return jsonb_build_object('result', 'invalid');
  end if;
  select * into v_ticket from public.tickets where code = v_code for update;
  if not found then
    return jsonb_build_object('result', 'invalid');
  end if;
  if v_ticket.event_date_id <> p_event_date_id then
    return jsonb_build_object('result', 'other_event', 'name', v_ticket.attendee_name);
  end if;
  select * into v_order from public.orders where id = v_ticket.order_id;
  if v_ticket.status = 'pending' or v_order.status = 'pending' then
    return jsonb_build_object('result', 'pending_payment', 'name', v_ticket.attendee_name);
  end if;
  if v_ticket.status in ('cancelled', 'transferred') then
    return jsonb_build_object('result', 'cancelled', 'name', v_ticket.attendee_name);
  end if;

  select at into v_prev from public.checkins where ticket_id = v_ticket.id and kind = p_kind and undone_at is null;
  if v_prev is not null then
    return jsonb_build_object('result', 'already_used', 'name', v_ticket.attendee_name, 'at', v_prev);
  end if;
  if p_kind = 'out' and not exists (select 1 from public.checkins where ticket_id = v_ticket.id
                                    and kind = 'in' and undone_at is null) then
    return jsonb_build_object('result', 'no_checkin', 'name', v_ticket.attendee_name);
  end if;

  insert into public.checkins (ticket_id, kind, at, device_id, offline)
  values (v_ticket.id, p_kind, coalesce(p_at, now()), left(p_device_id, 100), p_at is not null);
  if p_kind = 'in' then
    update public.tickets set status = 'used' where id = v_ticket.id;
  end if;
  return jsonb_build_object('result', 'ok', 'name', v_ticket.attendee_name, 'ticket_id', v_ticket.id,
    'type', (select tt.name from public.order_items oi join public.ticket_types tt on tt.id = oi.ticket_type_id
             where oi.id = v_ticket.order_item_id));
end;
$$;
revoke all on function public.checkin(text, uuid, public.checkin_kind, text, timestamptz) from public, anon;
grant execute on function public.checkin(text, uuid, public.checkin_kind, text, timestamptz) to authenticated;

-- Desfazer check-in: exige organizer.
create or replace function public.undo_checkin(p_ticket_id uuid, p_kind public.checkin_kind default 'in')
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_ticket public.tickets;
begin
  select * into v_ticket from public.tickets where id = p_ticket_id for update;
  if not found or not private.can_manage_event(v_ticket.event_id) then
    raise exception 'Sem permissão.' using errcode = '42501';
  end if;
  update public.checkins set undone_at = now(), undone_by = (select auth.uid())
  where ticket_id = p_ticket_id and kind = p_kind and undone_at is null;
  if p_kind = 'in' then
    update public.checkins set undone_at = now(), undone_by = (select auth.uid())
    where ticket_id = p_ticket_id and kind = 'out' and undone_at is null;
    update public.tickets set status = 'valid' where id = p_ticket_id and status = 'used';
  end if;
  perform private.audit('checkin.undone', 'tickets', p_ticket_id::text, jsonb_build_object('kind', p_kind));
end;
$$;
revoke all on function public.undo_checkin(uuid, public.checkin_kind) from public, anon;
grant execute on function public.undo_checkin(uuid, public.checkin_kind) to authenticated;

-- Lista para portaria/check-in online (inclui assinatura para validação offline).
create or replace function public.door_list(p_event_date_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_event uuid := (select event_id from public.event_dates where id = p_event_date_id);
begin
  if v_event is null or not private.can_door(v_event) then
    raise exception 'Sem permissão.' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'ticket_id', t.id, 'code', t.code, 'sig', private.ticket_sig(t.code), 'name', t.attendee_name,
      'status', t.status, 'order_status', o.status, 'type', tt.name, 'tier', oi.tier_applied,
      'cpf_masked', '***.' || substr(p.cpf, 4, 3) || '.' || substr(p.cpf, 7, 3) || '-**',
      'email', p.email, 'phone', p.phone, 'creci', p.creci, 'company', p.company, 'city', p.city,
      'presence_confirmed', t.presence_confirmed,
      'in_at', (select c.at from public.checkins c where c.ticket_id = t.id and c.kind = 'in' and c.undone_at is null),
      'out_at', (select c.at from public.checkins c where c.ticket_id = t.id and c.kind = 'out' and c.undone_at is null),
      'person_id', p.id)
      order by t.attendee_name)
    from public.tickets t
    join public.orders o on o.id = t.order_id
    join public.order_items oi on oi.id = t.order_item_id
    join public.ticket_types tt on tt.id = oi.ticket_type_id
    join public.people p on p.id = t.attendee_person_id
    where t.event_date_id = p_event_date_id and t.status <> 'pending'
  ), '[]'::jsonb);
end;
$$;
revoke all on function public.door_list(uuid) from public, anon;
grant execute on function public.door_list(uuid) to authenticated;

-- Eventos atribuídos à portaria do usuário (para o app de portaria).
create or replace function public.door_events()
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('event_id', e.id, 'title', e.title, 'date_id', d.id,
                                               'starts_at', d.starts_at, 'ends_at', d.ends_at, 'label', d.label)
                            order by d.starts_at), '[]'::jsonb)
  from public.events e join public.event_dates d on d.event_id = e.id
  where e.status in ('published', 'closed') and d.ends_at > now() - interval '1 day'
    and private.can_door(e.id);
$$;
revoke all on function public.door_events() from public, anon;
grant execute on function public.door_events() to authenticated;

-- ---------------------------------------------------------------------------
-- Certificados
-- ---------------------------------------------------------------------------
create or replace function private.issue_certificates(p_event_date_id uuid)
returns int language plpgsql security definer set search_path = '' as $$
declare
  v_date public.event_dates;
  v_event public.events;
  t record;
  v_cert uuid;
  v_n int := 0;
  v_require_out boolean;
begin
  select * into v_date from public.event_dates where id = p_event_date_id;
  select * into v_event from public.events where id = v_date.event_id;
  if v_event.certificate_hours <= 0 then
    return 0;
  end if;
  v_require_out := coalesce((v_event.rules ->> 'require_checkout')::boolean, false);
  for t in
    select tk.* from public.tickets tk
    where tk.event_date_id = p_event_date_id and tk.status = 'used'
      and exists (select 1 from public.checkins c where c.ticket_id = tk.id and c.kind = 'in' and c.undone_at is null)
      and (not v_require_out or exists (select 1 from public.checkins c where c.ticket_id = tk.id
                                        and c.kind = 'out' and c.undone_at is null))
      and not exists (select 1 from public.certificates c where c.ticket_id = tk.id)
  loop
    insert into public.certificates (ticket_id, person_name, event_title, event_date, hours)
    values (t.id, t.attendee_name, v_event.title, (v_date.starts_at at time zone 'America/Sao_Paulo')::date,
            v_event.certificate_hours)
    returning id into v_cert;
    v_n := v_n + 1;
    if coalesce((v_event.auto_messages ->> 'certificate')::boolean, true) then
      perform private.enqueue_message('certificate', t.attendee_person_id, t.id, v_event.id,
        private.ticket_payload(t.id) || jsonb_build_object(
          'certificate_url', private.site_url() || '/certificado/?c=' ||
                             (select code from public.certificates where id = v_cert)),
        'certificate:' || t.id);
    end if;
  end loop;
  update public.event_dates set certificates_processed_at = now() where id = p_event_date_id;
  if v_n > 0 then
    perform private.audit('certificates.issued', 'event_dates', p_event_date_id::text, jsonb_build_object('count', v_n));
  end if;
  return v_n;
end;
$$;

create or replace function public.issue_certificates(p_event_date_id uuid)
returns int language plpgsql security definer set search_path = '' as $$
begin
  if not private.can_manage_event((select event_id from public.event_dates where id = p_event_date_id)) then
    raise exception 'Sem permissão.' using errcode = '42501';
  end if;
  return private.issue_certificates(p_event_date_id);
end;
$$;
revoke all on function public.issue_certificates(uuid) from public, anon;
grant execute on function public.issue_certificates(uuid) to authenticated;

-- Validação pública (sem dados sensíveis).
create or replace function public.validate_certificate(p_code text)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  perform private.rate_limit('validate_certificate', 30, 10);
  return (select jsonb_build_object('code', c.code, 'person_name', c.person_name, 'event_title', c.event_title,
                                    'event_date', c.event_date, 'hours', c.hours, 'issued_at', c.issued_at,
                                    'revoked', c.revoked_at is not null)
          from public.certificates c where c.code = upper(trim(p_code)));
end;
$$;
revoke all on function public.validate_certificate(text) from public;
grant execute on function public.validate_certificate(text) to anon, authenticated;

-- Dados para gerar o PDF do certificado (titular ou equipe).
create or replace function public.certificate_document(p_code text)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('code', c.code, 'person_name', c.person_name, 'event_title', c.event_title,
                            'event_date', c.event_date, 'hours', c.hours, 'issued_at', c.issued_at,
                            'background_url', coalesce(nullif(e.certificate_background_url, ''),
                                                       private.setting('certificate_background_url') #>> '{}'),
                            'signer_name', private.setting('certificate_signer_name') #>> '{}',
                            'signer_role', private.setting('certificate_signer_role') #>> '{}',
                            'signature_url', private.setting('certificate_signature_url') #>> '{}',
                            'validate_url', private.site_url() || '/validar/?c=' || c.code)
  from public.certificates c
  join public.tickets t on t.id = c.ticket_id
  join public.events e on e.id = t.event_id
  join public.people p on p.id = t.attendee_person_id
  where c.code = upper(trim(p_code)) and c.revoked_at is null
    and (p.user_id = (select auth.uid()) or private.can_manage_event(e.id));
$$;
revoke all on function public.certificate_document(text) from public, anon;
grant execute on function public.certificate_document(text) to authenticated;

-- ---------------------------------------------------------------------------
-- RLS (leitura direta pela equipe; público usa RPCs acima)
-- ---------------------------------------------------------------------------
alter table public.reservations enable row level security;
alter table public.reservation_items enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.order_payments enable row level security;
alter table public.payment_events enable row level security;
alter table public.tickets enable row level security;
alter table public.checkins enable row level security;
alter table public.waitlist enable row level security;
alter table public.absences enable row level security;
alter table public.certificates enable row level security;
alter table public.form_questions enable row level security;
alter table public.form_answers enable row level security;
alter table public.messages_log enable row level security;

create or replace function private.can_view_event_data(p_event_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select private.has_role('organizer', p_event_id) or private.has_role('finance', p_event_id);
$$;
grant execute on function private.can_view_event_data(uuid) to authenticated;

create policy "reservations: equipe lê" on public.reservations for select to authenticated
  using ((select private.can_view_event_data((select event_id from public.event_dates where id = event_date_id))));
create policy "reservation_items: equipe lê" on public.reservation_items for select to authenticated
  using ((select private.is_staff()));
create policy "orders: equipe/finance ou comprador lê" on public.orders for select to authenticated
  using ((select private.can_view_event_data(event_id))
         or buyer_person_id in (select id from public.people where user_id = (select auth.uid())));
create policy "order_items: equipe lê" on public.order_items for select to authenticated
  using ((select private.can_view_event_data((select event_id from public.orders where id = order_id))));
create policy "order_payments: equipe lê" on public.order_payments for select to authenticated
  using ((select private.can_view_event_data((select event_id from public.orders where id = order_id))));
create policy "payment_events: admin lê" on public.payment_events for select to authenticated
  using ((select private.is_admin()) or (select private.has_role('finance', null)));
create policy "tickets: equipe lê" on public.tickets for select to authenticated
  using ((select private.can_view_event_data(event_id)));
create policy "checkins: equipe lê" on public.checkins for select to authenticated
  using ((select private.can_view_event_data((select event_id from public.tickets where id = ticket_id))));
create policy "waitlist: equipe lê" on public.waitlist for select to authenticated
  using ((select private.can_view_event_data((select event_id from public.event_dates where id = event_date_id))));
create policy "waitlist: equipe remove" on public.waitlist for update to authenticated
  using ((select private.can_manage_event((select event_id from public.event_dates where id = event_date_id))))
  with check ((select private.can_manage_event((select event_id from public.event_dates where id = event_date_id))));
create policy "absences: equipe lê" on public.absences for select to authenticated
  using ((select private.can_read_base()));
create policy "certificates: equipe lê" on public.certificates for select to authenticated
  using ((select private.can_view_event_data((select event_id from public.tickets where id = ticket_id))));
create policy "certificates: equipe revoga" on public.certificates for update to authenticated
  using ((select private.can_manage_event((select event_id from public.tickets where id = ticket_id))))
  with check ((select private.can_manage_event((select event_id from public.tickets where id = ticket_id))));
create policy "form_questions: leitura" on public.form_questions for select to anon, authenticated
  using ((select private.event_is_public(event_id)) or (select private.can_manage_event(event_id)));
create policy "form_questions: escrita" on public.form_questions for all to authenticated
  using ((select private.can_manage_event(event_id))) with check ((select private.can_manage_event(event_id)));
create policy "form_answers: equipe lê" on public.form_answers for select to authenticated
  using ((select private.can_view_event_data((select event_id from public.tickets where id = ticket_id))));
create policy "messages_log: equipe lê" on public.messages_log for select to authenticated
  using ((select private.is_staff()));

revoke all on public.reservations, public.reservation_items, public.orders, public.order_items,
  public.order_payments, public.payment_events, public.tickets, public.checkins, public.waitlist,
  public.absences, public.certificates, public.form_answers, public.messages_log from anon;
revoke insert, update, delete on public.reservations, public.reservation_items, public.orders,
  public.order_items, public.order_payments, public.payment_events, public.tickets, public.checkins,
  public.absences, public.form_answers, public.messages_log from authenticated;
revoke insert, delete on public.waitlist, public.certificates from authenticated;
revoke insert, update, delete on public.form_questions from anon;

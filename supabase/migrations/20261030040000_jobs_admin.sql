-- Jobs agendados, envio manual, dados do painel, importação do Sympla, rebuild do site, storage.

create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

-- ---------------------------------------------------------------------------
-- Jobs (rodam a cada minuto via pg_cron)
-- ---------------------------------------------------------------------------
create or replace function private.run_jobs()
returns void language plpgsql security definer set search_path = '' as $$
declare
  d record;
  t record;
  w record;
  v_now timestamptz := now();
  v_local timestamp := now() at time zone 'America/Sao_Paulo';
begin
  -- Reservas vencidas liberam estoque.
  update public.reservations set status = 'expired' where status = 'open' and expires_at <= v_now;

  -- Pedidos pendentes vencidos (Pix não pago) são cancelados.
  for t in select id from public.orders where status = 'pending' and expires_at is not null
           and expires_at <= v_now - interval '5 minutes' loop
    perform private.cancel_order(t.id, 'expired');
  end loop;

  -- Ofertas da lista de espera vencidas.
  for w in select id, event_date_id from public.waitlist where status = 'offered' and expires_at <= v_now loop
    update public.waitlist set status = 'expired' where id = w.id;
  end loop;

  -- Viradas de lote por data e oferta de vagas livres à lista de espera.
  for d in select ed.id from public.event_dates ed join public.events e on e.id = ed.event_id
           where e.status = 'published' and ed.starts_at > v_now loop
    perform private.sync_lots(d.id);
    if exists (select 1 from public.waitlist where event_date_id = d.id and status = 'waiting') then
      perform private.offer_waitlist_seats(d.id);
    end if;
  end loop;

  -- Confirmação de presença 48h antes.
  for t in select tk.id, tk.attendee_person_id, tk.event_id from public.tickets tk
           join public.event_dates ed on ed.id = tk.event_date_id
           join public.events e on e.id = tk.event_id
           where tk.status = 'valid' and tk.presence_requested_at is null and tk.presence_confirmed is null
             and coalesce((e.rules ->> 'confirm_presence_48h')::boolean, false)
             and ed.starts_at <= v_now + interval '48 hours' and ed.starts_at > v_now + interval '24 hours' loop
    update public.tickets set presence_requested_at = v_now where id = t.id;
    perform private.enqueue_message('confirm_presence', t.attendee_person_id, t.id, t.event_id,
                                    private.ticket_payload(t.id), 'confirm_presence:' || t.id);
  end loop;

  -- Libera vagas não confirmadas 24h antes.
  for d in select distinct ed.id from public.event_dates ed join public.events e on e.id = ed.event_id
           where e.status = 'published' and coalesce((e.rules ->> 'release_unconfirmed_24h')::boolean, false)
             and ed.starts_at <= v_now + interval '24 hours' and ed.starts_at > v_now loop
    for t in select id, attendee_person_id, event_id from public.tickets
             where event_date_id = d.id and status = 'valid' and presence_confirmed is null
               and presence_requested_at is not null loop
      update public.tickets set status = 'cancelled', cancel_reason = 'unconfirmed' where id = t.id;
      perform private.enqueue_message('released', t.attendee_person_id, t.id, t.event_id,
                                      private.ticket_payload(t.id), 'released:' || t.id);
    end loop;
    perform private.offer_waitlist_seats(d.id);
  end loop;

  -- Lembrete 2h antes.
  for t in select tk.id, tk.attendee_person_id, tk.event_id from public.tickets tk
           join public.event_dates ed on ed.id = tk.event_date_id
           join public.events e on e.id = tk.event_id
           where tk.status = 'valid' and tk.reminder_sent_at is null
             and coalesce((e.auto_messages ->> 'reminder_2h')::boolean, true)
             and ed.starts_at <= v_now + interval '2 hours' and ed.starts_at > v_now loop
    update public.tickets set reminder_sent_at = v_now where id = t.id;
    perform private.enqueue_message('reminder', t.attendee_person_id, t.id, t.event_id,
                                    private.ticket_payload(t.id), 'reminder:' || t.id);
  end loop;

  -- Faltas: quem não fez check-in nem cancelou.
  for d in select ed.id from public.event_dates ed join public.events e on e.id = ed.event_id
           where ed.ends_at <= v_now and ed.absences_processed_at is null
             and coalesce((e.rules ->> 'register_absence')::boolean, false) loop
    insert into public.absences (person_id, ticket_id, event_date_id)
    select tk.attendee_person_id, tk.id, tk.event_date_id from public.tickets tk
    where tk.event_date_id = d.id and tk.status = 'valid'
    on conflict (ticket_id) do nothing;
    update public.event_dates set absences_processed_at = v_now where id = d.id;
  end loop;

  -- Certificados no dia seguinte às 9h (America/Sao_Paulo).
  if extract(hour from v_local) >= 9 then
    for d in select ed.id from public.event_dates ed join public.events e on e.id = ed.event_id
             where ed.certificates_processed_at is null and e.certificate_hours > 0
               and (ed.ends_at at time zone 'America/Sao_Paulo')::date < v_local::date loop
      perform private.issue_certificates(d.id);
    end loop;
  end if;

  -- Limpeza do limite de taxa.
  delete from private.rate_limits where window_start < v_now - interval '1 day';
end;
$$;

-- Dispara a Edge Function que envia a fila e o rebuild do site.
-- Configure no Vault: project_url (https://<ref>.supabase.co) e cron_secret (mesmo valor do secret CRON_SECRET
-- das Edge Functions). Sem eles, nada é chamado.
create or replace function private.dispatch_http()
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_url text := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url');
  v_secret text := (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret');
begin
  if v_url is null or v_secret is null then
    return;
  end if;
  if exists (select 1 from public.messages_log where status = 'queued') then
    perform net.http_post(url := v_url || '/functions/v1/process-outbox',
                          headers := jsonb_build_object('Content-Type', 'application/json',
                                                        'x-cron-secret', v_secret),
                          body := '{}'::jsonb);
  end if;
  if exists (select 1 from private.rebuild_requests where dispatched_at is null) then
    perform net.http_post(url := v_url || '/functions/v1/request-rebuild',
                          headers := jsonb_build_object('Content-Type', 'application/json',
                                                        'x-cron-secret', v_secret),
                          body := '{}'::jsonb);
    update private.rebuild_requests set dispatched_at = now() where dispatched_at is null;
  end if;
end;
$$;

-- Pedidos de rebuild do site estático (evento publicado/alterado).
create table private.rebuild_requests (
  id bigint generated always as identity primary key,
  reason text not null,
  created_at timestamptz not null default now(),
  dispatched_at timestamptz
);

create or replace function private.request_rebuild()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_event uuid;
  v_status public.event_status;
begin
  if tg_table_name = 'events' then
    v_event := coalesce(new.id, old.id);
    v_status := coalesce(new.status, old.status);
    if tg_op = 'UPDATE' and old.status = 'draft' and new.status = 'draft' then
      return null;
    end if;
  else
    v_event := coalesce(new.event_id, old.event_id);
    select status into v_status from public.events where id = v_event;
    if v_status is null or v_status = 'draft' then
      return null;
    end if;
  end if;
  insert into private.rebuild_requests (reason) values (tg_table_name || ':' || v_event);
  return null;
end;
$$;
create trigger events_rebuild after insert or update or delete on public.events
  for each row execute function private.request_rebuild();
create trigger event_dates_rebuild after insert or update of starts_at, ends_at, label or delete on public.event_dates
  for each row execute function private.request_rebuild();
create trigger speakers_rebuild after insert or update or delete on public.speakers
  for each row execute function private.request_rebuild();

select cron.schedule('aciesc-jobs', '* * * * *', $$select private.run_jobs()$$);
select cron.schedule('aciesc-dispatch', '* * * * *', $$select private.dispatch_http()$$);

-- Fila de mensagens: a Edge Function (service_role) pega lotes com trava.
create or replace function public.claim_outbox(p_limit int default 50)
returns setof public.messages_log language sql security definer set search_path = '' as $$
  update public.messages_log m set attempts = attempts + 1
  where m.id in (select id from public.messages_log where status = 'queued' and attempts < 5
                 order by created_at limit p_limit for update skip locked)
  returning m.*;
$$;
revoke all on function public.claim_outbox(int) from public, anon, authenticated;
grant execute on function public.claim_outbox(int) to service_role;

create or replace function public.mark_message(p_id bigint, p_status public.message_status, p_error text default null)
returns void language sql security definer set search_path = '' as $$
  update public.messages_log set status = case when p_status = 'failed' and attempts < 5 then 'queued'::public.message_status
                                              else p_status end,
    error = left(p_error, 1000), sent_at = case when p_status = 'sent' then now() end
  where id = p_id;
$$;
revoke all on function public.mark_message(bigint, public.message_status, text) from public, anon, authenticated;
grant execute on function public.mark_message(bigint, public.message_status, text) to service_role;

-- ---------------------------------------------------------------------------
-- Envio manual para segmentos
-- ---------------------------------------------------------------------------
create or replace function public.send_segment_message(p_event_date_id uuid, p_segment text,
                                                       p_channels public.message_channel[],
                                                       p_subject text, p_body text)
returns int language plpgsql security definer set search_path = '' as $$
declare
  v_date public.event_dates;
  v_event public.events;
  r record;
  v_n int := 0;
  v_batch text := gen_random_uuid()::text;
begin
  select * into v_date from public.event_dates where id = p_event_date_id;
  select * into v_event from public.events where id = v_date.event_id;
  if not private.can_manage_event(v_event.id) then
    raise exception 'Sem permissão.' using errcode = '42501';
  end if;
  if coalesce(trim(p_body), '') = '' then
    raise exception 'Escreva a mensagem.' using errcode = '22023';
  end if;
  for r in
    select distinct on (person_id) person_id, ticket_id from (
      select t.attendee_person_id person_id, t.id ticket_id from public.tickets t
      where t.event_date_id = p_event_date_id and (
        (p_segment = 'all' and t.status in ('valid', 'used')) or
        (p_segment = 'unconfirmed' and t.status = 'valid' and t.presence_confirmed is null) or
        (p_segment = 'present' and t.status = 'used') or
        (p_segment = 'absent' and t.status = 'valid' and v_date.ends_at < now()))
      union all
      select w.person_id, null from public.waitlist w
      where p_segment = 'waitlist' and w.event_date_id = p_event_date_id and w.status in ('waiting', 'offered')
    ) s
  loop
    perform private.enqueue_message('custom', r.person_id, r.ticket_id, v_event.id,
      jsonb_build_object('subject', left(p_subject, 200), 'body', left(p_body, 4000),
                         'event_title', v_event.title, 'starts_at', v_date.starts_at),
      'custom:' || v_batch || ':' || r.person_id, p_channels);
    v_n := v_n + 1;
  end loop;
  perform private.audit('messages.bulk', 'event_dates', p_event_date_id::text,
    jsonb_build_object('segment', p_segment, 'channels', p_channels, 'count', v_n));
  return v_n;
end;
$$;
revoke all on function public.send_segment_message(uuid, text, public.message_channel[], text, text) from public, anon;
grant execute on function public.send_segment_message(uuid, text, public.message_channel[], text, text) to authenticated;

-- Ação na Base (convidar a associar, cobrar renovação, convidar a ser adepto).
create or replace function public.send_base_message(p_person_ids uuid[], p_template text,
                                                    p_channels public.message_channel[])
returns int language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
  v_n int := 0;
  v_batch text := gen_random_uuid()::text;
begin
  if not private.is_staff() then
    raise exception 'Sem permissão.' using errcode = '42501';
  end if;
  if p_template not in ('invite_associate', 'renewal_reminder', 'invite_adept') then
    raise exception 'Modelo inválido.' using errcode = '22023';
  end if;
  foreach v_id in array p_person_ids loop
    perform private.enqueue_message(p_template, v_id, null, null,
      jsonb_build_object('name', (select full_name from public.people where id = v_id),
                         'site_url', private.site_url()),
      p_template || ':' || v_batch || ':' || v_id, p_channels);
    v_n := v_n + 1;
  end loop;
  perform private.audit('messages.bulk', 'people', null,
    jsonb_build_object('template', p_template, 'count', v_n, 'channels', p_channels));
  return v_n;
end;
$$;
revoke all on function public.send_base_message(uuid[], text, public.message_channel[]) from public, anon;
grant execute on function public.send_base_message(uuid[], text, public.message_channel[]) to authenticated;

-- ---------------------------------------------------------------------------
-- Base ACIESC: listagem com participação
-- ---------------------------------------------------------------------------
create or replace function public.base_people(p_search text default null, p_tier text default null,
                                              p_participation text default null,
                                              p_limit int default 50, p_offset int default 0)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_search text := nullif(trim(p_search), '');
  v_digits text := regexp_replace(coalesce(p_search, ''), '\D', '', 'g');
begin
  if not private.can_read_base() then
    raise exception 'Sem permissão.' using errcode = '42501';
  end if;
  return (
    with base as (
      select p.id, p.full_name, p.email, p.phone, p.creci, p.company, p.city, p.cpf, p.created_at,
             m.tier, m.status, m.valid_until, m.source, private.effective_tier(p.id) effective,
             (select count(*) from public.tickets t where t.attendee_person_id = p.id
                and t.status in ('valid', 'used')) registrations,
             (select count(*) from public.tickets t where t.attendee_person_id = p.id and t.status = 'used') attended,
             (select count(*) from public.absences a where a.person_id = p.id) absences,
             (select a.ticket_id is not null from public.tickets t
                join public.event_dates d on d.id = t.event_date_id
                left join public.absences a on a.ticket_id = t.id
                where t.attendee_person_id = p.id and t.status in ('valid', 'used') and d.ends_at < now()
                order by d.starts_at desc limit 1) missed_last
      from public.people p left join public.memberships m on m.person_id = p.id
      where (v_search is null or p.full_name ilike '%' || v_search || '%' or p.email ilike '%' || v_search || '%'
             or p.creci ilike '%' || v_search || '%' or (length(v_digits) >= 3 and p.cpf like '%' || v_digits || '%'))
    ), filtered as (
      select * from base
      where (p_tier is null or p_tier = '' or
             (p_tier = 'associate' and tier = 'associate' and effective = 'associate') or
             (p_tier = 'expired' and tier = 'associate' and effective <> 'associate') or
             (p_tier = 'adept' and tier = 'adept') or
             (p_tier = 'other' and tier = 'other'))
        and (p_participation is null or p_participation = '' or
             (p_participation = 'never' and registrations = 0) or
             (p_participation = '1-2' and attended between 1 and 2) or
             (p_participation = '3+' and attended >= 3) or
             (p_participation = 'missed_last' and coalesce(missed_last, false)))
    )
    select jsonb_build_object(
      'total', (select count(*) from filtered),
      'funnel', jsonb_build_object(
        'other', (select count(*) from base where tier = 'other'),
        'adept', (select count(*) from base where tier = 'adept'),
        'associate', (select count(*) from base where tier = 'associate' and effective = 'associate'),
        'expired', (select count(*) from base where tier = 'associate' and effective <> 'associate')),
      'rows', coalesce((select jsonb_agg(jsonb_build_object(
          'id', id, 'full_name', full_name, 'email', email, 'phone', phone, 'creci', creci, 'company', company,
          'city', city, 'cpf_masked', '***.' || substr(cpf, 4, 3) || '.' || substr(cpf, 7, 3) || '-**',
          'tier', tier, 'status', status, 'effective', effective, 'valid_until', valid_until, 'source', source,
          'registrations', registrations, 'attended', attended, 'absences', absences) order by full_name)
        from (select * from filtered order by full_name limit least(p_limit, 500) offset p_offset) x), '[]'::jsonb))
  );
end;
$$;
revoke all on function public.base_people(text, text, text, int, int) from public, anon;
grant execute on function public.base_people(text, text, text, int, int) to authenticated;

-- Ficha da pessoa.
create or replace function public.person_detail(p_person_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.can_read_base() then
    raise exception 'Sem permissão.' using errcode = '42501';
  end if;
  return (
    select jsonb_build_object(
      'person', to_jsonb(p) - 'user_id',
      'membership', to_jsonb(m),
      'effective_tier', private.effective_tier(p.id),
      'history', coalesce((select jsonb_agg(to_jsonb(me) order by me.created_at desc)
                           from public.membership_events me where me.person_id = p.id), '[]'::jsonb),
      'events', coalesce((select jsonb_agg(jsonb_build_object(
                  'ticket_id', t.id, 'event_title', e.title, 'starts_at', d.starts_at, 'status', t.status,
                  'tier', oi.tier_applied, 'price', oi.unit_price, 'order_status', o.status,
                  'checked_in', exists (select 1 from public.checkins c where c.ticket_id = t.id
                                        and c.kind = 'in' and c.undone_at is null),
                  'absent', exists (select 1 from public.absences a where a.ticket_id = t.id),
                  'certificate', (select c.code from public.certificates c where c.ticket_id = t.id))
                  order by d.starts_at desc)
                from public.tickets t join public.events e on e.id = t.event_id
                join public.event_dates d on d.id = t.event_date_id
                join public.order_items oi on oi.id = t.order_item_id
                join public.orders o on o.id = t.order_id
                where t.attendee_person_id = p.id), '[]'::jsonb),
      'stats', jsonb_build_object(
        'registrations', (select count(*) from public.tickets t where t.attendee_person_id = p.id
                          and t.status in ('valid', 'used')),
        'attended', (select count(*) from public.tickets t where t.attendee_person_id = p.id and t.status = 'used'),
        'absences', (select count(*) from public.absences a where a.person_id = p.id),
        'hours', (select coalesce(sum(c.hours), 0) from public.certificates c join public.tickets t on t.id = c.ticket_id
                  where t.attendee_person_id = p.id and c.revoked_at is null)))
    from public.people p left join public.memberships m on m.person_id = p.id
    where p.id = p_person_id);
end;
$$;
revoke all on function public.person_detail(uuid) from public, anon;
grant execute on function public.person_detail(uuid) to authenticated;

-- CPF válido aleatório (para anonimização).
create or replace function private.random_cpf()
returns text language plpgsql volatile set search_path = '' as $$
declare
  v text;
begin
  loop
    v := lpad((floor(random() * 1000000000))::bigint::text, 9, '0');
    for i in 0..99 loop
      if private.is_valid_cpf(v || lpad(i::text, 2, '0'))
         and not exists (select 1 from public.people where cpf = v || lpad(i::text, 2, '0')) then
        return v || lpad(i::text, 2, '0');
      end if;
    end loop;
  end loop;
end;
$$;

-- Exclusão LGPD a pedido do titular (admin): anonimiza mantendo números agregados.
create or replace function public.anonymize_person(p_person_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_admin() then
    raise exception 'Sem permissão.' using errcode = '42501';
  end if;
  -- Mantém o histórico agregado (pedidos/ingressos) sem dados pessoais.
  update public.people set
    full_name = 'Titular anonimizado', email = null, phone = null, creci = null, company = null, city = null,
    notes = null, user_id = null, whatsapp_opt_in = false,
    cpf = private.random_cpf()
  where id = p_person_id;
  update public.tickets set attendee_name = 'Titular anonimizado' where attendee_person_id = p_person_id;
  update public.certificates set person_name = 'Titular anonimizado'
  where ticket_id in (select id from public.tickets where attendee_person_id = p_person_id);
  update public.orders set buyer_email = '' where buyer_person_id = p_person_id;
  delete from public.messages_log where person_id = p_person_id;
  perform private.audit('person.anonymized', 'people', p_person_id::text, '{}'::jsonb);
end;
$$;
revoke all on function public.anonymize_person(uuid) from public, anon;
grant execute on function public.anonymize_person(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Painel: lista de eventos e dados
-- ---------------------------------------------------------------------------
create or replace function public.admin_events()
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', e.id, 'slug', e.slug, 'title', e.title, 'status', e.status, 'kind', e.kind, 'cover_url', e.cover_url,
    'first_date', (select min(starts_at) from public.event_dates where event_id = e.id),
    'last_date', (select max(ends_at) from public.event_dates where event_id = e.id),
    'capacity', (select coalesce(sum(capacity), 0) from public.event_dates where event_id = e.id),
    'registered', (select count(*) from public.tickets t where t.event_id = e.id and t.status in ('valid', 'used')),
    'checked_in', (select count(*) from public.tickets t where t.event_id = e.id and t.status = 'used'),
    'waitlist', (select count(*) from public.waitlist w join public.event_dates d on d.id = w.event_date_id
                 where d.event_id = e.id and w.status = 'waiting'),
    'revenue', (select coalesce(sum(total), 0) from public.orders o where o.event_id = e.id and o.status = 'paid'))
    order by e.created_at desc), '[]'::jsonb)
  from public.events e
  where private.can_view_event_data(e.id);
$$;
revoke all on function public.admin_events() from public, anon;
grant execute on function public.admin_events() to authenticated;

create or replace function public.admin_dashboard(p_from date, p_to date)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_from timestamptz := (p_from::timestamp at time zone 'America/Sao_Paulo');
  v_to timestamptz := ((p_to + 1)::timestamp at time zone 'America/Sao_Paulo');
begin
  if not (private.is_staff() or private.has_role('finance', null)) then
    raise exception 'Sem permissão.' using errcode = '42501';
  end if;
  return (
    with tk as (
      select t.*, o.total, o.payment_method, o.utm_source, o.utm_medium, o.utm_campaign, o.device,
             o.created_at order_at, oi.unit_price, oi.tier_applied
      from public.tickets t join public.orders o on o.id = t.order_id
      join public.order_items oi on oi.id = t.order_item_id
      join public.event_dates d on d.id = t.event_date_id
      where d.starts_at >= v_from and d.starts_at < v_to and t.status in ('valid', 'used')
    )
    select jsonb_build_object(
      'registrations', (select count(*) from tk),
      'free', (select count(*) from tk where unit_price = 0),
      'paid', (select count(*) from tk where unit_price > 0),
      'checked_in', (select count(*) from tk where status = 'used'),
      'certificates', (select count(*) from public.certificates c join tk on tk.id = c.ticket_id),
      'hours', (select coalesce(sum(c.hours), 0) from public.certificates c join tk on tk.id = c.ticket_id),
      'revenue', (select coalesce(sum(o.total), 0) from public.orders o
                  join public.event_dates d on d.id = o.event_date_id
                  where o.status = 'paid' and d.starts_at >= v_from and d.starts_at < v_to),
      'by_tier', (select coalesce(jsonb_object_agg(tier_applied, n), '{}'::jsonb)
                  from (select tier_applied, count(*) n from tk group by 1) x),
      'by_event', (select coalesce(jsonb_agg(jsonb_build_object('title', title, 'registered', registered,
                                                                'present', present) order by registered desc), '[]')
                   from (select e.title, count(*) registered, count(*) filter (where tk.status = 'used') present
                         from tk join public.events e on e.id = tk.event_id group by e.title) x),
      'by_device', (select coalesce(jsonb_object_agg(coalesce(device, 'desconhecido'), n), '{}'::jsonb)
                    from (select device, count(*) n from tk group by 1) x),
      'by_hour', (select coalesce(jsonb_object_agg(h, n), '{}'::jsonb)
                  from (select extract(hour from order_at at time zone 'America/Sao_Paulo')::int h, count(*) n
                        from tk group by 1) x),
      'by_source', (select coalesce(jsonb_agg(jsonb_build_object('source', coalesce(utm_source, 'direto'),
                                                                 'medium', utm_medium, 'campaign', utm_campaign,
                                                                 'n', n) order by n desc), '[]')
                    from (select utm_source, utm_medium, utm_campaign, count(*) n from tk group by 1, 2, 3) x),
      'ranking', (select coalesce(jsonb_agg(jsonb_build_object('person_id', person_id, 'name', full_name,
                                                               'attended', n) order by n desc), '[]')
                  from (select p.id person_id, p.full_name, count(*) n from tk
                        join public.people p on p.id = tk.attendee_person_id
                        where tk.status = 'used' group by 1, 2 order by 3 desc limit 10) x),
      'associates_never', (select count(*) from public.people p
                           where private.effective_tier(p.id) = 'associate'
                             and not exists (select 1 from public.tickets t where t.attendee_person_id = p.id
                                             and t.status in ('valid', 'used')))));
end;
$$;
revoke all on function public.admin_dashboard(date, date) from public, anon;
grant execute on function public.admin_dashboard(date, date) to authenticated;

-- Financeiro do evento.
create or replace function public.event_finance(p_event_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.can_view_event_data(p_event_id) then
    raise exception 'Sem permissão.' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'paid', (select coalesce(sum(total), 0) from public.orders where event_id = p_event_id and status = 'paid'),
    'pending', (select coalesce(sum(total), 0) from public.orders where event_id = p_event_id and status = 'pending'),
    'cancelled', (select coalesce(sum(total), 0) from public.orders where event_id = p_event_id
                  and status in ('cancelled', 'failed')),
    'refunded', (select coalesce(sum(total), 0) from public.orders where event_id = p_event_id and status = 'refunded'),
    'orders', coalesce((select jsonb_agg(jsonb_build_object(
                 'id', o.id, 'created_at', o.created_at, 'status', o.status, 'total', o.total,
                 'method', o.payment_method, 'installments', o.installments, 'buyer', p.full_name,
                 'email', o.buyer_email, 'tickets', (select count(*) from public.tickets t where t.order_id = o.id),
                 'utm_source', o.utm_source) order by o.created_at desc)
               from public.orders o join public.people p on p.id = o.buyer_person_id
               where o.event_id = p_event_id), '[]'::jsonb));
end;
$$;
revoke all on function public.event_finance(uuid) from public, anon;
grant execute on function public.event_finance(uuid) to authenticated;

-- Visão geral do evento (por data).
create or replace function public.event_overview(p_event_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.can_view_event_data(p_event_id) then
    raise exception 'Sem permissão.' using errcode = '42501';
  end if;
  return coalesce((select jsonb_agg(jsonb_build_object(
    'date_id', d.id, 'starts_at', d.starts_at, 'ends_at', d.ends_at, 'label', d.label, 'capacity', d.capacity,
    'remaining', private.date_remaining(d.id),
    'registered', (select count(*) from public.tickets t where t.event_date_id = d.id and t.status in ('valid', 'used')),
    'pending', (select count(*) from public.tickets t where t.event_date_id = d.id and t.status = 'pending'),
    'confirmed', (select count(*) from public.tickets t where t.event_date_id = d.id and t.presence_confirmed),
    'declined', (select count(*) from public.tickets t where t.event_date_id = d.id and t.presence_confirmed = false),
    'checked_in', (select count(*) from public.tickets t where t.event_date_id = d.id and t.status = 'used'),
    'waitlist', (select count(*) from public.waitlist w where w.event_date_id = d.id and w.status = 'waiting'),
    'offered', (select count(*) from public.waitlist w where w.event_date_id = d.id and w.status = 'offered'),
    'certificates', (select count(*) from public.certificates c join public.tickets t on t.id = c.ticket_id
                     where t.event_date_id = d.id),
    'by_tier', (select coalesce(jsonb_object_agg(tier_applied, n), '{}'::jsonb) from (
                  select oi.tier_applied, count(*) n from public.tickets t
                  join public.order_items oi on oi.id = t.order_item_id
                  where t.event_date_id = d.id and t.status in ('valid', 'used') group by 1) x))
    order by d.starts_at) from public.event_dates d where d.event_id = p_event_id), '[]'::jsonb);
end;
$$;
revoke all on function public.event_overview(uuid) from public, anon;
grant execute on function public.event_overview(uuid) to authenticated;

-- Lista de espera (painel).
create or replace function public.waitlist_list(p_event_date_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.can_view_event_data((select event_id from public.event_dates where id = p_event_date_id)) then
    raise exception 'Sem permissão.' using errcode = '42501';
  end if;
  return coalesce((select jsonb_agg(jsonb_build_object(
    'id', w.id, 'name', p.full_name, 'email', p.email, 'phone', p.phone, 'status', w.status,
    'created_at', w.created_at, 'offered_at', w.offered_at, 'expires_at', w.expires_at,
    'absences', private.semester_absences(p.id)) order by w.created_at)
    from public.waitlist w join public.people p on p.id = w.person_id
    where w.event_date_id = p_event_date_id), '[]'::jsonb);
end;
$$;
revoke all on function public.waitlist_list(uuid) from public, anon;
grant execute on function public.waitlist_list(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Migração do Sympla: cria evento encerrado + participantes (histórico).
-- p_event: {title, slug, starts_at, ends_at, certificate_hours}
-- p_rows: [{full_name, cpf, email, phone, checked_in: bool}]
-- ---------------------------------------------------------------------------
create or replace function public.import_sympla(p_event jsonb, p_rows jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_event uuid;
  v_date uuid;
  v_type uuid;
  v_lot uuid;
  r jsonb;
  v_person uuid;
  v_order uuid;
  v_item uuid;
  v_ticket uuid;
  v_ok int := 0;
  v_errors jsonb := '[]'::jsonb;
  v_line int := 0;
begin
  if not private.is_staff() then
    raise exception 'Sem permissão.' using errcode = '42501';
  end if;
  insert into public.events (slug, title, kind, status, visibility, certificate_hours, summary)
  values (p_event ->> 'slug', p_event ->> 'title', 'open_free', 'closed', 'private',
          coalesce((p_event ->> 'certificate_hours')::numeric, 0), 'Evento importado do Sympla')
  returning id into v_event;
  insert into public.event_dates (event_id, starts_at, ends_at, capacity)
  values (v_event, (p_event ->> 'starts_at')::timestamptz, (p_event ->> 'ends_at')::timestamptz,
          greatest(jsonb_array_length(p_rows), 1))
  returning id into v_date;
  insert into public.ticket_types (event_id, name, visible) values (v_event, 'Importado do Sympla', false)
  returning id into v_type;
  insert into public.lots (ticket_type_id, event_date_id, name, quantity, status)
  values (v_type, v_date, 'Importado', greatest(jsonb_array_length(p_rows), 1), 'closed')
  returning id into v_lot;

  for r in select * from jsonb_array_elements(p_rows) loop
    v_line := v_line + 1;
    begin
      v_person := private.upsert_person(r, 'sympla');
      insert into public.orders (event_id, event_date_id, buyer_person_id, buyer_email, total, payment_method,
                                 status, provider, created_at, paid_at)
      values (v_event, v_date, v_person, coalesce(nullif(lower(r ->> 'email'), ''), '-'), 0, 'free', 'paid',
              'sympla', (p_event ->> 'starts_at')::timestamptz, (p_event ->> 'starts_at')::timestamptz)
      returning id into v_order;
      insert into public.order_items (order_id, ticket_type_id, lot_id, tier_applied, base_price, unit_price)
      values (v_order, v_type, v_lot, private.effective_tier(v_person), 0, 0) returning id into v_item;
      insert into public.tickets (order_item_id, order_id, event_id, event_date_id, attendee_person_id,
                                  attendee_name, status)
      values (v_item, v_order, v_event, v_date, v_person, trim(r ->> 'full_name'),
              case when coalesce((r ->> 'checked_in')::boolean, false) then 'used' else 'valid' end::public.ticket_status)
      returning id into v_ticket;
      if coalesce((r ->> 'checked_in')::boolean, false) then
        insert into public.checkins (ticket_id, kind, at, device_id)
        values (v_ticket, 'in', (p_event ->> 'starts_at')::timestamptz, 'sympla');
      end if;
      v_ok := v_ok + 1;
    exception when others then
      v_errors := v_errors || jsonb_build_object('line', v_line, 'error', sqlerrm);
    end;
  end loop;
  update public.event_dates set absences_processed_at = now(), certificates_processed_at = now() where id = v_date;
  perform private.audit('sympla.imported', 'events', v_event::text, jsonb_build_object('rows', v_ok));
  return jsonb_build_object('event_id', v_event, 'imported', v_ok, 'errors', v_errors);
end;
$$;
revoke all on function public.import_sympla(jsonb, jsonb) from public, anon;
grant execute on function public.import_sympla(jsonb, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- Storage: capas de evento, fotos de palestrantes e artes de certificado (público para leitura).
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('public-assets', 'public-assets', true, 5242880,
        array['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'])
on conflict (id) do nothing;

create policy "public-assets: equipe envia" on storage.objects for insert to authenticated
  with check (bucket_id = 'public-assets' and (select private.is_staff()));
create policy "public-assets: equipe altera" on storage.objects for update to authenticated
  using (bucket_id = 'public-assets' and (select private.is_staff()));
create policy "public-assets: equipe remove" on storage.objects for delete to authenticated
  using (bucket_id = 'public-assets' and (select private.is_staff()));

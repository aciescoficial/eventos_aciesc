-- Início do painel (protótipo "A · Início — meus eventos"): local, formato e
-- ingressos aguardando confirmação de presença.
create or replace function public.admin_events()
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', e.id, 'slug', e.slug, 'title', e.title, 'status', e.status, 'kind', e.kind, 'cover_url', e.cover_url,
    'format', e.format, 'venue_name', v.name, 'venue_city', v.city,
    'first_date', (select min(starts_at) from public.event_dates where event_id = e.id),
    'last_date', (select max(ends_at) from public.event_dates where event_id = e.id),
    'capacity', (select coalesce(sum(capacity), 0) from public.event_dates where event_id = e.id),
    'registered', (select count(*) from public.tickets t where t.event_id = e.id and t.status in ('valid', 'used')),
    'checked_in', (select count(*) from public.tickets t where t.event_id = e.id and t.status = 'used'),
    'presence_pending', (select count(*) from public.tickets t where t.event_id = e.id and t.status = 'valid'
                           and t.presence_requested_at is not null and t.presence_confirmed is null),
    'waitlist', (select count(*) from public.waitlist w join public.event_dates d on d.id = w.event_date_id
                 where d.event_id = e.id and w.status = 'waiting'),
    'revenue', (select coalesce(sum(total), 0) from public.orders o where o.event_id = e.id and o.status = 'paid'))
    order by e.created_at desc), '[]'::jsonb)
  from public.events e
  left join public.venues v on v.id = e.venue_id
  where private.can_view_event_data(e.id);
$$;
revoke all on function public.admin_events() from public, anon;
grant execute on function public.admin_events() to authenticated;

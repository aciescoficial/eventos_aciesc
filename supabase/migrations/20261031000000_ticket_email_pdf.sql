-- E-mail de ingresso no estilo "pedido confirmado" + PDF anexo.
-- Acrescenta dados do pedido ao payload das mensagens de ingresso.
create or replace function private.ticket_payload(p_ticket_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'name', t.attendee_name, 'event_title', e.title, 'event_slug', e.slug,
    'starts_at', d.starts_at, 'ends_at', d.ends_at, 'date_label', d.label,
    'venue', case when v.id is not null then jsonb_build_object('name', v.name, 'address', v.address,
                  'city', v.city, 'maps_url', v.maps_url, 'parking_info', v.parking_info) end,
    'format', e.format, 'ticket_code', t.code, 'ticket_id', t.id,
    'cover_url', e.cover_url,
    'ticket_type', tt.name,
    'unit_price', oi.unit_price,
    'order_number', upper(substr(replace(o.id::text, '-', ''), 1, 10)),
    'order_url', private.site_url() || '/pedido/?id=' || o.id,
    'buyer_email', o.buyer_email,
    'order_total', o.total,
    'payment_method', o.payment_method,
    'purchased_at', coalesce(o.paid_at, o.created_at),
    'event_url', private.site_url() || '/e/' || e.slug || '/',
    'tickets_url', private.site_url() || '/meus-ingressos/',
    'presence_url', private.site_url() || '/presenca/?t=' || t.presence_token)
  from public.tickets t
  join public.events e on e.id = t.event_id
  join public.event_dates d on d.id = t.event_date_id
  join public.orders o on o.id = t.order_id
  join public.order_items oi on oi.id = t.order_item_id
  join public.ticket_types tt on tt.id = oi.ticket_type_id
  left join public.venues v on v.id = e.venue_id
  where t.id = p_ticket_id;
$$;

-- Conteúdo assinado do QR Code, só para as Edge Functions (service_role).
-- Fica fora do payload da fila para não aparecer no log de mensagens.
create or replace function public.ticket_qr_for_service(p_ticket_id uuid)
returns text language sql stable security definer set search_path = '' as $$
  select t.code || '.' || private.ticket_sig(t.code)
  from public.tickets t
  where t.id = p_ticket_id and t.status in ('valid', 'used');
$$;

revoke all on function public.ticket_qr_for_service(uuid) from public, anon, authenticated;
grant execute on function public.ticket_qr_for_service(uuid) to service_role;

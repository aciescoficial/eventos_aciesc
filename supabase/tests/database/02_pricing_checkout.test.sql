-- Preço por perfil, lotes, reserva, checkout gratuito, capacidade, check-in e lista de espera.
begin;
create extension if not exists pgtap with schema extensions;
select plan(33);

-- Pessoas: associado ativo, associado vencido, adepto.
insert into public.people (id, cpf, full_name, email) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '52601815906', 'Ana Associada', 'ana@teste.local'),
  ('aaaaaaaa-0000-0000-0000-000000000002', '11144477735', 'Beto Vencido', 'beto@teste.local'),
  ('aaaaaaaa-0000-0000-0000-000000000003', '39053344705', 'Cris Adepta', 'cris@teste.local');
update public.memberships set tier = 'associate', status = 'active', valid_until = current_date + 30
  where person_id = 'aaaaaaaa-0000-0000-0000-000000000001';
update public.memberships set tier = 'associate', status = 'active', valid_until = current_date - 1
  where person_id = 'aaaaaaaa-0000-0000-0000-000000000002';
update public.memberships set tier = 'adept', status = 'active'
  where person_id = 'aaaaaaaa-0000-0000-0000-000000000003';

select is(private.effective_tier('aaaaaaaa-0000-0000-0000-000000000001'), 'associate', 'associado ativo');
select is(private.effective_tier('aaaaaaaa-0000-0000-0000-000000000002'), 'adept', 'associado vencido vira adepto (config)');
select is(private.effective_tier('aaaaaaaa-0000-0000-0000-000000000003'), 'adept', 'adepto');
select is((select count(*)::int from public.membership_events where person_id::text like 'aaaaaaaa-%'), 3, 'histórico do vínculo registrado');

-- Evento "Curso Lead Milionário": associado free, adepto 50%, outro full.
insert into public.events (id, slug, title, kind, status, rules) values
  ('eeeeeeee-0000-0000-0000-000000000001', 'lead-milionario', 'Curso Lead Milionário', 'paid', 'draft',
   private.default_event_rules() || '{"one_per_cpf": true}');
insert into public.event_dates (id, event_id, starts_at, ends_at, capacity) values
  ('dddddddd-0000-0000-0000-000000000001', 'eeeeeeee-0000-0000-0000-000000000001',
   now() + interval '10 days', now() + interval '10 days 4 hours', 3);
insert into public.ticket_types (id, event_id, name) values
  ('77777777-0000-0000-0000-000000000001', 'eeeeeeee-0000-0000-0000-000000000001', 'Individual');
insert into public.tier_rules (ticket_type_id, tier, mode, value) values
  ('77777777-0000-0000-0000-000000000001', 'associate', 'free', null),
  ('77777777-0000-0000-0000-000000000001', 'adept', 'percent', 50),
  ('77777777-0000-0000-0000-000000000001', 'other', 'full', null);
insert into public.lots (id, ticket_type_id, event_date_id, name, base_price, quantity, trigger, sort) values
  ('11111111-0000-0000-0000-000000000001', '77777777-0000-0000-0000-000000000001',
   'dddddddd-0000-0000-0000-000000000001', '1º lote', 199.99, 2, 'quantity', 1),
  ('11111111-0000-0000-0000-000000000002', '77777777-0000-0000-0000-000000000001',
   'dddddddd-0000-0000-0000-000000000001', '2º lote', 249.90, 10, 'quantity', 2);
insert into public.coupons (event_id, code, kind, value) values
  ('eeeeeeee-0000-0000-0000-000000000001', 'DEZ', 'percent', 10);

select is((select unit_price from public.compute_price('77777777-0000-0000-0000-000000000001',
  '11111111-0000-0000-0000-000000000001', 'associate')), 0.00, 'associado: gratuito');
select is((select unit_price from public.compute_price('77777777-0000-0000-0000-000000000001',
  '11111111-0000-0000-0000-000000000001', 'adept')), 100.00, 'adepto: 50% com arredondamento half-up');
select is((select unit_price from public.compute_price('77777777-0000-0000-0000-000000000001',
  '11111111-0000-0000-0000-000000000001', 'other')), 199.99, 'outro: valor cheio, sem taxa');
select is((select unit_price from public.compute_price('77777777-0000-0000-0000-000000000001',
  '11111111-0000-0000-0000-000000000001', 'other', 'dez')), 179.99, 'cupom aplicado ao valor do lote');
select is((select unit_price from public.compute_price('77777777-0000-0000-0000-000000000001',
  '11111111-0000-0000-0000-000000000001', 'adept', 'DEZ')), 100.00, 'cupom não acumula: vale o menor');

update public.app_settings set value = 'true' where key = 'coupon_stacks_with_tier';
select is((select unit_price from public.compute_price('77777777-0000-0000-0000-000000000001',
  '11111111-0000-0000-0000-000000000001', 'adept', 'DEZ')), 90.00, 'cupom acumula quando configurado');
update public.app_settings set value = 'false' where key = 'coupon_stacks_with_tier';

update public.tier_rules set mode = 'blocked', value = null
  where ticket_type_id = '77777777-0000-0000-0000-000000000001' and tier = 'other';
select ok((select blocked from public.compute_price('77777777-0000-0000-0000-000000000001',
  '11111111-0000-0000-0000-000000000001', 'other')), 'perfil bloqueado');
update public.tier_rules set mode = 'full'
  where ticket_type_id = '77777777-0000-0000-0000-000000000001' and tier = 'other';

select throws_ok($$select public.create_reservation('dddddddd-0000-0000-0000-000000000001',
  '[{"ticket_type_id":"77777777-0000-0000-0000-000000000001","quantity":1}]')$$,
  'P0001', null, 'rascunho não vende');

-- Publicar ativa o 1º lote.
update public.events set status = 'published' where id = 'eeeeeeee-0000-0000-0000-000000000001';
select private.sync_lots('dddddddd-0000-0000-0000-000000000001');
select is((select status::text from public.lots where id = '11111111-0000-0000-0000-000000000001'), 'active',
  '1º lote ativo');

-- Reserva 1: associado (gratuito) → checkout confirma direto.
create temp table t_res (n int, id uuid);
insert into t_res select 1, public.create_reservation('dddddddd-0000-0000-0000-000000000001',
  '[{"ticket_type_id":"77777777-0000-0000-0000-000000000001","quantity":1}]', '{"utm_source":"instagram"}');
select is((select status::text from public.reservations where id = (select id from t_res where n = 1)), 'open',
  'reserva aberta');
select ok((select expires_at between now() + interval '14 minutes' and now() + interval '16 minutes'
           from public.reservations where id = (select id from t_res where n = 1)), 'reserva expira em 15 min');

create temp table t_out (n int, r jsonb);
insert into t_out select 1, public.checkout((select id from t_res where n = 1), jsonb_build_object(
  'accept_terms', true,
  'buyer', jsonb_build_object('cpf', '526.018.159-06', 'full_name', 'Ana Associada', 'email', 'ana@teste.local'),
  'units', jsonb_build_array(jsonb_build_object('ticket_type_id', '77777777-0000-0000-0000-000000000001',
    'people', jsonb_build_array(jsonb_build_object('cpf', '52601815906', 'full_name', 'Ana Associada',
                                                   'email', 'ana@teste.local'))))));
select is((select r ->> 'status' from t_out where n = 1), 'paid', 'pedido gratuito confirmado');
select is((select count(*)::int from public.tickets where status = 'valid' and event_id = 'eeeeeeee-0000-0000-0000-000000000001'), 1,
  'ingresso emitido');
select is((select oi.tier_applied::text from public.order_items oi join public.orders o on o.id = oi.order_id
  where o.event_id = 'eeeeeeee-0000-0000-0000-000000000001' limit 1), 'associate', 'perfil aplicado');
select is((select utm_source from public.orders where event_id = 'eeeeeeee-0000-0000-0000-000000000001' limit 1), 'instagram', 'origem UTM registrada');
select is((select count(*)::int from public.messages_log where template = 'ticket' and event_id = 'eeeeeeee-0000-0000-0000-000000000001'), 1,
  'e-mail do ingresso na fila');

-- Uma inscrição por CPF.
insert into t_res select 2, public.create_reservation('dddddddd-0000-0000-0000-000000000001',
  '[{"ticket_type_id":"77777777-0000-0000-0000-000000000001","quantity":1}]');
select throws_ok(format($$select public.checkout(%L, '{"accept_terms":true,
  "buyer":{"cpf":"52601815906","full_name":"Ana Associada","email":"ana@teste.local"},
  "units":[{"ticket_type_id":"77777777-0000-0000-0000-000000000001",
            "people":[{"cpf":"52601815906","full_name":"Ana Associada"}]}]}')$$, (select id from t_res where n = 2)),
  'P0001', null, 'mesmo CPF não se inscreve duas vezes');

-- Pagamento desabilitado bloqueia pedido pago.
select throws_ok(format($$select public.checkout(%L, '{"accept_terms":true,
  "buyer":{"cpf":"39053344705","full_name":"Cris Adepta","email":"cris@teste.local"},
  "units":[{"ticket_type_id":"77777777-0000-0000-0000-000000000001",
            "people":[{"cpf":"39053344705","full_name":"Cris Adepta"}]}]}')$$, (select id from t_res where n = 2)),
  'P0001', 'O pagamento online ainda não está disponível. Fale com a ACIESC.', 'pagamento online bloqueado até configurar');

-- Lote vira por quantidade: 1º lote (2) tem 1 vendido + 1 reserva aberta.
update public.reservations set status = 'expired' where id = (select id from t_res where n = 2);
update public.app_settings set value = 'true' where key = 'payments_enabled';
insert into t_res select 3, public.create_reservation('dddddddd-0000-0000-0000-000000000001',
  '[{"ticket_type_id":"77777777-0000-0000-0000-000000000001","quantity":1}]');
insert into t_out select 3, public.checkout((select id from t_res where n = 3), jsonb_build_object(
  'accept_terms', true, 'payment_method', 'pix',
  'buyer', jsonb_build_object('cpf', '39053344705', 'full_name', 'Cris Adepta', 'email', 'cris@teste.local'),
  'units', jsonb_build_array(jsonb_build_object('ticket_type_id', '77777777-0000-0000-0000-000000000001',
    'people', jsonb_build_array(jsonb_build_object('cpf', '39053344705', 'full_name', 'Cris Adepta'))))));
select is((select (r ->> 'total')::numeric from t_out where n = 3), 100.00, 'adepto paga 50%');
select is((select r ->> 'status' from t_out where n = 3), 'pending', 'pedido pago fica pendente');
select private.sync_lots('dddddddd-0000-0000-0000-000000000001');
select is((select status::text from public.lots where id = '11111111-0000-0000-0000-000000000002'), 'active',
  '2º lote ativado ao esgotar o 1º');
select is((select count(*)::int from public.audit_log where action = 'lot.turned'
  and data->>'ticket_type_id' = '77777777-0000-0000-0000-000000000001'), 1, 'virada auditada');

-- Webhook confirma (idempotente).
select is(public.payment_confirm('test', 'evt-1', ((select r ->> 'order_id' from t_out where n = 3))::uuid,
  'ref-1', 'paid', '{}'), 'ok', 'webhook confirma');
select is(public.payment_confirm('test', 'evt-1', ((select r ->> 'order_id' from t_out where n = 3))::uuid,
  'ref-1', 'paid', '{}'), 'duplicate', 'webhook repetido é ignorado');

-- Capacidade (3): 2 ocupadas; reservar 2 falha.
select throws_ok($$select public.create_reservation('dddddddd-0000-0000-0000-000000000001',
  '[{"ticket_type_id":"77777777-0000-0000-0000-000000000001","quantity":2}]')$$,
  'P0001', 'Vagas esgotadas para esta data.', 'não vende acima da capacidade');

-- Check-in com QR assinado.
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000dd', 'porta@teste.local');
insert into public.user_roles (user_id, role, event_id)
values ('00000000-0000-0000-0000-0000000000dd', 'door', 'eeeeeeee-0000-0000-0000-000000000001');

create temp table t_qr as
  select code || '.' || private.ticket_sig(code) qr, code from public.tickets
  where attendee_person_id = 'aaaaaaaa-0000-0000-0000-000000000001';
grant select on t_qr to authenticated;

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000dd","role":"authenticated"}';
select is((public.checkin((select code from t_qr) || '.0000000000000000',
  'dddddddd-0000-0000-0000-000000000001')) ->> 'result', 'invalid', 'assinatura falsa é recusada');
select is((public.checkin((select qr from t_qr), 'dddddddd-0000-0000-0000-000000000001')) ->> 'result', 'ok',
  'check-in liberado');
select is((public.checkin((select qr from t_qr), 'dddddddd-0000-0000-0000-000000000001')) ->> 'result',
  'already_used', 'segundo check-in: já utilizado');
select throws_ok($$select public.undo_checkin((select id from public.tickets limit 1))$$, '42501', null,
  'portaria não desfaz check-in');
reset role;

select * from finish();
rollback;

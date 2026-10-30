-- Visitante anônimo: vê eventos publicados, não vê rascunhos, cupons, pessoas ou pedidos.
begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

insert into public.events (id, slug, title, status) values
  ('e1000000-0000-0000-0000-000000000001', 'publicado', 'Evento publicado', 'published'),
  ('e1000000-0000-0000-0000-000000000002', 'rascunho', 'Evento rascunho', 'draft');
insert into public.coupons (event_id, code, kind, value) values ('e1000000-0000-0000-0000-000000000001', 'SEGREDO', 'percent', 10);
insert into public.event_secrets (event_id, online_url) values ('e1000000-0000-0000-0000-000000000001', 'https://link-secreto');
insert into public.people (cpf, full_name) values ('52601815906', 'Pessoa');

set local role anon;
select is((select count(*)::int from public.events where id in ('e1000000-0000-0000-0000-000000000001', 'e1000000-0000-0000-0000-000000000002')), 1,
  'anon vê só o publicado');
select throws_ok('select * from public.coupons', '42501', null, 'anon não lista cupons');
select throws_ok('select * from public.event_secrets', '42501', null, 'anon não vê link secreto');
select throws_ok('select * from public.people', '42501', null, 'anon não lê pessoas');
select throws_ok('select * from public.orders', '42501', null, 'anon não lê pedidos');
select throws_ok('select * from public.tickets', '42501', null, 'anon não lê ingressos');
select is((public.lookup_tier('52601815906')).tier::text, 'other', 'lookup_tier retorna só o perfil');
select throws_ok($$select public.lookup_tier('12345678900')$$, '22023', null, 'CPF inválido recusado');
select throws_ok($$select public.payment_confirm('x', 'y', gen_random_uuid(), null, 'paid', '{}')$$, '42501', null,
  'anon não confirma pagamento');
reset role;

select * from finish();
rollback;

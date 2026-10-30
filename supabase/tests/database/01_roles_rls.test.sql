-- Testes de RLS da Fase 1: anônimo, usuário sem papel, door, organizer e admin.
begin;
create extension if not exists pgtap with schema extensions;
select plan(14);

-- Usuários de teste
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'admin-rls@teste.local'),
  ('00000000-0000-0000-0000-00000000000b', 'organizer-rls@teste.local'),
  ('00000000-0000-0000-0000-00000000000c', 'door-rls@teste.local'),
  ('00000000-0000-0000-0000-00000000000d', 'participante-rls@teste.local');

insert into public.user_roles (user_id, role, event_id) values
  ('00000000-0000-0000-0000-00000000000a', 'admin', null),
  ('00000000-0000-0000-0000-00000000000b', 'organizer', null),
  ('00000000-0000-0000-0000-00000000000c', 'door', '11111111-1111-1111-1111-111111111111');

select is((select count(*)::int from public.audit_log
  where action = 'role.granted' and data->>'user_id' like '00000000-0000-0000-0000-00000000000_'), 3,
  'concessão de papel é auditada');

-- Total real de papéis (inclui dados locais pré-existentes), lido como postgres.
create temp table test_all_roles as select id from public.user_roles;
grant select on test_all_roles to authenticated;

-- Anônimo ---------------------------------------------------------------------
set local role anon;
select throws_ok('select * from public.user_roles', '42501', null, 'anon não lê user_roles');
select throws_ok('select * from public.audit_log', '42501', null, 'anon não lê audit_log');
reset role;

-- Participante (sem papel) ----------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000d","role":"authenticated"}';
select is((select count(*)::int from public.user_roles), 0, 'participante não vê papéis de ninguém');
select is((select count(*)::int from public.audit_log), 0, 'participante não lê auditoria');
select throws_ok(
  $$insert into public.user_roles (user_id, role) values ('00000000-0000-0000-0000-00000000000d', 'admin')$$,
  '42501', null, 'participante não se promove a admin');
reset role;

-- Door (portaria de um evento) ------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000c","role":"authenticated"}';
select is((select count(*)::int from public.user_roles), 1, 'door vê só o próprio papel');
select ok(private.has_role('door', '11111111-1111-1111-1111-111111111111'), 'door tem papel no evento atribuído');
select ok(not private.has_role('door', '22222222-2222-2222-2222-222222222222'), 'door não tem papel em outro evento');
reset role;

-- Organizer ------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}';
select is((select count(*)::int from public.my_roles()), 1, 'my_roles retorna papéis do organizer');
select is_empty(
  $$delete from public.user_roles where user_id = '00000000-0000-0000-0000-00000000000c' returning 1$$,
  'organizer não remove papéis');
reset role;

-- Admin ----------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}';
select is((select count(*)::int from public.user_roles), (select count(*)::int from test_all_roles),
  'admin vê todos os papéis');
select lives_ok(
  $$insert into public.user_roles (user_id, role) values ('00000000-0000-0000-0000-00000000000d', 'finance')$$,
  'admin concede papel');
select throws_ok(
  $$insert into public.audit_log (action, entity) values ('x', 'y')$$,
  '42501', null, 'nem admin escreve direto na auditoria');
reset role;

select * from finish();
rollback;

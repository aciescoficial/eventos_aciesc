-- Fase 1 — Fundação: papéis do painel e trilha de auditoria.
-- Funções auxiliares ficam no schema `private`, que não é exposto pela API REST.

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

-- ---------------------------------------------------------------------------
-- Papéis
-- ---------------------------------------------------------------------------
create type public.app_role as enum ('admin', 'organizer', 'door', 'finance');

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.app_role not null,
  -- null = papel global; preenchido = papel restrito a um evento (ex.: portaria).
  -- A FK para public.events é adicionada na Fase 3, quando a tabela existir.
  event_id uuid,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  constraint user_roles_unique unique nulls not distinct (user_id, role, event_id)
);

create index user_roles_user_id_idx on public.user_roles (user_id);

comment on table public.user_roles is
  'Papéis do painel /admin. event_id nulo = papel global.';

-- Verdadeiro se o usuário logado é admin.
create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.user_roles ur
    where ur.user_id = (select auth.uid())
      and ur.role = 'admin'
      and ur.event_id is null
  );
$$;

-- Verdadeiro se o usuário logado tem o papel (global ou para o evento informado).
-- Admin global sempre passa.
create or replace function private.has_role(
  p_role public.app_role,
  p_event_id uuid default null
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_admin() or exists (
    select 1 from public.user_roles ur
    where ur.user_id = (select auth.uid())
      and ur.role = p_role
      and (ur.event_id is null or ur.event_id = p_event_id)
  );
$$;

revoke all on function private.is_admin() from public;
revoke all on function private.has_role(public.app_role, uuid) from public;
grant execute on function private.is_admin() to authenticated;
grant execute on function private.has_role(public.app_role, uuid) to authenticated;

-- Papéis do usuário logado, para o front decidir o que mostrar.
-- A autorização real continua nas políticas RLS.
create or replace function public.my_roles()
returns table (role public.app_role, event_id uuid)
language sql
stable
security invoker
set search_path = ''
as $$
  select ur.role, ur.event_id
  from public.user_roles ur
  where ur.user_id = (select auth.uid());
$$;

revoke all on function public.my_roles() from public, anon;
grant execute on function public.my_roles() to authenticated;

alter table public.user_roles enable row level security;

create policy "user_roles: ver os próprios ou admin"
  on public.user_roles for select
  to authenticated
  using (user_id = (select auth.uid()) or (select private.is_admin()));

create policy "user_roles: admin insere"
  on public.user_roles for insert
  to authenticated
  with check ((select private.is_admin()));

create policy "user_roles: admin altera"
  on public.user_roles for update
  to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

create policy "user_roles: admin remove"
  on public.user_roles for delete
  to authenticated
  using ((select private.is_admin()));

revoke all on public.user_roles from anon;

-- ---------------------------------------------------------------------------
-- Auditoria
-- ---------------------------------------------------------------------------
create table public.audit_log (
  id bigint generated always as identity primary key,
  actor_user_id uuid references auth.users (id) on delete set null,
  action text not null,
  entity text not null,
  entity_id text,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index audit_log_entity_idx on public.audit_log (entity, entity_id);
create index audit_log_created_at_idx on public.audit_log (created_at desc);

alter table public.audit_log enable row level security;

-- Só leitura para admin. Escrita apenas por private.audit() (security definer)
-- ou service_role; não há política de insert/update/delete para clientes.
create policy "audit_log: admin lê"
  on public.audit_log for select
  to authenticated
  using ((select private.is_admin()));

revoke all on public.audit_log from anon;
revoke insert, update, delete, truncate on public.audit_log from authenticated;

create or replace function private.audit(
  p_action text,
  p_entity text,
  p_entity_id text default null,
  p_data jsonb default '{}'::jsonb
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.audit_log (actor_user_id, action, entity, entity_id, data)
  values ((select auth.uid()), p_action, p_entity, p_entity_id, coalesce(p_data, '{}'::jsonb));
$$;

revoke all on function private.audit(text, text, text, jsonb) from public;

-- Toda mudança de papel fica registrada.
create or replace function private.user_roles_audit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    perform private.audit('role.revoked', 'user_roles', old.id::text, to_jsonb(old));
    return old;
  end if;
  perform private.audit(
    case when tg_op = 'INSERT' then 'role.granted' else 'role.updated' end,
    'user_roles', new.id::text, to_jsonb(new)
  );
  return new;
end;
$$;

create trigger user_roles_audit
  after insert or update or delete on public.user_roles
  for each row execute function private.user_roles_audit();

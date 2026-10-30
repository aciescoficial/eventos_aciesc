-- Fase 2 — Base ACIESC: pessoas, vínculos, configurações, limite de taxa.

create extension if not exists unaccent with schema extensions;
create extension if not exists pg_trgm with schema extensions;

-- ---------------------------------------------------------------------------
-- Configurações (decisões pendentes viram configuração)
-- ---------------------------------------------------------------------------
create table public.app_settings (
  key text primary key,
  value jsonb not null,
  description text,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);

insert into public.app_settings (key, value, description) values
  ('expired_associate_tier', '"adept"', 'Perfil aplicado a associado com anuidade vencida (decisão pendente #4): adept | other'),
  ('expired_associate_grace_days', '0', 'Dias de tolerância após o vencimento da anuidade (decisão pendente #4)'),
  ('adept_signup_applies_price', 'true', 'Quem vira adepto no checkout já paga preço de adepto (decisão pendente #5)'),
  ('coupon_stacks_with_tier', 'false', 'Cupom acumula com desconto de perfil (decisão pendente #9)'),
  ('payments_enabled', 'false', 'Pagamento online habilitado (gateway configurado — decisão pendente #1)'),
  ('max_installments', '12', 'Máximo de parcelas no cartão'),
  ('interest_free_installments', '1', 'Parcelas sem juros (decisão pendente #10)'),
  ('absence_limit_per_semester', '2', 'Faltas no semestre que levam a pessoa ao fim da fila (decisão pendente #7)'),
  ('absence_penalty_enabled', 'false', 'Aplicar penalidade de faltas na lista de espera (decisão pendente #7)'),
  ('terms_version', '"2026-10-30"', 'Versão vigente dos termos de uso e privacidade'),
  ('support_whatsapp', '""', 'WhatsApp de ajuda exibido nas páginas (apenas dígitos, com DDI)'),
  ('certificate_signer_name', '""', 'Nome de quem assina o certificado (decisão pendente #11)'),
  ('certificate_signer_role', '""', 'Cargo de quem assina o certificado (decisão pendente #11)'),
  ('certificate_signature_url', '""', 'Imagem da assinatura do certificado (decisão pendente #11)'),
  ('certificate_background_url', '""', 'Arte de fundo padrão do certificado'),
  ('site_url', '"http://localhost:3000"', 'URL pública do site (usada em links de e-mail/WhatsApp)');

alter table public.app_settings enable row level security;

-- Leitura pública só das chaves que o site precisa exibir.
create policy "app_settings: leitura pública restrita"
  on public.app_settings for select
  to anon, authenticated
  using (key in ('payments_enabled', 'max_installments', 'interest_free_installments',
                 'terms_version', 'support_whatsapp', 'site_url'));

create policy "app_settings: admin lê tudo"
  on public.app_settings for select to authenticated
  using ((select private.is_admin()));

create policy "app_settings: admin altera"
  on public.app_settings for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));

revoke insert, delete, truncate on public.app_settings from anon, authenticated;

create or replace function private.setting(p_key text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select value from public.app_settings where key = p_key;
$$;
revoke all on function private.setting(text) from public;
grant execute on function private.setting(text) to authenticated, anon;
grant usage on schema private to anon;

create or replace function private.app_settings_audit()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  new.updated_at := now();
  new.updated_by := (select auth.uid());
  perform private.audit('setting.updated', 'app_settings', new.key,
    jsonb_build_object('from', old.value, 'to', new.value));
  return new;
end;
$$;
create trigger app_settings_audit before update on public.app_settings
  for each row execute function private.app_settings_audit();

-- ---------------------------------------------------------------------------
-- Papéis: helpers adicionais
-- ---------------------------------------------------------------------------
-- Equipe interna (admin ou organizer global).
create or replace function private.is_staff()
returns boolean language sql stable security definer set search_path = '' as $$
  select private.has_role('organizer', null);
$$;

-- Pode ler dados da Base (admin, organizer, finance).
create or replace function private.can_read_base()
returns boolean language sql stable security definer set search_path = '' as $$
  select private.has_role('organizer', null) or private.has_role('finance', null);
$$;

revoke all on function private.is_staff() from public;
revoke all on function private.can_read_base() from public;
grant execute on function private.is_staff() to authenticated;
grant execute on function private.can_read_base() to authenticated;

-- ---------------------------------------------------------------------------
-- Limite de taxa (por IP + ação), para evitar enumeração de CPF/cupom.
-- ---------------------------------------------------------------------------
create table private.rate_limits (
  bucket text not null,
  window_start timestamptz not null,
  hits int not null default 0,
  primary key (bucket, window_start)
);

create or replace function private.client_ip()
returns text language sql stable set search_path = '' as $$
  select coalesce(
    split_part(nullif(current_setting('request.headers', true), '')::json ->> 'x-forwarded-for', ',', 1),
    nullif(current_setting('request.headers', true), '')::json ->> 'x-real-ip',
    'unknown'
  );
$$;

-- Lança erro se a ação passar de p_max chamadas na janela (minutos).
create or replace function private.rate_limit(p_action text, p_max int, p_window_minutes int)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_bucket text := p_action || ':' || coalesce((select auth.uid())::text, private.client_ip());
  v_window timestamptz := to_timestamp(
    floor(extract(epoch from now()) / (p_window_minutes * 60)) * (p_window_minutes * 60));
  v_hits int;
begin
  insert into private.rate_limits (bucket, window_start, hits) values (v_bucket, v_window, 1)
  on conflict (bucket, window_start) do update set hits = private.rate_limits.hits + 1
  returning hits into v_hits;
  if v_hits > p_max then
    raise exception 'Muitas tentativas. Aguarde alguns minutos e tente novamente.'
      using errcode = 'P0429';
  end if;
end;
$$;
revoke all on function private.rate_limit(text, int, int) from public;
grant execute on function private.rate_limit(text, int, int) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- CPF
-- ---------------------------------------------------------------------------
create or replace function private.is_valid_cpf(p_cpf text)
returns boolean language plpgsql immutable set search_path = '' as $$
declare
  d int[];
  s int;
  r int;
begin
  if p_cpf !~ '^\d{11}$' or p_cpf ~ '^(\d)\1{10}$' then
    return false;
  end if;
  d := array(select substr(p_cpf, g, 1)::int from generate_series(1, 11) g);
  s := 0;
  for i in 1..9 loop s := s + d[i] * (11 - i); end loop;
  r := (s * 10) % 11; if r = 10 then r := 0; end if;
  if r <> d[10] then return false; end if;
  s := 0;
  for i in 1..10 loop s := s + d[i] * (12 - i); end loop;
  r := (s * 10) % 11; if r = 10 then r := 0; end if;
  return r = d[11];
end;
$$;
grant execute on function private.is_valid_cpf(text) to anon, authenticated;

create or replace function private.normalize_cpf(p_cpf text)
returns text language sql immutable set search_path = '' as $$
  select regexp_replace(coalesce(p_cpf, ''), '\D', '', 'g');
$$;
grant execute on function private.normalize_cpf(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Pessoas e vínculos
-- ---------------------------------------------------------------------------
create type public.membership_tier as enum ('associate', 'adept', 'other');
create type public.membership_status as enum ('active', 'expired', 'none');
create type public.membership_source as enum ('higestor', 'platform', 'import');

create table public.people (
  id uuid primary key default gen_random_uuid(),
  cpf text not null unique check (private.is_valid_cpf(cpf)),
  full_name text not null check (length(trim(full_name)) between 2 and 200),
  email text check (email is null or email = lower(email)),
  phone text,
  creci text,
  company text,
  city text,
  user_id uuid unique references auth.users (id) on delete set null,
  whatsapp_opt_in boolean not null default false,
  whatsapp_opt_in_at timestamptz,
  source text not null default 'platform',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index people_email_idx on public.people (email);
create index people_name_trgm_idx on public.people using gin (full_name extensions.gin_trgm_ops);
create index people_creci_idx on public.people (creci);

create table public.memberships (
  person_id uuid primary key references public.people (id) on delete cascade,
  tier public.membership_tier not null default 'other',
  status public.membership_status not null default 'none',
  valid_until date,
  source public.membership_source not null default 'platform',
  adept_since timestamptz,
  terms_version text,
  terms_accepted_at timestamptz,
  terms_ip text,
  last_synced_at timestamptz,
  updated_at timestamptz not null default now()
);

create table public.membership_events (
  id bigint generated always as identity primary key,
  person_id uuid not null references public.people (id) on delete cascade,
  from_tier public.membership_tier,
  to_tier public.membership_tier not null,
  from_status public.membership_status,
  to_status public.membership_status not null,
  reason text not null,
  actor_user_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index membership_events_person_idx on public.membership_events (person_id, created_at desc);

create or replace function private.touch_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger people_touch before update on public.people
  for each row execute function private.touch_updated_at();

-- Toda pessoa nasce com vínculo "other".
create or replace function private.people_after_insert()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.memberships (person_id) values (new.id) on conflict do nothing;
  return new;
end;
$$;
create trigger people_after_insert after insert on public.people
  for each row execute function private.people_after_insert();

-- Histórico do vínculo + auditoria.
create or replace function private.memberships_history()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  new.updated_at := now();
  if tg_op = 'UPDATE' and (old.tier is distinct from new.tier or old.status is distinct from new.status) then
    insert into public.membership_events (person_id, from_tier, to_tier, from_status, to_status, reason, actor_user_id)
    values (new.person_id, old.tier, new.tier, old.status, new.status,
            coalesce(nullif(current_setting('app.membership_reason', true), ''), 'manual'),
            (select auth.uid()));
    perform private.audit('membership.changed', 'people', new.person_id::text,
      jsonb_build_object('from', old.tier, 'to', new.tier, 'from_status', old.status, 'to_status', new.status));
  end if;
  return new;
end;
$$;
create trigger memberships_history before update on public.memberships
  for each row execute function private.memberships_history();

-- Perfil efetivo usado em preço e acesso.
create or replace function private.effective_tier(p_person_id uuid)
returns public.membership_tier
language plpgsql stable security definer set search_path = '' as $$
declare
  m public.memberships;
  v_grace int := coalesce((private.setting('expired_associate_grace_days'))::int, 0);
  v_expired_tier public.membership_tier :=
    coalesce((private.setting('expired_associate_tier') #>> '{}')::public.membership_tier, 'adept');
begin
  select * into m from public.memberships where person_id = p_person_id;
  if not found then
    return 'other'::public.membership_tier;
  end if;
  if m.tier = 'associate' then
    if m.status = 'active' and (m.valid_until is null or m.valid_until + v_grace >= current_date) then
      return 'associate'::public.membership_tier;
    end if;
    return v_expired_tier;
  end if;
  return m.tier;
end;
$$;
revoke all on function private.effective_tier(uuid) from public;
grant execute on function private.effective_tier(uuid) to authenticated, anon;

alter table public.people enable row level security;
alter table public.memberships enable row level security;
alter table public.membership_events enable row level security;

create policy "people: equipe lê" on public.people for select to authenticated
  using ((select private.can_read_base()) or user_id = (select auth.uid()));
create policy "people: equipe insere" on public.people for insert to authenticated
  with check ((select private.is_staff()));
create policy "people: equipe altera" on public.people for update to authenticated
  using ((select private.is_staff())) with check ((select private.is_staff()));
create policy "people: admin exclui" on public.people for delete to authenticated
  using ((select private.is_admin()));

create policy "memberships: equipe ou titular lê" on public.memberships for select to authenticated
  using ((select private.can_read_base())
         or person_id in (select id from public.people where user_id = (select auth.uid())));
create policy "memberships: equipe altera" on public.memberships for update to authenticated
  using ((select private.is_staff())) with check ((select private.is_staff()));

create policy "membership_events: equipe ou titular lê" on public.membership_events for select to authenticated
  using ((select private.can_read_base())
         or person_id in (select id from public.people where user_id = (select auth.uid())));

revoke all on public.people, public.memberships, public.membership_events from anon;
revoke insert, delete on public.memberships from authenticated;
revoke insert, update, delete on public.membership_events from authenticated;

-- ---------------------------------------------------------------------------
-- RPCs
-- ---------------------------------------------------------------------------

-- Checkout: CPF → perfil. Retorna só o perfil (sem dados pessoais) e tem limite de taxa.
create or replace function public.lookup_tier(p_cpf text)
returns table (tier public.membership_tier, registered boolean)
language plpgsql security definer set search_path = '' as $$
declare
  v_cpf text := private.normalize_cpf(p_cpf);
  v_person uuid;
begin
  perform private.rate_limit('lookup_tier', 20, 10);
  if not private.is_valid_cpf(v_cpf) then
    raise exception 'CPF inválido.' using errcode = '22023';
  end if;
  select id into v_person from public.people where cpf = v_cpf;
  if v_person is null then
    return query select 'other'::public.membership_tier, false;
  else
    return query select private.effective_tier(v_person), true;
  end if;
end;
$$;
revoke all on function public.lookup_tier(text) from public;
grant execute on function public.lookup_tier(text) to anon, authenticated;

-- Liga a conta logada à pessoa de mesmo e-mail (primeiro login).
create or replace function public.claim_person()
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_email text := lower((select auth.jwt() ->> 'email'));
  v_uid uuid := (select auth.uid());
  v_id uuid;
begin
  if v_uid is null then
    return null;
  end if;
  select id into v_id from public.people where user_id = v_uid;
  if v_id is not null then
    return v_id;
  end if;
  update public.people set user_id = v_uid
  where id = (select id from public.people where email = v_email and user_id is null
              order by created_at limit 1)
  returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.claim_person() from public, anon;
grant execute on function public.claim_person() to authenticated;

-- Perfil da conta logada (para "Meus ingressos").
create or replace function public.my_profile()
returns table (person_id uuid, full_name text, email text, cpf_masked text,
               tier public.membership_tier, membership_status public.membership_status, valid_until date)
language sql stable security definer set search_path = '' as $$
  select p.id, p.full_name, p.email,
         '***.' || substr(p.cpf, 4, 3) || '.' || substr(p.cpf, 7, 3) || '-**',
         private.effective_tier(p.id), m.status, m.valid_until
  from public.people p
  left join public.memberships m on m.person_id = p.id
  where p.user_id = (select auth.uid());
$$;
revoke all on function public.my_profile() from public, anon;
grant execute on function public.my_profile() to authenticated;

-- Importação de CSV do Hi Gestor (ou planilha). Cada linha:
-- {cpf, full_name, email, phone, creci, company, city, status: active|expired, valid_until}
-- Regra: associados do Hi Gestor nunca sobrescrevem um adepto que não é associado,
-- exceto para promovê-lo a associado (situação vinda do Hi Gestor).
create or replace function public.import_members(p_rows jsonb, p_source public.membership_source default 'higestor',
                                                 p_dry_run boolean default true)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  r jsonb;
  v_line int := 0;
  v_cpf text;
  v_person uuid;
  v_status public.membership_status;
  v_valid date;
  v_created int := 0;
  v_updated int := 0;
  v_errors jsonb := '[]'::jsonb;
  v_now timestamptz := now();
begin
  if not private.is_staff() then
    raise exception 'Sem permissão.' using errcode = '42501';
  end if;
  perform set_config('app.membership_reason', 'import:' || p_source::text, true);

  for r in select * from jsonb_array_elements(p_rows) loop
    v_line := v_line + 1;
    v_cpf := private.normalize_cpf(r ->> 'cpf');
    if not private.is_valid_cpf(v_cpf) then
      v_errors := v_errors || jsonb_build_object('line', v_line, 'cpf', r ->> 'cpf', 'error', 'CPF inválido');
      continue;
    end if;
    if coalesce(trim(r ->> 'full_name'), '') = '' then
      v_errors := v_errors || jsonb_build_object('line', v_line, 'cpf', v_cpf, 'error', 'Nome vazio');
      continue;
    end if;
    begin
      v_status := coalesce(nullif(lower(r ->> 'status'), ''), 'active')::public.membership_status;
    exception when others then
      v_errors := v_errors || jsonb_build_object('line', v_line, 'cpf', v_cpf, 'error', 'Situação inválida (use active/expired)');
      continue;
    end;
    begin
      v_valid := nullif(r ->> 'valid_until', '')::date;
    exception when others then
      v_errors := v_errors || jsonb_build_object('line', v_line, 'cpf', v_cpf, 'error', 'Validade inválida (use AAAA-MM-DD)');
      continue;
    end;

    select id into v_person from public.people where cpf = v_cpf;
    if p_dry_run then
      if v_person is null then v_created := v_created + 1; else v_updated := v_updated + 1; end if;
      continue;
    end if;

    if v_person is null then
      insert into public.people (cpf, full_name, email, phone, creci, company, city, source)
      values (v_cpf, trim(r ->> 'full_name'), nullif(lower(trim(r ->> 'email')), ''),
              nullif(trim(r ->> 'phone'), ''), nullif(trim(r ->> 'creci'), ''),
              nullif(trim(r ->> 'company'), ''), nullif(trim(r ->> 'city'), ''), p_source::text)
      returning id into v_person;
      v_created := v_created + 1;
    else
      update public.people set
        email = coalesce(email, nullif(lower(trim(r ->> 'email')), '')),
        phone = coalesce(nullif(trim(r ->> 'phone'), ''), phone),
        creci = coalesce(nullif(trim(r ->> 'creci'), ''), creci),
        company = coalesce(nullif(trim(r ->> 'company'), ''), company),
        city = coalesce(nullif(trim(r ->> 'city'), ''), city)
      where id = v_person;
      v_updated := v_updated + 1;
    end if;

    update public.memberships set
      tier = 'associate', status = v_status, valid_until = v_valid,
      source = p_source, last_synced_at = v_now
    where person_id = v_person;
  end loop;

  if not p_dry_run then
    perform private.audit('base.imported', 'people', null,
      jsonb_build_object('source', p_source, 'created', v_created, 'updated', v_updated,
                         'errors', jsonb_array_length(v_errors)));
  end if;

  return jsonb_build_object('dry_run', p_dry_run, 'created', v_created, 'updated', v_updated, 'errors', v_errors);
end;
$$;
revoke all on function public.import_members(jsonb, public.membership_source, boolean) from public, anon;
grant execute on function public.import_members(jsonb, public.membership_source, boolean) to authenticated;

-- Alteração manual de vínculo pela equipe (com motivo).
create or replace function public.set_membership(p_person_id uuid, p_tier public.membership_tier,
                                                 p_status public.membership_status, p_valid_until date,
                                                 p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_staff() then
    raise exception 'Sem permissão.' using errcode = '42501';
  end if;
  perform set_config('app.membership_reason', coalesce(nullif(trim(p_reason), ''), 'manual'), true);
  update public.memberships set
    tier = p_tier, status = p_status, valid_until = p_valid_until,
    adept_since = case when p_tier = 'adept' then coalesce(adept_since, now()) else adept_since end
  where person_id = p_person_id;
end;
$$;
revoke all on function public.set_membership(uuid, public.membership_tier, public.membership_status, date, text) from public, anon;
grant execute on function public.set_membership(uuid, public.membership_tier, public.membership_status, date, text) to authenticated;

-- Concessão de papéis por e-mail (painel de configurações).
create or replace function public.grant_role_by_email(p_email text, p_role public.app_role, p_event_id uuid default null)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid;
begin
  if not private.is_admin() then
    raise exception 'Sem permissão.' using errcode = '42501';
  end if;
  select id into v_uid from auth.users where lower(email) = lower(trim(p_email));
  if v_uid is null then
    raise exception 'Nenhuma conta com esse e-mail. Peça para a pessoa entrar uma vez no site.' using errcode = 'P0002';
  end if;
  insert into public.user_roles (user_id, role, event_id, created_by)
  values (v_uid, p_role, p_event_id, (select auth.uid()))
  on conflict on constraint user_roles_unique do nothing;
end;
$$;
revoke all on function public.grant_role_by_email(text, public.app_role, uuid) from public, anon;
grant execute on function public.grant_role_by_email(text, public.app_role, uuid) to authenticated;

-- Lista de papéis com e-mail (só admin).
create or replace function public.list_roles()
returns table (id uuid, email text, role public.app_role, event_id uuid, created_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select ur.id, u.email::text, ur.role, ur.event_id, ur.created_at
  from public.user_roles ur join auth.users u on u.id = ur.user_id
  where private.is_admin()
  order by u.email, ur.role;
$$;
revoke all on function public.list_roles() from public, anon;
grant execute on function public.list_roles() to authenticated;

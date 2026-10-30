-- Dados de demonstração (somente ambiente local). Exemplos da especificação, seção 5.2.

insert into public.venues (id, name, address, city, maps_url, parking_info) values
  ('0a000000-0000-4000-8000-000000000001', 'Sede ACIESC', 'Endereço a confirmar', 'Itapema',
   'https://www.google.com/maps/search/?api=1&query=Itapema+SC', null);

insert into public.events (id, slug, title, kind, category, summary, description, format, venue_id, visibility,
                           certificate_hours, status, featured, rules) values
  ('0e000000-0000-4000-8000-000000000001', 'aniversario-aciesc-3-anos', 'Aniversário ACIESC 3 anos', 'open_free',
   'Networking', 'Celebração de 3 anos da ACIESC, aberta a todos.',
   E'Venha comemorar com a gente os 3 anos da ACIESC.\n\nTexto de demonstração.',
   'in_person', '0a000000-0000-4000-8000-000000000001', 'public', 0, 'published', true,
   private.default_event_rules()),
  ('0e000000-0000-4000-8000-000000000002', 'curso-lead-milionario', 'Curso Lead Milionário', 'free_course',
   'Cursos', 'Curso gratuito para associados; adeptos pagam 50%.',
   E'Curso de demonstração sobre geração de leads para corretores.\n\nTexto de demonstração.',
   'in_person', '0a000000-0000-4000-8000-000000000001', 'public', 4, 'published', true,
   private.default_event_rules() || '{"one_per_cpf": true, "confirm_presence_48h": true, "release_unconfirmed_24h": true, "register_absence": true}');

insert into public.event_dates (id, event_id, starts_at, ends_at, capacity) values
  ('0d000000-0000-4000-8000-000000000001', '0e000000-0000-4000-8000-000000000001',
   date_trunc('day', now()) + interval '20 days 22 hours', date_trunc('day', now()) + interval '21 days 2 hours', 200),
  ('0d000000-0000-4000-8000-000000000002', '0e000000-0000-4000-8000-000000000002',
   date_trunc('day', now()) + interval '12 days 22 hours', date_trunc('day', now()) + interval '13 days 2 hours', 40);

insert into public.ticket_types (id, event_id, name, description, sort) values
  ('07000000-0000-4000-8000-000000000001', '0e000000-0000-4000-8000-000000000001', 'Ingresso individual', null, 1),
  ('07000000-0000-4000-8000-000000000002', '0e000000-0000-4000-8000-000000000002', 'Ingresso individual', null, 1);

insert into public.tier_rules (ticket_type_id, tier, mode, value) values
  ('07000000-0000-4000-8000-000000000001', 'associate', 'free', null),
  ('07000000-0000-4000-8000-000000000001', 'adept', 'free', null),
  ('07000000-0000-4000-8000-000000000001', 'other', 'free', null),
  ('07000000-0000-4000-8000-000000000002', 'associate', 'free', null),
  ('07000000-0000-4000-8000-000000000002', 'adept', 'percent', 50),
  ('07000000-0000-4000-8000-000000000002', 'other', 'full', null);

insert into public.lots (ticket_type_id, event_date_id, name, base_price, quantity, trigger, sort, status) values
  ('07000000-0000-4000-8000-000000000001', '0d000000-0000-4000-8000-000000000001', 'Lote único', 0, 200, 'quantity', 1, 'active'),
  ('07000000-0000-4000-8000-000000000002', '0d000000-0000-4000-8000-000000000002', '1º lote', 197, 20, 'quantity', 1, 'active'),
  ('07000000-0000-4000-8000-000000000002', '0d000000-0000-4000-8000-000000000002', '2º lote', 247, 20, 'quantity', 2, 'scheduled');

insert into public.speakers (event_id, name, bio, sort) values
  ('0e000000-0000-4000-8000-000000000002', 'Palestrante de demonstração', 'Mini bio de demonstração.', 1);

-- Associado de teste (CPF válido fictício).
insert into public.people (id, cpf, full_name, email, creci, city, source) values
  ('0f000000-0000-4000-8000-000000000001', '52998224725', 'Associado Teste', 'associado@teste.local', '00000-F', 'Itapema', 'import');
update public.memberships set tier = 'associate', status = 'active', valid_until = current_date + 365, source = 'import'
  where person_id = '0f000000-0000-4000-8000-000000000001';

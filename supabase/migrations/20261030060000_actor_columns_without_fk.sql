-- Colunas de "quem fez" (auditoria) não usam FK para auth.users: um JWT ainda válido de
-- uma conta removida não pode impedir uma compra, um check-in ou o registro de auditoria.
alter table public.audit_log drop constraint if exists audit_log_actor_user_id_fkey;
alter table public.reservations drop constraint if exists reservations_user_id_fkey;
alter table public.messages_log drop constraint if exists messages_log_created_by_fkey;
alter table public.events drop constraint if exists events_created_by_fkey;
alter table public.checkins drop constraint if exists checkins_by_user_id_fkey;
alter table public.checkins drop constraint if exists checkins_undone_by_fkey;
alter table public.user_roles drop constraint if exists user_roles_created_by_fkey;
alter table public.app_settings drop constraint if exists app_settings_updated_by_fkey;
alter table public.membership_events drop constraint if exists membership_events_actor_user_id_fkey;

-- Políticas com leitura pública chamam helpers de papel também para o visitante anônimo
-- (retornam false sem login). O schema private não é exposto pela API.
grant execute on function private.is_admin() to anon;
grant execute on function private.has_role(public.app_role, uuid) to anon;
grant execute on function private.is_staff() to anon;
grant execute on function private.can_read_base() to anon;
grant execute on function private.can_manage_event(uuid) to anon;
grant execute on function private.can_view_event_data(uuid) to anon;
grant execute on function private.can_door(uuid) to anon;

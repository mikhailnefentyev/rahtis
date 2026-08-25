-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · починка проверки вызывающей роли
--
-- current_user внутри security definer возвращает владельца функции, а
-- не того, кто её позвал: под этой проверкой служебный ключ выглядел как
-- postgres и не проходил. Роль вызывающего лежит в JWT, и достаёт её
-- auth.role().
-- ═══════════════════════════════════════════════════════════════════

create or replace function public.agent_privileges()
returns table (object text, privilege text)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not ((select app.is_admin()) or (select auth.role()) = 'service_role') then
    raise exception 'Привилегии смотрит только оператор.' using errcode = '42501';
  end if;

  return query
  select (g.table_schema || '.' || g.table_name)::text, g.privilege_type::text
  from information_schema.role_table_grants g
  where g.grantee = 'agent'

  union all

  select (n.nspname || '.' || p.proname)::text, 'EXECUTE'::text
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where has_function_privilege('agent', p.oid, 'EXECUTE')
    and n.nspname in ('public', 'app')
    and p.proname like 'agent\_%'

  order by 1, 2;
end;
$$;

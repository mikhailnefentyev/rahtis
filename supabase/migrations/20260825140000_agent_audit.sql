-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · проверка привилегий агента
--
-- Гарантия «агент не умеет писать» должна проверяться, а не приниматься
-- на слово. Эта функция отвечает на вопрос одним запросом: что роль
-- agent может делать с таблицами и какие функции ей открыты.
--
-- Только оператору: список привилегий — это карта того, где искать
-- дыры, и посторонним она не нужна.
-- ═══════════════════════════════════════════════════════════════════

create or replace function public.agent_privileges()
returns table (object text, privilege text)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not (select app.is_admin()) then
    raise exception 'Привилегии смотрит только оператор.' using errcode = '42501';
  end if;

  return query
  select (table_schema || '.' || table_name)::text, privilege_type::text
  from information_schema.role_table_grants
  where grantee = 'agent'

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

revoke all on function public.agent_privileges() from public, anon;
grant execute on function public.agent_privileges() to authenticated, service_role;

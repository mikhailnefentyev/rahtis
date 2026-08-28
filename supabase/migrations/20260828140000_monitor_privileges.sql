-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · проверка прав наблюдателя
--
-- agent_privileges() отвечал за одну роль, потому что роль была одна.
-- Теперь их две: agent читает данные компании для воркфлоу n8n, monitor
-- читает журнал сбоев для внешнего наблюдателя. Проверять надо обе, и
-- одним и тем же способом — иначе вторая проверяется чтением кода, а
-- это ровно то, чего мы избегали.
--
-- Имя роли — параметр, но не любой: список закрыт. Иначе функция
-- превратилась бы в инструмент осмотра привилегий всей базы, доступный
-- служебному ключу, а это уже не проверка изоляции, а её обход.
-- ═══════════════════════════════════════════════════════════════════

create or replace function public.role_privileges(p_role text)
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

  if p_role not in ('agent', 'monitor') then
    raise exception 'Неизвестная роль: %', p_role using errcode = '22023';
  end if;

  return query
  select (g.table_schema || '.' || g.table_name)::text, g.privilege_type::text
  from information_schema.role_table_grants g
  where g.grantee = p_role

  union all

  select (n.nspname || '.' || p.proname)::text, 'EXECUTE'::text
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where has_function_privilege(p_role, p.oid, 'EXECUTE')
    and n.nspname in ('public', 'app')
    /*
     * Только наши функции. Без этого в список попадут сотни встроенных,
     * на которые EXECUTE есть у всех через PUBLIC, и настоящие две
     * потеряются среди них.
     */
    and (p.proname like 'agent\_%' or p.proname in ('platform_pulse', 'record_incident'))

  order by 1, 2;
end;
$$;

revoke all on function public.role_privileges(text) from public, anon;
grant execute on function public.role_privileges(text) to authenticated, service_role;

comment on function public.role_privileges(text) is
  'Что на самом деле разрешено роли agent или monitor. Ответ берётся из каталога, а не из кода.';

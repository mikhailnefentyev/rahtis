-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · прополка журнала сбоев
--
-- Журнал, из которого нельзя ничего убрать, растёт вечно. Свёртка по
-- отпечатку держит рост в разумных рамках — тысяча одинаковых ошибок
-- это одна строка, — но закрытые полгода назад поломки в ленте не нужны
-- никому, а наблюдателю мешают: он читает открытые, и чем короче список,
-- тем быстрее видно новое.
--
-- Удалять разрешено только служебной роли и только через функцию ниже.
-- Прямого delete нет ни у кого: строку журнала не должно быть можно
-- убрать «чтобы не мозолила», её можно только закрыть.
-- ═══════════════════════════════════════════════════════════════════

/*
 * Убирает закрытое и давно не повторявшееся.
 *
 * Два условия вместе, а не по отдельности. Закрытая вчера поломка ещё
 * нужна: если она вернётся, счётчик и первое появление расскажут, что
 * это рецидив, а не новость. Открытая не удаляется никогда, сколько бы
 * ей ни было месяцев — незакрытый сбой это незакрытый сбой.
 */
create or replace function public.prune_incidents(p_keep_days integer default 90)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_removed integer;
begin
  delete from public.incidents
  where status = 'RESOLVED'
    and last_seen < now() - make_interval(days => greatest(7, coalesce(p_keep_days, 90)));

  get diagnostics v_removed = row_count;
  return v_removed;
end;
$$;

revoke all on function public.prune_incidents(integer) from public, anon, authenticated;
grant execute on function public.prune_incidents(integer) to service_role;

comment on function public.prune_incidents(integer) is
  'Убирает закрытые и давно не повторявшиеся сбои. Открытые не трогает никогда.';

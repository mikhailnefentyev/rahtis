-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · экран объекта у водителя знает, что день уже в счёте (26.10.2026)
--
-- Прогон 26.10: после «Отправить счёт сейчас» водитель всё ещё видел
-- форму нового рейса на этот день, а база такой рейс не принимает
-- (день в счёте). Теперь в состоянии дня есть признак invoiced, и
-- приложение прячет форму. Текст функции берётся из базы и меняется
-- точечно, как в 20261013210000.
-- ═══════════════════════════════════════════════════════════════════

do $$
declare
  v_sig constant text := 'public.driver_site_state()';
  v_def text := replace(pg_get_functiondef(v_sig::regprocedure), E'\r\n', E'\n');
  v_mark constant text := $m$'trailer_id', d.trailer_id, 'approved_at', d.approved_at,$m$;
begin
  if (length(v_def) - length(replace(v_def, v_mark, ''))) / length(v_mark) <> 1 then
    raise exception 'driver_site_state: место правки не найдено или встретилось не один раз';
  end if;

  execute replace(v_def, v_mark, v_mark || $m$ 'invoiced', d.invoice_id is not null,$m$);
end;
$$;

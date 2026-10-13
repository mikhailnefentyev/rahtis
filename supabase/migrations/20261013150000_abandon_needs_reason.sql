-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · отказ перевозчика от рейса — только с причиной
--
-- abandon_order принимал пустую причину. Она уходит в журнал заказа, и
-- заказчик, у которого рейс вернулся на стол, читает именно её; отказ
-- без слов оставлял его без объяснения (прогон 13.10.2026).
--
-- Решение пользователя 13.10.2026: причина обязательна, не короче трёх
-- знаков. Свой код 55013 — кабинет отвечает на него отдельной фразой.
-- Текст функции берётся из базы и меняется точечно.
-- ═══════════════════════════════════════════════════════════════════

do $$
declare
  v_def text := replace(pg_get_functiondef('public.abandon_order(uuid, text)'::regprocedure), E'\r\n', E'\n');
  v_new text;
begin
  v_new := replace(
    v_def,
    '  select exists (',
    $r$  if length(coalesce(v_reason, '')) < 3 then
    raise exception 'Укажите причину отказа от рейса.' using errcode = '55013';
  end if;

  select exists ($r$
  );

  if (length(v_def) - length(replace(v_def, '  select exists (', ''))) / length('  select exists (') <> 1 then
    raise exception 'abandon_order: место правки не найдено или встретилось не один раз';
  end if;

  execute v_new;
end;
$$;

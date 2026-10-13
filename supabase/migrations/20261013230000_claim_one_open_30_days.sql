-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · претензии: одна открытая от стороны на рейс, срок 30 дней
--
-- file_claim принимал сколько угодно претензий по одному рейсу и в любое
-- время после его закрытия: шесть подряд на 1 000 € каждая — и шесть
-- уведомлений второй стороне (прогон 13.10.2026).
--
-- Решение пользователя 13.10.2026:
--   · у стороны по рейсу — одна открытая претензия (OPEN, IN_REVIEW);
--     новую можно подать после закрытия прежней, дополнения идут в неё
--     комментариями и вложениями (код 55016);
--   · по закрытому рейсу претензия подаётся 30 дней после закрытия
--     (код 55017). По идущему рейсу срок не действует.
-- Текст функции берётся из базы и меняется точечно.
-- ═══════════════════════════════════════════════════════════════════

do $$
declare
  v_def text := replace(pg_get_functiondef('public.file_claim(uuid, public.claim_kind, text, uuid, integer)'::regprocedure), E'\r\n', E'\n');
  v_mark constant text := '  select count(*) + 1 into v_n from public.claims where order_id = p_order_id;';
  v_new text;
begin
  if (length(v_def) - length(replace(v_def, v_mark, ''))) / length(v_mark) <> 1 then
    raise exception 'file_claim: место правки не найдено или встретилось не один раз';
  end if;

  v_new := replace(
    v_def,
    v_mark,
    $r$  if v_order.status = 'DONE' and v_order.closed_at < now() - interval '30 days' then
    raise exception 'Претензия подаётся в течение 30 дней после закрытия рейса.' using errcode = '55017';
  end if;

  if exists (
    select 1 from public.claims c
    where c.order_id = p_order_id
      and c.filed_by_company_id = (select app.current_company_id())
      and c.status in ('OPEN', 'IN_REVIEW')
  ) then
    raise exception 'По этому рейсу у вас уже есть открытая претензия — дополните её.' using errcode = '55016';
  end if;

$r$ || v_mark
  );

  execute v_new;
end;
$$;

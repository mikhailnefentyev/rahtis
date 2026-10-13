-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · заморозка снимает висящие отклики перевозчика
--
-- freeze_company отказывает, пока у компании есть незакрытые заказы, но
-- отклики на чужие заказы стола не считала: заказ ещё не её. Отклик
-- оставался у заказчика в списке, тот выбирал замороженного перевозчика,
-- а перевозчик подтверждал — и замороженная компания получала идущий
-- рейс (прогон 13.10.2026).
--
-- Теперь заморозка убирает отклики компании с заказов, где перевозчик
-- ещё не выбран. Заказ, оставшийся без единого отклика, возвращается в
-- «открыт». Новых откликов замороженная компания подать не может — это
-- закрыто раньше. Текст функции берётся из базы и меняется точечно.
-- ═══════════════════════════════════════════════════════════════════

do $$
declare
  v_def text := replace(pg_get_functiondef('public.freeze_company(uuid, text)'::regprocedure), E'\r\n', E'\n');
  v_mark text := E'  update public.companies\n  set frozen_at = now(),';
  v_new text;
begin
  if (length(v_def) - length(replace(v_def, v_mark, ''))) / length(v_mark) <> 1 then
    raise exception 'freeze_company: место правки не найдено или встретилось не один раз';
  end if;

  v_new := replace(
    v_def,
    v_mark,
    $r$  /*
   * Отклики на чужие заказы, где перевозчик ещё не выбран, — снять:
   * выбрать замороженного нельзя. Двумя шагами и в этом порядке: сначала
   * заказы, у которых других откликов нет, возвращаются в «открыт»,
   * потом удаляются сами отклики.
   */
  update public.orders o
  set status = 'OPEN',
      deadline_at = null
  where o.status = 'REQUESTED'
    and o.chosen_offer_id is null
    and exists (
      select 1 from public.order_offers f
      where f.order_id = o.id and f.carrier_company_id = p_company_id
    )
    and not exists (
      select 1 from public.order_offers f
      where f.order_id = o.id and f.carrier_company_id <> p_company_id
    );

  delete from public.order_offers f
  using public.orders o
  where o.id = f.order_id
    and f.carrier_company_id = p_company_id
    and o.status in ('OPEN', 'REQUESTED')
    and o.chosen_offer_id is distinct from f.id;

$r$ || v_mark
  );

  execute v_new;
end;
$$;

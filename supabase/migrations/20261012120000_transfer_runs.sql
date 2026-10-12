-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · перегон: забрать единицу и оставить её в другом месте
--
-- 12.10.2026 решение пользователя: бывает, что прицеп нужно просто
-- перегнать — забрать в одном месте и оставить в другом, без погрузки и
-- выгрузки (как rantaveto в порту). Отдельного формата не заводим: это
-- тот же рейс с маршрутом из двух точек, «забор» → «возврат».
--
-- Мешало одно правило публикации: «добавьте хотя бы одно действие —
-- выгрузку или загрузку». Теперь у единицы (прицеп, контейнер) хватает
-- либо действия, либо точки, где её оставить.
--
-- Закрытие. Рейс закрывается накладной, а у перегона пустого прицепа
-- накладной обычно нет. Решение пользователя: перегон закрывается фото
-- при сдаче — снимком, привязанным к точке возврата или сделанным после
-- прибытия на неё. Накладная, если она есть, по-прежнему годится.
-- ═══════════════════════════════════════════════════════════════════

-- ── Что такое перегон ──────────────────────────────────────────────

/* Единицу забирают и оставляют; между этим — ни одного действия. */
create or replace function app.order_is_transfer(p_order_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
           select 1 from public.order_stops s
           where s.order_id = p_order_id and s.role = 'TRAILER_RETURN'
         )
     and not exists (
           select 1 from public.order_stops s
           where s.order_id = p_order_id and s.role not in ('PICKUP', 'TRAILER_RETURN')
         );
$$;

/*
 * Чем подтверждён рейс для закрытия: накладной — или, у перегона, фото
 * при сдаче. Снимок из приложения водителя привязан к точке (stop_id);
 * загруженный из кабинета — нет, поэтому годится и снимок, сделанный
 * после прибытия на точку возврата.
 */
create or replace function app.order_closing_evidence_ok(p_order_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
           select 1 from public.order_documents d
           where d.order_id = p_order_id and d.kind = 'CMR'
         )
      or (
           app.order_is_transfer(p_order_id)
           and exists (
             select 1
             from public.order_documents d
             join public.order_stops r on r.order_id = d.order_id and r.role = 'TRAILER_RETURN'
             where d.order_id = p_order_id
               and d.kind <> 'CMR'
               and (d.stop_id = r.id
                    or (d.stop_id is null and d.created_at >= coalesce(r.arrived_at, r.completed_at)))
           )
         );
$$;

revoke all on function app.order_is_transfer(uuid), app.order_closing_evidence_ok(uuid) from public, anon;
grant execute on function app.order_is_transfer(uuid), app.order_closing_evidence_ok(uuid) to authenticated;


-- ── Публикация: действие или точка возврата ────────────────────────

/*
 * Условие дополняется на месте: тело app.create_order_for общее для
 * заказчика, API и своего рейса и менялось не раз. Место правки не
 * найдено — миграция падает, а не проходит молча.
 */
do $$
declare
  v_proc regprocedure := 'app.create_order_for(uuid, jsonb, jsonb, boolean, uuid)'::regprocedure;
  v_def text := replace(pg_get_functiondef(v_proc), E'\r\n', E'\n');
  v_new text;
begin
  if position('not v_has_work and not v_has_return' in v_def) > 0 then
    return;
  end if;

  v_new := replace(v_def, 'if not v_has_work then', 'if not v_has_work and not v_has_return then');

  if v_new = v_def then
    raise exception 'create_order_for: место правки не найдено';
  end if;

  execute v_new;
end;
$$;


-- ── Закрытие: накладная или фото при сдаче ─────────────────────────

/* Тело из 20260925130000 с одной правкой: проверка подтверждения. */
create or replace function public.close_order(p_order_id uuid)
returns public.orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
  v_pending integer;
begin
  select * into v_order from public.orders where id = p_order_id;
  if v_order.id is null then
    raise exception 'Заказ не найден.' using errcode = 'P0002';
  end if;

  if not coalesce(
    v_order.assigned_company_id = (select app.current_company_id())
    or (select app.is_admin()),
    false
  ) then
    raise exception 'Закрыть рейс может только назначенный перевозчик.'
      using errcode = '42501';
  end if;

  if v_order.status <> 'IN_PROGRESS' then
    raise exception 'Закрывать можно только идущий рейс, текущий статус: %.', v_order.status
      using errcode = '55000';
  end if;

  select count(*) into v_pending
  from public.order_stops s
  where s.order_id = p_order_id and s.completed_at is null;

  if v_pending > 0 then
    raise exception 'Сначала отметьте все точки маршрута: осталось %.', v_pending
      using errcode = '55000';
  end if;

  if not app.order_closing_evidence_ok(p_order_id) then
    if app.order_is_transfer(p_order_id) then
      raise exception 'Приложите фото при сдаче — без него перегон не закрывается.'
        using errcode = '55000';
    end if;

    raise exception 'Приложите CMR — без накладной рейс не закрывается.'
      using errcode = '55000';
  end if;

  /*
   * Ставка комиссии записывается в сам рейс. С этого момента он
   * рассчитывается по ней навсегда, что бы ни случилось с текущей
   * ставкой платформы.
   */
  update public.orders
  set status = 'DONE',
      closed_at = now(),
      commission_bps = app.current_commission_bps()
  where id = p_order_id
  returning * into v_order;

  return v_order;
end;
$$;


-- ── Напоминание о накладной перегона не касается ───────────────────

/* Тело из 20261007140000; у перегона накладной не ждут. */
create or replace function app.on_last_stop_without_cmr()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
begin
  if new.completed_at is null or old.completed_at is not null then
    return new;
  end if;

  if exists (
    select 1 from public.order_stops s
    where s.order_id = new.order_id and s.id <> new.id and s.completed_at is null
  ) then
    return new;
  end if;

  if exists (select 1 from public.order_documents d where d.order_id = new.order_id and d.kind = 'CMR') then
    return new;
  end if;

  if app.order_is_transfer(new.order_id) then
    return new;
  end if;

  select * into v_order from public.orders where id = new.order_id;
  if v_order.status <> 'IN_PROGRESS' then
    return new;
  end if;

  perform app.notify_driver(
    v_order.assigned_driver_id, 'cmr.missing', jsonb_build_object('ref', v_order.ref), v_order.id);

  if v_order.assigned_company_id is not null then
    perform app.notify_event(
      v_order.assigned_company_id, 'ORDER', 'cmr.missing', jsonb_build_object('ref', v_order.ref), '/carrier/desk');
  end if;

  return new;
end;
$$;


-- ── Показатель «документы» в оценке перевозчика ────────────────────

/*
 * Доля рейсов с накладной считала бы перегон без накладной провалом.
 * Перегон с фото при сдаче — оформленный рейс. Расчёт лежит во внутренней
 * функции app.carrier_scorecard; публичная — обёртка с проверкой прав.
 */
do $$
declare
  v_proc regprocedure := 'app.carrier_scorecard(uuid)'::regprocedure;
  v_def text := replace(pg_get_functiondef(v_proc), E'\r\n', E'\n');
  v_new text;
begin
  if position('order_closing_evidence_ok' in v_def) > 0 then
    return;
  end if;

  v_new := regexp_replace(
    v_def,
    $p$select 1 from public\.order_documents d where d\.order_id = done\.id and d\.kind = 'CMR'$p$,
    'select 1 where app.order_closing_evidence_ok(done.id)'
  );

  if v_new = v_def then
    raise exception 'carrier_scorecard: место правки не найдено';
  end if;

  execute v_new;
end;
$$;

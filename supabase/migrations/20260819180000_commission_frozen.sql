-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · комиссия фиксируется при закрытии рейса
--
-- README обещал это с самого начала — «действующая ставка комиссии
-- фиксируется в записи рейса при закрытии, иначе изменение комиссии
-- перепишет задним числом уже выставленные счета», — но колонки не было,
-- и обещание держалось на том, что комиссию пока никто не менял.
--
-- Без неё любой отчёт о выплатах считался бы по текущей константе. Стоит
-- поднять комиссию с 3 % до 4 %, и все прошлые рейсы задним числом
-- станут стоить перевозчику дороже — включая те, за которые уже
-- заплачено. Это не ошибка округления, это переписанная история расчётов.
--
-- Заодно появляется closed_at: без момента закрытия рейс нельзя отнести
-- к неделе, а значит нельзя и включить в недельный отчёт. Статус DONE
-- сам по себе не говорит, когда он наступил.
-- ═══════════════════════════════════════════════════════════════════

alter table public.orders
  /*
   * Ставка комиссии в базисных пунктах на момент закрытия рейса.
   * 300 bps = 3 %. NULL у незакрытых: у них комиссии ещё нет, и
   * подставлять текущую значило бы делать вид, что она уже решена.
   */
  add column commission_bps integer,

  add column closed_at timestamptz,

  add constraint orders_commission_range
    check (commission_bps is null or commission_bps between 0 and 10000),

  /* Комиссия и момент закрытия появляются вместе и только у DONE. */
  add constraint orders_commission_with_closing
    check ((commission_bps is null) = (closed_at is null)),

  add constraint orders_closed_only_when_done
    check (closed_at is null or status = 'DONE');

comment on column public.orders.commission_bps is
  'Ставка комиссии на момент закрытия, в базисных пунктах. Отчёты считают по ней, а не по текущей.';
comment on column public.orders.closed_at is
  'Момент закрытия рейса. По нему рейс относится к отчётной неделе.';

create index orders_closed_idx on public.orders (closed_at)
  where closed_at is not null;


-- ── Действующая ставка ─────────────────────────────────────────────

/*
 * Комиссия оператора одним местом.
 *
 * Пока значение одно на всю платформу — то же, что в lib/config.ts. ТЗ §1
 * обещает гибкость по клиентам и типам заказов; когда она появится,
 * меняется тело этой функции, а не два десятка мест, где считаются
 * деньги.
 */
create or replace function app.current_commission_bps()
returns integer
language sql
stable
as $$
  select 300;
$$;

comment on function app.current_commission_bps() is
  'Действующая ставка комиссии в базисных пунктах. Позже станет зависеть от клиента (ТЗ §1).';


-- ── Закрытие фиксирует ставку ──────────────────────────────────────

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

  if not (
    v_order.assigned_company_id = (select app.current_company_id())
    or (select app.is_admin())
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

  if not exists (
    select 1 from public.order_documents d
    where d.order_id = p_order_id and d.kind = 'CMR'
  ) then
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

comment on function public.close_order(uuid) is
  'Закрывает рейс: все точки пройдены, приложен CMR, ставка комиссии зафиксирована (ТЗ §9).';


-- ── Деньги рейса ───────────────────────────────────────────────────

/*
 * Комиссия и выплата из ставки заказчика.
 *
 * Одно определение на всю платформу: отчёт перевозчика, счёт заказчику и
 * сводка оператора обязаны сходиться до цента. Три похожие формулы в трёх
 * запросах рано или поздно разойдутся на округлении.
 *
 * Округление — до цента, в пользу арифметики, а не одной из сторон:
 * комиссия округляется, выплата берётся вычитанием, поэтому ставка всегда
 * равна сумме частей ровно.
 */
create or replace function app.commission_cents(p_rate_cents integer, p_bps integer)
returns integer
language sql
immutable
as $$
  select round((p_rate_cents::numeric * p_bps) / 10000)::integer;
$$;

create or replace function app.payout_cents(p_rate_cents integer, p_bps integer)
returns integer
language sql
immutable
as $$
  select p_rate_cents - app.commission_cents(p_rate_cents, p_bps);
$$;

comment on function app.commission_cents(integer, integer) is
  'Комиссия оператора в центах. Одно определение на отчёты, счета и выплаты.';
comment on function app.payout_cents(integer, integer) is
  'Выплата перевозчику: ставка за вычетом комиссии. Сумма частей равна ставке ровно.';


/*
 * Считать деньги вправе только код, который делает это от имени владельца:
 * отчёты и счета Этапа 7 — функции security definer. Прямой вызов из
 * клиента ничего не открывает, но и не нужен, а действующая ставка — не то
 * число, которое стоит отдавать наружу отдельным запросом.
 */
revoke all on function app.current_commission_bps() from public, anon, authenticated;
revoke all on function app.commission_cents(integer, integer) from public, anon, authenticated;
revoke all on function app.payout_cents(integer, integer) from public, anon, authenticated;
grant execute on function app.current_commission_bps() to service_role;
grant execute on function app.commission_cents(integer, integer) to service_role;
grant execute on function app.payout_cents(integer, integer) to service_role;

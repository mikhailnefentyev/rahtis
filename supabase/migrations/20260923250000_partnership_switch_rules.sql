-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · когда смена формата вступает в силу
--
-- 23.09.2026 решение пользователя:
--   · из подписки в подряд — сразу;
--   · из подряда в подписку — только с нового месяца.
--
-- Правило несимметрично не по прихоти. Подряд — это обещание возить
-- нашу работу за 3 %; уйти из него в середине месяца значит забрать
-- работу, взятую на этих условиях. Подписка ничего нам не обещает, из
-- неё выходить можно когда угодно.
--
-- Отложенная смена хранится у компании: что включить и с какого дня.
-- Применяет её ночное задание — то же, что чистит счётчики попыток.
-- Отменить заявку можно до первого числа, нажав «оставить как есть».
--
-- ── Заодно убран пересчёт стороны договора при закрытии рейса ──
--
-- Сторона выводилась из ветки дважды: при назначении и ещё раз при
-- закрытии. Второй раз был лишним и вредным: рейс, взятый подрядчиком,
-- менял сторону, если ветку переключили, пока он ехал. Теперь сторона
-- решается там, где перевозчик берёт рейс, и позже не меняется — это и
-- есть «смена касается новых рейсов», обещанная в условиях.
--
-- Переназначение рейса другому перевозчику по-прежнему пересчитывает
-- сторону: это делает триггер на назначении, а не закрытие.
-- ═══════════════════════════════════════════════════════════════════

alter table public.companies
  add column pending_partnership public.partnership_mode,
  add column pending_partnership_from date,
  add constraint companies_pending_partnership_pair
    check ((pending_partnership is null) = (pending_partnership_from is null));

comment on column public.companies.pending_partnership is
  'Заявленная ветка, которая включится позже. NULL — заявки нет.';
comment on column public.companies.pending_partnership_from is
  'С какого дня включится заявленная ветка. Первое число следующего месяца.';

grant select (pending_partnership, pending_partnership_from) on public.companies to authenticated;


-- ── Сторона договора решается при назначении, не при закрытии ──────

create or replace function app.freeze_order_fees()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_origin public.offer_origin;
  v_closed date;
  v_free date;
begin
  if new.status = 'DONE' and old.status is distinct from 'DONE' then
    /* Нет отклика — значит рейс не со стола: то же правило, что в contract_party_of. */
    select coalesce(f.origin, 'DIRECT') into v_origin
    from (select 1) z
    left join public.order_offers f on f.id = new.chosen_offer_id;

    v_closed := (coalesce(new.closed_at, now()) at time zone 'Europe/Helsinki')::date;

    v_free := app.free_until(new.shipper_company_id);
    new.shipper_fee_bps := case
      when v_origin = 'DIRECT' then 0
      when v_free is not null and v_closed <= v_free then 0
      else app.current_shipper_fee_bps()
    end;

    v_free := app.free_until(new.assigned_company_id);
    new.commission_bps := case
      when new.contract_party = 'CARRIER' then 0
      when v_free is not null and v_closed <= v_free then 0
      else app.current_commission_bps()
    end;
  end if;
  return new;
end;
$$;


-- ── Смена ветки самим перевозчиком ─────────────────────────────────

/* Возвращает дату включения, поэтому тип меняется — старую снимаем. */
drop function if exists public.set_own_partnership(public.partnership_mode);

create or replace function public.set_own_partnership(p_mode public.partnership_mode)
returns date
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_company uuid := (select app.current_company_id());
  v_kind public.party_role;
  v_frozen timestamptz;
  v_now public.partnership_mode;
  v_from date;
begin
  if (select app.current_party_role()) is distinct from 'CARRIER' or v_company is null then
    raise exception 'Формат сотрудничества меняет перевозчик у своей компании.' using errcode = '42501';
  end if;

  select kind, frozen_at, partnership into v_kind, v_frozen, v_now
  from public.companies where id = v_company;

  if v_kind is distinct from 'CARRIER' then
    raise exception 'Формат есть только у перевозчика.' using errcode = '22023';
  end if;

  if v_frozen is not null then
    raise exception 'Компания заморожена: формат меняет оператор.' using errcode = '42501';
  end if;

  /* Нажали то, что уже включено: значит, отменяют заявку на смену. */
  if p_mode = v_now then
    update public.companies
    set pending_partnership = null, pending_partnership_from = null
    where id = v_company;

    perform app.audit('company.partnership_cancel', v_company::text,
      jsonb_build_object('mode', p_mode));
    return null;
  end if;

  if p_mode = 'SUBCONTRACTOR' then
    /* В подряд — сразу: перевозчик берётся возить нашу работу. */
    update public.companies
    set partnership = 'SUBCONTRACTOR',
        pending_partnership = null,
        pending_partnership_from = null
    where id = v_company;

    perform app.audit('company.partnership', v_company::text,
      jsonb_build_object('mode', p_mode, 'by', 'CARRIER', 'from', 'now'));
    return null;
  end if;

  /*
   * Из подряда в подписку — с первого числа следующего месяца: работа,
   * взятая на условиях подряда, доезжает на них же.
   */
  v_from := (date_trunc('month', (now() at time zone 'Europe/Helsinki'))
             + interval '1 month')::date;

  update public.companies
  set pending_partnership = 'SUBSCRIBER',
      pending_partnership_from = v_from
  where id = v_company;

  perform app.audit('company.partnership_planned', v_company::text,
    jsonb_build_object('mode', p_mode, 'by', 'CARRIER', 'from', v_from));

  return v_from;
end;
$$;

comment on function public.set_own_partnership(public.partnership_mode) is
  'Смена ветки перевозчиком. В подряд — сразу, в подписку — с первого числа следующего месяца. Возвращает дату включения или NULL, если включено сразу.';

revoke all on function public.set_own_partnership(public.partnership_mode) from public, anon;
grant execute on function public.set_own_partnership(public.partnership_mode) to authenticated;


-- ── Заявленная смена включается сама ───────────────────────────────

create or replace function public.apply_pending_partnerships()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_today date := (now() at time zone 'Europe/Helsinki')::date;
  v_count integer;
begin
  update public.companies
  set partnership = pending_partnership,
      pending_partnership = null,
      pending_partnership_from = null
  where pending_partnership is not null
    and pending_partnership_from <= v_today;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.apply_pending_partnerships() from public, anon, authenticated;
grant execute on function public.apply_pending_partnerships() to service_role;

/*
 * Ночью, а не первого числа в полночь: задание, привязанное к одному
 * дню месяца, пропускает месяц целиком, если в ту ночь оно не
 * выполнилось. Проверка «дата настала» каждый день догоняет сама.
 */
select cron.schedule(
  'rahtis-apply-partnership',
  '25 2 * * *',
  $$ select public.apply_pending_partnerships(); $$
);


-- ── Оператор переключает без ограничений и снимает заявку ──────────

create or replace function public.set_company_partnership(
  p_company_id uuid,
  p_mode public.partnership_mode
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_kind public.party_role;
begin
  if not (select app.is_admin()) then
    raise exception 'Ветку перевозчика меняет только оператор.' using errcode = '42501';
  end if;

  select kind into v_kind from public.companies where id = p_company_id;

  if v_kind is distinct from 'CARRIER' then
    raise exception 'Ветка есть только у перевозчика.' using errcode = '22023';
  end if;

  update public.companies
  set partnership = p_mode,
      pending_partnership = null,
      pending_partnership_from = null
  where id = p_company_id;

  perform app.audit('company.partnership', p_company_id::text,
    jsonb_build_object('mode', p_mode, 'by', 'ADMIN'));
end;
$$;

revoke all on function public.set_company_partnership(uuid, public.partnership_mode) from public, anon;
grant execute on function public.set_company_partnership(uuid, public.partnership_mode)
  to authenticated, service_role;

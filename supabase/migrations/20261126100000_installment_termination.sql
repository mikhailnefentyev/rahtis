-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · рассрочка техники: прекращение сделки и НДС (22.11.2026)
--
-- Решения владельца 22.11.2026:
--
--   1. Выход из сделки в рассрочке. Раньше из ACTIVE был один выход —
--      отметить оплаченными все взносы. Покупатель перестал платить,
--      продавец забрал машину — а задание продолжало выставлять счета и
--      слать напоминания. Теперь продавец записывает прекращение
--      (terminate_installment_deal): статус TERMINATED, причина —
--      REPOSSESSED (продавец забрал машину по закону 91/1966) или
--      AGREEMENT (стороны договорились расторгнуть продажу).
--      Счета взносов, напоминания и сигналы о пороге прекращаются:
--      задание берёт только ACTIVE. Неоплаченные и ещё не выставленные
--      взносы остаются как есть. Взаиморасчёт (tilitys, 3–4 § закона)
--      RAHTIS не считает и не проводит — это дело сторон и, если машину
--      забирают без согласия покупателя, судебного исполнителя.
--      Кредит-нот и движения денег нет.
--
--      Машина: копия у покупателя снимается с работы тем же состоянием,
--      что запись продавца при передаче (черновик, installment_role =
--      'SOLD': не одобрить заново, не привязать GPS, не удалить —
--      остаётся история рейсов), водитель, GPS и объявления свободного
--      места отвязаны. Запись продавца возвращается ему: отметка «продана
--      в рассрочку» снята, план обслуживания вернулся с машиной. Допуск
--      остаётся черновиком — продавец отправляет машину на одобрение как
--      обычно (за время рассрочки машина и документы могли измениться).
--      Объявление — «снято с продажи»: чтобы продать снова, продавец
--      создаёт новое после одобрения машины.
--
--   2. НДС в сделке всегда обычный: продавцы — перевозчики-плательщики
--      НДС, продают машину из бизнеса. Новое объявление и новое
--      предложение — только STANDARD. Уже существующие объявления и
--      сделки с другим режимом читаются и доживают как есть: данные не
--      переносятся, ограничения таблиц не ужесточаются.
-- ═══════════════════════════════════════════════════════════════════

alter table public.installment_deals drop constraint installment_deals_status;
alter table public.installment_deals
  add constraint installment_deals_status
    check (status in ('NEGOTIATING', 'AGREED', 'ACTIVE', 'PAID_OFF', 'CANCELLED', 'TERMINATED')),
  add column terminated_at timestamptz,
  add column terminated_reason text
    constraint installment_deals_terminated_reason check (terminated_reason in ('REPOSSESSED', 'AGREEMENT')),
  add column terminated_note text
    constraint installment_deals_terminated_note check (char_length(terminated_note) <= 2000),
  /* Прекращённая сделка всегда с датой и причиной. */
  add constraint installment_deals_terminated
    check (status <> 'TERMINATED' or (terminated_at is not null and terminated_reason is not null));

comment on column public.installment_deals.terminated_reason is
  'Почему сделка в рассрочке прекращена: REPOSSESSED — продавец забрал машину по закону 91/1966, AGREEMENT — стороны договорились (22.11.2026).';

/* Права на чтение — на всю таблицу (grant select … to authenticated в 20261122100000): новые столбцы видны сторонам. */

-- ── Прекращение сделки в рассрочке ──────────────────────────────────

/*
 * Продавец записывает, что продажа в рассрочку прекращена. Только главный
 * в компании-продавце и только сделку в рассрочке (ACTIVE). Возвращает
 * статус сделки. Взаиморасчёт сторон здесь не считается (см. шапку).
 */
create or replace function public.terminate_installment_deal(p_deal_id uuid, p_reason text, p_note text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := app.installment_owner();
  v_deal public.installment_deals;
  v_listing public.equipment_listings;
  v_listing_id uuid;
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
begin
  /* Порядок блокировок как у согласия, передачи и отмены: объявление, потом сделка. */
  select listing_id into v_listing_id from public.installment_deals where id = p_deal_id;
  perform 1 from public.equipment_listings where id = v_listing_id for update;
  select * into v_deal from public.installment_deals where id = p_deal_id for update;
  if v_deal.id is null or v_deal.seller_company_id <> v_me then
    raise exception 'Прекращение сделки записывает продавец.' using errcode = '42501';
  end if;
  if v_deal.status <> 'ACTIVE' then
    raise exception 'Прекратить можно только сделку в рассрочке.' using errcode = '55000';
  end if;
  if p_reason is null or p_reason not in ('REPOSSESSED', 'AGREEMENT') then
    raise exception 'Причина прекращения.' using errcode = '22023';
  end if;
  if char_length(coalesce(v_note, '')) > 2000 then
    raise exception 'Пояснение.' using errcode = '22023';
  end if;

  /*
   * Машина не должна быть в работе у покупателя: открытые рейсы сначала
   * закрыть или переназначить — как у продавца при передаче. Свой код
   * ошибки: страница объясняет продавцу, чего ждать от покупателя.
   */
  if v_deal.buyer_vehicle_id is not null and exists (
    select 1 from public.orders o
    where o.assigned_vehicle_id = v_deal.buyer_vehicle_id
      and o.status in ('REQUESTED', 'AWAIT_DRIVER', 'IN_PROGRESS')
  ) then
    raise exception 'У машины есть открытые рейсы покупателя — их нужно закрыть или переназначить.' using errcode = '55006';
  end if;

  select * into v_listing from public.equipment_listings where id = v_deal.listing_id;

  if v_deal.buyer_vehicle_id is not null then
    /*
     * Копия у покупателя: снята с работы и больше не «куплена в рассрочку».
     * Состояние — то же, что у записи продавца после передачи: черновик с
     * отметкой SOLD (заново не одобрить, GPS не привязать, не удалить).
     * Строка остаётся: на неё ссылаются рейсы и история покупателя.
     */
    update public.vehicles
    set access = 'DRAFT', installment_role = 'SOLD', driver_name = null, whatsapp = null, updated_at = now()
    where id = v_deal.buyer_vehicle_id;
    update public.vehicle_drivers set during = tstzrange(lower(during), now())
    where vehicle_id = v_deal.buyer_vehicle_id and upper_inf(during);
    update public.gps_units set vehicle_id = null where vehicle_id = v_deal.buyer_vehicle_id;
    update public.capacity_offers set status = 'WITHDRAWN', updated_at = now()
    where vehicle_id = v_deal.buyer_vehicle_id and status in ('DRAFT', 'PUBLISHED');
    /* План обслуживания возвращается с машиной: напоминания — снова продавцу. Сервисную книжку каждая сторона хранит у себя. */
    update public.maintenance_items set vehicle_id = v_listing.vehicle_id, company_id = v_deal.seller_company_id
    where vehicle_id = v_deal.buyer_vehicle_id;
  end if;

  /*
   * Запись продавца: ровно обратное передаче — отметка «продана в
   * рассрочку» и привязка к сделке сняты. Допуск остаётся черновиком:
   * продавец отправляет машину на одобрение как любую другую.
   */
  update public.vehicles
  set installment_role = null, installment_deal_id = null, updated_at = now()
  where id = v_listing.vehicle_id and installment_deal_id = v_deal.id and installment_role = 'SOLD';

  /* Объявление освобождает машину: новое продавец создаст после одобрения (одна живая продажа на машину). */
  update public.equipment_listings set status = 'WITHDRAWN', updated_at = now()
  where id = v_deal.listing_id and status = 'RESERVED';

  update public.installment_deals
  set status = 'TERMINATED', terminated_at = now(), terminated_reason = p_reason, terminated_note = v_note
  where id = p_deal_id;

  return 'TERMINATED';
end;
$$;

revoke all on function public.terminate_installment_deal(uuid, text, text) from public, anon;
grant execute on function public.terminate_installment_deal(uuid, text, text) to authenticated;

-- ── НДС: новое объявление и новое предложение — только обычный ──────

/*
 * Объявление продавца. Режим НДС — только STANDARD (решение 22.11.2026):
 * и новое объявление, и правка старого сохраняются с обычным НДС. Старое
 * объявление с другим режимом остаётся читаемым, пока его не правят.
 * Остальное — как в 20261122100000.
 */
create or replace function public.save_equipment_listing(
  p_id uuid,
  p_vehicle_id uuid,
  p_price_cents bigint,
  p_vat_mode text,
  p_down_payment_cents bigint,
  p_months integer,
  p_final_cents bigint,
  p_annual_rate_bps integer,
  p_odometer_km integer,
  p_description text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := app.installment_party();
  v_vat_bps integer;
  v_id uuid;
begin
  if p_vat_mode is distinct from 'STANDARD' then
    raise exception 'Продажа в рассрочку — только с обычным НДС.' using errcode = '22023';
  end if;
  if not exists (select 1 from public.vehicles v where v.id = p_vehicle_id and v.company_id = v_me and v.access = 'APPROVED') then
    raise exception 'Машина не из вашего парка или не одобрена.' using errcode = '42501';
  end if;
  /* Машину и пробег нельзя менять, пока идут переговоры: покупатель видел другое. */
  if p_id is not null and exists (
    select 1 from public.equipment_listings l
    where l.id = p_id and (l.vehicle_id <> p_vehicle_id or l.odometer_km is distinct from p_odometer_km)
      and exists (select 1 from public.installment_deals d where d.listing_id = l.id and d.status = 'NEGOTIATING')
  ) then
    raise exception 'По объявлению идут переговоры — машину и пробег не изменить.' using errcode = '55000';
  end if;
  /* НДС — по стране регистрации продавца (как у счетов за фрахт). */
  select case c.country::text
    when 'FI' then 2550 when 'SE' then 2500 when 'NO' then 2500 when 'DK' then 2500 when 'EE' then 2400
    when 'LV' then 2100 when 'LT' then 2100 when 'PL' then 2300 when 'DE' then 1900 when 'RO' then 2100
  end into v_vat_bps from public.companies c where c.id = v_me;
  if v_vat_bps is null then
    raise exception 'Страна продавца не поддерживается.' using errcode = '22023';
  end if;
  perform app.installment_terms_ok(p_price_cents, p_vat_mode, v_vat_bps, p_down_payment_cents, p_months, p_final_cents, p_annual_rate_bps);

  if p_id is null then
    insert into public.equipment_listings (
      seller_company_id, vehicle_id, price_cents, vat_mode, vat_bps, down_payment_cents, months,
      final_cents, annual_rate_bps, odometer_km, description
    )
    values (
      v_me, p_vehicle_id, p_price_cents, p_vat_mode, v_vat_bps, p_down_payment_cents, p_months,
      p_final_cents, p_annual_rate_bps, p_odometer_km, coalesce(p_description, '')
    )
    returning id into v_id;
  else
    update public.equipment_listings
    set vehicle_id = p_vehicle_id, price_cents = p_price_cents, vat_mode = p_vat_mode, vat_bps = v_vat_bps,
        down_payment_cents = p_down_payment_cents, months = p_months, final_cents = p_final_cents,
        annual_rate_bps = p_annual_rate_bps, odometer_km = p_odometer_km,
        description = coalesce(p_description, ''), updated_at = now()
    where id = p_id and seller_company_id = v_me and status in ('DRAFT', 'PUBLISHED')
    returning id into v_id;
    if v_id is null then
      raise exception 'Объявление нельзя изменить.' using errcode = '55000';
    end if;
  end if;
  return v_id;
end;
$$;

/*
 * Предложение покупателя по объявлению. Новая сделка — только с обычным
 * НДС (решение 22.11.2026): по старому объявлению с другим режимом
 * предложение не принимается, пока продавец не сохранит объявление
 * заново. Уже начатые сделки (propose_installment_terms, согласие,
 * передача, взносы) идут со своим режимом до конца. Остальное — как в
 * 20261122100000.
 */
create or replace function public.start_installment_deal(
  p_listing_id uuid,
  p_price_cents bigint,
  p_down_payment_cents bigint,
  p_months integer,
  p_final_cents bigint,
  p_annual_rate_bps integer,
  p_handover_date date,
  p_first_due_date date
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := app.installment_party();
  v_listing public.equipment_listings;
  v_id uuid;
begin
  select * into v_listing from public.equipment_listings where id = p_listing_id and status = 'PUBLISHED' for share;
  if v_listing.id is null then
    raise exception 'Объявление недоступно.' using errcode = '55000';
  end if;
  if v_listing.seller_company_id = v_me then
    raise exception 'Своё объявление.' using errcode = '42501';
  end if;
  if not app.installment_company_ok(v_listing.seller_company_id) then
    raise exception 'Объявление недоступно.' using errcode = '55000';
  end if;
  if (select is_test from public.companies where id = v_me)
     is distinct from (select is_test from public.companies where id = v_listing.seller_company_id) then
    raise exception 'Объявление недоступно.' using errcode = '55000';
  end if;
  if v_listing.vat_mode <> 'STANDARD' then
    raise exception 'Объявление со старым режимом НДС — продавец должен сохранить его заново.' using errcode = '55000';
  end if;
  perform app.installment_terms_ok(p_price_cents, v_listing.vat_mode, v_listing.vat_bps, p_down_payment_cents, p_months, p_final_cents, p_annual_rate_bps);
  /* Передача не раньше завтрашнего дня: первый счёт должен успеть стать «до передачи». */
  if p_handover_date is null or p_handover_date <= app.helsinki_today() or p_first_due_date is null or p_first_due_date <= p_handover_date then
    raise exception 'Даты.' using errcode = '22023';
  end if;

  insert into public.installment_deals (
    listing_id, seller_company_id, buyer_company_id, price_cents, vat_mode, vat_bps, down_payment_cents,
    months, final_cents, annual_rate_bps, handover_date, first_due_date, proposed_by, vehicle_snapshot
  )
  select
    v_listing.id, v_listing.seller_company_id, v_me, p_price_cents, v_listing.vat_mode, v_listing.vat_bps,
    p_down_payment_cents, p_months, p_final_cents, p_annual_rate_bps, p_handover_date, p_first_due_date, v_me,
    jsonb_build_object('make', v.make, 'plate', v.plate, 'vehicle_class', v.vehicle_class::text, 'odometer_km', v_listing.odometer_km)
  from public.vehicles v where v.id = v_listing.vehicle_id
  returning id into v_id;
  return v_id;
end;
$$;

/* Права — как были: только вошедшим пользователям. */
revoke all on function public.save_equipment_listing(uuid, uuid, bigint, text, bigint, integer, bigint, integer, integer, text) from public, anon;
revoke all on function public.start_installment_deal(uuid, bigint, bigint, integer, bigint, integer, date, date) from public, anon;
grant execute on function public.save_equipment_listing(uuid, uuid, bigint, text, bigint, integer, bigint, integer, integer, text) to authenticated;
grant execute on function public.start_installment_deal(uuid, bigint, bigint, integer, bigint, integer, date, date) to authenticated;

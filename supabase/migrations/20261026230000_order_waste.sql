-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · отметка «отходы» в заказе и данные Приложения VII (26.10.2026)
--
-- Обычные перевозки тоже возят отходы: торговая сеть везёт картон,
-- плёнку, банки из магазинов на свою базу или переработчику. Через
-- границу ЕС это перевозка отходов по Регламенту (ЕС) 2024/1157: для
-- «зелёных» отходов на переработку — документ Приложения VII (ст. 18),
-- который едет вместе с CMR; с 01.01.2027 — электронно в DIWASS.
-- Смешанная упаковка 15 01 06 и опасные отходы — не Приложение VII, а
-- предварительное уведомление и согласие властей. Внутри стран — свои
-- системы (BDO, GPAIS, APUS, PISTRIK, SIIRTO).
--
-- Таблица — по строке на заказ: что везут, по какой процедуре и данные
-- для граф Приложения VII. Пишут обе стороны заказа: организатор
-- перевозки — обычно заказчик, но в своих рейсах перевозчика заказ
-- оформляет он сам.
-- ═══════════════════════════════════════════════════════════════════

create table if not exists public.order_waste (
  order_id uuid primary key references public.orders (id) on delete cascade,
  /*
   * ANNEX_VII    — через границу, «зелёный» отход на переработку (ст. 18);
   * NOTIFICATION — через границу, нужна предварительная нотификация (ст. 4(2));
   * DOMESTIC     — внутри страны, документ по национальной системе;
   * REUSE        — не отход: многоразовая тара/поддоны возвращаются в оборот.
   */
  procedure text not null default 'ANNEX_VII'
    constraint order_waste_procedure check (procedure in ('ANNEX_VII', 'NOTIFICATION', 'DOMESTIC', 'REUSE')),
  /* Код по перечню отходов ЕС (6 цифр, опасный — со звёздочкой). */
  ewc_code text constraint order_waste_ewc check (ewc_code is null or ewc_code ~ '^\d{6}\*?$'),
  /* Базельский / OECD / EU-код (B3020, EU3011, GC010…) — графа 10. */
  basel_code text constraint order_waste_basel check (basel_code is null or length(basel_code) <= 20),
  description text constraint order_waste_description check (description is null or length(description) <= 300),
  /* Графа 3: фактическое количество, кг. */
  quantity_kg integer constraint order_waste_qty check (quantity_kg is null or quantity_kg between 1 and 100000),
  /* Графа 6: производитель отхода и место образования. */
  producer_name text constraint order_waste_producer check (producer_name is null or length(producer_name) <= 200),
  producer_address text constraint order_waste_producer_addr check (producer_address is null or length(producer_address) <= 300),
  /* Графа 2: импортёр / получатель. */
  consignee_name text constraint order_waste_consignee check (consignee_name is null or length(consignee_name) <= 200),
  consignee_address text constraint order_waste_consignee_addr check (consignee_address is null or length(consignee_address) <= 300),
  consignee_contact text constraint order_waste_consignee_contact check (consignee_contact is null or length(consignee_contact) <= 200),
  /* Графа 7: предприятие по переработке. */
  facility_name text constraint order_waste_facility check (facility_name is null or length(facility_name) <= 200),
  facility_address text constraint order_waste_facility_addr check (facility_address is null or length(facility_address) <= 300),
  /* Графа 8: операция утилизации R1–R13. */
  recovery_code text constraint order_waste_recovery check (recovery_code is null or recovery_code ~ '^R(1[0-3]|[1-9])$'),
  /* Договор организатора с получателем (ст. 18(10)). */
  contract_ref text constraint order_waste_contract check (contract_ref is null or length(contract_ref) <= 120),
  /* Номер документа Приложения VII в DIWASS, когда он там создан. */
  diwass_number text constraint order_waste_diwass check (diwass_number is null or length(diwass_number) <= 80),
  updated_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists order_waste_touch_updated_at on public.order_waste;
create trigger order_waste_touch_updated_at
  before update on public.order_waste
  for each row execute function app.touch_updated_at();

alter table public.order_waste enable row level security;
revoke all on public.order_waste from anon, authenticated;
grant select, insert, update, delete on public.order_waste to authenticated;

drop policy if exists order_waste_select_party on public.order_waste;
create policy order_waste_select_party
  on public.order_waste for select to authenticated
  using ((select app.party_to_order(order_id)));

drop policy if exists order_waste_write_party on public.order_waste;
create policy order_waste_write_party
  on public.order_waste for all to authenticated
  using ((select app.owns_order(order_id)) or (select app.carries_order(order_id)))
  with check ((select app.owns_order(order_id)) or (select app.carries_order(order_id)));

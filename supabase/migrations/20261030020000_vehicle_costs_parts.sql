-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · покупки из «Запчастей» — в доходность (30.10.2026)
--
-- Просьба пользователя: «добавь в доходность ремонты и шины из раздела
-- запчасти». На странице «Запчасти» после поиска перевозчик записывает
-- покупку (машина, дата, поставщик, сумма, номер детали) — она ложится
-- в журнал расходов машины (vehicle_costs) и сразу видна в доходности.
--
-- Новый вид PARTS — запчасти (шины — прежний TYRES, работа — REPAIR),
-- и поставщик, у которого куплено.
-- ═══════════════════════════════════════════════════════════════════

alter table public.vehicle_costs drop constraint vehicle_costs_category_check;
alter table public.vehicle_costs add constraint vehicle_costs_category_check
  check (category in ('REPAIR', 'PARTS', 'TYRES', 'TOLLS', 'PARKING', 'WASH', 'FINE', 'OTHER'));

alter table public.vehicle_costs
  add column supplier text check (char_length(supplier) <= 120);

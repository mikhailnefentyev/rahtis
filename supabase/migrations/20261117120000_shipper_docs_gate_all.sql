-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · документы до публикации — у любого заказчика (17.11.2026)
--
-- С 11.11.2026 (20261111130000_forwarder_docs_gate) заказчик-экспедитор,
-- которого реестр не подтвердил автоматически, публикует и назначает
-- перевозки только после того, как оператор принял выписку из реестра и
-- полис. Решение 17.11.2026: то же для грузовладельца. Роль больше не
-- освобождает от документов; меняется только вид полиса — у
-- грузовладельца полис общей ответственности предприятия (vastuuvakuutus,
-- Betriebshaftpflicht) с теми же порогами лимитов. Документ тот же вид
-- FORWARDER_INSURANCE: поля, проверка и пороги совпадают, различаются
-- только тексты в интерфейсе.
--
-- Запрет смены роли «экспедитор → грузовладелец» до проверки
-- (app.shipper_role_docs_guard) больше не нужен: смена роли ничего не
-- открывает. Убран, чтобы заказчик мог исправить роль сам.
--
-- Действующих грузовладельцев на 17.11.2026 нет — правило никого из
-- работающих не останавливает.
-- ═══════════════════════════════════════════════════════════════════

create or replace function app.forwarder_docs_required(p_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select c.kind = 'SHIPPER'
       and c.client_of is null
       and not app.forwarder_registry_confirmed(c.id)
    from public.companies c
    where c.id = p_company_id
  ), false);
$$;

comment on function app.forwarder_docs_required(uuid) is
  'Заказчик (экспедитор или грузовладелец), не подтверждённый реестром автоматически (не финский или не найден PRH): публикация и назначение — только с принятыми выпиской и полисом ответственности (11.11.2026, грузовладельцы — с 17.11.2026).';

drop trigger if exists companies_shipper_role_docs_guard on public.companies;
drop function if exists app.shipper_role_docs_guard();

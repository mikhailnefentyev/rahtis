-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · сторона договора не меняется при отмене рейса
--
-- При срыве рейса в пути (abandon_order) и при снятии заказа заказчиком
-- (withdraw_order) отклики удаляются, а назначение остаётся: перевозчик
-- проехал часть маршрута, и это его история. Удаление отклика обнуляет
-- chosen_offer_id, триггер пересчитывает сторону договора — и без
-- отклика рейс считается «не со стола». У перевозчика на подписке
-- договор «Aivomaa отвечает» так превращался в «напрямую с
-- перевозчиком»: претензию по сорванному рейсу подать было нельзя
-- (file_claim отвечал «решают стороны между собой»), а в отчётах
-- раскрывались имена сторон (прогон 13.10.2026).
--
-- Теперь отклик, исчезнувший при сохранённом назначении, сторону
-- договора не трогает: она остаётся той, по которой рейс шёл.
-- Уже отменённые рейсы не пересчитываются — это история.
-- ═══════════════════════════════════════════════════════════════════

create or replace function app.stamp_contract_party()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE'
     and new.chosen_offer_id is null
     and old.chosen_offer_id is not null
     and new.assigned_company_id is not null
     and new.assigned_company_id is not distinct from old.assigned_company_id then
    return new;
  end if;

  new.contract_party := app.contract_party_of(new.assigned_company_id, new.chosen_offer_id);
  return new;
end;
$$;

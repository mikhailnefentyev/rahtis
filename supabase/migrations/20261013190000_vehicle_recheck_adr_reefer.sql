-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · ADR и рефрижератор у допущенной машины — через оператора
--
-- Допущенная машина возвращалась на проверку при смене номера, осей,
-- эко-класса, класса и вместимости. Метки ADR и «рефрижератор»
-- перевозчик включал сам, и допуск оставался: заказчик видел «ADR» на
-- отклике машины, у которой оператор свидетельства не смотрел (прогон
-- 13.10.2026).
--
-- Решение пользователя 13.10.2026: включение ADR или рефрижератора у
-- допущенной машины возвращает её на проверку. За этими двумя метками
-- стоят документы. Выключение, а также контейнеры, гидроборт и боковая
-- загрузка остаются за перевозчиком без проверки.
-- ═══════════════════════════════════════════════════════════════════

create or replace function app.reset_vehicle_access_on_material_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.access = 'APPROVED' and (
       new.plate is distinct from old.plate
    or new.axles is distinct from old.axles
    or new.euro_class is distinct from old.euro_class
    or new.vehicle_class is distinct from old.vehicle_class
    or new.payload_kg is distinct from old.payload_kg
    or new.ldm is distinct from old.ldm
    or (new.adr and not old.adr)
    or (new.reefer and not old.reefer)
  ) then
    new.access := 'PENDING';
    new.submitted_at := now();
    new.approved_at := null;
  end if;

  return new;
end;
$$;

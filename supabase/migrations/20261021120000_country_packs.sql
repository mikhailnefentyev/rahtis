-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · пакеты стран: Прибалтика, Польша, Германия
--
-- 21.10.2026 пользователь решил начать выход в Европу с пакета стран
-- «Прибалтика, Польша, Германия, Швеция». Код стран — src/lib/country;
-- здесь то, что живёт в базе:
--
--   1. Часовой пояс точки по стране. Согласованное время точки хранится
--      местным (scheduled_date + scheduled_time), и app.stop_timezone
--      переводит его в момент для простоя и тревог рейса. Латвия, Литва,
--      Польша и Германия падали в финское время: погрузка в Гданьске на
--      08:00 считалась бы на час раньше настоящей.
--      Должно совпадать с stopTimeZone() в src/lib/country.
--
--   2. Справочник мест водителя (заправки, стоянки) принимает новые
--      страны и их широты: Германия начинается от 47,3° с. ш.
-- ═══════════════════════════════════════════════════════════════════

create or replace function app.stop_timezone(p_country text)
returns text
language sql
immutable
as $$
  select case upper(coalesce(p_country, 'FI'))
    when 'SE' then 'Europe/Stockholm'
    when 'NO' then 'Europe/Oslo'
    when 'DK' then 'Europe/Copenhagen'
    when 'EE' then 'Europe/Tallinn'
    when 'LV' then 'Europe/Riga'
    when 'LT' then 'Europe/Vilnius'
    when 'PL' then 'Europe/Warsaw'
    when 'DE' then 'Europe/Berlin'
    else 'Europe/Helsinki'
  end
$$;


alter table public.driver_places
  drop constraint driver_places_country_check,
  add constraint driver_places_country_check
    check (country in ('FI', 'SE', 'NO', 'DK', 'EE', 'LV', 'LT', 'PL', 'DE')),
  drop constraint driver_places_lat_check,
  add constraint driver_places_lat_check check (lat between 47 and 72),
  drop constraint driver_places_lon_check,
  add constraint driver_places_lon_check check (lon between 3 and 33);

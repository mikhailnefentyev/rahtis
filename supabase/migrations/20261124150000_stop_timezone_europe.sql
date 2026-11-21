-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · пояс точки по полной таблице Европы (21.11.2026, аудит 2.8)
--
-- app.stop_timezone знал только 10 стран пакетов; точка в NL, CZ, IT, HU…
-- (через API страна любая, подсказка адреса теперь ищет по ЕС/ЕЭЗ и
-- соседям) считалась по Хельсинки — опоздание, простой и ETA сдвигались
-- на час. Таблица — та же, что COUNTRY_TZ в src/lib/country/index.ts
-- (её же читает eFTI); country.test.mjs сверяет коды и пояса.
--
-- Пустая или неизвестная страна — по-прежнему Europe/Helsinki.
-- Функция не используется в индексах и generated-столбцах: смена
-- результата для стран вне пакетов индексов не портит.
-- ═══════════════════════════════════════════════════════════════════

create or replace function app.stop_timezone(p_country text)
returns text
language sql
immutable
as $$
  select case upper(coalesce(p_country, 'FI'))
    when 'AL' then 'Europe/Tirane'
    when 'AT' then 'Europe/Vienna'
    when 'BA' then 'Europe/Sarajevo'
    when 'BE' then 'Europe/Brussels'
    when 'BG' then 'Europe/Sofia'
    when 'BY' then 'Europe/Minsk'
    when 'CH' then 'Europe/Zurich'
    when 'CY' then 'Asia/Nicosia'
    when 'CZ' then 'Europe/Prague'
    when 'DE' then 'Europe/Berlin'
    when 'DK' then 'Europe/Copenhagen'
    when 'EE' then 'Europe/Tallinn'
    when 'ES' then 'Europe/Madrid'
    when 'FR' then 'Europe/Paris'
    when 'GB' then 'Europe/London'
    when 'GR' then 'Europe/Athens'
    when 'HR' then 'Europe/Zagreb'
    when 'HU' then 'Europe/Budapest'
    when 'IE' then 'Europe/Dublin'
    when 'IS' then 'Atlantic/Reykjavik'
    when 'IT' then 'Europe/Rome'
    when 'LI' then 'Europe/Vaduz'
    when 'LT' then 'Europe/Vilnius'
    when 'LU' then 'Europe/Luxembourg'
    when 'LV' then 'Europe/Riga'
    when 'MD' then 'Europe/Chisinau'
    when 'ME' then 'Europe/Podgorica'
    when 'MK' then 'Europe/Skopje'
    when 'MT' then 'Europe/Malta'
    when 'NL' then 'Europe/Amsterdam'
    when 'NO' then 'Europe/Oslo'
    when 'PL' then 'Europe/Warsaw'
    when 'PT' then 'Europe/Lisbon'
    when 'RO' then 'Europe/Bucharest'
    when 'RS' then 'Europe/Belgrade'
    when 'RU' then 'Europe/Moscow'
    when 'SE' then 'Europe/Stockholm'
    when 'SI' then 'Europe/Ljubljana'
    when 'SK' then 'Europe/Bratislava'
    when 'TR' then 'Europe/Istanbul'
    when 'UA' then 'Europe/Kyiv'
    else 'Europe/Helsinki'
  end
$$;

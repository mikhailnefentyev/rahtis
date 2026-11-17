-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · счёт за подписку — своим заданием, раз в месяц (17.11.2026)
--
-- Модель: Aivomaa Oy в перевозках не участвует; свой счёт за платформу
-- выставляет раз в месяц. Расчёт «полмесяца» (1-го и 16-го) был
-- документами старой схемы, где Aivomaa — сторона перевозки; таких
-- открытых заказов нет (все 119 — тестовые и закрыты). Месячный сбор
-- жил внутри него и отключился бы вместе с ним.
--
-- Теперь задание идёт 1-го числа в 04:20 UTC, а маршрут
-- /api/reports/settlement (тот же адрес в app.runtime_config) выпускает
-- только месячный счёт Aivomaa за подписку (generateMonthlyFees).
-- Документы старой схемы оператор при нужде выпускает вручную из пульта.
-- ═══════════════════════════════════════════════════════════════════

do $$
begin
  perform cron.unschedule('rahtis-period-settlement');
exception
  when others then
    null;
end;
$$;

do $$
begin
  perform cron.unschedule('rahtis-monthly-fees');
exception
  when others then
    null;
end;
$$;

select cron.schedule(
  'rahtis-monthly-fees',
  '20 4 1 * *',
  $$ select app.run_period_settlement(); $$
);

comment on function app.run_period_settlement() is
  'Месячный счёт Aivomaa за подписку (1-го числа, задание rahtis-monthly-fees): зовёт /api/reports/settlement. С 17.11.2026 расчётов за полмесяца по расписанию нет.';

-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · документы расчётного периода
--
-- Недельный отчёт остаётся как был: он показывает выработку и приходит
-- обеим сторонам по понедельникам. Деньги живут другим ритмом — половина
-- месяца, 1–15 и 16–конец, — и этот ритм уже описан правилом оплат
-- (миграция payout_schedule). Не было документов к нему.
--
-- Раз в период выпускаются два разных документа:
--
--   заказчику — СВОДКА К ОПЛАТЕ: рейсы периода, итог, срок оплаты;
--   перевозчику — СВОДНЫЙ ОТЧЁТ: те же рейсы его глазами, за вычетом
--   комиссии, и дата, когда придут деньги.
--
-- СВОДКА, А НЕ СЧЁТ. Номер счёта рождается в бухгалтерии оператора и
-- вписывается в админку руками — так было и так остаётся. Документ,
-- который платформа называет счётом, обязан нести нумерацию без
-- пропусков и обязательные реквизиты; выдать за счёт сводку — значит
-- пообещать бухгалтерскую строгость там, где её нет.
--
-- Срок оплаты заказчику — четырнадцать дней, и он живёт в config.ts
-- рядом с комиссией, а не здесь: это коммерческое условие, а не свойство
-- календаря. Дата оплаты перевозчику, наоборот, вычисляется здесь — она
-- часть правила периодов и должна остаться одной на весь продукт.
--
-- Запас между двумя датами существенен: период, закрытый 15-го, оплачен
-- заказчиком к 30-му, а перевозчику платят 15-го следующего месяца.
-- Полторы недели зазора — это то, что отделяет посредника от того, кто
-- платит из своего кармана.
-- ═══════════════════════════════════════════════════════════════════


-- ── Документ знает, какого он рода ─────────────────────────────────

create type public.report_kind as enum ('WEEK', 'PERIOD');

comment on type public.report_kind is
  'WEEK — недельный отчёт о выработке. PERIOD — документ расчётного периода.';

alter table public.weekly_reports
  add column kind public.report_kind not null default 'WEEK',
  /* Срок оплаты: заказчику — по счёту, перевозчику — день выплаты. */
  add column due_date date;

comment on column public.weekly_reports.due_date is
  'Когда платить: у заказчика срок оплаты сводки, у перевозчика день выплаты. NULL у недельного отчёта.';

/*
 * В week у документа периода лежит первое число периода. Отдельной
 * колонки не заводим: это та же ось времени, по которой отчёт находится
 * в кабинете, и вторая дата рядом означала бы, что одна из них лишняя.
 */
comment on column public.weekly_reports.week is
  'Понедельник недели у WEEK, первое число расчётного периода у PERIOD. По Хельсинки.';

alter table public.weekly_reports
  drop constraint weekly_reports_unique;

alter table public.weekly_reports
  add constraint weekly_reports_unique
    unique nulls not distinct (week, company_id, role, kind);


-- ── Границы периода и дата оплаты ──────────────────────────────────

/*
 * Приложению нужны те же три даты, которыми живёт правило оплат. Считать
 * их второй раз на TypeScript нельзя: правило про короткий февраль,
 * записанное дважды, разойдётся ровно в феврале и ровно в пользу не той
 * стороны.
 */
create or replace function public.settlement_period(p_moment timestamptz default now())
returns table (period_start date, period_end date, payout_due date)
language sql
stable
security definer
set search_path = ''
as $$
  select
    app.payout_period_start(p_moment),
    app.payout_period_end(app.payout_period_start(p_moment)),
    app.payout_due(p_moment);
$$;

comment on function public.settlement_period(timestamptz) is
  'Границы расчётного периода и день выплаты перевозчику для момента. Одно правило на весь продукт.';

revoke all on function public.settlement_period(timestamptz) from public, anon, authenticated;
grant execute on function public.settlement_period(timestamptz) to service_role;


-- ── Запуск по расписанию ───────────────────────────────────────────

create or replace function app.run_period_settlement()
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_url text;
  v_secret text;
  v_request bigint;
begin
  select value into v_url from app.runtime_config where key = 'settlement_url';
  select value into v_secret from app.runtime_config where key = 'reports_secret';

  if v_url is null or v_secret is null then
    raise notice 'Документы периода не выпущены: в app.runtime_config нет settlement_url или reports_secret.';
    return null;
  end if;

  select net.http_post(
    url := v_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_secret
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 120000
  ) into v_request;

  return v_request;
end;
$$;

revoke all on function app.run_period_settlement() from public, anon, authenticated;

do $$
begin
  perform cron.unschedule('rahtis-period-settlement');
exception
  when others then
    null;
end;
$$;

/*
 * Первое и шестнадцатое — то есть на следующий день после конца периода,
 * когда он закрыт целиком и добавить в него уже нечего.
 *
 * 04:20 UTC — 06:20 зимой и 07:20 летом по Хельсинки: документ лежит в
 * кабинете до начала рабочего дня при обоих сдвигах, а переводить время
 * дважды в год в cron некому. Двадцать минут отступа от недельных
 * отчётов не украшение: первого числа обе задачи могут прийтись на один
 * день, и делить очередь pg_net им незачем.
 */
select cron.schedule(
  'rahtis-period-settlement',
  '20 4 1,16 * *',
  $$ select app.run_period_settlement(); $$
);

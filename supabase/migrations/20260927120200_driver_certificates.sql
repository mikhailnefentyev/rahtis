-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · сроки сертификатов водителя и напоминания
--
-- Задание — docs/training/RAHTIS-driver-training.md, п. 6. Код 95, ADR,
-- Työturva, EA1, Tieturva, карта водителя: у каждого свой срок, и
-- водитель вспоминает о нём на дороге, когда уже поздно.
--
-- СРОК ВВОДИТСЯ, А НЕ ВЫЧИСЛЯЕТСЯ. Дату окончания вносит сам водитель в
-- приложении или перевозчик в карточке водителя. Сроки у документов
-- разные (EA1 — 3 года, большинство остальных — 5 лет) и меняются, и
-- вычисленная дата выглядела бы как проверенная, не будучи ею.
--
-- СРОКИ ВИДИТ ПЕРЕВОЗЧИК — ему они нужны для допуска машины и водителя.
-- Это отдельно от результатов тренажёра: тех перевозчик не видит
-- (миграция 20260927120000_training).
--
-- НАПОМИНАНИЯ за 6, 3 и 1 месяц: водителю — во входящие приложения (а
-- оттуда push, триггер driver_notifications_push), перевозчику — в
-- кабинет и письмом. WhatsApp-агента нет (решение 21.09.2026). Считает и
-- рассылает сайт (/api/reminders/certificates), база раз в день его
-- будит тем же приёмом, что выпуск отчётов.
-- ═══════════════════════════════════════════════════════════════════


create type public.driver_certificate_type as enum (
  'CODE95',
  'ADR_BASIC',
  'ADR_TANK',
  'ADR_CLASS1',
  'ADR_CLASS7',
  'TYOTURVA',
  'EA1',
  'TIETURVA1',
  'TACHO_CARD'
);

create table public.driver_certificates (
  id uuid primary key default gen_random_uuid(),

  driver_id uuid not null references public.drivers (id) on delete cascade,
  type public.driver_certificate_type not null,

  issued_at date,
  expires_at date not null,

  /* Скан или фото документа — в первой версии не загружается. */
  document_url text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  /* Кто внёс последнюю правку: водитель или человек перевозчика. */
  updated_by uuid references auth.users (id) on delete set null,

  /* Один действующий документ каждого вида: продление — это новая дата, а не новая строка. */
  constraint driver_certificates_one_per_type unique (driver_id, type),
  constraint driver_certificates_dates check (issued_at is null or issued_at <= expires_at)
);

comment on table public.driver_certificates is
  'Сроки сертификатов водителя. Дату вводит водитель или перевозчик; видят оба. Напоминания — /api/reminders/certificates.';

create or replace function app.driver_certificate_touch()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end;
$$;

create trigger driver_certificates_touch
  before insert or update on public.driver_certificates
  for each row execute function app.driver_certificate_touch();

alter table public.driver_certificates enable row level security;
revoke all on public.driver_certificates from anon, authenticated;
grant select, delete on public.driver_certificates to authenticated;
grant insert (driver_id, type, issued_at, expires_at) on public.driver_certificates to authenticated;
/*
 * driver_id и type — ради upsert (продление тем же видом): PostgREST
 * переписывает все присланные колонки. Увести строку чужому водителю
 * не даёт with check политик.
 */
grant update (driver_id, type, issued_at, expires_at) on public.driver_certificates to authenticated;

/* Водитель — свои. */
create policy driver_certificates_self
  on public.driver_certificates for all to authenticated
  using (driver_id = (select app.current_driver_id()))
  with check (driver_id = (select app.current_driver_id()));

/* Перевозчик — своих водителей. */
create policy driver_certificates_carrier
  on public.driver_certificates for all to authenticated
  using ((select app.owns_driver(driver_id)))
  with check ((select app.owns_driver(driver_id)));

create policy driver_certificates_admin_read
  on public.driver_certificates for select to authenticated
  using ((select app.is_admin()));


-- ── Какие напоминания уже ушли ─────────────────────────────────────

/*
 * Ступень напоминания привязана к дате окончания: продлили документ —
 * новая дата, и через пять лет напоминания пойдут заново.
 */
create table public.driver_certificate_reminders (
  certificate_id uuid not null references public.driver_certificates (id) on delete cascade,
  expires_at date not null,
  stage text not null,
  sent_at timestamptz not null default now(),

  primary key (certificate_id, expires_at, stage),
  constraint driver_certificate_reminders_stage check (stage in ('6M', '3M', '1M'))
);

comment on table public.driver_certificate_reminders is
  'Журнал напоминаний о сроках сертификатов: одна ступень на дату окончания уходит один раз. Пишет только сайт служебным ключом.';

alter table public.driver_certificate_reminders enable row level security;
revoke all on public.driver_certificate_reminders from anon, authenticated;


-- ── Вид уведомления в кабинете ─────────────────────────────────────

alter type public.notification_kind add value if not exists 'DRIVER';


-- ── Расписание ─────────────────────────────────────────────────────

/*
 * Адрес и секрет — как у push: тот же сайт, тот же REPORTS_CRON_SECRET.
 * Если отчёты ещё не настроены, не настраивается и это.
 */
insert into app.runtime_config (key, value, note)
select 'certificates_url',
       regexp_replace(value, '/api/reports/weekly$', '/api/reminders/certificates'),
       'Маршрут напоминаний о сроках сертификатов водителей. Будит app.run_certificate_reminders.'
from app.runtime_config
where key = 'reports_url' and value ~ '/api/reports/weekly$'
on conflict (key) do nothing;

create or replace function app.run_certificate_reminders()
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
  select value into v_url from app.runtime_config where key = 'certificates_url';
  select value into v_secret from app.runtime_config where key = 'reports_secret';

  if v_url is null or v_secret is null then
    raise notice 'Напоминания о сертификатах не разосланы: в app.runtime_config нет certificates_url или reports_secret.';
    return null;
  end if;

  select net.http_post(
    url := v_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_secret
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  ) into v_request;

  insert into app.scheduler_calls (request_id, job)
  values (v_request, 'certificate-reminders')
  on conflict (request_id) do nothing;

  return v_request;
end;
$$;

revoke all on function app.run_certificate_reminders() from public, anon, authenticated;

/* Каждый день в 06:10 UTC — утром по Хельсинки, до выезда. */
select cron.schedule(
  'rahtis-certificate-reminders',
  '10 6 * * *',
  $$ select app.run_certificate_reminders(); $$
);

-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · недельные отчёты в PDF
--
-- Неделю рейса решает момент ЗАКРЫТИЯ, а не начала. Рейс, взятый в
-- пятницу и выгруженный в понедельник, попадает в отчёт и выплату
-- следующей недели — так уже считает app.report_week(app.closed_moment)
-- и так это должно остаться: платят за выполненную работу, а не за
-- начатую.
--
-- Ставки комиссии и налога сохраняются в строке отчёта. Отчёт за
-- прошлую неделю не должен пересчитаться, когда комиссия изменится: он
-- уже ушёл контрагенту, и второй его экземпляр обязан совпасть с
-- первым.
-- ═══════════════════════════════════════════════════════════════════

create table public.weekly_reports (
  id uuid primary key default gen_random_uuid(),

  /* Понедельник недели по Хельсинки. */
  week date not null,

  /* NULL — сводка оператора: она не про одну компанию, а про все. */
  company_id uuid references public.companies (id) on delete cascade,
  role public.party_role not null,

  file_path text not null,
  bytes integer,

  orders_count integer not null default 0,
  gross_cents bigint not null default 0,
  commission_cents bigint,
  payout_cents bigint,

  /* Ставки на момент выпуска: см. шапку файла. */
  commission_bps integer,
  vat_bps integer not null,

  generated_at timestamptz not null default now(),
  emailed_at timestamptz,

  /*
   * Один отчёт на неделю, компанию и роль. Повторный запуск обновляет
   * строку, а не плодит вторую: воскресное задание может сработать
   * дважды, и две одинаковые ссылки в кабинете выглядят как ошибка.
   */
  constraint weekly_reports_unique unique nulls not distinct (week, company_id, role)
);

create index weekly_reports_company_idx
  on public.weekly_reports (company_id, week desc);

comment on table public.weekly_reports is
  'Выпущенные недельные отчёты. Сам PDF лежит в бакете reports.';

alter table public.weekly_reports enable row level security;

revoke all on public.weekly_reports from anon, authenticated;
grant select on public.weekly_reports to authenticated;
grant select, insert, update on public.weekly_reports to service_role;

/* Свои отчёты видит компания, все — оператор. */
create policy weekly_reports_select_own
  on public.weekly_reports for select to authenticated
  using (company_id = (select app.current_company_id()));

create policy weekly_reports_select_admin
  on public.weekly_reports for select to authenticated
  using ((select app.is_admin()));


-- ── Хранилище ──────────────────────────────────────────────────────

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('reports', 'reports', false, 10485760, array['application/pdf'])
on conflict (id) do nothing;

/*
 * Политика сравнивает первый сегмент пути с компанией спрашивающего.
 * Проверяется, где объект лежит физически, а не что попросил клиент:
 * путь придумывает не браузер, а генератор отчётов.
 *
 * Сводка оператора лежит в reports/admin/ — этот сегмент не совпадает
 * ни с одним uuid, поэтому компаниям она недоступна без отдельного
 * запрета.
 */
create policy reports_read_own
  on storage.objects for select to authenticated
  using (
    bucket_id = 'reports'
    and (storage.foldername(name))[1] = (select app.current_company_id())::text
  );

create policy reports_read_admin
  on storage.objects for select to authenticated
  using (bucket_id = 'reports' and (select app.is_admin()));

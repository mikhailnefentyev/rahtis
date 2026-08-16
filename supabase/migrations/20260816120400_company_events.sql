-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · Этап 1 · журнал модерации
--
-- Кто, когда и из какого статуса в какой перевёл компанию. Оператор
-- допускает компании к деньгам, и решение должно оставлять след.
-- Добавить журнал позже можно, но история до этого момента будет
-- потеряна навсегда — поэтому он заводится сразу.
-- ═══════════════════════════════════════════════════════════════════

create table public.company_events (
  id bigint generated always as identity primary key,

  company_id uuid not null references public.companies (id) on delete cascade,

  /*
   * Кто принял решение. NULL допустим: строка о создании заявки пишется до
   * появления пользователя, а серверные задания действуют без сессии.
   * on delete set null — уволенный сотрудник Aivomaa не должен уносить
   * с собой историю решений.
   */
  actor_id uuid references auth.users (id) on delete set null,

  from_status public.company_status,
  to_status public.company_status not null,
  note text,

  created_at timestamptz not null default now()
);

comment on table public.company_events is
  'Журнал смен статуса компании. Пишется триггером, вручную не заполняется.';

create index company_events_company_id_idx
  on public.company_events (company_id, created_at desc);


/*
 * Триггер, а не запись из приложения: смена статуса не должна зависеть от
 * того, вспомнил ли автор кода про журнал. Любой UPDATE статуса, откуда бы
 * он ни пришёл, оставит строку.
 *
 * Про actor_id. Решения оператора выполняются под секретным ключом, а там
 * нет сессии и auth.uid() возвращает NULL. Поэтому серверное действие может
 * сообщить исполнителя через настройку транзакции:
 *
 *   select set_config('app.actor_id', <uuid>, true);
 *
 * Настройка действует до конца транзакции. Пока такое действие не написано
 * (интерфейс модерации — Этап 2), автор останется пустым, но сам факт
 * перехода будет записан.
 */
create or replace function app.log_company_status_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid;
begin
  v_actor := coalesce(
    nullif(current_setting('app.actor_id', true), '')::uuid,
    (select auth.uid())
  );

  if tg_op = 'INSERT' then
    insert into public.company_events (company_id, actor_id, from_status, to_status, note)
    values (new.id, v_actor, null, new.status, null);

  elsif new.status is distinct from old.status then
    insert into public.company_events (company_id, actor_id, from_status, to_status, note)
    values (new.id, v_actor, old.status, new.status, new.rejection_reason);
  end if;

  return new;
end;
$$;

comment on function app.log_company_status_change() is
  'Пишет строку в company_events при создании компании и при каждой смене статуса.';

create trigger companies_log_status_insert
  after insert on public.companies
  for each row execute function app.log_company_status_change();

create trigger companies_log_status_update
  after update of status on public.companies
  for each row execute function app.log_company_status_change();


-- ── Права и RLS ────────────────────────────────────────────────────

alter table public.company_events enable row level security;

revoke all on public.company_events from anon, authenticated;

/*
 * Только чтение. Пишет исключительно триггер, который выполняется с правами
 * владельца и RLS не подчиняется, поэтому политик на запись нет вовсе.
 */
grant select on public.company_events to authenticated;

/*
 * Компания видит свою историю, включая причину отказа: это её решение
 * и она вправе знать основание.
 */
create policy company_events_select_own
  on public.company_events for select to authenticated
  using (company_id = (select app.current_company_id()));

create policy company_events_select_admin
  on public.company_events for select to authenticated
  using ((select app.is_admin()));

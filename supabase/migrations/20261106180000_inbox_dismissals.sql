-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · «Требует вашего действия» (6.11.2026)
--
-- Список собирается из существующих таблиц; своё у него одно — пункт,
-- отложенный человеком («позже»), чтобы он не стоял сверху весь день.
-- Только у пунктов без собственного «закрыть»: напоминание о счёте,
-- продление документа. Строки — свои, чужие не видны.
-- ═══════════════════════════════════════════════════════════════════

create table public.inbox_dismissals (
  user_id uuid not null references auth.users (id) on delete cascade,
  item_key text not null,
  until timestamptz not null,
  created_at timestamptz not null default now(),
  primary key (user_id, item_key),

  constraint inbox_dismissals_key check (char_length(item_key) between 1 and 200)
);

comment on table public.inbox_dismissals is
  'Отложенные пункты «Требует вашего действия»: ключ пункта и до какого момента скрыт. Свои строки.';

alter table public.inbox_dismissals enable row level security;
revoke all on public.inbox_dismissals from anon, authenticated;

create policy inbox_dismissals_own
  on public.inbox_dismissals for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

grant select, insert, update, delete on public.inbox_dismissals to authenticated;
grant all on public.inbox_dismissals to service_role;

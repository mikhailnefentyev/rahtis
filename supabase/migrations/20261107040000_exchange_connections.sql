-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · подключённые биржи грузов (7.11.2026)
--
-- Компания подключает свой аккаунт внешней биржи (Trans.eu, TIMOCOM) и
-- работает с ним из RAHTIS. Пока договоров с биржами нет, строка — заявка
-- (INTERESTED): кому и какая биржа нужна. Когда доступ появится, та же
-- строка станет подключением (CONNECTED) — вход на странице биржи, токены
-- будут лежать отдельно и только у сервера.
--
-- То, что приходит из аккаунта биржи, видит только эта компания.
-- ═══════════════════════════════════════════════════════════════════

create table public.exchange_connections (
  company_id uuid not null references public.companies (id) on delete cascade,
  provider text not null,
  /* INTERESTED — заявка; CONNECTED — аккаунт подключён; REVOKED — отключён. */
  status text not null default 'INTERESTED',
  requested_by uuid references auth.users (id) on delete set null,
  /* Аккаунт на бирже — для показа «подключено как …»; появится с подключением. */
  external_account text,
  connected_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  primary key (company_id, provider),
  constraint exchange_connections_provider check (provider in ('TRANSEU', 'TIMOCOM')),
  constraint exchange_connections_status check (status in ('INTERESTED', 'CONNECTED', 'REVOKED')),
  constraint exchange_connections_account check (external_account is null or char_length(external_account) <= 200)
);

comment on table public.exchange_connections is
  'Внешние биржи грузов компании: заявка на подключение и само подключение. Данные из аккаунта биржи видит только эта компания.';

alter table public.exchange_connections enable row level security;
revoke all on public.exchange_connections from anon, authenticated;

create policy exchange_connections_company
  on public.exchange_connections for select to authenticated
  using (company_id = (select app.current_company_id()));

create policy mfa_required on public.exchange_connections
  as restrictive for all to authenticated
  using ((select app.mfa_satisfied()))
  with check ((select app.mfa_satisfied()));

grant select on public.exchange_connections to authenticated;
grant all on public.exchange_connections to service_role;


-- ── Заявка и её отмена ──────────────────────────────────────────────

/* «Хочу подключить»: заявка своей компании. Подключённую не трогает. */
create or replace function public.request_exchange_connection(p_provider text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_company uuid := (select app.current_company_id());
begin
  if v_company is null then
    raise exception 'Нет компании.' using errcode = '42501';
  end if;
  if p_provider not in ('TRANSEU', 'TIMOCOM') then
    raise exception 'Неизвестная биржа.' using errcode = '22023';
  end if;

  insert into public.exchange_connections (company_id, provider, status, requested_by)
  values (v_company, p_provider, 'INTERESTED', (select auth.uid()))
  on conflict (company_id, provider) do update
    set status = 'INTERESTED',
        requested_by = excluded.requested_by,
        updated_at = now()
    where public.exchange_connections.status = 'REVOKED';
end;
$$;

/* «Отменить»: заявка снимается. Подключение так не снимается — для него будет отключение. */
create or replace function public.withdraw_exchange_connection(p_provider text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_company uuid := (select app.current_company_id());
begin
  if v_company is null then
    raise exception 'Нет компании.' using errcode = '42501';
  end if;

  delete from public.exchange_connections
  where company_id = v_company
    and provider = p_provider
    and status = 'INTERESTED';
end;
$$;

revoke all on function public.request_exchange_connection(text) from public, anon;
revoke all on function public.withdraw_exchange_connection(text) from public, anon;
grant execute on function public.request_exchange_connection(text) to authenticated;
grant execute on function public.withdraw_exchange_connection(text) to authenticated;

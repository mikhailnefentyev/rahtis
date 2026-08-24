-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · состояние расчётов по рейсу и вопросы оператору
--
-- Одна цепочка на рейс, а не две параллельные. Модель посредника: сперва
-- выставляем счёт заказчику, потом получаем деньги, потом платим
-- перевозчику. Разводить это на «счёт» и «выплату» как независимые
-- дорожки значило бы разрешить выплату по неоплаченному счёту — то есть
-- заплатить из своего кармана и не заметить.
--
-- Только вперёд. Откат состояния расчётов — это не исправление опечатки,
-- а событие бухгалтерии: у него есть кредит-нота и своя дата. Разрешив
-- откат кнопкой, мы получили бы историю, в которую нельзя верить.
-- ═══════════════════════════════════════════════════════════════════

create type public.billing_status as enum ('PENDING', 'INVOICED', 'PAID', 'SETTLED');

comment on type public.billing_status is
  'PENDING — счёт не выставлен. INVOICED — выставлен заказчику. '
  'PAID — деньги получены. SETTLED — перевозчику выплачено.';

alter table public.orders
  add column billing public.billing_status not null default 'PENDING',
  add column invoice_ref text,
  add column invoiced_at timestamptz,
  add column paid_at timestamptz,
  add column settled_at timestamptz;

comment on column public.orders.invoice_ref is
  'Номер счёта в бухгалтерии оператора. Наружу не показывается перевозчику.';

/*
 * Расчёты начинаются только после закрытия рейса. Ограничение, а не
 * договорённость: счёт за невыполненную работу — это не опечатка в
 * интерфейсе, а претензия от клиента.
 */
alter table public.orders
  add constraint orders_billing_needs_done
    check (billing = 'PENDING' or status = 'DONE');

create index orders_billing_idx on public.orders (billing)
  where status = 'DONE';


/*
 * Порядок состояний числом.
 *
 * Сравнивать перечисление напрямую нельзя: порядок значений в типе —
 * деталь его объявления, и добавление нового состояния между
 * существующими молча изменило бы смысл всех сравнений.
 */
create or replace function app.billing_rank(p_state public.billing_status)
returns smallint
language sql
immutable
set search_path = ''
as $$
  select case p_state
    when 'PENDING' then 0
    when 'INVOICED' then 1
    when 'PAID' then 2
    when 'SETTLED' then 3
  end::smallint;
$$;

revoke all on function app.billing_rank(public.billing_status)
  from public, anon, authenticated;


create or replace function public.set_billing(
  p_order_id uuid,
  p_next public.billing_status,
  p_invoice_ref text default null
)
returns public.orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
begin
  if not (select app.is_admin()) then
    raise exception 'Состояние расчётов меняет только оператор.' using errcode = '42501';
  end if;

  select * into v_order from public.orders where id = p_order_id;

  if v_order.id is null then
    raise exception 'Заказ не найден.' using errcode = 'P0002';
  end if;

  if v_order.status <> 'DONE' then
    raise exception 'Рейс ещё не закрыт, расчёты начинать рано.' using errcode = '55004';
  end if;

  if app.billing_rank(p_next) <= app.billing_rank(v_order.billing) then
    raise exception
      'Расчёты идут только вперёд: сейчас %, назад к % вернуть нельзя.',
      v_order.billing, p_next
      using errcode = '55005';
  end if;

  update public.orders
  set billing = p_next,
      invoice_ref = coalesce(nullif(btrim(coalesce(p_invoice_ref, '')), ''), invoice_ref),
      invoiced_at = case when p_next = 'INVOICED' then now() else invoiced_at end,
      paid_at = case when p_next = 'PAID' then now() else paid_at end,
      settled_at = case when p_next = 'SETTLED' then now() else settled_at end
  where id = p_order_id
  returning * into v_order;

  perform app.audit(
    'billing.set',
    p_order_id::text,
    jsonb_build_object('ref', v_order.ref, 'to', p_next, 'invoice_ref', v_order.invoice_ref)
  );

  return v_order;
end;
$$;

revoke all on function public.set_billing(uuid, public.billing_status, text)
  from public, anon;
grant execute on function public.set_billing(uuid, public.billing_status, text)
  to authenticated, service_role;


-- ── Вопросы оператору ──────────────────────────────────────────────

/*
 * Отдельная таблица, а не просто письмо.
 *
 * Письмо может не дойти — тем же спам-фильтром, из-за которого мы завели
 * второй канал. Вопрос, оставшийся без ответа, это потерянный клиент,
 * поэтому он лежит в базе очередью с отметкой «разобрано», а письмо
 * оператору только дублирует.
 */
create table public.support_messages (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),

  company_id uuid not null references public.companies (id) on delete cascade,
  user_id uuid references auth.users (id) on delete set null,
  role public.party_role not null,

  /* Копия на момент письма: человек уходит из компании, вопрос остаётся. */
  from_email text not null,

  subject text not null,
  body text not null,

  handled_at timestamptz,
  handled_by uuid references auth.users (id) on delete set null,

  constraint support_subject_length check (length(btrim(subject)) between 3 and 200),
  constraint support_body_length check (length(btrim(body)) between 3 and 4000)
);

create index support_messages_open_idx on public.support_messages (created_at desc)
  where handled_at is null;

alter table public.support_messages enable row level security;

revoke all on public.support_messages from anon, authenticated;
grant select on public.support_messages to authenticated;
grant select, insert, update on public.support_messages to service_role;
grant usage, select on sequence public.support_messages_id_seq to service_role;

/* Своя переписка видна компании, вся — оператору. */
create policy support_messages_select_own
  on public.support_messages for select to authenticated
  using (company_id = (select app.current_company_id()));

create policy support_messages_select_admin
  on public.support_messages for select to authenticated
  using ((select app.is_admin()));


create or replace function public.submit_support_message(p_subject text, p_body text)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_company uuid;
  v_role public.party_role;
  v_email text;
  v_id bigint;
begin
  v_company := (select app.current_company_id());
  v_role := (select app.current_party_role());

  if v_company is null or v_role is null then
    raise exception 'Написать оператору может только сотрудник компании.' using errcode = '42501';
  end if;

  if not app.company_is_open(v_company) then
    raise exception 'Компания заморожена.' using errcode = '42501';
  end if;

  select email into v_email from auth.users where id = (select auth.uid());

  insert into public.support_messages (company_id, user_id, role, from_email, subject, body)
  values (v_company, (select auth.uid()), v_role, coalesce(v_email, 'tuntematon'),
          btrim(p_subject), btrim(p_body))
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.submit_support_message(text, text) from public, anon;
grant execute on function public.submit_support_message(text, text)
  to authenticated, service_role;


create or replace function public.handle_support_message(p_id bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (select app.is_admin()) then
    raise exception 'Отмечать вопросы может только оператор.' using errcode = '42501';
  end if;

  update public.support_messages
  set handled_at = now(), handled_by = (select auth.uid())
  where id = p_id and handled_at is null;
end;
$$;

revoke all on function public.handle_support_message(bigint) from public, anon;
grant execute on function public.handle_support_message(bigint) to authenticated, service_role;

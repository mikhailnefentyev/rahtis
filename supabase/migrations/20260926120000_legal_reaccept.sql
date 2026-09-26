-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · повторное принятие новых редакций
--
-- Согласие спрашивалось один раз — при активации кабинета. Новая
-- редакция условий, политики или договора стороны для уже работающей
-- компании проходила молча: платформа продолжала работать с ней по
-- тексту, который та не видела. Первая же правка для настоящих клиентов
-- (договор заказчика v8 и договор перевозчика v1, 25–26.09.2026) это
-- показала.
--
-- Теперь у работающей компании с непринятой действующей редакцией:
--
--   · в кабинете плашка со ссылками на изменённые документы и кнопкой,
--     которая принимает их разом (accept_legal с источником REACCEPT);
--   · новая работа не начинается, пока не принято. Проверка стоит на
--     переходах, с которых работа начинается: публикация заказа
--     (DRAFT → OPEN), выбор или прямое назначение исполнителя
--     (→ AWAIT_DRIVER, проверяется заказчик), подтверждение рейса
--     (AWAIT_DRIVER → IN_PROGRESS, проверяется перевозчик) и отклик
--     со стола (вставка в order_offers).
--
-- Уже идущая работа не останавливается: отметки точек, закрытие рейсов,
-- правки маршрута и отмены проверку не проходят вовсе. Автоматика без
-- пользователя (истечение сроков, служебный ключ) и оператор проверку
-- тоже не проходят — рейс не должен застрять из-за непрочитанной бумаги.
--
-- Триггеры, а не строки в каждой функции: функции заказов длинные и
-- вызываются из нескольких мест, а переход статуса — одно место.
-- ═══════════════════════════════════════════════════════════════════

/* Какие действующие редакции компания ещё не приняла. */
create or replace function public.my_pending_legal()
returns table (kind public.legal_kind, version integer)
language sql
stable
security definer
set search_path = ''
as $$
  select d.kind, d.version
  from unnest(
    app.required_legal_kinds(
      (select c.kind from public.companies c where c.id = (select app.current_company_id()))
    )
  ) as k(kind)
  join public.legal_documents d on d.id = public.active_legal_document(k.kind)
  where not exists (
    select 1 from public.legal_acceptances a
    where a.company_id = (select app.current_company_id())
      and a.document_id = d.id
  )
  order by d.kind;
$$;

comment on function public.my_pending_legal() is
  'Действующие редакции, которые компания текущего пользователя ещё не приняла.';

revoke all on function public.my_pending_legal() from public, anon;
grant execute on function public.my_pending_legal() to authenticated;


/*
 * Проверка перед новой работой. Только для работающей компании: у
 * одобренной, но не активированной согласие спрашивает активация.
 */
create or replace function app.assert_legal_current(p_company_id uuid)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_company_id is null
     or (select auth.uid()) is null
     or (select app.is_admin()) then
    return;
  end if;

  if (select status from public.companies where id = p_company_id) = 'ACTIVE'
     and not app.legal_accepted(p_company_id) then
    raise exception 'Palvelun ehdot ovat muuttuneet: hyväksy uudet versiot ennen uusia kuljetuksia.'
      using errcode = '55009';
  end if;
end;
$$;

revoke all on function app.assert_legal_current(uuid) from public, anon, authenticated;


create or replace function app.on_order_start_legal()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status is not distinct from old.status then
    return new;
  end if;

  if old.status = 'DRAFT' and new.status = 'OPEN' then
    perform app.assert_legal_current(new.shipper_company_id);
  elsif new.status = 'AWAIT_DRIVER' and old.status in ('DRAFT', 'OPEN', 'REQUESTED') then
    perform app.assert_legal_current(new.shipper_company_id);
  elsif old.status = 'AWAIT_DRIVER' and new.status = 'IN_PROGRESS' then
    perform app.assert_legal_current(new.assigned_company_id);
  end if;

  return new;
end;
$$;

revoke all on function app.on_order_start_legal() from public, anon, authenticated;

create trigger orders_legal_before_start
  before update of status on public.orders
  for each row execute function app.on_order_start_legal();


create or replace function app.on_offer_legal()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform app.assert_legal_current(new.carrier_company_id);
  return new;
end;
$$;

revoke all on function app.on_offer_legal() from public, anon, authenticated;

create trigger order_offers_legal_before_insert
  before insert on public.order_offers
  for each row execute function app.on_offer_legal();

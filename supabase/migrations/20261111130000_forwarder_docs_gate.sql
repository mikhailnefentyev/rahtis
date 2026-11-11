-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · экспедитор без подтверждения реестром: документы до работы
--
-- Решение пользователя 11.11.2026 (повод — «экспедитор» из Германии:
-- Gmail, ни сайта, ни парка, хочет брать грузы и отдавать их
-- субподрядчикам — классическая схема двойного брокерства):
-- «одобряем сразу, чтобы могли пройти и посмотреть, а вот
-- покупать-продавать только после документов».
--
-- КТО. Заказчик (SHIPPER, не клиент перевозчика) с ролью FORWARDER, чья
-- компания НЕ подтверждена реестром автоматически:
--   · любой нефинский экспедитор — VIES, Brønnøysund и ручная проверка
--     показывают, что компания есть, но не что заявитель — она;
--   · финский экспедитор, которого сверка не нашла в открытых данных
--     PRH (toiminimi, реестр не ответил), у которого название в реестре
--     другое (nameMatch = DIFFERENT) или есть банкротство / санация /
--     ликвидация.
-- Финская компания, найденная PRH под своим названием, — свободна.
-- Грузовладелец (CARGO_OWNER) — свободен. Вердикт — снимок
-- companies.registry_check (src/lib/registry), его пишет сервер.
--
-- ЧТО. Два документа из «Документов компании», ПРИНЯТЫЕ оператором
-- (review_company_document): выписка из реестра (REGISTER_EXTRACT,
-- срок отметки — app.company_document_fresh_until, 12 месяцев) и полис
-- ответственности экспедитора (FORWARDER_INSURANCE с лимитами не ниже
-- 250 000 € / 500 000 € — app.forwarder_policy_until). Решает последний
-- рассмотренный документ вида, как и раньше: отклонённый или истёкший
-- не считается, новая версия на проверке прежнюю одобренную не гасит.
--
-- ДОПУСК. Одобрение заявки — как было: компания входит и видит всё.
-- Закрыто до документов («купить-продать»), проверка в базе:
--   · заказ: вставка не черновиком, выход из DRAFT/CANCELLED (публикация
--     на стол, группе, напрямую машине), новый выбранный отклик или
--     назначенный перевозчик (выбор отклика, прямое назначение, взятие
--     из группы, принятие запроса на место) — триггер
--     orders_zz_forwarder_docs_guard. Через него же идут кабинет, API
--     (api_create_order, api_order_action) и письма-заказы;
--   · запрос свободного места (догруз) — триггер на capacity_requests.
-- Черновик сохраняется. Начатое доезжает: подтверждение, ход рейса,
-- возвраты на стол, отмены не проверяются. Сменить роль на
-- «грузовладелец», пока документы нужны и не приняты, может только
-- оператор (иначе правило обходилось бы одной кнопкой).
--
-- Оператору проверка не мешает (как app.assert_legal_current): он и
-- принимает документы.
--
-- Код ошибки свой — 55018: кабинет и API отвечают на него своей фразой
-- (src/lib/forwarders/docsGate.ts).
-- ═══════════════════════════════════════════════════════════════════


-- ── Кому нужны документы ───────────────────────────────────────────

/*
 * Подтверждён ли экспедитор реестром автоматически. Только Финляндия:
 * открытые данные PRH дают и название, и состояние компании. Снимок
 * перепроверки, когда реестр не ответил, не перезаписывается (кроме
 * перепроверки оператором) — см. src/lib/trust/status.ts.
 */
create or replace function app.forwarder_registry_confirmed(p_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select c.country = 'FI'
       and coalesce(c.registry_check ->> 'verdict', '') in ('OK', 'ATTENTION')
       and coalesce(c.registry_check ->> 'nameMatch', '') <> 'DIFFERENT'
       and (
         jsonb_typeof(c.registry_check -> 'situations') is distinct from 'array'
         or jsonb_array_length(c.registry_check -> 'situations') = 0
       )
    from public.companies c
    where c.id = p_company_id
  ), false);
$$;

comment on function app.forwarder_registry_confirmed(uuid) is
  'Финская компания найдена в открытых данных PRH под своим названием и без банкротства, санации, ликвидации (снимок companies.registry_check).';

create or replace function app.forwarder_docs_required(p_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select c.kind = 'SHIPPER'
       and c.client_of is null
       and c.shipper_role = 'FORWARDER'
       and not app.forwarder_registry_confirmed(c.id)
    from public.companies c
    where c.id = p_company_id
  ), false);
$$;

comment on function app.forwarder_docs_required(uuid) is
  'Экспедитор, не подтверждённый реестром автоматически (не финский или не найден PRH): публикация и назначение — только с принятыми выпиской и полисом (решение 11.11.2026).';


-- ── Состояние документов ───────────────────────────────────────────

/*
 * Действует ли принятый документ вида. Выписка — по сроку отметки
 * (app.shipper_document_of), полис — с лимитами (app.forwarder_policy_until).
 */
create or replace function app.forwarder_doc_valid(p_company_id uuid, p_kind public.document_kind)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_ok boolean;
begin
  if p_kind = 'FORWARDER_INSURANCE' then
    return app.forwarder_policy_until(p_company_id) is not null;
  end if;

  select d.approved and (d.valid_until is null or d.valid_until >= current_date)
  into v_ok
  from app.shipper_document_of(p_company_id, p_kind) d;

  return coalesce(v_ok, false);
end;
$$;

/*
 * Для кабинета и оператора: OK — принят и действует; PENDING — есть на
 * проверке; REJECTED — последний рассмотренный отклонён; EXPIRED —
 * последний рассмотренный истёк (или лимиты полиса ниже порога);
 * MISSING — ничего не загружено.
 */
create or replace function app.forwarder_doc_state(p_company_id uuid, p_kind public.document_kind)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_last text;
begin
  if app.forwarder_doc_valid(p_company_id, p_kind) then
    return 'OK';
  end if;

  if exists (
    select 1 from public.company_documents d
    where d.company_id = p_company_id and d.kind = p_kind and d.review_status = 'PENDING'
  ) then
    return 'PENDING';
  end if;

  select d.review_status into v_last
  from public.company_documents d
  where d.company_id = p_company_id and d.kind = p_kind and d.review_status <> 'PENDING'
  order by d.uploaded_at desc
  limit 1;

  if v_last is null then
    return 'MISSING';
  elsif v_last = 'REJECTED' then
    return 'REJECTED';
  end if;
  return 'EXPIRED';
end;
$$;

create or replace function app.forwarder_docs_ok(p_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select app.forwarder_doc_valid(p_company_id, 'REGISTER_EXTRACT')
     and app.forwarder_doc_valid(p_company_id, 'FORWARDER_INSURANCE');
$$;

comment on function app.forwarder_docs_ok(uuid) is
  'Выписка из реестра и полис экспедитора приняты оператором и действуют.';

/* Закрыта ли новая работа: документы нужны и их нет. */
create or replace function app.forwarder_docs_blocked(p_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select app.forwarder_docs_required(p_company_id) and not app.forwarder_docs_ok(p_company_id);
$$;

/*
 * Проверка перед новой работой. Оператору не мешает: он принимает
 * документы и может помочь с рейсом, который уже идёт.
 */
create or replace function app.assert_forwarder_docs(p_company_id uuid)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_company_id is null or (select app.is_admin()) then
    return;
  end if;

  if app.forwarder_docs_blocked(p_company_id) then
    raise exception 'Публикация и назначение перевозок откроются, когда оператор примет выписку из реестра и полис ответственности экспедитора.'
      using errcode = '55018';
  end if;
end;
$$;

revoke all on function
  app.forwarder_registry_confirmed(uuid),
  app.forwarder_docs_required(uuid),
  app.forwarder_doc_valid(uuid, public.document_kind),
  app.forwarder_doc_state(uuid, public.document_kind),
  app.forwarder_docs_ok(uuid),
  app.forwarder_docs_blocked(uuid),
  app.assert_forwarder_docs(uuid)
from public, anon, authenticated;

grant execute on function
  app.forwarder_registry_confirmed(uuid),
  app.forwarder_docs_required(uuid),
  app.forwarder_doc_valid(uuid, public.document_kind),
  app.forwarder_doc_state(uuid, public.document_kind),
  app.forwarder_docs_ok(uuid),
  app.forwarder_docs_blocked(uuid),
  app.assert_forwarder_docs(uuid)
to service_role;


-- ── Запрет в базе: заказы ──────────────────────────────────────────

/*
 * Новая работа заказчика — проверка; начатое — нет.
 *
 *   · вставка не черновиком (create_order и API публикуют, вставляя
 *     черновик и переводя его дальше, — это ловит второе условие, но
 *     прямую вставку тоже закрываем);
 *   · выход из DRAFT или CANCELLED в любой рабочий статус: публикация
 *     на стол, группе машин, прямое назначение, принятие запроса места;
 *   · новый выбранный отклик или новый назначенный перевозчик: выбор
 *     отклика, прямое назначение со стола, взятие из группы, принятие
 *     запроса на место. Заказы, опубликованные до 11.11.2026, на столе
 *     остаются, но назначить их тоже нельзя, пока нет документов.
 *
 * Не проверяются: возврат на стол (отказ, истёкший срок, отмена
 * назначения — отклик и перевозчик снимаются в NULL), подтверждение
 * перевозчиком, смена машины и водителя внутри рейса, ход рейса.
 *
 * «zz» — после остальных BEFORE-триггеров (они идут по алфавиту): статус
 * уже окончательный.
 */
create or replace function app.forwarder_docs_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_new_work boolean;
begin
  if tg_op = 'INSERT' then
    v_new_work := new.status not in ('DRAFT', 'CANCELLED')
      or new.chosen_offer_id is not null
      or new.assigned_company_id is not null;
  else
    v_new_work := (new.status not in ('DRAFT', 'CANCELLED') and old.status in ('DRAFT', 'CANCELLED'))
      or (new.chosen_offer_id is not null and new.chosen_offer_id is distinct from old.chosen_offer_id)
      or (new.assigned_company_id is not null and new.assigned_company_id is distinct from old.assigned_company_id);
  end if;

  if v_new_work then
    perform app.assert_forwarder_docs(new.shipper_company_id);
  end if;

  return new;
end;
$$;

revoke all on function app.forwarder_docs_guard() from public, anon, authenticated;

drop trigger if exists orders_zz_forwarder_docs_guard on public.orders;
create trigger orders_zz_forwarder_docs_guard
  before insert or update of status, chosen_offer_id, assigned_company_id
  on public.orders
  for each row execute function app.forwarder_docs_guard();


-- ── Запрет в базе: запрос свободного места ─────────────────────────

/*
 * Запрос места — предложение перевозчику взять груз по цене; принятие
 * сразу делает заказ подтверждённым. Закрыт так же, как публикация.
 */
create or replace function app.capacity_request_docs_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform app.assert_forwarder_docs(new.shipper_company_id);
  return new;
end;
$$;

revoke all on function app.capacity_request_docs_guard() from public, anon, authenticated;

drop trigger if exists capacity_requests_forwarder_docs_guard on public.capacity_requests;
create trigger capacity_requests_forwarder_docs_guard
  before insert on public.capacity_requests
  for each row execute function app.capacity_request_docs_guard();


-- ── Роль: не уйти из правила сменой на «грузовладельца» ────────────

/*
 * Роль заказчика заявляет сама компания (/account). Экспедитор, которому
 * нужны документы и они ещё не приняты, сам в грузовладельцы не
 * переходит — это делает оператор (ему проверка не мешает). С принятыми
 * документами или подтверждённый реестром — меняет как раньше.
 */
create or replace function app.shipper_role_docs_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.shipper_role = 'FORWARDER'
     and new.shipper_role = 'CARGO_OWNER'
     and (select auth.uid()) is not null
     and not (select app.is_admin())
     and app.forwarder_docs_blocked(old.id) then
    raise exception 'Роль «грузовладелец» до проверки документов меняет оператор.'
      using errcode = '55018';
  end if;
  return new;
end;
$$;

revoke all on function app.shipper_role_docs_guard() from public, anon, authenticated;

drop trigger if exists companies_shipper_role_docs_guard on public.companies;
create trigger companies_shipper_role_docs_guard
  before update of shipper_role on public.companies
  for each row execute function app.shipper_role_docs_guard();


-- ── Состояние для кабинета и оператора ─────────────────────────────

/*
 * Одна строка на компанию: нужны ли документы, открыта ли работа и что
 * с каждым из двух документов. По ней кабинет показывает плашку и гасит
 * кнопки, а оператор — «puuttuvat / tarkastettavana / kunnossa».
 *
 * overall: OK — документы не нужны или приняты; REVIEW — всё, чего не
 * хватает, ждёт проверки; MISSING — чего-то нет, или отклонено, или
 * истекло.
 *
 * Без аргумента — своя компания. Чужие — только оператору и серверу
 * (служебный ключ: письмо «работа открыта» после решения оператора).
 */
create or replace function public.forwarder_docs_status(p_company_ids uuid[] default null)
returns table (
  company_id uuid,
  required boolean,
  ok boolean,
  register_extract text,
  insurance text,
  overall text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_own uuid := (select app.current_company_id());
  v_ids uuid[] := coalesce(p_company_ids, case when v_own is null then '{}'::uuid[] else array[v_own] end);
begin
  if not (
    (select app.is_admin())
    or (select auth.role()) = 'service_role'
    or v_ids <@ case when v_own is null then '{}'::uuid[] else array[v_own] end
  ) then
    raise exception 'Нет доступа к этой компании.' using errcode = '42501';
  end if;

  return query
  select
    s.id,
    s.required,
    not s.required or (s.reg = 'OK' and s.ins = 'OK'),
    s.reg,
    s.ins,
    case
      when not s.required or (s.reg = 'OK' and s.ins = 'OK') then 'OK'
      when s.reg in ('OK', 'PENDING') and s.ins in ('OK', 'PENDING') then 'REVIEW'
      else 'MISSING'
    end
  from (
    select
      c.id,
      app.forwarder_docs_required(c.id) as required,
      app.forwarder_doc_state(c.id, 'REGISTER_EXTRACT') as reg,
      app.forwarder_doc_state(c.id, 'FORWARDER_INSURANCE') as ins
    from public.companies c
    where c.id = any (v_ids)
  ) s;
end;
$$;

comment on function public.forwarder_docs_status(uuid[]) is
  'Документы экспедитора для работы (11.11.2026): нужны ли, открыта ли публикация и назначение, состояние выписки и полиса.';

revoke all on function public.forwarder_docs_status(uuid[]) from public, anon;
grant execute on function public.forwarder_docs_status(uuid[]) to authenticated, service_role;

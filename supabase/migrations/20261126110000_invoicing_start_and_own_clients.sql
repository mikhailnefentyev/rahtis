-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · недельные счета: включение без истории и свои клиенты
-- (22.11.2026)
--
-- Два решения владельца.
--
--   А. Включение недельных счетов не выставляет историю. Нижней границей
--      была одна дата на всех (START в src/lib/invoices/freight.ts):
--      перевозчик на три месяца выключал настройку и выставлял счета из
--      своей бухгалтерии, включал снова — и RAHTIS выставил бы все рейсы
--      с первой недели схемы второй раз.
--        · companies.weekly_invoicing_from — момент последнего включения.
--          Ставит триггер при переходе weekly_invoicing false → true, на
--          любом пути (кабинет, оператор, служебный ключ). У компаний,
--          которые настройку не переключали, пусто — действует START.
--        · В счёт идут рейсы, закрытые в этот момент или позже
--          (src/lib/invoices/freightScope.ts).
--
--   Б. Свой клиент перевозчика (companies.client_of) получает счёт от
--      RAHTIS только с явного подтверждения перевозчика. Своих клиентов
--      перевозчик часто уже выставляет из бухгалтерии — клиент получал
--      второй счёт.
--        · companies.auto_invoice — отметка на записи клиента, по
--          умолчанию нет; смысл имеет только у строк с client_of.
--        · Меняет перевозчик — владелец записи, тем же путём, что имя и
--          почту клиента: carrier_update_client (новый параметр).
--          Диспетчер не меняет — как и недельные счета компании.
--        · carrier_clients отдаёт отметку в список клиентов.
--
-- Существующие данные: weekly_invoicing_from у всех пусто (ничего не
-- меняется, пока настройку не переключат). auto_invoice = true получают
-- ровно те свои клиенты, кому RAHTIS уже выставил счёт за перевозки от
-- имени их перевозчика, — то, что работает сегодня, молча не
-- останавливается. Остальные свои клиенты счетов больше не получают,
-- пока перевозчик не включит отметку.
--
-- Все функции — целиком, от последнего определения (указано у каждой).
-- ═══════════════════════════════════════════════════════════════════


-- ── Колонки ────────────────────────────────────────────────────────

alter table public.companies
  add column weekly_invoicing_from timestamptz,
  add column auto_invoice boolean not null default false,
  /* Отметка — про запись клиента в справочнике перевозчика, не про участника платформы. */
  add constraint companies_auto_invoice_own_client check (not auto_invoice or client_of is not null);

comment on column public.companies.weekly_invoicing_from is
  'Момент последнего включения weekly_invoicing (ставит триггер). В автоматический счёт идут рейсы, закрытые в этот момент или позже; пусто — настройку не переключали, действует общая дата начала схемы (22.11.2026).';

comment on column public.companies.auto_invoice is
  'Свой клиент перевозчика (client_of): перевозчик подтвердил, что RAHTIS отправляет этому клиенту счета от его имени. У остальных строк значения не имеет (22.11.2026).';

/*
 * Права. Читать обе колонки участник может, как и остальные колонки своей
 * строки: чтение companies выдано на таблицу целиком (20260816120100), а
 * строки ограничивает RLS. Права на запись (как у weekly_invoicing в
 * 20261117140000) не выдаются ни одной из них намеренно:
 *   · weekly_invoicing_from ставит только триггер ниже — выставленная
 *     вручную дата в прошлом открыла бы счета за историю;
 *   · auto_invoice живёт на строке клиента, а политика
 *     companies_update_own пускает участника только к своей строке —
 *     запись идёт через carrier_update_client.
 */


-- ── А. Момент включения недельных счетов ───────────────────────────

/*
 * Без списка колонок: срабатывает на любое обновление строки, а не только
 * когда weekly_invoicing стоит в SET, — так его не обойти и другим
 * триггером. Дата берётся только отсюда: что бы ни пришло в запросе, при
 * включении это «сейчас».
 */
create function app.company_weekly_invoicing_from()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.weekly_invoicing and not old.weekly_invoicing then
    new.weekly_invoicing_from := now();
  end if;
  return new;
end;
$$;

revoke all on function app.company_weekly_invoicing_from() from public, anon, authenticated;

create trigger companies_weekly_invoicing_from
  before update on public.companies
  for each row execute function app.company_weekly_invoicing_from();


-- ── Денежные настройки меняет владелец: + отметка своего клиента ───

/*
 * Последнее определение — 20261125140000_sites_fleet_fixes. Добавлены
 * новые колонки: auto_invoice решает, уйдёт ли клиенту счёт от имени
 * компании, — это то же решение, что weekly_invoicing, только по одному
 * клиенту; weekly_invoicing_from участнику и так не выдана, здесь — на
 * случай, если право когда-нибудь выдадут. Проверка работает и внутри
 * carrier_update_client: auth.uid() там — тот же человек.
 *
 * Момент включения, который ставит триггер выше, сюда не попадает:
 * он меняется только вместе с weekly_invoicing, а её диспетчеру менять
 * уже нельзя.
 */
create or replace function app.company_money_settings_owner_only()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (new.currency is distinct from old.currency
      or new.weekly_invoicing is distinct from old.weekly_invoicing
      or new.weekly_invoicing_from is distinct from old.weekly_invoicing_from
      or new.auto_invoice is distinct from old.auto_invoice)
     and (select auth.uid()) is not null
     and not app.is_admin()
     and exists (
       select 1 from public.profiles p
       where p.id = (select auth.uid()) and p.member_kind = 'DISPATCHER'
     ) then
    raise exception 'Валюту и счета от имени компании меняет владелец компании.' using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke all on function app.company_money_settings_owner_only() from public, anon, authenticated;

drop trigger companies_money_settings_owner_only on public.companies;

/*
 * Имя прежнее. Триггеры одного события идут по алфавиту: этот — раньше
 * companies_weekly_invoicing_from, поэтому видит weekly_invoicing_from
 * такой, какой её прислал запрос, а не проставленной триггером.
 */
create trigger companies_money_settings_owner_only
  before update of currency, weekly_invoicing, weekly_invoicing_from, auto_invoice on public.companies
  for each row execute function app.company_money_settings_owner_only();


-- ── Б. Справочник клиентов: отметка в списке ───────────────────────

/* Меняется состав строки ответа — функция пересоздаётся (как в 20261021130000). */
drop function public.carrier_clients();

/*
 * Последнее определение — 20261021130000_foreign_clients. Добавлена
 * колонка auto_invoice, последней: остальным читателям списка (форма
 * своего рейса, стол, почта заказов) порядок и имена прежние.
 */
create function public.carrier_clients()
returns table (
  id uuid, name text, country text, business_id text, contact_email text,
  orders integer, last_order_at timestamptz, auto_invoice boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select c.id, c.name, c.country::text, c.business_id, c.contact_email,
         (select count(*)::integer from public.orders o where o.shipper_company_id = c.id),
         (select max(o.created_at) from public.orders o where o.shipper_company_id = c.id),
         c.auto_invoice
  from public.companies c
  where c.client_of = (select app.current_company_id())
    and (select app.current_party_role()) = 'CARRIER'
  order by 7 desc nulls last, c.name;
$$;

revoke all on function public.carrier_clients() from public, anon;
grant execute on function public.carrier_clients() to authenticated;


-- ── Б. Правка клиента: отметка «счета от моего имени» ──────────────

drop function public.carrier_update_client(uuid, text, text, text, text);

/*
 * Последнее определение — 20261021130000_foreign_clients. Добавлен
 * p_auto_invoice: не передан — отметка остаётся прежней (так вызывает
 * прежний код и форма, где переключатель не показан).
 *
 * Счёт уходит клиенту письмом, поэтому с отметкой почта клиента
 * обязательна (23514 — чтобы приложение показало свой текст, а не
 * «проверьте номер и почту»). Кто может менять отметку, решает триггер
 * companies_money_settings_owner_only: диспетчеру — 42501.
 */
create function public.carrier_update_client(
  p_client_id uuid, p_name text, p_business_id text, p_email text, p_country text default null,
  p_auto_invoice boolean default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := (select app.current_company_id());
  v_name text := app.clean_client_name(p_name);
  v_bid text := upper(btrim(coalesce(p_business_id, '')));
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_country text;
  v_auto boolean;
begin
  if (select app.current_party_role()) is distinct from 'CARRIER' or v_me is null then
    raise exception 'Клиентов правит перевозчик.' using errcode = '42501';
  end if;

  select country, auto_invoice into v_country, v_auto
  from public.companies where id = p_client_id and client_of = v_me;
  if v_country is null then
    raise exception 'Клиент не найден.' using errcode = 'P0002';
  end if;
  v_country := upper(btrim(coalesce(nullif(p_country, ''), v_country)));
  v_auto := coalesce(p_auto_invoice, v_auto);

  if length(v_name) < 2 or length(v_name) > 200 then
    raise exception 'Укажите имя клиента.' using errcode = '22023';
  end if;

  if not app.client_email_ok(v_email) then
    raise exception 'Почта клиента указана неверно.' using errcode = '22023';
  end if;

  if v_auto and v_email = '' then
    raise exception 'Для счетов от имени перевозчика нужна почта клиента.' using errcode = '23514';
  end if;

  if v_country !~ '^[A-Z]{2}$' or not app.business_id_ok(v_country, v_bid) then
    raise exception 'Номер клиента указан неверно.' using errcode = '22023';
  end if;

  /* Второй клиент с тем же именем или номером — это дубль, а не правка. */
  if exists (
    select 1 from public.companies c
    where c.client_of = v_me and c.id <> p_client_id
      and ((v_bid <> '' and c.country = v_country and c.business_id = v_bid)
        or lower(app.clean_client_name(c.name)) = lower(v_name))
  ) then
    raise exception 'Такой клиент уже есть.' using errcode = '23505';
  end if;

  update public.companies
  set name = v_name, country = v_country, business_id = v_bid, contact_email = v_email, auto_invoice = v_auto
  where id = p_client_id and client_of = v_me;
end;
$$;

revoke all on function public.carrier_update_client(uuid, text, text, text, text, boolean) from public, anon;
grant execute on function public.carrier_update_client(uuid, text, text, text, text, boolean) to authenticated;


-- ── Существующие свои клиенты ──────────────────────────────────────

/*
 * Свой клиент, которому RAHTIS уже выставил хотя бы один счёт за
 * перевозки от имени его перевозчика (с 17.11.2026), продолжает их
 * получать: отметка ставится сразу, перевозчик может снять её в
 * справочнике клиентов. Черновики без номера (сорвавшийся запуск) не в
 * счёт. Остальным своим клиентам счета не уходят, пока перевозчик не
 * включит отметку.
 */
update public.companies c
set auto_invoice = true
where c.client_of is not null
  and exists (
    select 1 from public.carrier_invoices i
    where i.kind = 'FREIGHT'
      and i.customer_company_id = c.id
      and i.company_id = c.client_of
      and i.number not like 'DRAFT-%'
  );

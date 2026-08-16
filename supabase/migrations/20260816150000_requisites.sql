-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · Этап 2 · реквизиты и активация компании
--
-- Шаг APPROVED → ACTIVE из ТЗ §3. Состав реквизитов разный у двух сторон,
-- потому что и потоки денег разные: заказчику мы выставляем счёт,
-- перевозчику платим.
-- ═══════════════════════════════════════════════════════════════════

-- ── Проверка IBAN ──────────────────────────────────────────────────

/*
 * Полная проверка с контрольной суммой mod-97, а не только формат.
 * Опечатка в IBAN означает неушедшую выплату перевозчику, и ловить её
 * нужно при вводе, а не в банковской выписке через неделю.
 *
 * Проверка живёт в базе, а не только в форме: тогда неверный IBAN не
 * пройдёт никаким путём — ни через интерфейс, ни через Admin API,
 * ни при ручной правке.
 *
 * IMMUTABLE обязательно: без этого функцию нельзя использовать
 * в ограничении CHECK.
 */
create or replace function app.is_valid_iban(p_iban text)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_clean text;
  v_moved text;
  v_digits text := '';
  v_char text;
  v_remainder integer := 0;
  i integer;
begin
  if p_iban is null then
    return true;
  end if;

  v_clean := upper(regexp_replace(p_iban, '\s', '', 'g'));

  if v_clean !~ '^[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}$' then
    return false;
  end if;

  /* Первые четыре символа переносятся в конец. */
  v_moved := substring(v_clean from 5) || substring(v_clean from 1 for 4);

  /* Буквы заменяются числами: A = 10, B = 11, … Z = 35. */
  for i in 1..length(v_moved) loop
    v_char := substring(v_moved from i for 1);
    if v_char ~ '[0-9]' then
      v_digits := v_digits || v_char;
    else
      v_digits := v_digits || (ascii(v_char) - 55)::text;
    end if;
  end loop;

  /*
   * Получившееся число длиннее любого целого типа, поэтому остаток
   * считается посимвольно — по схеме Горнера.
   */
  for i in 1..length(v_digits) loop
    v_remainder := (v_remainder * 10 + substring(v_digits from i for 1)::integer) % 97;
  end loop;

  return v_remainder = 1;
end;
$$;

comment on function app.is_valid_iban(text) is
  'Проверка IBAN по контрольной сумме mod-97 (ISO 13616). NULL считается допустимым.';


-- ── Реквизиты ──────────────────────────────────────────────────────

alter table public.companies
  /* Общие: нужны обеим сторонам. */
  add column legal_name text,
  add column legal_street text,
  add column legal_postal_code text,
  add column legal_city text,
  add column legal_country char(2) default 'FI',
  add column vat_number text,

  /* Заказчик: мы выставляем ему счёт. */
  add column billing_street text,
  add column billing_postal_code text,
  add column billing_city text,
  add column billing_country char(2),
  add column billing_email text,
  add column billing_reference text,

  /*
   * Электронное счёт-фактурирование. В Финляндии обязательно для
   * госсектора и распространено в B2B, поэтому колонки заводятся сразу,
   * хотя заполнение пока необязательно.
   *
   * OVT-tunnus — адрес получателя электронных счетов, у финских компаний
   * это 0037 + Y-tunnus без дефиса + необязательный суффикс.
   * Оператор (välittäjätunnus) — код посредника, через которого счёт идёт.
   */
  add column einvoice_ovt text,
  add column einvoice_operator text,

  /* Перевозчик: мы платим ему. */
  add column iban text,
  add column bic text;

comment on column public.companies.billing_street is
  'Пустой адрес для счетов означает, что он совпадает с юридическим.';

comment on column public.companies.iban is
  'Счёт для выплат. Проверяется контрольной суммой, см. app.is_valid_iban.';


-- ── Ограничения ────────────────────────────────────────────────────

alter table public.companies
  /*
   * Формат номера НДС проверяется, а вот соответствие Y-tunnus — нет.
   * У финской компании ALV-номер обычно выводится из Y-tunnus, но при
   * групповой регистрации дочерняя компания использует номер группы,
   * и жёсткая проверка заблокировала бы законную компанию. Форма
   * подставляет выведенный номер подсказкой — этого достаточно.
   */
  add constraint companies_vat_format
    check (vat_number is null or vat_number ~ '^[A-Z]{2}[A-Z0-9]{2,12}$'),

  add constraint companies_iban_valid
    check (app.is_valid_iban(iban)),

  add constraint companies_bic_format
    check (bic is null or bic ~ '^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$'),

  add constraint companies_legal_postal_format
    check (legal_postal_code is null or legal_postal_code ~ '^[0-9A-Za-z -]{3,10}$'),

  add constraint companies_billing_postal_format
    check (billing_postal_code is null or billing_postal_code ~ '^[0-9A-Za-z -]{3,10}$'),

  add constraint companies_legal_country_format
    check (legal_country is null or legal_country ~ '^[A-Z]{2}$'),

  add constraint companies_billing_country_format
    check (billing_country is null or billing_country ~ '^[A-Z]{2}$'),

  add constraint companies_billing_email_normalised
    check (
      billing_email is null
      or (billing_email = lower(billing_email) and position('@' in billing_email) > 1)
    ),

  add constraint companies_einvoice_ovt_format
    check (einvoice_ovt is null or einvoice_ovt ~ '^[0-9A-Za-z]{8,17}$'),

  add constraint companies_einvoice_operator_format
    check (einvoice_operator is null or einvoice_operator ~ '^[0-9A-Za-z-]{4,20}$'),

  /*
   * Главный инвариант: активная компания имеет полные реквизиты.
   *
   * Это ограничение, а не проверка в коде, потому что «активна» означает
   * «ей можно выставить счёт» или «ей можно заплатить». Компания без
   * реквизитов в таком состоянии оказаться не должна ни одним путём.
   */
  add constraint companies_active_requires_requisites check (
    status <> 'ACTIVE'
    or (
      legal_name is not null
      and legal_street is not null
      and legal_postal_code is not null
      and legal_city is not null
      and legal_country is not null
      and vat_number is not null
      and (kind <> 'SHIPPER' or billing_email is not null)
      and (kind <> 'CARRIER' or iban is not null)
    )
  );


-- ── Права ──────────────────────────────────────────────────────────

/*
 * Реквизиты компания правит сама. Статуса в списке по-прежнему нет:
 * активацию выполняет функция ниже.
 */
grant update (
  name,
  contact_email,
  legal_name,
  legal_street,
  legal_postal_code,
  legal_city,
  legal_country,
  vat_number,
  billing_street,
  billing_postal_code,
  billing_city,
  billing_country,
  billing_email,
  billing_reference,
  einvoice_ovt,
  einvoice_operator,
  iban,
  bic
) on public.companies to authenticated;


-- ── Активация ──────────────────────────────────────────────────────

/*
 * Перевод APPROVED → ACTIVE.
 *
 * Ограничение выше уже не даст активировать компанию с неполными
 * реквизитами, но нарушение CHECK доходит до пользователя невнятным
 * сообщением про имя ограничения. Функция проверяет то же самое заранее
 * и говорит по-человечески; ограничение остаётся страховкой.
 */
create or replace function public.activate_company(p_company_id uuid)
returns public.companies
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_company public.companies;
begin
  if p_company_id is distinct from (select app.current_company_id()) then
    raise exception 'Активировать можно только свою компанию.' using errcode = '42501';
  end if;

  select * into v_company from public.companies where id = p_company_id for update;

  if v_company.id is null then
    raise exception 'Компания не найдена.' using errcode = 'P0002';
  end if;

  /* Повторный вызов безвреден: форму можно отправить дважды. */
  if v_company.status = 'ACTIVE' then
    return v_company;
  end if;

  if v_company.status <> 'APPROVED' then
    raise exception 'Активация возможна только после одобрения. Текущий статус: %.',
      v_company.status using errcode = '55000';
  end if;

  if v_company.legal_name is null
     or v_company.legal_street is null
     or v_company.legal_postal_code is null
     or v_company.legal_city is null
     or v_company.legal_country is null
     or v_company.vat_number is null
     or (v_company.kind = 'SHIPPER' and v_company.billing_email is null)
     or (v_company.kind = 'CARRIER' and v_company.iban is null)
  then
    raise exception 'Заполнены не все обязательные реквизиты.' using errcode = '23514';
  end if;

  update public.companies
  set status = 'ACTIVE',
      activated_at = now()
  where id = p_company_id
  returning * into v_company;

  return v_company;
end;
$$;

comment on function public.activate_company(uuid) is
  'Активирует свою компанию после заполнения реквизитов. Права проверяет внутри себя.';

revoke all on function public.activate_company(uuid) from public, anon;
grant execute on function public.activate_company(uuid) to authenticated, service_role;

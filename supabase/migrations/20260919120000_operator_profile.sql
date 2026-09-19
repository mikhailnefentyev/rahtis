-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · реквизиты оператора
--
-- Счёт заказчику выставляет Aivomaa Oy — под маркой RAHTIS, но от
-- юридического лица: имя, Y-tunnus, ALV-номер, адрес, банковский счёт.
-- До сих пор из этого набора в документах были только имя и Y-tunnus
-- (константы в config.ts), а адрес и IBAN жили лишь в тестовой карточке
-- перевозчика «Aivomaa Oy» — то есть там, где им не место: эту карточку
-- можно удалить или заморозить, и счёт остался бы без реквизитов.
--
-- Теперь у оператора своя строка. Одна: оператор у платформы один, и
-- ограничение на уровне ключа не даёт завести второго.
--
-- Читать могут все вошедшие: это то, что и так печатается на каждом
-- счёте. Менять — только оператор, функцией, с записью в аудит.
-- ═══════════════════════════════════════════════════════════════════

create table public.operator_profile (
  singleton boolean primary key default true check (singleton),

  brand text not null default 'RAHTIS',
  legal_name text not null,
  business_id text not null,
  vat_number text,

  street text not null,
  postal_code text not null,
  city text not null,
  country char(2) not null default 'FI',

  email text not null,
  phone text,
  website text,

  iban text,
  bic text,
  bank_name text,

  einvoice_ovt text,
  einvoice_operator text,

  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null,

  constraint operator_business_id_shape check (business_id ~ '^[0-9]{7}-[0-9]$'),
  constraint operator_iban_valid check (iban is null or app.is_valid_iban(iban)),
  constraint operator_email_shape check (email ~ '^[^@[:space:]]+@[^@[:space:]]+$')
);

comment on table public.operator_profile is
  'Реквизиты оператора (Aivomaa Oy) для счетов, сводок и писем. Ровно одна строка.';

alter table public.operator_profile enable row level security;
revoke all on public.operator_profile from anon, authenticated;
grant select on public.operator_profile to authenticated;
grant select, update on public.operator_profile to service_role;

create policy operator_profile_read
  on public.operator_profile for select to authenticated using (true);

/*
 * Начальные значения — из действующих данных Aivomaa Oy: Y-tunnus и имя
 * из config.ts, адрес, ALV-номер и счёт — из её карточки в реестре
 * компаний платформы.
 */
insert into public.operator_profile (
  legal_name, business_id, vat_number, street, postal_code, city, country,
  email, website, iban, bic, bank_name
)
values (
  'Aivomaa Oy', '3592993-6', 'FI35929936', 'Kankarepolku 5F B335', '00770', 'Helsinki', 'FI',
  'admin@rahtis.eu', 'https://www.rahtis.eu', 'FI5918383000011023', 'NDEAFIHH', 'Nordea'
);


create or replace function public.update_operator_profile(p jsonb)
returns public.operator_profile
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.operator_profile;
  v_clean text;
begin
  if not (select app.is_admin()) then
    raise exception 'Реквизиты оператора меняет только оператор.' using errcode = '42501';
  end if;

  v_clean := upper(regexp_replace(coalesce(p->>'iban', ''), '\s', '', 'g'));

  update public.operator_profile
  set legal_name = btrim(p->>'legal_name'),
      business_id = btrim(p->>'business_id'),
      vat_number = nullif(upper(btrim(coalesce(p->>'vat_number', ''))), ''),
      street = btrim(p->>'street'),
      postal_code = btrim(p->>'postal_code'),
      city = btrim(p->>'city'),
      country = upper(btrim(coalesce(p->>'country', 'FI'))),
      email = lower(btrim(p->>'email')),
      phone = nullif(btrim(coalesce(p->>'phone', '')), ''),
      website = nullif(btrim(coalesce(p->>'website', '')), ''),
      iban = nullif(v_clean, ''),
      bic = nullif(upper(btrim(coalesce(p->>'bic', ''))), ''),
      bank_name = nullif(btrim(coalesce(p->>'bank_name', '')), ''),
      einvoice_ovt = nullif(btrim(coalesce(p->>'einvoice_ovt', '')), ''),
      einvoice_operator = nullif(btrim(coalesce(p->>'einvoice_operator', '')), ''),
      updated_at = now(),
      updated_by = (select auth.uid())
  where singleton
  returning * into v_row;

  perform app.audit('operator.profile', 'operator', to_jsonb(v_row) - 'updated_by');

  return v_row;
end;
$$;

revoke all on function public.update_operator_profile(jsonb) from public, anon;
grant execute on function public.update_operator_profile(jsonb) to authenticated, service_role;

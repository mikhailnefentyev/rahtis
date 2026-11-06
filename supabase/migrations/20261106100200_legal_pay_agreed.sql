-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · документы: договорённость с водителем «на руки» (6.11.2026)
--
-- Под поведение 20261106100100_pay_agreed_fields: модели «на руки» за
-- день, месяц, рейс и сравнение с законной схемой. TERMS — новый пункт в
-- конце раздела 3. Черновик, активация — решение пользователя.
-- ═══════════════════════════════════════════════════════════════════

create or replace function pg_temp.draft_of(p_kind public.legal_kind)
returns uuid
language plpgsql
as $$
declare
  v_active uuid := public.active_legal_document(p_kind);
  v_draft uuid;
begin
  select d.id into v_draft
  from public.legal_documents d
  where d.kind = p_kind and d.status = 'DRAFT'
    and d.version > coalesce((select version from public.legal_documents where id = v_active), 0)
  order by d.version desc
  limit 1;

  if v_draft is null then
    insert into public.legal_documents (kind, version, status, effective_from)
    values (p_kind, (select coalesce(max(version), 0) + 1 from public.legal_documents where kind = p_kind), 'DRAFT', current_date)
    returning id into v_draft;

    insert into public.legal_clauses (document_id, locale, path, title, body)
    select v_draft, c.locale, c.path, c.title, c.body
    from public.legal_clauses c where c.document_id = v_active;
  end if;

  return v_draft;
end;
$$;

create or replace function pg_temp.append(p_doc uuid, p_section integer, p_marker text, p_fi text, p_en text)
returns void
language plpgsql
as $$
declare
  v_no integer;
begin
  if exists (
    select 1 from public.legal_clauses
    where document_id = p_doc and locale = 'fi' and path[1] = p_section and position(p_marker in body) = 1
  ) then
    return;
  end if;

  select coalesce(max(path[2]), 0) + 1 into v_no
  from public.legal_clauses
  where document_id = p_doc and path[1] = p_section and array_length(path, 1) = 2;

  insert into public.legal_clauses (document_id, locale, path, title, body)
  values
    (p_doc, 'fi', array[p_section, v_no], null, p_fi),
    (p_doc, 'en', array[p_section, v_no], null, p_en);
end;
$$;

do $$
begin
  perform pg_temp.append(pg_temp.draft_of('TERMS'), 3, 'Sovittu nettopalkka:',
    'Sovittu nettopalkka: kuljetusliike voi kirjata kuljettajan kanssa sovitun palkan nettomääränä päivältä, kuukaudelta tai matkalta. Palvelu laskee, mitä kuljettajalle kuuluu sopimuksen mukaan, ja vertaa sitä lainmukaiseen rakenteeseen: vähintään vähimmäispalkan suuruinen peruspalkka, päivärahat verovapaissa rajoissa sekä se osa, joka on maksettava verollisena palkkana, ja tämän osan arvioitu kustannus työnantajalle. Laskelma on suuntaa-antava ja perustuu maakohtaisiin keskimääräisiin kertoimiin ilman henkilökohtaisia vähennyksiä. Palvelu ei tarjoa keinoja palkan osien maksamiseen palkanlaskennan ulkopuolella, eikä tällaisia maksuja kirjata palveluun.',
    'Agreed net pay: the carrier may record the pay agreed with the driver as a net amount per day, per month or per trip. The service calculates what the driver is owed under the agreement and compares it with a lawful structure: a base wage of at least the minimum wage, per diems within the tax-free limits, and the part that has to be paid as taxable wage, together with an estimate of what that part costs the employer. The calculation is indicative and based on average country factors without personal deductions. The service does not provide ways to pay parts of the wage outside payroll, and such payments are not recorded in the service.');
end;
$$;

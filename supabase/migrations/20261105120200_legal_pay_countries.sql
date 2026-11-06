-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · документы: оплата и суточные водителей по странам (5.11.2026)
--
-- Под поведение 20261105120000_pay_countries: шаблоны оплаты и суточных
-- Польши, Эстонии, Латвии, Литвы и Северных стран, страна рабочего дня
-- водителя. TERMS — новый пункт в конце раздела 3 (водители и
-- калькулятор): всё справочно, рискованные схемы помечены. PRIVACY —
-- новый пункт в конце раздела 2: страна дня, ночёвка и питание водителя
-- обрабатываются для справочного расчёта суточных. Черновики, активация —
-- решение пользователя.
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
  perform pg_temp.append(pg_temp.draft_of('TERMS'), 3, 'Maakohtaiset palkka- ja päivärahamallit:',
    'Maakohtaiset palkka- ja päivärahamallit: palvelussa on kuljettajan palkan ja päivärahojen malleja Suomen lisäksi Puolaan, Viroon, Latviaan, Liettuaan ja Pohjoismaihin. Mallit perustuvat kunkin maan säädöksiin ja viranomaisten ohjeisiin, ja niiden lähteet näytetään mallin yhteydessä. Kuljetusliike kopioi mallin itselleen ja muuttaa sitä tarpeen mukaan. Laskelmat ovat suuntaa-antavia: lopullisen palkan, päivärahojen, verojen ja maksujen laskemisesta vastaa työnantaja. Palvelussa on myös käytännössä yleisiä malleja, jotka eivät kaikissa tilanteissa täytä lain vaatimuksia, kuten pelkkä kilometri- tai rahtiprosenttipalkka tai verovapaiksi merkityt "päivärahat" lain rajojen yli; ne on merkitty varoituksella, eikä niiden käyttö ole suositus. Kabotaasissa ja kolmasmaaliikenteessä noudatetaan lisäksi lähetettyjä kuljettajia koskevia sääntöjä (direktiivi (EU) 2020/1057).',
    'Country pay and per diem templates: in addition to Finland, the service offers driver pay and per diem templates for Poland, Estonia, Latvia, Lithuania and the Nordic countries. The templates are based on each country''s legislation and the guidance of its authorities, and their sources are shown with the template. The carrier copies a template for itself and adjusts it as needed. The calculations are indicative: the employer is responsible for calculating the final pay, per diems, taxes and contributions. The service also includes templates that are common in practice but do not meet legal requirements in every situation, such as pay based only on kilometres or a percentage of freight, or "per diems" marked as tax-free above the statutory limits; they are marked with a warning, and their use is not a recommendation. For cabotage and cross-trade operations the rules on posted drivers also apply (Directive (EU) 2020/1057).');

  perform pg_temp.append(pg_temp.draft_of('PRIVACY'), 2, 'Työpäivän maa:',
    'Työpäivän maa: päivärahojen ja palkan suuntaa-antavaa laskentaa varten palvelu päättelee kuljettajan kunkin työpäivän maan niistä kuljetuksen pisteistä, jotka kuljettaja on merkinnyt tehdyiksi. Kuljetusliike voi korjata maan sekä merkitä yöpymistavan (koti, ohjaamo, hotelli tai työnantajan järjestämä majoitus) ja työnantajan tarjoamat ateriat. Tietoja käsittelee kuljetusliike työnantajana; Aivomaa Oy toimii sen henkilötietojen käsittelijänä. Tiedot säilytetään kuten kuljettajan työaikatiedot.',
    'Country of the working day: for the indicative calculation of per diems and pay, the service infers the country of each of the driver''s working days from the stops of the transport that the driver has marked as done. The carrier may correct the country and record the type of overnight stay (home, cab, hotel or accommodation provided by the employer) and the meals provided by the employer. The carrier processes the data as the employer; Aivomaa Oy acts as its processor. The data is retained like the driver''s working time data.');
end;
$$;

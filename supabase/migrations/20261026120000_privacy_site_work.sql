-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · политика: работа на объекте (26.10.2026)
--
-- Под поведение 20261026110000_site_work: прибытие водителя на объект,
-- рейсы с весами, документ на перевозку, подтверждение дня прорабом по
-- ссылке. PRIVACY — новый черновик: 2.16 (что хранится), 5.1 (кто видит:
-- прораб по ссылке), 8.4 (сроки: документы на перевозку — шесть лет, как
-- требует jätelaki 121 §). Активация — решение пользователя.
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
    and d.version > (select version from public.legal_documents where id = v_active)
  order by d.version desc
  limit 1;

  if v_draft is null then
    insert into public.legal_documents (kind, version, status, effective_from)
    values (p_kind, (select max(version) + 1 from public.legal_documents where kind = p_kind), 'DRAFT', current_date)
    returning id into v_draft;

    insert into public.legal_clauses (document_id, locale, path, title, body)
    select v_draft, c.locale, c.path, c.title, c.body
    from public.legal_clauses c where c.document_id = v_active;
  end if;

  return v_draft;
end;
$$;

create or replace function pg_temp.swap(p_doc uuid, p_path integer[], p_locale text, p_from text, p_to text)
returns void
language plpgsql
as $$
begin
  update public.legal_clauses
  set body = replace(body, p_from, p_to)
  where document_id = p_doc and path = p_path and locale = p_locale and position(p_from in body) > 0;
  if not found then
    raise exception 'Пункт % (%): фрагмент не найден: %', array_to_string(p_path, '.'), p_locale, left(p_from, 60);
  end if;
end;
$$;

do $$
declare
  v_doc uuid := pg_temp.draft_of('PRIVACY');
begin
  delete from public.legal_clauses where document_id = v_doc and path = array[2, 16];

  insert into public.legal_clauses (document_id, locale, path, title, body)
  values
    (v_doc, 'fi', array[2, 16], null,
     'Työmaakuljetukset: kun kuljetusliike lisää palveluun asiakkaansa työmaan, siitä tallennetaan työmaan nimi ja osoite, asiakkaan nimi sekä kuljetusliikkeen antamat Y-tunnus ja sähköpostiosoite, hinnoittelu ja oletuskuorma. Kuljettajan sovelluksessa tallennetaan saapuminen työmaalle, käytetty auto ja perävaunu, kuormat (kuorman laji jäteluettelon mukaan, vaaka tai vastaanottopaikka, brutto-, tara- ja nettomassa, punnituslipun numero ja purkuaika) sekä päivän päättyminen. Näistä muodostetaan työtunnit, jätelain 121 §:n mukainen siirtoasiakirja ja kuljetusliikkeen raportti. Työnjohtaja voi hyväksyä päivän kuljetusliikkeen hänelle antaman linkin kautta; tällöin tallennetaan hänen ilmoittamansa nimi, hyväksymisaika ja mahdollinen huomautus. Kuljettaja voi lisätä vastaanottopaikan, jolloin tallennetaan paikan nimi ja sijainti; tieto ei koske henkilöä.'),
    (v_doc, 'en', array[2, 16], null,
     'Worksite haulage: when a carrier adds its customer''s worksite to the service, the name and address of the site, the customer''s name and the business ID and email address given by the carrier, the pricing and the default load are stored. In the driver app, the arrival at the site, the vehicle and trailer used, the loads (type of load according to the list of wastes, scale or receiving site, gross, tare and net weight, weighing ticket number and unloading time) and the end of the day are stored. From these, the working hours, the waste transfer document under section 121 of the Waste Act and the carrier''s report are formed. The site manager may approve a day through a link the carrier has given them; the name they enter, the time of approval and any note are then stored. A driver may add a receiving site, in which case its name and location are stored; this information does not concern a person.');

  perform pg_temp.swap(v_doc, array[8, 4], 'fi',
    'Määräajan umpeuduttua tiedot poistetaan automaattisesti;',
    'Kohdan 2.16 siirtoasiakirjat ja niiden perustana olevat kuormatiedot säilytetään kuusi vuotta siirron vuoden päättymisestä, kuten jätelaki edellyttää; työmaan tunnit ja hyväksynnät säilytetään kuten tilaukset. Määräajan umpeuduttua tiedot poistetaan automaattisesti;');
  perform pg_temp.swap(v_doc, array[8, 4], 'en',
    'When the period ends, the data is deleted automatically;',
    'The waste transfer documents of section 2.16 and the load data they are based on are retained for six years from the end of the year of the transfer, as the Waste Act requires; worksite hours and approvals are retained like orders. When the period ends, the data is deleted automatically;');
end;
$$;

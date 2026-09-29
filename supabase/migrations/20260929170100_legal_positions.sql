-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · документы: точки местоположения водителя
--
-- PRIVACY 2.4 и 7.1 описывали одну точку — отметку «пройдена». На деле
-- приложение водителя записывает ещё место прибытия, место каждого
-- снимка и место начала и конца смены. Тексты приведены к поведению:
-- какие точки, когда, кто видит (заказчик — точки своего рейса, в
-- кабинете и через API; перевозчик — смены своих водителей).
--
-- PRIVACY 8.4 — все точки хранятся 24 месяца (20260929170000).
--
-- Основание передачи точек заказчику — правовой выбор, маркер юриста.
-- Черновик; активация — решение пользователя.
-- ═══════════════════════════════════════════════════════════════════

create or replace function pg_temp.draft_of(p_kind public.legal_kind)
returns uuid
language plpgsql
as $$
declare
  v_active uuid := public.active_legal_document(p_kind);
  v_draft uuid;
begin
  if v_active is null then
    raise exception 'Нет действующей редакции %.', p_kind using errcode = '55007';
  end if;

  select d.id into v_draft
  from public.legal_documents d
  where d.kind = p_kind and d.status = 'DRAFT'
    and d.version > (select version from public.legal_documents where id = v_active)
  order by d.version desc
  limit 1;

  if v_draft is null then
    insert into public.legal_documents (kind, version, status, effective_from)
    values (p_kind, (select max(version) + 1 from public.legal_documents where kind = p_kind),
            'DRAFT', current_date)
    returning id into v_draft;

    insert into public.legal_clauses (document_id, locale, path, title, body)
    select v_draft, c.locale, c.path, c.title, c.body
    from public.legal_clauses c where c.document_id = v_active;
  end if;

  return v_draft;
end;
$$;

create or replace function pg_temp.put(p_doc uuid, p_path integer[], p_fi text, p_en text)
returns void
language sql
as $$
  insert into public.legal_clauses (document_id, locale, path, body)
  values (p_doc, 'fi', p_path, p_fi), (p_doc, 'en', p_path, p_en)
  on conflict (document_id, locale, path) do update set body = excluded.body;
$$;

do $$
declare
  v_privacy uuid := pg_temp.draft_of('PRIVACY');
begin
  perform pg_temp.put(v_privacy, array[2, 4],
    'Kuljettajan sijaintipisteet: kun kuljettaja saapuu pisteeseen, ottaa kuormaus-, purku-, vaurio- tai rahtikirjakuvan tai merkitsee pisteen ohitetuksi, selain voi antaa laitteen sijainnin. Kustakin hetkestä tallennetaan yksi piste; ohituksen kuittauksesta myös sen tarkkuus metreinä. Samoin tallennetaan yksi piste työvuoron alkaessa ja päättyessä. Kyse ei ole jatkuvasta seurannasta: sijaintia ei kysytä eikä tallenneta muulloin, ja jos selain ei anna sijaintia, toiminto tehdään ilman koordinaattia. Saapumisen, kuvien ja kuittauksen sijainnit näkyvät kyseisen tilauksen tilaajalle palvelussa ja rajapinnan kautta sekä ylläpitäjälle; niillä osoitetaan, missä ja milloin työ tehtiin, esimerkiksi odotusajan tai vaurion selvittämiseksi. Työvuoron sijainnit näkyvät kuljettajalle itselleen, hänen kuljetusliikkeelleen ja ylläpitäjälle. Kuittauksen sijainnista ja seuraavan pisteen osoitteesta lasketaan reititystoimittajan (kohta 5.2) avulla arvioitu saapumisaika seuraavalle pisteelle liikennetilanne huomioiden; arvio näkyy tilaajalle, kuljetusliikkeelle ja ylläpitäjälle. [Kohta täydennetään juristin kanssa: käsittelyperuste sijaintipisteiden luovuttamiselle tilaajalle.]',
    'Driver position points: when the driver arrives at a stop, takes a loading, unloading, damage or consignment note photo, or marks a stop as passed, the browser may provide the device''s location. One point is stored for each such moment; for the stop confirmation its accuracy in metres is stored as well. Likewise, one point is stored when a work shift starts and when it ends. This is not continuous tracking: the location is neither requested nor stored at any other time, and if the browser does not provide it, the action is carried out without coordinates. The arrival, photo and confirmation positions are visible to the shipper of that order in the service and through the interface, and to the operator; they show where and when the work was done, for example to settle waiting time or damage. Shift positions are visible to the driver, the driver''s carrier and the operator. From the confirmation position and the address of the next stop, an estimated time of arrival at the next stop is calculated with the routing supplier (section 5.2), taking traffic into account; the estimate is visible to the shipper, the carrier and the operator. [This clause is to be completed with counsel: the legal basis for disclosing position points to the shipper.]');

  perform pg_temp.put(v_privacy, array[7, 1],
    'Palvelu käyttää reittipisteiden koordinaatteja ja tilauksen tapahtumia. Laitteen sijainti kysytään vain kohdassa 2.4 luetelluissa hetkissä — saapuminen pisteeseen, kuvan ottaminen, pisteen ohittaminen sekä työvuoron alku ja loppu — ja kustakin tallennetaan yksi piste. Sijainnin antaminen ratkaistaan selaimen luvalla; kieltäytyminen ei estä toimintoa eikä työn suorittamista.',
    'The service uses the coordinates of route stops and the events of an order. The device''s location is requested only at the moments listed in section 2.4 — arriving at a stop, taking a photo, passing a stop, and the start and end of a work shift — and one point is stored for each. Providing the location is decided by the browser''s permission; refusing it prevents neither the action nor performing the work.');

  perform pg_temp.put(v_privacy, array[8, 4],
    'Säilytysajat tietoryhmittäin: tilaukset, laskut, tilitykset ja rahtikirjat (CMR) säilytetään kuusi vuotta sen kalenterivuoden päättymisestä, jona keikka päättyi. Kohdan 2.4 sijaintipisteet sekä kuormaus-, purku- ja vauriokuvat säilytetään 24 kuukautta keikan tai työvuoron päättymisestä; pidempään säilytettävästä rahtikirjasta poistetaan tällöin kuvauspaikka. Kuljettajasovelluksen tapahtumat, avustajan keskustelut ja tukipyynnöt säilytetään 24 kuukautta. Palvelun ilmoitukset ja lähetettyjen sähköpostien loki säilytetään 12 kuukautta. Määräajan umpeuduttua tiedot poistetaan automaattisesti; kirjanpidon edellyttämät tilaus- ja laskutiedot poistetaan tai anonymisoidaan säilytysajan päätyttyä. Jos keikasta on vireillä reklamaatio tai muu vaatimus, sen tietoja säilytetään kohdan 8.5 mukaisesti.',
    'Retention periods by category: orders, invoices, settlements and consignment notes (CMR) are retained for six years from the end of the calendar year in which the job ended. The position points of section 2.4 and loading, unloading and damage photos are retained for 24 months from the end of the job or shift; the place of capture is then removed from a consignment note that is kept longer. Driver app events, assistant conversations and support requests are retained for 24 months. Service notifications and the log of sent emails are retained for 12 months. When the period ends, the data is deleted automatically; order and invoice data required for bookkeeping is deleted or anonymised at the end of its retention period. If a claim or other demand concerning a job is pending, its data is retained as set out in section 8.5.');

  raise notice 'Черновик PRIVACY v%', (select version from public.legal_documents where id = v_privacy);
end;
$$;

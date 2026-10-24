-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · политика: аналитика витрины по согласию
--
-- 24.10.2026 на открытых страницах (главная, блог, заявка, условия,
-- политика, описание API) появилась аналитика HeyCatch. Она молчит,
-- пока посетитель не нажал «Разрешить»; из кабинетов, приложения
-- водителя и ссылок отслеживания события не уходят никогда; из адресов
-- вырезается строка запроса (код приглашения).
--
-- PRIVACY — новый черновик: 2.6 больше не обещает «никакой аналитики»,
-- новый 2.15 описывает аналитику, 6.2 — передача за ЕЭЗ, 8.4 — срок.
-- Активация — решение пользователя.
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
  perform pg_temp.swap(v_doc, array[2, 6], 'fi',
    'Palvelu ei käytä analytiikka- tai markkinointievästeitä: tunnistautumattomalle kävijälle ei aseteta yhtään evästettä,',
    'Palvelu ei käytä markkinointievästeitä. Sivuston analytiikka on käytössä vain kävijän suostumuksella kohdan 2.15 mukaisesti; ilman suostumusta tunnistautumattomalle kävijälle ei aseteta yhtään evästettä eikä selaimeen tallenneta tunnistetta,');
  perform pg_temp.swap(v_doc, array[2, 6], 'en',
    'The service uses no analytics or marketing cookies: a visitor who is not signed in is given no cookie at all,',
    'The service uses no marketing cookies. Site analytics is used only with the visitor''s consent as described in section 2.15; without consent a visitor who is not signed in is given no cookie at all and no identifier is stored in the browser,');

  insert into public.legal_clauses (document_id, locale, path, title, body)
  values
    (v_doc, 'fi', array[2, 15], null,
     'Sivuston analytiikka: julkisilla sivuilla (etusivu, blogi, hakemus, käyttöehdot, tietosuojaseloste ja rajapinnan kuvaus) kerätään kävijän suostumuksella tietoja sivujen käytöstä HeyCatch-analytiikkapalvelulla: katsotut sivut, klikkaukset ja lomakkeen lähetys, saapumislähde (esimerkiksi kampanjalinkki), selaimen ja laitteen tyyppi, IP-osoitteesta päätelty likimääräinen sijainti sekä selaimeen tallennettava satunnainen tunniste. Hakemuksesta välitetään vain yrityksen tyyppi ja maa, ei nimeä, Y-tunnusta eikä sähköpostiosoitetta. Kirjautuneen palvelun sivuilta, kuljettajasovelluksesta ja seurantalinkeiltä tietoja ei kerätä, ja sivujen osoitteista poistetaan kyselyosa (esimerkiksi kutsulinkin tunniste). Ilman suostumusta analytiikka ei lähetä tietoja eikä tallenna selaimeen mitään. Suostumuksen voi perua milloin tahansa sivun alareunan linkistä Analytiikka-asetukset. Käsittely perustuu suostumukseen (kohta 4.4).'),
    (v_doc, 'en', array[2, 15], null,
     'Site analytics: on the public pages (front page, blog, application, terms of use, privacy notice and the interface description), data on the use of the pages is collected with the visitor''s consent using the HeyCatch analytics service: pages viewed, clicks and form submissions, the source of the visit (for example a campaign link), the type of browser and device, an approximate location derived from the IP address and a random identifier stored in the browser. From the application only the type of company and the country are passed on, not the name, business ID or email address. No data is collected from the signed-in service, the driver app or tracking links, and the query part (for example an invitation link identifier) is removed from page addresses. Without consent the analytics sends nothing and stores nothing in the browser. Consent can be withdrawn at any time through the Analytics settings link at the bottom of the page. The processing is based on consent (section 4.4).');

  perform pg_temp.swap(v_doc, array[6, 2], 'fi',
    'Näin on erityisesti avustajan kielimallissa sekä mahdollisessa etätuessa.',
    'Näin on erityisesti avustajan kielimallissa, kohdan 2.15 sivuston analytiikassa sekä mahdollisessa etätuessa.');
  perform pg_temp.swap(v_doc, array[6, 2], 'en',
    'That is so in particular for the assistant''s language model and for any remote support.',
    'That is so in particular for the assistant''s language model, the site analytics of section 2.15 and any remote support.');

  perform pg_temp.swap(v_doc, array[8, 4], 'fi',
    'kielletyksi merkitty osoite säilytetään niin kauan kuin kielto on voimassa.',
    'kielletyksi merkitty osoite säilytetään niin kauan kuin kielto on voimassa. Kohdan 2.15 analytiikkatiedot säilytetään enintään 24 kuukautta; selaimen tunniste vanhenee 12 kuukaudessa.');
  perform pg_temp.swap(v_doc, array[8, 4], 'en',
    'an address marked as refused is retained for as long as the refusal applies.',
    'an address marked as refused is retained for as long as the refusal applies. The analytics data of section 2.15 is retained for at most 24 months; the browser identifier expires after 12 months.');
end;
$$;

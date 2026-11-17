-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · условия: документы до публикации — у любого заказчика
-- (17.11.2026)
--
-- Под поведение 20261117120000_shipper_docs_gate_all. Черновики (если
-- черновика нет — копия действующей версии), активация — решение
-- пользователя.
--   TERMS, раздел 8:
--     · пункт «Huolitsijan asiakirjat:» → «Julkaisemisen edellyttämät
--       asiakirjat:» — для любого заказчика без подтверждения PRH;
--       полис: у экспедитора полис экспедитора, у грузовладельца полис
--       общей ответственности, пороги те же; отметка для перевозчика;
--     · ссылки на него в «Huolitsijan vastuuvakuutus:» и «Tilaajan
--       yritysasiakirjat:»;
--   SHIPPER_AGREEMENT, раздел 2, «Huolitsijana toimiva tilaaja:» —
--     ссылка и «vastuuvakuutus» вместо «huolitsijan vastuuvakuutus».
-- PRIVACY не меняется: полис компании — данные компании, обработка та
-- же, что у полиса экспедитора.
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

/* Пункт по метке в начале финского текста: номер «следующий свободный», заранее не известен. */
create or replace function pg_temp.path_of(p_doc uuid, p_section integer, p_markers text[])
returns integer[]
language plpgsql
as $$
declare
  v_path integer[];
begin
  select c.path into v_path
  from public.legal_clauses c
  where c.document_id = p_doc and c.locale = 'fi' and c.path[1] = p_section
    and cardinality(c.path) = 2
    and exists (select 1 from unnest(p_markers) m where position(m in c.body) = 1)
  order by c.path
  limit 1;

  if v_path is null then
    raise exception 'Раздел %: пункт «%» не найден', p_section, p_markers[1];
  end if;
  return v_path;
end;
$$;

/*
 * Замена фразы в пункте. Новая фраза уже стоит — ничего; нет ни старой,
 * ни новой — ошибка: текст пункта меняли, и править вслепую нельзя.
 */
create or replace function pg_temp.swap(p_doc uuid, p_path integer[], p_locale text, p_from text, p_to text)
returns void
language plpgsql
as $$
begin
  if exists (
    select 1 from public.legal_clauses
    where document_id = p_doc and path = p_path and locale = p_locale and position(p_to in body) > 0
  ) then
    return;
  end if;

  update public.legal_clauses
  set body = replace(body, p_from, p_to)
  where document_id = p_doc and path = p_path and locale = p_locale and position(p_from in body) > 0;

  if not found then
    raise exception 'Пункт % (%): фрагмент не найден: %', array_to_string(p_path, '.'), p_locale, left(p_from, 60);
  end if;
end;
$$;


-- ── TERMS, раздел 8 ────────────────────────────────────────────────

do $$
declare
  v_doc uuid := pg_temp.draft_of('TERMS');
  v_gate integer[] := pg_temp.path_of(v_doc, 8, array['Huolitsijan asiakirjat:', 'Julkaisemisen edellyttämät asiakirjat:']);
  v_insurance integer[] := pg_temp.path_of(v_doc, 8, array['Huolitsijan vastuuvakuutus:']);
  v_company integer[] := pg_temp.path_of(v_doc, 8, array['Tilaajan yritysasiakirjat:']);
begin
  update public.legal_clauses set body =
    'Julkaisemisen edellyttämät asiakirjat: tämä kohta koskee tilaajaa, jonka yritystä ei ole voitu vahvistaa Patentti- ja rekisterihallituksen avoimista yritystiedoista sen omalla nimellä, kuten ulkomaista yritystä tai toiminimeä, riippumatta siitä, toimiiko tilaaja huolitsijana tai muuna kuljetusten välittäjänä vai kuljettaako se omia tavaroitaan. Tällainen tilaaja voi hyväksymisensä jälkeen käyttää palvelua, tutustua sen tietoihin ja tallentaa toimeksiantoja luonnoksina. Ennen kuin se voi julkaista toimeksiantoja, tarjota niitä ryhmälle ajoneuvoja, lähettää suoria tilauksia, valita tarjouksen, pyytää vapaata tilaa ajoneuvosta tai muuten antaa kuljetuksen kuljetusliikkeelle, myös rajapinnan tai sähköpostin kautta, sen on toimitettava palveluun (1) ote kaupparekisteristä tai sen maan vastaavasta virallisesta rekisteristä, jossa se on rekisteröity, kuten Handelsregisterauszug tai Gewerbeanmeldung, ja (2) vastuuvakuutuksen vakuutustodistus tai vakuutuskirja: huolitsijana tai muuna kuljetusten välittäjänä toimivalta tilaajalta huolitsijan vastuuvakuutus ja omia tavaroitaan kuljettavalta tilaajalta yrityksen toiminnan vastuuvakuutus. Vakuutuksen vastuumäärien on oltava vähintään 250 000 euroa vahinkotapahtumaa kohden ja vähintään 500 000 euroa vakuutuskautta kohden yhteensä, ja vakuutuksen on oltava voimassa vähintään Euroopan talousalueella ja Norjassa; muussa valuutassa ilmoitettu vastuumäärä muunnetaan euroiksi kohdassa Huolitsijan vastuuvakuutus kuvatulla tavalla. Aivomaa Oy tarkastaa asiakirjat ja voi hyväksyä tai hylätä ne sekä pyytää lisäselvitystä tai vahvistuksen asiakirjan antajalta. Julkaiseminen ja kuljetusten antaminen avautuvat, kun Aivomaa Oy on hyväksynyt molemmat asiakirjat. Otteen tarkastus on voimassa 12 kuukautta otteen antamispäivästä ja vakuutuksen tarkastus vakuutuksen voimassaolon ajan. Jos asiakirja vanhenee tai Aivomaa Oy hylkää sen, uusien toimeksiantojen julkaiseminen ja kuljetusten antaminen keskeytyvät, kunnes uusi asiakirja on hyväksytty. Keskeytys ei koske jo vahvistettuja kuljetuksia. Kun omia tavaroitaan kuljettavan tilaajan vastuuvakuutus on hyväksytty, kuljetusliike näkee toimeksiannon yhteydessä merkinnän, että tilaajan vastuuvakuutus on tarkastettu ja voimassa tiettyyn päivään asti. Merkintä on tieto eikä takuu vakuutuksen voimassaolosta, korvauksista eikä tilaajan maksukyvystä.'
  where document_id = v_doc and path = v_gate and locale = 'fi';

  update public.legal_clauses set body =
    'Documents required for publishing: this clause applies to a shipper whose company could not be confirmed under its own name from the open company data of the Finnish Patent and Registration Office, such as a foreign company or a sole trader, regardless of whether the shipper acts as a freight forwarder or other intermediary of transport or transports its own goods. After its approval, such a shipper may use the service, view its information and save jobs as drafts. Before it may publish jobs, offer them to a group of vehicles, send direct orders, select an offer, request free space in a vehicle or otherwise give a transport to a carrier, including through the interface or by e-mail, it must provide the service with (1) an extract from the trade register or the equivalent official register of the country in which it is registered, such as a Handelsregisterauszug or Gewerbeanmeldung, and (2) the insurance certificate or policy of its liability insurance: from a shipper acting as a freight forwarder or other intermediary of transport, its freight forwarder''s liability insurance, and from a shipper transporting its own goods, its general business liability insurance. The limits of indemnity of the insurance must be at least EUR 250,000 per occurrence and at least EUR 500,000 in the aggregate per insurance period, and the insurance must be valid at least in the European Economic Area and Norway; a limit stated in another currency is converted into euros as described in the clause on freight forwarder''s liability insurance. Aivomaa Oy checks the documents and may approve or reject them and request further information or confirmation from the issuer of a document. Publishing and giving transports become available once Aivomaa Oy has approved both documents. The check of the extract is valid for 12 months from the date of issue of the extract and the check of the insurance for as long as the insurance is valid. If a document expires or Aivomaa Oy rejects it, the publishing of new jobs and the giving of transports are suspended until a new document has been approved. A suspension does not affect transports already confirmed. Once the liability insurance of a shipper transporting its own goods has been approved, the carrier sees in connection with a job a note that the shipper''s liability insurance has been checked and is valid until a certain date. The note is information and not a guarantee of the validity of the insurance, of any indemnity or of the shipper''s ability to pay.'
  where document_id = v_doc and path = v_gate and locale = 'en';

  perform pg_temp.swap(v_doc, v_insurance, 'fi',
    'lukuun ottamatta kohdassa Huolitsijan asiakirjat tarkoitettua tilaajaa',
    'lukuun ottamatta kohdassa Julkaisemisen edellyttämät asiakirjat tarkoitettua tilaajaa');
  perform pg_temp.swap(v_doc, v_insurance, 'en',
    'except for a shipper referred to in the clause on freight forwarder''s documents',
    'except for a shipper referred to in the clause on documents required for publishing');

  perform pg_temp.swap(v_doc, v_company, 'fi',
    'kohdassa Huolitsijan asiakirjat tarkoitetun tilaajan',
    'kohdassa Julkaisemisen edellyttämät asiakirjat tarkoitetun tilaajan');
  perform pg_temp.swap(v_doc, v_company, 'en',
    'a shipper referred to in the clause on freight forwarder''s documents must',
    'a shipper referred to in the clause on documents required for publishing must');
end;
$$;


-- ── SHIPPER_AGREEMENT, раздел 2 ────────────────────────────────────

do $$
declare
  v_doc uuid := pg_temp.draft_of('SHIPPER_AGREEMENT');
  v_role integer[] := pg_temp.path_of(v_doc, 2, array['Huolitsijana toimiva tilaaja:']);
begin
  perform pg_temp.swap(v_doc, v_role, 'fi',
    'sekä huolitsijan vastuuvakuutus käyttöehtojen kohdan Huolitsijan asiakirjat mukaisesti',
    'sekä vastuuvakuutus käyttöehtojen kohdan Julkaisemisen edellyttämät asiakirjat mukaisesti; tämä koskee myös omia tavaroitaan kuljettavaa tilaajaa');
  perform pg_temp.swap(v_doc, v_role, 'en',
    'and its freight forwarder''s liability insurance before publishing jobs or giving transports, in accordance with the clause on freight forwarder''s documents in the terms of use',
    'and its liability insurance before publishing jobs or giving transports, in accordance with the clause on documents required for publishing in the terms of use; this also applies to a shipper transporting its own goods');
end;
$$;

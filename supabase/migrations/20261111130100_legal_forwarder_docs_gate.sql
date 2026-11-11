-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · документы: экспедитор без подтверждения реестром (11.11.2026)
--
-- Под поведение 20261111130000_forwarder_docs_gate. Черновики (если
-- черновика нет — копия действующей версии), активация — решение
-- пользователя.
--   TERMS, раздел 8:
--     · новый пункт «Huolitsijan asiakirjat:» в конце раздела — кто,
--       какие документы, что до них закрыто, что не затрагивается;
--     · «Huolitsijan vastuuvakuutus:» и «Tilaajan yritysasiakirjat:» —
--       фраза «не условие пользования сервисом» с оговоркой про новый
--       пункт;
--   SHIPPER_AGREEMENT, раздел 2: «Huolitsijana toimiva tilaaja:» — та же
--     оговорка.
-- PRIVACY не меняется: выписка и полис уже описаны (документы заказчика,
-- полис экспедитора), новой обработки нет — по итогу той же проверки
-- открывается работа.
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

/* Пункт в конец раздела: следующий свободный номер; повторный прогон не плодит дублей. */
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

/*
 * Замена фразы в пункте, найденном по метке в начале финского текста
 * (номер у таких пунктов — «следующий свободный», заранее не известен).
 * Если новая фраза уже стоит — ничего не делает; если нет ни старой, ни
 * новой — ошибка: значит, текст пункта меняли, и править вслепую нельзя.
 */
create or replace function pg_temp.swap_marked(
  p_doc uuid, p_section integer, p_marker text,
  p_fi_from text, p_fi_to text, p_en_from text, p_en_to text
)
returns void
language plpgsql
as $$
declare
  v_path integer[];
  v_locale text;
  v_from text;
  v_to text;
begin
  select c.path into v_path
  from public.legal_clauses c
  where c.document_id = p_doc and c.locale = 'fi' and c.path[1] = p_section
    and cardinality(c.path) = 2 and position(p_marker in c.body) = 1
  order by c.path
  limit 1;

  if v_path is null then
    raise exception 'Раздел %: пункт «%» не найден', p_section, p_marker;
  end if;

  foreach v_locale in array array['fi', 'en'] loop
    if v_locale = 'fi' then
      v_from := p_fi_from;
      v_to := p_fi_to;
    else
      v_from := p_en_from;
      v_to := p_en_to;
    end if;

    if exists (
      select 1 from public.legal_clauses
      where document_id = p_doc and path = v_path and locale = v_locale and position(v_to in body) > 0
    ) then
      continue;
    end if;

    update public.legal_clauses
    set body = replace(body, v_from, v_to)
    where document_id = p_doc and path = v_path and locale = v_locale and position(v_from in body) > 0;

    if not found then
      raise exception 'Пункт % (%): фрагмент не найден: %', array_to_string(v_path, '.'), v_locale, left(v_from, 60);
    end if;
  end loop;
end;
$$;


-- ── TERMS, раздел 8 ────────────────────────────────────────────────

do $$
declare
  v_doc uuid := pg_temp.draft_of('TERMS');
begin
  perform pg_temp.append(v_doc, 8, 'Huolitsijan asiakirjat:',
    'Huolitsijan asiakirjat: tämä kohta koskee tilaajaa, joka toimii huolitsijana tai muuna kuljetusten välittäjänä ja jonka yritystä ei ole voitu vahvistaa Patentti- ja rekisterihallituksen avoimista yritystiedoista sen omalla nimellä, kuten ulkomaista yritystä tai toiminimeä. Tällainen tilaaja voi hyväksymisensä jälkeen käyttää palvelua, tutustua sen tietoihin ja tallentaa toimeksiantoja luonnoksina. Ennen kuin se voi julkaista toimeksiantoja, tarjota niitä ryhmälle ajoneuvoja, lähettää suoria tilauksia, valita tarjouksen, pyytää vapaata tilaa ajoneuvosta tai muuten antaa kuljetuksen kuljetusliikkeelle, myös rajapinnan tai sähköpostin kautta, sen on toimitettava palveluun (1) ote kaupparekisteristä tai sen maan vastaavasta virallisesta rekisteristä, jossa se on rekisteröity, kuten Handelsregisterauszug tai Gewerbeanmeldung, ja (2) huolitsijan vastuuvakuutuksen vakuutustodistus tai vakuutuskirja, jonka vastuumäärät ovat vähintään kohdassa Huolitsijan vastuuvakuutus mainitut. Aivomaa Oy tarkastaa asiakirjat ja voi hyväksyä tai hylätä ne sekä pyytää lisäselvitystä tai vahvistuksen asiakirjan antajalta. Julkaiseminen ja kuljetusten antaminen avautuvat, kun Aivomaa Oy on hyväksynyt molemmat asiakirjat. Otteen tarkastus on voimassa 12 kuukautta otteen antamispäivästä ja vakuutuksen tarkastus vakuutuksen voimassaolon ajan. Jos asiakirja vanhenee tai Aivomaa Oy hylkää sen, uusien toimeksiantojen julkaiseminen ja kuljetusten antaminen keskeytyvät, kunnes uusi asiakirja on hyväksytty. Keskeytys ei koske jo vahvistettuja kuljetuksia. Tätä kohtaa ei sovelleta tilaajaan, joka kuljettaa omia tavaroitaan.',
    'Freight forwarder''s documents: this clause applies to a shipper acting as a freight forwarder or other intermediary of transport whose company could not be confirmed under its own name from the open company data of the Finnish Patent and Registration Office, such as a foreign company or a sole trader. After its approval, such a shipper may use the service, view its information and save jobs as drafts. Before it may publish jobs, offer them to a group of vehicles, send direct orders, select an offer, request free space in a vehicle or otherwise give a transport to a carrier, including through the interface or by e-mail, it must provide the service with (1) an extract from the trade register or the equivalent official register of the country in which it is registered, such as a Handelsregisterauszug or Gewerbeanmeldung, and (2) the insurance certificate or policy of its freight forwarder''s liability insurance with limits of indemnity at least those stated in the clause on freight forwarder''s liability insurance. Aivomaa Oy checks the documents and may approve or reject them and request further information or confirmation from the issuer of a document. Publishing and giving transports become available once Aivomaa Oy has approved both documents. The check of the extract is valid for 12 months from the date of issue of the extract and the check of the insurance for as long as the insurance is valid. If a document expires or Aivomaa Oy rejects it, the publishing of new jobs and the giving of transports are suspended until a new document has been approved. A suspension does not affect transports already confirmed. This clause does not apply to a shipper transporting its own goods.');

  perform pg_temp.swap_marked(v_doc, 8, 'Huolitsijan vastuuvakuutus:',
    'Vakuutuksen toimittaminen ei ole palvelun käytön eikä toimeksiantojen julkaisemisen edellytys.',
    'Vakuutuksen toimittaminen ei ole palvelun käytön eikä toimeksiantojen julkaisemisen edellytys, lukuun ottamatta kohdassa Huolitsijan asiakirjat tarkoitettua tilaajaa.',
    'Providing the insurance is not a condition for using the service or for publishing jobs.',
    'Providing the insurance is not a condition for using the service or for publishing jobs, except for a shipper referred to in the clause on freight forwarder''s documents.');

  perform pg_temp.swap_marked(v_doc, 8, 'Tilaajan yritysasiakirjat:',
    'Asiakirjojen toimittaminen ei ole palvelun käytön edellytys.',
    'Asiakirjojen toimittaminen ei ole palvelun käytön edellytys; kohdassa Huolitsijan asiakirjat tarkoitetun tilaajan on kuitenkin toimitettava kaupparekisteriote tai vastaava ote ennen toimeksiantojen julkaisemista.',
    'Providing the documents is not a condition for using the service.',
    'Providing the documents is not a condition for using the service; a shipper referred to in the clause on freight forwarder''s documents must, however, provide an extract from the trade register or an equivalent extract before publishing jobs.');
end;
$$;


-- ── SHIPPER_AGREEMENT, раздел 2 ────────────────────────────────────

do $$
begin
  perform pg_temp.swap_marked(pg_temp.draft_of('SHIPPER_AGREEMENT'), 2, 'Huolitsijana toimiva tilaaja:',
    'vakuutus ei ole palvelun käytön eikä toimeksiantojen julkaisemisen edellytys.',
    'vakuutus ei ole palvelun käytön eikä toimeksiantojen julkaisemisen edellytys. Jos tilaajan yritystä ei ole voitu vahvistaa Patentti- ja rekisterihallituksen avoimista yritystiedoista, sen on kuitenkin ennen toimeksiantojen julkaisemista tai kuljetusten antamista toimitettava kaupparekisteriote tai vastaava ote sekä huolitsijan vastuuvakuutus käyttöehtojen kohdan Huolitsijan asiakirjat mukaisesti.',
    'the insurance is not a condition for using the service or for publishing jobs.',
    'the insurance is not a condition for using the service or for publishing jobs. Where the shipper''s company could not be confirmed from the open company data of the Finnish Patent and Registration Office, the shipper must, however, provide an extract from the trade register or an equivalent extract and its freight forwarder''s liability insurance before publishing jobs or giving transports, in accordance with the clause on freight forwarder''s documents in the terms of use.');
end;
$$;

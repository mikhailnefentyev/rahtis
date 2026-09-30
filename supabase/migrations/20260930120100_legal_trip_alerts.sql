-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · документы: оповещения об опоздании и простое
--
-- Под поведение 20260930120000: вебхуки order.late и order.waiting несут
-- согласованное время точки, оценку опоздания, начало простоя и конец
-- бесплатного часа. PRIVACY 2.10 — в черновик v16. Активация — решение
-- пользователя.
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
  perform pg_temp.put(v_privacy, array[2, 10],
    'Rajapinnan käyttö: yrityksen luomista rajapinta-avaimista tallennetaan nimi, avaimen alkuosa, tarkistussumma (ei itse avainta), luoja sekä luonti-, käyttö- ja poistoajat. Rajapintapyynnöistä tallennetaan käytetty avain, pyynnön tyyppi, osoite ilman hakuehtoja, vastauskoodi ja kesto. Pyyntöloki säilytetään 90 päivää. Jos yritys tilaa tapahtumailmoituksia, palvelu lähettää sen ilmoittamaan osoitteeseen yrityksen omien tilausten ja reklamaatioiden tapahtumat: tilaus- ja reklamaationumero, tila, reittipisteen paikkakunta sekä sovittu, saapumis-, arvioitu saapumis- ja kuittausaika, arvioitu myöhästyminen, odotusajan alku ja maksuttoman odotuksen päättyminen, tarjouksen tunniste, reittimuutoksen laji ja asiakirjan laji. Kuljettajan sijaintia ilmoituksissa ei lähetetä. Yritys on näiden tietojen vastaanottaja. Toimitusloki säilytetään 30 päivää. Lokit poistetaan automaattisesti. Rajapinnan kautta yritys saa samat tiedot kuin palvelun omassa näkymässään.',
    'Use of the interface: for the API keys a company creates, the name, the beginning of the key, a checksum (not the key itself), the creator and the times of creation, use and revocation are stored. For API requests, the key used, the type of request, the address without query parameters, the response code and the duration are stored. The request log is retained for 90 days. If a company subscribes to event notifications, the service sends the events of the company''s own orders and claims to the address the company has given: the order and claim number, status, the town of a route stop and the agreed time and the times of arrival, estimated arrival and confirmation, the estimated delay, the start of waiting and the end of free waiting, the identifier of an offer, the type of a route change and the type of a document. The driver''s position is not sent in notifications. The company is the recipient of this data. The delivery log is retained for 30 days. The logs are deleted automatically. Through the interface a company receives the same data as in its own view of the service.');
end;
$$;

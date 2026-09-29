-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · документы: вебхуки
--
-- К черновикам из 20260929140100 добавляется поведение вебхуков:
-- TERMS 4.4 — за принимающий сервер и хранение секрета отвечает компания;
-- PRIVACY 2.10 — что уходит на адрес компании и сколько хранится журнал
-- доставок (30 дней). Черновик; активация — решение пользователя.
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
  v_terms uuid := pg_temp.draft_of('TERMS');
  v_privacy uuid := pg_temp.draft_of('PRIVACY');
begin
  perform pg_temp.put(v_terms, array[4, 4],
    'Tilaaja voi luoda palvelussa rajapinta-avaimia (API) omien järjestelmiensä liittämiseksi palveluun ja tilata tapahtumailmoituksia (webhook) omaan osoitteeseensa. Avain ja ilmoitusten allekirjoitussalaisuus ovat salaisia tunnisteita: ne näytetään luotaessa kerran, eikä Aivomaa Oy näe avainta jälkikäteen. Avaimella tehdyt toimet katsotaan yrityksen toimiksi samalla tavalla kuin avaimen luoneen käyttäjän toimet. Yritys säilyttää avaimen ja salaisuuden turvallisesti, antaa ne vain tarpeellisille järjestelmille ja poistaa ne käytöstä heti, jos ne ovat voineet joutua sivullisen tietoon. Yritys vastaa ilmoitukset vastaanottavasta palvelimestaan ja siitä, kuka sen kautta saa tiedot. Rajapinnan käyttöä rajoitetaan pyyntöjen määrän perusteella, ja avain lakkaa toimimasta, kun yrityksen käyttöoikeus tai avaimen luoneen käyttäjän oikeudet päättyvät. [Kohta täydennetään juristin kanssa: vastuu avaimen väärinkäytöstä ennen sen poistamista käytöstä.]',
    'A shipper can create application programming interface (API) keys in the service to connect its own systems to the service, and subscribe to event notifications (webhooks) at its own address. A key and a notification signing secret are secret identifiers: they are shown once when created, and Aivomaa Oy cannot see a key afterwards. Actions taken with a key are treated as actions of the company in the same way as actions of the user who created the key. The company keeps the key and the secret secure, gives them only to the systems that need them and revokes them at once if they may have come to the knowledge of a third party. The company is responsible for the server that receives the notifications and for who gets the data through it. Use of the interface is limited by the number of requests, and a key stops working when the company''s access or the rights of the user who created it end. [This clause is to be completed with counsel: liability for misuse of a key before it is revoked.]');

  perform pg_temp.put(v_privacy, array[2, 10],
    'Rajapinnan käyttö: yrityksen luomista rajapinta-avaimista tallennetaan nimi, avaimen alkuosa, tarkistussumma (ei itse avainta), luoja sekä luonti-, käyttö- ja poistoajat. Rajapintapyynnöistä tallennetaan käytetty avain, pyynnön tyyppi, osoite ilman hakuehtoja, vastauskoodi ja kesto. Pyyntöloki säilytetään 90 päivää. Jos yritys tilaa tapahtumailmoituksia, palvelu lähettää sen ilmoittamaan osoitteeseen yrityksen omien tilausten tapahtumat (tilausnumero, tila, reittipisteen paikkakunta ja aika, asiakirjan laji); yritys on näiden tietojen vastaanottaja. Toimitusloki säilytetään 30 päivää. Lokit poistetaan automaattisesti. Rajapinnan kautta yritys saa samat tiedot kuin palvelun omassa näkymässään.',
    'Use of the interface: for the API keys a company creates, the name, the beginning of the key, a checksum (not the key itself), the creator and the times of creation, use and revocation are stored. For API requests, the key used, the type of request, the address without query parameters, the response code and the duration are stored. The request log is retained for 90 days. If a company subscribes to event notifications, the service sends the events of the company''s own orders (order number, status, the town and time of a route stop, the type of a document) to the address the company has given; the company is the recipient of this data. The delivery log is retained for 30 days. The logs are deleted automatically. Through the interface a company receives the same data as in its own view of the service.');
end;
$$;

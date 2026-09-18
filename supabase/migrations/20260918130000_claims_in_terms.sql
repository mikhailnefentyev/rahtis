-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · претензии в условиях
--
-- В кабинетах появились claims (миграция claims): подача по рейсу,
-- лента переписки, решение оператора, фото рейса как доказательство.
-- Условия об этом молчали, а соглашение заказчика отправляло претензию
-- письмом на admin@rahtis.eu — то есть описывало путь, которым теперь
-- пользуются только когда кабинет недоступен.
--
-- Что меняется.
--
-- TERMS (общие условия, их принимают обе стороны):
--   • новый раздел 12 «Reklamaatiot ja poikkeamat»; прежний 12
--     «Vastuu, muutokset ja riidat» становится 13 — порядок разделов
--     остаётся «от работы к ответственности», и заключительные положения
--     по-прежнему стоят последними. Перекрёстных ссылок на номера пунктов
--     в тексте нет (проверено по действующим редакциям), поэтому сдвиг
--     ничего не ломает;
--   • 8.7 — фото из приложения водителя: с моментом и местом съёмки,
--     привязаны к рейсу и доступны в его claims;
--   • 13.3 (бывший 12.3) — досудебное урегулирование идёт через
--     процедуру claims в сервисе, почта остаётся запасным путём.
--
-- SHIPPER_AGREEMENT:
--   • 10.2 — претензия подаётся в сервисе с карточки рейса, почта —
--     если это невозможно; оператор сообщает решение с обоснованием;
--   • 10.5 — ссылка на порядок claims в общих условиях.
--
-- ГЛАВНОЕ ОГРАНИЧЕНИЕ ТЕКСТА. Контрагент заказчика — Aivomaa Oy (TERMS
-- 1.3, SHIPPER_AGREEMENT 1.2). Поэтому претензия адресуется Aivomaa Oy,
-- а не перевозчику напрямую, даже если в интерфейсе вторая сторона
-- названа «kuljetusliike». Решение оператора — позиция посредника, а не
-- арбитраж: оно не лишает сторону суда и не отменяет императивного права
-- и CMR.
--
-- ПРАВИТСЯ ЧЕРНОВИК, А НЕ ДЕЙСТВУЮЩАЯ РЕДАКЦИЯ. Миграция о приоритетном
-- языке (20260918040000) уже создала черновики новых редакций; претензии
-- ложатся в те же черновики, чтобы компании принимали одну новую
-- редакцию, а не две подряд. Если черновика нет — он создаётся копией
-- действующей. Активирует редакцию оператор в админке: после активации
-- каждая компания принимает её заново, и это его решение, а не
-- миграции.
-- ═══════════════════════════════════════════════════════════════════

/*
 * Черновик следующей редакции: последний DRAFT новее действующей, иначе
 * новый — копией действующей.
 */
create or replace function pg_temp.next_draft(p_kind public.legal_kind)
returns uuid
language plpgsql
as $$
declare
  v_active uuid := public.active_legal_document(p_kind);
  v_active_version integer;
  v_draft uuid;
begin
  if v_active is null then
    raise exception 'Нет действующей редакции %.', p_kind using errcode = '55007';
  end if;

  select version into v_active_version from public.legal_documents where id = v_active;

  select id into v_draft
  from public.legal_documents
  where kind = p_kind and status = 'DRAFT' and version > v_active_version
  order by version desc
  limit 1;

  if v_draft is null then
    insert into public.legal_documents (kind, version, status, effective_from)
    values (
      p_kind,
      (select max(version) + 1 from public.legal_documents where kind = p_kind),
      'DRAFT',
      current_date
    )
    returning id into v_draft;

    insert into public.legal_clauses (document_id, locale, path, title, body)
    select v_draft, c.locale, c.path, c.title, c.body
    from public.legal_clauses c
    where c.document_id = v_active;
  end if;

  return v_draft;
end;
$$;

/* Ровно два пункта — финский и английский, иначе путь назван неверно. */
create or replace function pg_temp.set_clause(p_doc uuid, p_path integer[], p_fi text, p_en text)
returns void
language plpgsql
as $$
declare
  v_touched integer;
begin
  update public.legal_clauses
  set body = case locale when 'fi' then p_fi else p_en end
  where document_id = p_doc and path = p_path;

  get diagnostics v_touched = row_count;
  if v_touched <> 2 then
    raise exception 'Пункт %: ожидались два языка, изменено %.', p_path, v_touched using errcode = '55000';
  end if;
end;
$$;

create or replace function pg_temp.add_clause(
  p_doc uuid, p_path integer[], p_title_fi text, p_title_en text, p_fi text, p_en text
)
returns void
language plpgsql
as $$
begin
  if exists (select 1 from public.legal_clauses where document_id = p_doc and path = p_path) then
    raise exception 'Пункт % уже есть.', p_path using errcode = '23505';
  end if;

  insert into public.legal_clauses (document_id, locale, path, title, body)
  values (p_doc, 'fi', p_path, p_title_fi, p_fi),
         (p_doc, 'en', p_path, p_title_en, p_en);
end;
$$;


do $$
declare
  v_terms uuid := pg_temp.next_draft('TERMS');
  v_shipper uuid := pg_temp.next_draft('SHIPPER_AGREEMENT');
begin
  -- ── TERMS ─────────────────────────────────────────────────────────

  /* Раздел 12 становится 13. Сначала сдвиг, потом вставка нового 12. */
  if exists (select 1 from public.legal_clauses where document_id = v_terms and path[1] = 13) then
    raise exception 'В черновике TERMS уже есть раздел 13 — миграция применена?' using errcode = '55000';
  end if;

  update public.legal_clauses
  set path = array[13] || path[2:]
  where document_id = v_terms and path[1] = 12;

  perform pg_temp.add_clause(v_terms, array[12],
    'Reklamaatiot ja poikkeamat', 'Claims and deviations', null, null);

  perform pg_temp.add_clause(v_terms, array[12, 1], null, null,
    'Keikan tilaaja ja keikan suorittanut kuljetusliike voivat tehdä palvelussa reklamaation käynnissä olevasta tai valmiista keikasta. Reklamaation aihe voi olla lastin tai perävaunun vaurio, vajaus, odotusaika, poikkeama reitistä tai aikataulusta tai muu keikkaan liittyvä poikkeama. Reklamaatio osoitetaan Aivomaa Oy:lle, joka on kummankin osapuolen sopimuskumppani: Aivomaa Oy käsittelee sen keikan toisen osapuolen kanssa ja välittää osapuolten välillä. Reklamaatio ei synnytä suoraa sopimussuhdetta tilaajan ja kuljetusliikkeen välille.',
    'The shipper of a job and the carrier that performed it may file a claim in the service about a running or completed job. A claim may concern damage to the cargo or trailer, a shortage, waiting time, a deviation from the route or schedule, or another deviation related to the job. The claim is addressed to Aivomaa Oy, which is each party''s contracting party: Aivomaa Oy handles it with the other party to the job and mediates between the parties. A claim does not create a direct contractual relationship between the shipper and the carrier.');

  perform pg_temp.add_clause(v_terms, array[12, 2], null, null,
    'Reklamaatio tehdään viivytyksettä sen jälkeen, kun poikkeama on havaittu tai sen olisi pitänyt havaita. Siinä kerrotaan, mitä, missä ja milloin tapahtui, vaadittu summa ilman arvonlisäveroa, jos se tiedetään, sekä käytettävissä oleva näyttö. Reklamaatio palvelussa ei korvaa rahtikirjaan tehtäviä varaumia eikä sovellettavan lain, mukaan lukien soveltuvin osin CMR-yleissopimuksen, mukaisia ilmoituksia, menettelyjä ja määräaikoja. Jos palvelu ei ole käytettävissä, reklamaatio voidaan lähettää osoitteeseen admin@rahtis.eu.',
    'A claim is filed without delay once the deviation was noticed or should have been noticed. It states what happened, where and when, the amount claimed excluding VAT if known, and the available evidence. A claim in the service does not replace reservations entered in the consignment note, nor the notices, procedures and time limits required by applicable law, including the CMR Convention where it applies. If the service is unavailable, a claim may be sent to admin@rahtis.eu.');

  perform pg_temp.add_clause(v_terms, array[12, 3], null, null,
    'Reklamaatioon liitetään keikan asiakirjat ja valokuvat, myös ne, jotka lisätään keikalle reklamaation tekemisen jälkeen. Osapuolet voivat liittää reklamaatioon tiedostoja ja kirjoittaa siihen viestejä. Viestit, liitteet ja tilamuutokset tallentuvat aikaleimoin reklamaation tapahtumalokiin, ne näkyvät keikan osapuolille ja Aivomaa Oy:lle, eikä osapuoli voi poistaa niitä jälkikäteen. Kuljetusliikkeen yritystietoja ei näytetä tilaajalle reklamaatiossakaan. Näyttöä arvioidaan kohdan 8 mukaisesti muun näytön kanssa.',
    'The documents and photographs of the job are attached to the claim, including those added to the job after the claim was filed. The parties may attach files to the claim and write messages in it. Messages, attachments and status changes are recorded with timestamps in the claim''s event log, are visible to the parties to the job and to Aivomaa Oy, and cannot be deleted afterwards by a party. The carrier''s company details are not shown to the shipper in a claim either. Evidence is assessed together with other evidence as set out in section 8.');

  perform pg_temp.add_clause(v_terms, array[12, 4], null, null,
    'Reklamaation tila on avoin, käsittelyssä, ratkaistu tai hylätty. Aivomaa Oy voi pyytää osapuolilta täsmennyksiä ja lisänäyttöä ja hoitaa tarvittaessa yhteydenpidon vakuutusyhtiöön. Ratkaisu tai hylkäys perustellaan, ja siitä ilmoitetaan molemmille osapuolille palvelussa ja sähköpostitse. Reklamaation tekijä voi merkitä reklamaation ratkaistuksi, jos osapuolet ovat sopineet asiasta. Suljettuun reklamaatioon ei voi lisätä viestejä; jatkuva tai uusi asia käsitellään uutena reklamaationa.',
    'A claim''s status is open, in review, resolved or rejected. Aivomaa Oy may ask the parties for clarification and further evidence and, where necessary, handles contact with the insurer. A resolution or rejection is reasoned and notified to both parties in the service and by email. The party that filed a claim may mark it resolved if the parties have reached agreement. No messages can be added to a closed claim; a continuing or new matter is handled as a new claim.');

  perform pg_temp.add_clause(v_terms, array[12, 5], null, null,
    'Aivomaa Oy:n ratkaisu reklamaatiossa on sen kanta sopimuskumppanina ja osapuolten välisenä välittäjänä. Se ei ole välitystuomio, se ei estä osapuolta saattamasta asiaa tuomioistuimen ratkaistavaksi kohdan 13 mukaisesti, eikä se rajoita pakottavan lain tai CMR-yleissopimuksen mukaisia oikeuksia. Reklamaatio ei sellaisenaan oikeuta pidättämään riidatonta maksua. Hyväksytyn vaatimuksen maksaminen tai kuittaaminen sovitaan erikseen ja kirjataan reklamaatioon.',
    'Aivomaa Oy''s resolution of a claim is its position as contracting party and as intermediary between the parties. It is not an arbitral award, it does not prevent a party from bringing the matter before a court as set out in section 13, and it does not limit rights under mandatory law or the CMR Convention. A claim does not in itself entitle a party to withhold an undisputed payment. Payment or set-off of an accepted claim is agreed separately and recorded in the claim.');

  /* 8.7 — фото из приложения водителя. */
  perform pg_temp.add_clause(v_terms, array[8, 7], null, null,
    'Kuljettajan sovelluksella otetut nouto- ja toimituskuvat liitetään keikalle ottohetken ja, jos laite sen antaa, ottopaikan tiedoin. Kuvat ovat keikan osapuolten ja Aivomaa Oy:n käytettävissä, ja ne näkyvät keikan reklamaatioissa todisteena perävaunun ja lastin tilasta ennen ja jälkeen kuljetuksen. Kuvat otetaan vain työn kannalta tarpeellisesta, eikä niihin tule tarpeettomasti sivullisia henkilöitä.',
    'Pickup and delivery photographs taken with the driver app are attached to the job with the time and, where the device provides it, the place they were taken. They are available to the parties to the job and to Aivomaa Oy and appear in the job''s claims as evidence of the condition of the trailer and cargo before and after the transport. Photographs are taken only of what the work requires and must not needlessly show outsiders.');

  /* 13.3 (бывший 12.3) — досудебный путь теперь через claims. */
  perform pg_temp.set_clause(v_terms, array[13, 3],
    'Sovelletaan Suomen lakia, kuitenkin niin, että pakottavat säännökset ja sovellettavat kansainväliset yleissopimukset ovat etusijalla. Osapuolet yrittävät ensin sopia riidan palvelun reklamaatiomenettelyssä kohdan 12 mukaisesti tai osoitteen admin@rahtis.eu kautta. Jos sopimukseen ei päästä, riita käsitellään Helsingin toimivaltaisessa tuomioistuimessa, jolleivät pakottavat oikeuspaikkasäännökset, mukaan lukien sovellettava CMR-yleissopimus, edellytä muuta.',
    'Finnish law applies, subject to the precedence of mandatory provisions and applicable international conventions. The parties first seek to settle a dispute through the claims procedure in the service under section 12 or through admin@rahtis.eu. Failing agreement, the dispute is heard by the competent court in Helsinki unless mandatory rules on jurisdiction, including the applicable CMR Convention, require otherwise.');


  -- ── SHIPPER_AGREEMENT ─────────────────────────────────────────────

  perform pg_temp.set_clause(v_shipper, array[10, 2],
    'Vaatimus tehdään palvelussa reklamaationa keikan kortilta; jos se ei ole mahdollista, se lähetetään osoitteeseen admin@rahtis.eu. Vaatimuksessa ilmoitetaan tilauksen numero, olosuhteet, vaadittu summa ja käytettävissä oleva näyttö. Aivomaa Oy pyytää tarvittaessa täsmennyksiä, hoitaa yhteydenpidon suorittajaan ja vakuutusyhtiöön ja ilmoittaa ratkaisunsa perusteluineen palvelussa ja sähköpostitse.',
    'A claim is filed in the service from the job card; if that is not possible, it is sent to admin@rahtis.eu. The claim states the order number, the circumstances, the amount claimed and the available evidence. Where necessary Aivomaa Oy requests clarification, handles contact with the performer and the insurer, and notifies its reasoned resolution in the service and by email.');

  perform pg_temp.add_clause(v_shipper, array[10, 5], null, null,
    'Reklamaation käsittelyssä, näytössä ja ratkaisun luonteessa noudatetaan lisäksi RAHTIS-käyttöehtojen reklamaatioita koskevia määräyksiä. Tilaajan reklamaatio osoitetaan Aivomaa Oy:lle sopimuskumppanina myös silloin, kun poikkeama on syntynyt suorittajan vastuupiirissä.',
    'The handling of claims, evidence and the nature of the resolution are further governed by the provisions on claims in the RAHTIS terms of use. The shipper''s claim is addressed to Aivomaa Oy as contracting party even where the deviation arose within the performer''s area of responsibility.');

  raise notice 'TERMS v% и SHIPPER_AGREEMENT v% — черновики с претензиями готовы к активации',
    (select version from public.legal_documents where id = v_terms),
    (select version from public.legal_documents where id = v_shipper);
end;
$$;

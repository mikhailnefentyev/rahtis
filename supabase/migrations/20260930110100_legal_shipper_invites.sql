-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · документы: перевозчик приглашает своего заказчика
--
-- Под поведение 20260930110000: приглашение — разрешение перевозчика на
-- прямые заказы, его одобренные машины знакомы заказчику без истории
-- рейсов, перевозчик видит приглашённого по имени. Приглашения хранятся
-- 12 месяцев.
-- TERMS 6.6, 6.7 и PRIVACY 2.11, 3.1, 8.4 — в новые черновики
-- (TERMS v18, PRIVACY v16). Активация — решение пользователя.
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
  perform pg_temp.put(v_terms, array[6, 6],
    'Tilaaja voi lähettää toimeksiannon suoraan ajoneuvolle, joka on ajanut sen keikkoja, jos ajoneuvon kuljetusliike on sallinut tältä tilaajalta suorat tilaukset. Jos kuljetusliike on kutsunut tilaajan palveluun, tilaaja voi hyväksymisensä jälkeen lähettää suoria tilauksia kuljetusliikkeen kaikille hyväksytyille ajoneuvoille myös ilman aiempia keikkoja: kutsu on kuljetusliikkeen lupa suoriin tilauksiin, ja kuljetusliike voi perua sen kohdan 6.7 mukaisesti. Suora tilaus ei mene tarjouspöydälle eikä sillä ole määräaikaa: se odottaa, kunnes kuljetusliike tai sen kuljettaja vahvistaa sen, ja kuljetussopimus syntyy vahvistuksesta kuten kohdassa 6.3. Ennen vahvistusta tilaaja voi siirtää toimeksiannon tarjouspöydälle ja kuljetusliike voi kieltäytyä; kummassakin tapauksessa toimeksianto julkaistaan tarjouspöydällä. Jos ajoneuvon kuljetusliike käyttää palvelua kuukausimaksulla, suora tilaus tehdään tilaajan ja kuljetusliikkeen välille kohdan 8.5 (a) mukaisesti: kuljetusliike laskuttaa tilaajaa itse ja vastaa kuljetuksesta, ja Aivomaa Oy välittää tiedot ja raportin tehdystä työstä. Muissa tapauksissa Aivomaa Oy on tilaajan sopimuskumppani myös suorissa tilauksissa.',
    'The shipper may send a job directly to a vehicle that has performed its jobs, provided the vehicle''s carrier has allowed direct orders from that shipper. If a carrier has invited the shipper to the service, the shipper may, once approved, send direct orders to all of the carrier''s approved vehicles even without previous jobs: the invitation is the carrier''s permission for direct orders, and the carrier may withdraw it under clause 6.7. A direct order does not go to the board and has no deadline: it waits until the carrier or its driver confirms it, and the contract of carriage is formed on confirmation as under clause 6.3. Before confirmation the shipper may move the job to the board and the carrier may decline; in either case the job is published on the board. If the vehicle''s carrier uses the service for a monthly fee, the direct order is made between the shipper and the carrier as set out in clause 8.5 (a): the carrier invoices the shipper itself and is responsible for the transport, and Aivomaa Oy passes on the data and a report of the work done. In other cases Aivomaa Oy is the shipper''s contracting party in direct orders as well.');

  perform pg_temp.put(v_terms, array[6, 7],
    'Kuljetusliike päättää, mitkä tilaajat saavat lähettää suoria tilauksia sen ajoneuvoille, ja voi perua luvan milloin tahansa; peruminen ei vaikuta jo lähetettyihin tilauksiin. Tällaisista ajoneuvoista tilaaja näkee rekisteritunnuksen, ajoneuvon tiedot ja kuljetusliikkeen arvosanan sekä yhteydenpitoa varten kuljettajan nimen, puhelinnumeron ja sähköpostiosoitteen. Jos ajoneuvon kuljetusliike käyttää palvelua kuukausimaksulla, tilaaja näkee lisäksi kuljetusliikkeen nimen, y-tunnuksen sekä maksamista varten tilinumeron ja BIC-koodin: osapuolet laskuttavat ja maksavat keskenään, eikä laskuttajaa voi jättää tuntemattomaksi. Jos keikka ajetaan alihankintana, kuljetusliikkeen nimi ja muut tiedot eivät näy tilaajalle, koska tilaajan sopimuskumppani ja laskuttaja on Aivomaa Oy. Vastaavasti kuljetusliike näkee tilaajan nimen vain niistä tilaajista, joiden kanssa se laskuttaa suoraan tai jotka se on itse kutsunut palveluun; muutoin tilaajat näkyvät sille koodilla, keikkamäärällä ja viimeisimmällä reitillä. Kuljetuksen suorittamiseen tarvittavat lastaus- ja purkupaikkojen tiedot näkyvät kuljetusliikkeelle ja kuljettajalle.',
    'The carrier decides which shippers may send direct orders to its vehicles and may withdraw that permission at any time; withdrawal does not affect orders already sent. For such vehicles the shipper sees the registration number, the vehicle''s details and the carrier''s rating and, for contact, the driver''s name, telephone number and email address. If the vehicle''s carrier uses the service for a monthly fee, the shipper also sees the carrier''s name, business identity code and, for payment, its account number and BIC code: the parties invoice and pay each other, and the party issuing the invoice cannot remain unknown. If the job is performed as subcontracting, the carrier''s name and other details are not shown to the shipper, because the shipper''s contracting party and invoicing party is Aivomaa Oy. Likewise, the carrier sees a shipper''s name only for those shippers it invoices directly or has itself invited to the service; otherwise shippers are shown to it by a code, the number of jobs and the latest route. The loading and unloading place details needed to perform the transport are visible to the carrier and the driver.');

  perform pg_temp.put(v_privacy, array[2, 11],
    'Kutsut: kun kuljetusliike kutsuu asiakkaansa palveluun, tallennetaan kutsutun yrityksen nimi, Y-tunnus ja kuljetusliikkeen antama sähköpostiosoite, kutsun lähettäjä ja lähetysaika, kutsulinkin tarkistussumma (ei itse linkkiä) sekä tieto siitä, onko kutsun perusteella jätetty hakemus. Osoitteeseen lähetetään yksi kutsuviesti, jossa kerrotaan, kuka kutsui; muita viestejä sinne ei lähetetä, ellei vastaanottaja jätä hakemusta. Kutsun tiedot näkyvät kutsuneelle kuljetusliikkeelle ja ylläpitäjälle. Kutsut poistetaan automaattisesti 12 kuukauden kuluttua lähettämisestä. [Kohta täydennetään juristin kanssa: kutsuviestin lähettämisen peruste, kun osoitteen antaa kuljetusliike, ja vastaanottajalle annettava tieto.]',
    'Invitations: when a carrier invites its customer to the service, the invited company''s name, business ID and the email address given by the carrier, the sender and time of the invitation, a checksum of the invitation link (not the link itself) and whether an application was made on the basis of the invitation are stored. One invitation message stating who sent the invitation is sent to the address; no other messages are sent there unless the recipient applies. The invitation data is visible to the inviting carrier and the administrator. Invitations are deleted automatically 12 months after they were sent. [To be completed with a lawyer: the basis for sending the invitation message when the address is given by the carrier, and the information given to the recipient.]');

  perform pg_temp.put(v_privacy, array[3, 1],
    'Tiedot saadaan henkilöltä itseltään, yritykseltä, jonka puolesta hän toimii, tilaajalta, kuljetusliikkeeltä, tilauksen suorittamiseen osallistuvilta sekä palvelussa tehdyistä toimista ja asiakirjoista. Kutsutun yrityksen nimen, Y-tunnuksen ja sähköpostiosoitteen antaa kutsun lähettänyt kuljetusliike. Yritysten rekisteritiedot tarkistetaan julkisista rekistereistä.',
    'Data is obtained from the person themselves, from the company they act for, from the shipper, from the carrier, from those taking part in performing the order, and from the actions and documents in the service. The name, business ID and email address of an invited company are given by the carrier that sent the invitation. Company registration details are checked against public registers.');

  perform pg_temp.put(v_privacy, array[8, 4],
    'Säilytysajat tietoryhmittäin: tilaukset, laskut, tilitykset ja rahtikirjat (CMR) säilytetään kuusi vuotta sen kalenterivuoden päättymisestä, jona keikka päättyi. Kohdan 2.4 sijaintipisteet sekä kuormaus-, purku- ja vauriokuvat säilytetään 24 kuukautta keikan tai työvuoron päättymisestä; pidempään säilytettävästä rahtikirjasta poistetaan tällöin kuvauspaikka. Kuljettajasovelluksen tapahtumat, avustajan keskustelut ja tukipyynnöt säilytetään 24 kuukautta. Palvelun ilmoitukset, lähetettyjen sähköpostien loki ja kohdan 2.11 kutsut säilytetään 12 kuukautta. Määräajan umpeuduttua tiedot poistetaan automaattisesti; kirjanpidon edellyttämät tilaus- ja laskutiedot poistetaan tai anonymisoidaan säilytysajan päätyttyä. Jos keikasta on vireillä reklamaatio tai muu vaatimus, sen tietoja säilytetään kohdan 8.5 mukaisesti.',
    'Retention periods by category: orders, invoices, settlements and consignment notes (CMR) are retained for six years from the end of the calendar year in which the job ended. The position points of section 2.4 and loading, unloading and damage photos are retained for 24 months from the end of the job or shift; the place of capture is then removed from a consignment note that is kept longer. Driver app events, assistant conversations and support requests are retained for 24 months. Service notifications, the log of sent emails and the invitations of section 2.11 are retained for 12 months. When the period ends, the data is deleted automatically; order and invoice data required for bookkeeping is deleted or anonymised at the end of its retention period. If a claim or other demand concerning a job is pending, its data is retained as set out in section 8.5.');
end;
$$;

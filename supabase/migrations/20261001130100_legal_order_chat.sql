-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · документы: переписка по рейсу и машинный перевод
--
-- Под поведение 20261001130000: переписка заказчика, перевозчика и
-- водителя по рейсу, перевод через n8n и OpenAI, оператор читает только
-- при претензии, хранение 24 месяца. TERMS 6.10 (новый) — черновик v18;
-- PRIVACY 2.13, 5.6 (новые) и 8.4 — черновик v16. Активация — решение
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
  v_terms uuid := pg_temp.draft_of('TERMS');
  v_privacy uuid := pg_temp.draft_of('PRIVACY');
begin
  perform pg_temp.put(v_terms, array[6, 10], 'Kun keikalle on osoitettu ajoneuvo, tilaaja, kuljetusliike ja keikan kuljettaja voivat viestiä keikasta palvelussa ja kuljettajasovelluksessa siihen asti, kun keikan päättymisestä on kulunut kolme päivää. Viestit näkyvät näille osapuolille. Aivomaa Oy:n henkilöstö näkee viestit vain, jos keikasta on tehty reklamaatio. Viestit on tarkoitettu keikan suorittamiseen: aikatauluun, saapumiseen, paikan ohjeisiin ja odotukseen. Viestien käännökset ovat konekäännöksiä, ja ristiriitatilanteessa alkuperäinen viesti ratkaisee. Kohdan 6.7 nimettömyys koskee myös viestejä: viestissä näytetään lähettäjän rooli ja kuljettajan etunimi.', 'Once a vehicle has been assigned to a job, the shipper, the carrier and the job''s driver can exchange messages about the job in the service and the driver app until three days have passed from the end of the job. The messages are visible to these parties. Aivomaa Oy''s staff see the messages only if a claim has been made concerning the job. The messages are intended for performing the job: the schedule, arrival, site instructions and waiting. Translations of messages are machine translations, and in case of conflict the original message prevails. The anonymity of clause 6.7 also applies to messages: a message shows the sender''s role and the driver''s first name.');
  perform pg_temp.put(v_privacy, array[2, 13], 'Keikan viestit: kun keikalle on osoitettu ajoneuvo, tallennetaan tilaajan, kuljetusliikkeen ja kuljettajan keikasta lähettämät viestit, lähettäjän rooli, kuljettajan etunimi, lähetysaika sekä viestin konekäännökset. Viestit näkyvät keikan tilaajalle, kuljetusliikkeelle ja kuljettajalle; Aivomaa Oy:n henkilöstö näkee ne vain, jos keikasta on tehty reklamaatio. Viestit säilytetään 24 kuukautta lähettämisestä, ja ne poistetaan automaattisesti. Käsittelyn peruste on osapuolten oikeutettu etu hoitaa kuljetus ja osoittaa sen kulku. [Kohta täydennetään juristin kanssa: viestien käsittelyperuste ja kuljettajalle annettava tieto.]', 'Job messages: once a vehicle has been assigned to a job, the messages sent about the job by the shipper, the carrier and the driver are stored, together with the sender''s role, the driver''s first name, the time of sending and machine translations of the message. The messages are visible to the job''s shipper, carrier and driver; Aivomaa Oy''s staff see them only if a claim has been made concerning the job. The messages are retained for 24 months from sending and are deleted automatically. The basis for processing is the parties'' legitimate interest in performing the transport and demonstrating its course. [To be completed with counsel: the basis for processing messages and the information given to the driver.]');
  perform pg_temp.put(v_privacy, array[5, 6], 'Keikan viestien käännökset tehdään OpenAI:n kielimallilla; automaatio on toteutettu n8n-työkalulla. Näille välitetään viestin teksti ja kielet, joille se käännetään, mutta ei lähettäjän nimeä, keikan numeroa eikä muita keikan tietoja. OpenAI voi käsitellä tietoja ETA-alueen ulkopuolella, ja siirtoon sovelletaan kohtaa 6.4.', 'Translations of job messages are made with OpenAI''s language model; the automation is implemented with the n8n tool. They receive the text of the message and the languages into which it is translated, but not the sender''s name, the job number or other job data. OpenAI may process data outside the EEA, and clause 6.4 applies to the transfer.');

  update public.legal_clauses
  set body = replace(body, 'Kuljettajasovelluksen tapahtumat, avustajan keskustelut ja tukipyynnöt säilytetään 24 kuukautta.',
                           'Kuljettajasovelluksen tapahtumat, avustajan keskustelut, kohdan 2.13 keikan viestit ja tukipyynnöt säilytetään 24 kuukautta.')
  where document_id = v_privacy and path = array[8, 4] and locale = 'fi';

  update public.legal_clauses
  set body = replace(body, 'Driver app events, assistant conversations and support requests are retained for 24 months.',
                           'Driver app events, assistant conversations, the job messages of section 2.13 and support requests are retained for 24 months.')
  where document_id = v_privacy and path = array[8, 4] and locale = 'en';

  if not exists (select 1 from public.legal_clauses where document_id = v_privacy and path = array[8, 4] and body like '%2.13%') then
    raise exception 'PRIVACY 8.4: не нашлась фраза о сроках 24 месяца.';
  end if;
end;
$$;

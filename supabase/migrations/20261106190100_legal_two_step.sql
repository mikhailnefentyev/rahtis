-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · документы: двухэтапный вход и устройства входа (6.11.2026)
--
-- Под 20261106190000_two_step. PRIVACY, черновик:
--   раздел 10 (Tietoturva) — двухэтапный вход, запись устройств входа и
--     письмо о входе с нового устройства;
--   раздел 8 (Säilytysajat) — устройства входа 12 месяцев.
-- Номер — следующий свободный в разделе. Активация — решение пользователя.
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

do $$
declare
  v_privacy uuid := pg_temp.draft_of('PRIVACY');
begin
  perform pg_temp.append(v_privacy, 10, 'Kirjautumisen suojaus:',
    'Kirjautumisen suojaus: käyttäjä voi ottaa käyttöön kaksivaiheisen kirjautumisen, jolloin salasanan lisäksi kysytään puhelimen todennussovelluksen kertakäyttöinen koodi. Palvelun ylläpitäjille se on pakollinen. Sovelluksen avain säilytetään kirjautumispalvelussa (Supabase), eikä Aivomaa Oy näe koodeja. Jokaisesta onnistuneesta kirjautumisesta tallennetaan käyttäjän tunnisteeseen liitettynä laitteen tunniste (selaimen tyypistä ja kieliasetuksesta laskettu tiiviste), selaimen ja käyttöjärjestelmän nimi, IP-osoitteen alkuosa (IPv4-osoitteesta kolme ensimmäistä osaa, IPv6-osoitteesta 48 ensimmäistä bittiä; koko osoitetta ei tallenneta), maa sekä ensimmäisen ja viimeisimmän kirjautumisen ajankohta. Kun tilille kirjaudutaan laitteelta, jota ei ole aiemmin käytetty, käyttäjälle lähetetään ilmoitus sähköpostiin ja palveluun; ilmoituksessa kerrotaan myös arvioitu paikkakunta, jota ei tallenneta. Käsittelyn tarkoitus on estää tilien kaappaukset ja niihin liittyvät petokset, ja peruste on Aivomaa Oy:n ja palvelun käyttäjien oikeutettu etu.',
    'Sign-in protection: a user may turn on two-step sign-in, in which case a one-time code from an authenticator app on the phone is asked in addition to the password. It is mandatory for the administrators of the service. The app key is stored by the sign-in service (Supabase), and Aivomaa Oy does not see the codes. For each successful sign-in, linked to the user''s account, we store a device identifier (a hash calculated from the browser type and language setting), the name of the browser and operating system, the first part of the IP address (the first three parts of an IPv4 address, the first 48 bits of an IPv6 address; the full address is not stored), the country, and the time of the first and the latest sign-in. When the account is signed in to from a device not used before, the user is notified by email and in the service; the notice also states the approximate city, which is not stored. The purpose is to prevent account takeovers and the related fraud, and the legal basis is the legitimate interest of Aivomaa Oy and the users of the service.');

  perform pg_temp.append(v_privacy, 8, 'Kirjautumislaitteet:',
    'Kirjautumislaitteet: kohdan 10 kirjautumislaitteiden tiedot poistetaan 12 kuukauden kuluttua laitteen viimeisimmästä kirjautumisesta, ja ne poistuvat heti, kun käyttäjätunnus poistetaan.',
    'Sign-in devices: the sign-in device data described in section 10 is deleted 12 months after the latest sign-in from that device, and immediately when the user account is deleted.');

  raise notice 'Черновик PRIVACY v%', (select version from public.legal_documents where id = v_privacy);
end;
$$;

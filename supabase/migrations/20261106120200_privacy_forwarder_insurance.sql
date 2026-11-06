-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · политика: полис экспедитора (6.11.2026)
--
-- Под поведение 20261106120000_forwarder_insurance. PRIVACY v5 (2.x
-- «Asiakirjat ja aineistot») уже называет «yrityksen luvat ja
-- vakuutustodistukset» вообще, без привязки к перевозчику. Новое здесь —
-- что полис и лицензию экспедитора проверяем у страховщика (передаём ему
-- название компании и номер полиса, получаем ответ), что в файле могут
-- быть имена подписантов и что перевозчик видит только дату.
-- Отдельный подпункт в конце раздела 2. Черновик PRIVACY, активация —
-- решение пользователя.
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

do $$
declare
  v_doc uuid := pg_temp.draft_of('PRIVACY');
  v_no integer;
begin
  /* Уже добавлен (повторный прогон) — ничего не делаем. */
  if exists (
    select 1 from public.legal_clauses
    where document_id = v_doc and locale = 'fi' and body like 'Huolitsijan vakuutus ja lupa:%'
  ) then
    return;
  end if;

  select coalesce(max(path[2]), 0) + 1 into v_no
  from public.legal_clauses
  where document_id = v_doc and cardinality(path) = 2 and path[1] = 2;

  insert into public.legal_clauses (document_id, locale, path, title, body)
  values
    (v_doc, 'fi', array[2, v_no], null,
     'Huolitsijan vakuutus ja lupa: huolitsijana toimiva tilaaja voi tallentaa palveluun huolitsijan vastuuvakuutuksen vakuutustodistuksen tai vakuutuskirjan ja puolalainen tilaaja tavarankuljetusten välitykseen oikeuttavan luvan sekä niiden tiedot (vakuutuksenantaja, vakuutusnumero, vastuumäärät, voimassaolo, alue ja ehdot). Asiakirja voi sisältää allekirjoittajien tai yhteyshenkilöiden nimiä. Tarkastamme tiedot ja voimme pyytää vakuutuksen voimassaolosta vahvistuksen vakuutuksenantajalta, jolle ilmoitamme tällöin yrityksen nimen ja vakuutusnumeron; vahvistuksen päivämäärä ja tulos tallennetaan. Asiakirjat näkevät tilaaja ja palvelun ylläpito. Kuljetusliike näkee suoran sopimuksen toimeksiannon yhteydessä vain tiedon siitä, mihin päivään asti vakuutus on tarkastettu voimassa olevaksi. Asiakirjat säilytetään yrityksen asiakkuuden ajan ja sen jälkeen niin kauan kuin niitä tarvitaan niiden perusteella tehtyjen tarkastusten osoittamiseen.'),
    (v_doc, 'en', array[2, v_no], null,
     'Forwarder''s insurance and licence: a customer acting as a freight forwarder may store in the service an insurance certificate or policy of its freight forwarder''s liability insurance, and a Polish customer its licence for intermediation in the carriage of goods, together with their details (insurer, policy number, limits of indemnity, period of validity, territory and conditions). Such a document may contain the names of signatories or contact persons. We check the details and may request confirmation of the validity of the insurance from the insurer, to whom we then disclose the company''s name and the policy number; the date and the result of the confirmation are recorded. The documents are visible to the customer and to the administrators of the service. In connection with an assignment under a direct contract, a carrier only sees the date until which the insurance has been checked as valid. The documents are kept for the duration of the company''s customer relationship and thereafter for as long as they are needed to demonstrate the checks made on their basis.');
end;
$$;

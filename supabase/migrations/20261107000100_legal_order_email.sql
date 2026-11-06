-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · документы: заказ из пересланного письма (6.11.2026)
--
-- Под 20261107000000_order_email_inbox. PRIVACY — раздел 2, пункт в
-- конце (номер — следующий свободный): что хранится из письма, кто
-- может присылать, ИИ-разбор, срок 30 дней, подтверждение отправителю.
-- Черновик, активация — решение пользователя.
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
begin
  perform pg_temp.append(pg_temp.draft_of('PRIVACY'), 2, 'Tilaukset sähköpostista:',
    'Tilaukset sähköpostista: yritys voi välittää asiakkaansa kuljetustilauksen yrityksen omaan RAHTIS-vastaanotto-osoitteeseen. Osoitteeseen hyväksytään viestit vain yrityksen käyttäjien kirjautumisosoitteista ja yrityksen erikseen ilmoittamista osoitteista; muut viestit hylätään tallentamatta niiden sisältöä. Viestin teksti ja liitteet luetaan tekoälyllä samalla tavalla kuin palveluun liitetty tilausteksti tai PDF (kohta tekoälyn käytöstä), eikä viestin tekstiä tai liitteitä tallenneta. Tallennamme viestin aiheen, lähettäjän osoitteen, vastaanottoajan ja viestin tunnisteen sekä luonnokseen poimitut tilauksen tiedot, joihin voi sisältyä lastaus- ja purkupaikkojen yhteyshenkilöiden nimiä ja puhelinnumeroita. Luonnos näkyy vain yrityksen käyttäjille, eikä sitä julkaista ilman käyttäjän tarkistusta. Tiedot poistetaan 30 päivän kuluttua vastaanotosta; tilaukseen siirretyt tiedot säilytetään kuten tilausten tiedot. Lähettäjälle voidaan lähettää vastaanottokuittaus. Peruste on palvelun käyttäjien kanssa tehty sopimus.',
    'Orders by email: a company may forward its customer''s transport order to the company''s own RAHTIS receiving address. The address accepts messages only from the sign-in addresses of the company''s users and from addresses the company has listed separately; other messages are rejected without storing their content. The text and attachments of the message are read by artificial intelligence in the same way as an order text or PDF pasted into the service (see the item on the use of artificial intelligence), and the text and attachments of the message are not stored. We store the subject of the message, the sender''s address, the time of receipt and the message identifier, and the order details extracted into the draft, which may include names and telephone numbers of contact persons at the loading and unloading places. The draft is visible only to the company''s users and is not published without a user''s review. The data is deleted 30 days after receipt; details transferred into an order are kept in the same way as the data of orders. A confirmation of receipt may be sent to the sender. The legal basis is the contract with the users of the service.');
end;
$$;

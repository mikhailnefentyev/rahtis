-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · документы: сверка машины на погрузке (6.11.2026)
--
-- Под 20261106200000_vehicle_check. PRIVACY, черновик, раздел 2: на
-- первой погрузке номер машины, её позиция и водитель сверяются с
-- заказом; результат видят заказчик и перевозчик; хранится вместе с
-- документами рейса. Номер — следующий свободный в разделе. Активация —
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
  perform pg_temp.append(pg_temp.draft_of('PRIVACY'), 2, 'Ajoneuvon tarkistus noudossa:',
    'Ajoneuvon tarkistus noudossa: rahtivarkauksien estämiseksi kuljetuksen ensimmäisessä noudossa verrataan tilaukseen ajoneuvon ja perävaunun rekisterinumeroa, jonka kuljettaja vahvistaa sovelluksessa, ajoneuvon viimeisintä sijaintia kuljetusliikkeen liittämästä GPS-järjestelmästä sekä sitä, kuittasiko noudon tilaukselle merkitty kuljettaja. Tallennamme vain tuloksen: rekisterinumerot, etäisyyden noutopaikasta ja sijainnin ajankohdan (ei koordinaatteja) sekä tiedon kuljettajan täsmäämisestä. Tulos näytetään tilaajalle ja kuljetusliikkeelle. Poikkeama on vain merkintä, jonka ihminen tarkistaa; kuljetusta ei pysäytetä eikä siitä tehdä automaattista päätöstä. Kun osapuoli vahvistaa poikkeaman kunnossa olevaksi, tallennamme vahvistajan, ajankohdan ja perustelun. Tiedot säilytetään samoin kuin kuljetuksen asiakirjat. Peruste on Aivomaa Oy:n ja palvelun käyttäjien oikeutettu etu estää rahtipetokset.',
    'Vehicle check at pickup: to prevent cargo theft, at the first pickup of a transport we compare with the order the registration number of the vehicle and trailer confirmed by the driver in the app, the latest position of the vehicle from the GPS system connected by the carrier, and whether the pickup was completed by the driver assigned to the order. We store only the result: the registration numbers, the distance from the pickup place and the time of the position (no coordinates), and whether the driver matched. The result is shown to the customer and the carrier. A discrepancy is only a flag for a person to check; the transport is not stopped and no automated decision is made. When a party confirms a discrepancy as in order, we store who confirmed it, when and why. The data is kept in the same way as the transport documents. The legal basis is the legitimate interest of Aivomaa Oy and the users of the service in preventing freight fraud.');
end;
$$;

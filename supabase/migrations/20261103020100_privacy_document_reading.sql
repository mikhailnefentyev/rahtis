-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · политика: чтение фото талонов и текстов заказов (3.11.2026)
--
-- Под поведение 20261103020000_weigh_tickets (фото весового талона →
-- n8n → OpenAI → поля рейса) и заказа из текста или PDF (доработка 2:
-- вставленный текст или файл заказа читает то же n8n → OpenAI). PRIVACY —
-- новый пункт 2.19 после 2.16 (объект), 2.17 (топливо), 2.18 (GPS):
-- что уходит на чтение, кому (OpenAI и n8n — обработчики), зачем,
-- передача за ЕЭЗ по стандартным договорным условиям (6.4); 8.4 — срок
-- как у документов рейса. Черновик, активация — решение пользователя.
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
    and d.version > (select version from public.legal_documents where id = v_active)
  order by d.version desc
  limit 1;

  if v_draft is null then
    insert into public.legal_documents (kind, version, status, effective_from)
    values (p_kind, (select max(version) + 1 from public.legal_documents where kind = p_kind), 'DRAFT', current_date)
    returning id into v_draft;

    insert into public.legal_clauses (document_id, locale, path, title, body)
    select v_draft, c.locale, c.path, c.title, c.body
    from public.legal_clauses c where c.document_id = v_active;
  end if;

  return v_draft;
end;
$$;

create or replace function pg_temp.swap(p_doc uuid, p_path integer[], p_locale text, p_from text, p_to text)
returns void
language plpgsql
as $$
begin
  update public.legal_clauses
  set body = replace(body, p_from, p_to)
  where document_id = p_doc and path = p_path and locale = p_locale and position(p_from in body) > 0;
  if not found then
    raise exception 'Пункт % (%): фрагмент не найден: %', array_to_string(p_path, '.'), p_locale, left(p_from, 60);
  end if;
end;
$$;

do $$
declare
  v_doc uuid := pg_temp.draft_of('PRIVACY');
begin
  delete from public.legal_clauses where document_id = v_doc and path = array[2, 19];

  insert into public.legal_clauses (document_id, locale, path, title, body)
  values
    (v_doc, 'fi', array[2, 19], null,
     'Automaattinen luku: kuljettaja tai kuljetusliike voi ottaa kuvan työmaakuorman punnituslipusta (kohta 2.16), ja tilauksen voi luoda liittämällä palveluun tilauksen tekstin tai PDF-tiedoston. Punnituslipun kuva sekä tilauksen teksti tai tiedosto välitetään luettaviksi OpenAI:n kielimallille n8n-palvelun kautta; OpenAI ja n8n toimivat henkilötietojen käsittelijöinä. Punnituslipusta luetaan lipun numero, punnitusaika, rekisterinumerot, brutto-, tara- ja nettomassa, materiaali ja vaa''an nimi, tilauksesta reitin pisteet, aikataulu, kuorman tiedot sekä mahdolliset yhteyshenkilöt. Tarkoituksena on säästää käsin syöttämistä ja havaita virheet, kuten saman lipun kirjaaminen kahdesti, väärä rekisterinumero tai desimaalivirhe. Käyttäjä tarkistaa luetut tiedot ennen tallennusta, eikä mitään tallenneta ilman hänen vahvistustaan. Lipun kuva tallennetaan kuorman liitteeksi, ja tiedoston tunnisteella tunnistetaan saman kuvan uudelleenkäyttö yrityksen sisällä. OpenAI voi käsitellä tietoja ETA-alueen ulkopuolella; siirrossa noudatetaan Euroopan komission vakiosopimuslausekkeita, ja siihen sovelletaan kohtaa 6.4.'),
    (v_doc, 'en', array[2, 19], null,
     'Automatic reading: a driver or a carrier may take a photo of the weighing ticket of a worksite load (clause 2.16), and an order may be created by pasting the text of the order or attaching it as a PDF file. The photo of the ticket and the text or file of the order are passed for reading to OpenAI''s language model through the n8n service; OpenAI and n8n act as processors. From a ticket, the ticket number, the time of weighing, the registration numbers, the gross, tare and net weight, the material and the name of the scale are read; from an order, the stops of the route, the schedule, the details of the cargo and any contact persons. The purpose is to save manual entry and to catch errors such as the same ticket being recorded twice, a wrong registration number or a misplaced decimal point. The user checks the data read before it is saved, and nothing is saved without their confirmation. The photo of the ticket is stored as an attachment of the load, and a fingerprint of the file is used to recognise the same photo being used again within the company. OpenAI may process data outside the EEA; the transfer is made under the standard contractual clauses of the European Commission, and clause 6.4 applies to it.');

  perform pg_temp.swap(v_doc, array[8, 4], 'fi',
    'Määräajan umpeuduttua tiedot poistetaan automaattisesti;',
    'Kohdan 2.19 punnituslippujen kuvat sekä tilauksen pohjaksi liitetyt tekstit ja tiedostot säilytetään kuten kuljetuksen asiakirjat. Määräajan umpeuduttua tiedot poistetaan automaattisesti;');
  perform pg_temp.swap(v_doc, array[8, 4], 'en',
    'When the period ends, the data is deleted automatically;',
    'The weighing ticket photos and the order texts and files of clause 2.19 are retained like the documents of the job. When the period ends, the data is deleted automatically;');
end;
$$;

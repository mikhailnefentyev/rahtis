-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · документы снова называют полмесяца
--
-- 21.09.2026 TERMS v8 и SHIPPER_AGREEMENT v4 (двухнедельные периоды)
-- были активированы раньше, чем решение о двух неделях отменили
-- (миграция half_month_periods). Та миграция удаляла только черновики и
-- действующие редакции не заметила: сейчас документы обещают две недели,
-- а система считает 1–15 и 16–конец.
--
-- Правятся черновики следующих редакций: TERMS 8.4 (черновик v9 уже
-- заведён миграцией legal_tes_template) и SHIPPER_AGREEMENT 9.1, 9.2.
-- Автоматический счёт в текстах остаётся — он действует. Пункт 9.2
-- договора заказчика возвращается к тексту v3 слово в слово.
-- Активация — решение пользователя.
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
  v_shipper uuid := pg_temp.draft_of('SHIPPER_AGREEMENT');
  v_v3 uuid;
begin
  perform pg_temp.put(v_terms, array[8, 4],
    'Tilityskausi on puoli kuukautta: kuukauden 1.–15. päivä ja 16. päivästä kuukauden loppuun. Kuljetus kuuluu siihen kauteen, jonka aikana se on merkitty valmiiksi. Aivomaa Oy lähettää tilaajalle laskun automaattisesti kauden päätyttyä. Tilaaja maksaa kauden 15 päivän kuluessa kauden päättymisestä, ja kuljetusliikkeelle maksetaan 30 päivän kuluessa kauden päättymisestä.',
    'The settlement period is half a month: the 1st to the 15th, and the 16th to the last day of the month. A transport belongs to the period in which it was marked complete. Aivomaa Oy sends the shipper an invoice automatically when the period ends. The shipper pays within 15 days of the end of the period, and the carrier is paid within 30 days of the end of the period.');

  perform pg_temp.put(v_shipper, array[9, 1],
    'Tilityskaudet ovat kuukauden 1.–15. päivä ja 16. päivä kuukauden viimeiseen päivään. Aivomaa Oy laskuttaa tilaajaa omissa nimissään kauden aikana valmistuneista töistä ja vahvistetuista lisistä. Lasku muodostetaan ja lähetetään automaattisesti kauden päätyttyä sovittua kanavaa pitkin niin, että se näkyy myös palvelussa.',
    'The settlement periods are the 1st to the 15th of the month and the 16th to the last day of the month. Aivomaa Oy invoices the shipper in its own name for the work completed and the confirmed surcharges of the period. The invoice is issued and sent automatically when the period ends, through the agreed channel, so that it is also visible in the service.');

  /* 9.2 — как в v3: пример с 1–15 и 16–30 сентября. */
  select id into v_v3 from public.legal_documents where kind = 'SHIPPER_AGREEMENT' and version = 3;

  update public.legal_clauses c
  set body = o.body
  from public.legal_clauses o
  where c.document_id = v_shipper and c.path = array[9, 2]
    and o.document_id = v_v3 and o.path = array[9, 2] and o.locale = c.locale;
end;
$$;

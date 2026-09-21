-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · документы догоняют двухнедельные периоды
--
-- С миграции two_week_periods расчётный период — две недели с
-- понедельника по воскресенье, а счёт заказчику уходит сам после конца
-- периода. Действующие условия (8.4) и договор заказчика (9.1, 9.2)
-- называют период половиной месяца. Правятся черновики следующих
-- редакций; действующие не трогаются. Активация — решение пользователя.
--
-- Сроки не меняются: заказчик платит в течение 15 дней после конца
-- периода, перевозчику платят в течение 30.
--
-- Заодно: границы текущего периода нужны странице расчётов оператора.
-- Это календарь, а не данные, поэтому функция открыта вошедшим.
-- ═══════════════════════════════════════════════════════════════════

grant execute on function public.settlement_period(timestamptz) to authenticated;

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
begin
  perform pg_temp.put(v_terms, array[8, 4],
    'Tilityskausi on kaksi viikkoa maanantaista sunnuntaihin. Kuljetus kuuluu siihen kauteen, jonka aikana se on merkitty valmiiksi. Aivomaa Oy lähettää tilaajalle laskun automaattisesti kauden päätyttyä. Tilaaja maksaa kauden 15 päivän kuluessa kauden päättymisestä, ja kuljetusliikkeelle maksetaan 30 päivän kuluessa kauden päättymisestä.',
    'The settlement period is two weeks, from Monday to Sunday. A transport belongs to the period in which it was marked complete. Aivomaa Oy sends the shipper an invoice automatically when the period ends. The shipper pays within 15 days of the end of the period, and the carrier is paid within 30 days of the end of the period.');

  perform pg_temp.put(v_shipper, array[9, 1],
    'Tilityskausi on kaksi viikkoa maanantaista sunnuntaihin. Aivomaa Oy laskuttaa tilaajaa omissa nimissään kauden aikana valmistuneista töistä ja vahvistetuista lisistä. Lasku muodostetaan ja lähetetään automaattisesti kauden päätyttyä sovittua kanavaa pitkin niin, että se näkyy myös palvelussa.',
    'The settlement period is two weeks, from Monday to Sunday. Aivomaa Oy invoices the shipper in its own name for the work completed and the confirmed surcharges of the period. The invoice is issued and sent automatically when the period ends, through the agreed channel, so that it is also visible in the service.');

  perform pg_temp.put(v_shipper, array[9, 2],
    'Tilaaja maksaa laskun 15 kalenteripäivän kuluessa kyseisen tilityskauden päättymisestä. Esimerkiksi 14.–27.9.2026 tehdyt työt maksetaan 12.10.2026 mennessä. Määräaika lasketaan kauden päättymisestä, ei viikkoraportista.',
    'The shipper pays the invoice within 15 calendar days of the end of the settlement period concerned. For example, work between 14 and 27 September 2026 is paid by 12 October 2026. The period runs from the end of the settlement period, not from the weekly report.');
end;
$$;

-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · документы: самосвальные заказы (28.10.2026)
--
-- Под поведение 20261028190100_tipper_orders: цена стройки — ставка за
-- час, рейс или тонну; на столе — ориентир, итог — по записям водителя
-- при закрытии рейса. Заказчик видит наработанное (дни, часы, рейсы,
-- тонны) — новый зритель записей водителя на объекте.
--   SHIPPER_AGREEMENT — 3.5 (цена по факту);
--   PRIVACY — 2.16 дополнен (кто видит записи по заказу платформы).
-- Черновики; активация — решение пользователя.
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

do $$
declare
  v_shipper uuid := pg_temp.draft_of('SHIPPER_AGREEMENT');
  v_privacy uuid := pg_temp.draft_of('PRIVACY');
begin
  delete from public.legal_clauses where document_id = v_shipper and path = array[3, 5];
  insert into public.legal_clauses (document_id, locale, path, title, body)
  values
    (v_shipper, 'fi', array[3, 5], null,
     'Maansiirto- ja kippityössä (tilauksen laji ”Maansiirto”) hinta sovitaan yksikköhintana tunnilta, kuormalta tai tonnilta ilman arvonlisäveroa. Tilauksessa näkyvä hinta on yksikköhinnan ja arvioidun määrän tulo ja vain arvio. Lopullinen hinta lasketaan toteutuneesta: tunnit saapumisesta kohteelle päivän päättymiseen (viimeinen purku ja sovittu lisäaika tai kuljettajan merkitsemä päättyminen), kuormien määrä tai punnitusten nettotonnit kuljettajan sovelluksessa tekemien merkintöjen mukaan. Lopullinen hinta vahvistuu, kun suorittaja sulkee ajon; tilaaja näkee toteuman tilauksessa ja voi tehdä siitä huomautuksen reklamaationa.'),
    (v_shipper, 'en', array[3, 5], null,
     'In earthworks and tipper work (order type “Earthworks”), the price is agreed as a unit rate per hour, load or tonne excluding VAT. The price shown in the order is the unit rate multiplied by the estimated quantity and is an estimate only. The final price is counted from the actual work: the hours from arrival at the site to the end of the day (the last unloading plus the agreed buffer, or the end recorded by the driver), the number of loads or the net tonnes weighed, according to the driver''s records in the app. The final price is fixed when the performing party closes the trip; the shipper sees the actual work in the order and may object to it as a claim.');

  update public.legal_clauses
  set body = body || ' Kun työ on tilattu palvelun kautta (tilauksen laji ”Maansiirto”), tilaaja näkee tilauksessa päivien määrän, tunnit, kuormat ja punnitusten nettotonnit, joista lopullinen hinta lasketaan.'
  where document_id = v_privacy and path = array[2, 16] and locale = 'fi' and body not like '%tilauksen laji ”Maansiirto”%';
  update public.legal_clauses
  set body = body || ' When the work is ordered through the service (order type “Earthworks”), the shipper sees in the order the number of days, the hours, the loads and the net tonnes weighed from which the final price is counted.'
  where document_id = v_privacy and path = array[2, 16] and locale = 'en' and body not like '%order type “Earthworks”%';
end;
$$;

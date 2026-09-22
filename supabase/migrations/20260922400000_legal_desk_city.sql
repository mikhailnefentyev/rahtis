-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · документы: на столе заказов — только город
--
-- Миграция desk_city_only убрала со стола всё, по чему узнаётся склад
-- заказчика: название места, адрес, номер брони, заметку и точную линию
-- маршрута; координаты округлены до 0,1° (около 10 км). Полные данные
-- точек перевозчик получает, когда рейс назначен ему.
--
-- В действующих редакциях (TERMS v10, PRIVACY v9, активированы
-- 22.09.2026) это правило не названо: ближайшее — PRIVACY 10.2, где
-- сказано лишь, что места видны «в той мере, в какой этого требует
-- перевозка». Здесь правило называется прямо:
--   · TERMS 6.8 — что видно на столе и когда открываются точки;
--   · PRIVACY 10.2 — то же в разделе о видимости данных.
--
-- Заодно удаляется брошенный черновик PRIVACY v2: он старше
-- действующей редакции, ни во что не превратится и только мешает
-- смотреть список.
--
-- Активация — решение пользователя.
-- ═══════════════════════════════════════════════════════════════════

-- ── Брошенный черновик ─────────────────────────────────────────────

do $$
declare
  v_doc uuid;
begin
  select id into v_doc from public.legal_documents
  where kind = 'PRIVACY' and status = 'DRAFT' and version = 2;

  if v_doc is null then
    raise notice 'Черновика PRIVACY v2 нет — удалять нечего.';
    return;
  end if;

  /* Принятую редакцию не удаляем ни при каких условиях: согласие
     компании ссылается на версию, и без неё непонятно, что принято. */
  if exists (select 1 from public.legal_acceptances a where a.document_id = v_doc) then
    raise exception 'У PRIVACY v2 есть принятия — черновик не удаляется.' using errcode = '55006';
  end if;

  delete from public.legal_documents where id = v_doc;
end;
$$;


-- ── Черновики документов ───────────────────────────────────────────

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
  /* Новый пункт: раздел 6 кончается прямыми заказами, и правило стола
     встаёт следом. Вставлять его в середину нельзя — на 6.6 и 6.7
     ссылается договор заказчика. */
  perform pg_temp.put(v_terms, array[6, 8],
    'Tarjouspöydällä toimeksiannosta näkyvät lastaus- ja purkupaikan kaupunki, aikataulu, matka, kuorma ja kuljetettavan yksikön tiedot. Paikan nimeä, tarkkaa osoitetta, varausnumeroa, huomautuksia, yhteyshenkilöitä eikä tarkkaa reittiviivaa ei näytetä, ja kartalla pisteet esitetään noin kymmenen kilometrin tarkkuudella. Pisteiden täydelliset tiedot avautuvat sille kuljetusliikkeelle ja kuljettajalle, jolle keikka on osoitettu; ilman niitä kuormaa ei voi noutaa.',
    'On the offer table, an assignment shows the city of the loading and unloading place, the schedule, the distance, the cargo and the details of the unit to be transported. The name of the place, the exact address, the booking reference, notes, contact persons and the exact route line are not shown, and on the map the points are presented with an accuracy of about ten kilometres. The full details of the points open to the carrier and the driver to whom the job has been assigned; without them the load cannot be collected.');

  /* Тот же факт в разделе о видимости данных: там он и ищется. */
  perform pg_temp.put(v_privacy, array[10, 2],
    'Tilaaja ei näe kuljetusliikkeen nimeä eikä sen henkilöstön yhteystietoja, eikä kuljetusliike näe tilaajan nimeä, yhteystietoja eikä laskutustietoja; kuljetusliikkeelle tilaaja näkyy koodilla. Tarjouspöydällä kuljetusliike näkee pisteistä vain kaupungin, ja kartalla ne esitetään noin kymmenen kilometrin tarkkuudella; paikan nimi, tarkka osoite, varausnumero, huomautukset ja yhteyshenkilöt avautuvat vasta, kun keikka on osoitettu sille. Lastaus- ja purkupaikkojen tiedot näkyvät kuljetusliikkeelle ja kuljettajalle siltä osin kuin kuljetus sitä edellyttää. Kuljetusliike ei näe muiden kuljetusliikkeiden kalustoa eikä niiden sijaintia. Ajoneuvoista, jotka ovat ajaneet tilaajan keikkoja ja joiden kuljetusliike on sallinut suorat tilaukset, tilaaja näkee rekisteritunnuksen ja kuljetusliikkeen arvosanan sekä yhteydenpitoa varten kuljettajan nimen, puhelinnumeron ja sähköpostiosoitteen. [Kohta täydennetään juristin kanssa: kuljettajan yhteystietojen luovuttamisen peruste ja kuljettajalle annettava tieto.]',
    'A shipper does not see the carrier''s name or its personnel contact details, and a carrier does not see the shipper''s name, contact details or billing details; the shipper is shown to the carrier by a code. On the offer table a carrier sees only the city of the points, and on the map they are presented with an accuracy of about ten kilometres; the name of the place, the exact address, the booking reference, notes and contact persons open only once the job has been assigned to it. Loading and unloading place details are visible to the carrier and the driver to the extent the transport requires. A carrier does not see other carriers'' vehicles or their locations. For vehicles that have performed the shipper''s jobs and whose carrier has allowed direct orders, the shipper sees the registration number and the carrier''s rating and, for contact, the driver''s name, telephone number and email address. [This clause is to be completed with counsel: the basis for disclosing the driver''s contact details and the information given to the driver.]');
end;
$$;

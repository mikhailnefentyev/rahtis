-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · политика: ежедневный осмотр машины водителем (15.11.2026)
--
-- Под поведение 20261115120000_vehicle_inspections. Новое о водителе:
-- кто и когда осмотрел машину, пробег и результат по пунктам. Подпункт
-- «Kaluston huolto ja vikailmoitukset» (2.29) дополняется: что
-- записывается, кто видит, срок — 24 месяца с осмотра. Черновик PRIVACY;
-- активация — решение пользователя.
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
begin
  /* Уже дополнен (повторный прогон) — ничего не делаем. */
  if exists (
    select 1 from public.legal_clauses
    where document_id = v_doc and locale = 'fi' and body like 'Kaluston huolto ja vikailmoitukset:%' and body like '%lähtötarkastu%'
  ) then
    return;
  end if;

  update public.legal_clauses
  set body = replace(replace(body,
      'Ilmoituksen sijaintia ei tallenneta.',
      'Kuljettaja voi myös kirjata sovelluksessa auton lähtötarkastuksen ennen ajoa: silloin tallennetaan tarkastaja, aika, auto, hänen halutessaan mittarilukema sekä kunkin tarkastuskohteen tulos, ja havaitut viat kirjataan vikailmoituksina. Ilmoituksen tai tarkastuksen sijaintia ei tallenneta.'),
      'Korjatut tai suljetut vikailmoitukset kuvineen poistetaan automaattisesti 24 kuukauden kuluttua sulkemisesta.',
      'Lähtötarkastuksia näkevät kuljetusliike, palvelun ylläpito ja tarkastuspäivänä saman auton kuljettajat. Korjatut tai suljetut vikailmoitukset kuvineen poistetaan automaattisesti 24 kuukauden kuluttua sulkemisesta, ja lähtötarkastukset 24 kuukauden kuluttua tarkastuksesta.')
  where document_id = v_doc and locale = 'fi' and body like 'Kaluston huolto ja vikailmoitukset:%';

  update public.legal_clauses
  set body = replace(replace(body,
      'The location of the report is not stored.',
      'The driver may also record a pre-trip inspection of the vehicle in the app, in which case the inspector, the time, the vehicle, if the driver chooses, the odometer reading, and the result for each inspection item are stored, and any defects found are recorded as defect reports. The location of a report or inspection is not stored.'),
      'Repaired or closed defect reports and their photos are deleted automatically 24 months after they were closed.',
      'Pre-trip inspections are visible to the carrier, the service administrators and, on the day of the inspection, the drivers of the same vehicle. Repaired or closed defect reports and their photos are deleted automatically 24 months after they were closed, and pre-trip inspections 24 months after the inspection.')
  where document_id = v_doc and locale = 'en' and body like 'Fleet maintenance and defect reports:%';

  /* Текст подпункта не тот, что ожидался, — лучше упасть, чем молча оставить политику без осмотров. */
  if not exists (
    select 1 from public.legal_clauses
    where document_id = v_doc and locale = 'fi' and body like '%lähtötarkastuksen ennen ajoa%' and body like '%24 kuukauden kuluttua tarkastuksesta%'
  ) or not exists (
    select 1 from public.legal_clauses
    where document_id = v_doc and locale = 'en' and body like '%pre-trip inspection of the vehicle%' and body like '%24 months after the inspection%'
  ) then
    raise exception 'PRIVACY: подпункт об обслуживании парка не найден или изменён.';
  end if;
end;
$$;

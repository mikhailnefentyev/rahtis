-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · политика: заправки из системы GPS (29.10.2026)
--
-- Под поведение 20261029030000_fuel_sources: если перевозчик подключил
-- систему слежения (PRIVACY 2.18), из неё могут приходить заправки —
-- машина, время, топливо, объём и пробег по счётчику GPS. Место
-- заправки по-прежнему не пишем. Срок — те же 24 месяца пункта 8.4.
-- Черновик v21, активация — решение пользователя.
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
  perform pg_temp.swap(v_doc, array[2, 17], 'fi',
    'Raportin rivit luetaan automaattisesti',
    'Jos kuljetusliike on liittänyt ajoneuvojen seurantajärjestelmän (kohta 2.18), siitä voidaan tallentaa järjestelmän havaitsemat tankkaukset: auto, aika, polttoaine, määrä ja seurantajärjestelmän kilometrilukema. Kuljetusliike näkee eri lähteiden määrät rinnakkain, jotta erot huomataan. Raportin rivit luetaan automaattisesti');
  perform pg_temp.swap(v_doc, array[2, 17], 'en',
    'The lines of the report are read automatically',
    'If the carrier has connected a vehicle tracking system (clause 2.18), the refuelling it detects may be stored: the vehicle, time, fuel, quantity and the mileage of the tracking system. The carrier sees the quantities from the different sources side by side so that differences are noticed. The lines of the report are read automatically');
end;
$$;

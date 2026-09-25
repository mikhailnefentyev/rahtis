-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · договор заказчика: на погрузку и выгрузку по 1 часу, не по 2
--
-- Решение пользователя от 25.09.2026: в цену входит 1 час на погрузку и
-- отдельно 1 час на выгрузку — так работают многие на рынке. Ставка за
-- превышение (5.2: 45 € без ALV за каждый начатый час, отдельно по
-- погрузке и выгрузке) не меняется.
--
-- Меняются 5.1 (норма) и 5.3 (примеры — пересчитаны под новую норму):
--
--   погрузка 1 ч 15 мин                    → 45 €
--   погрузка 2 ч 15 мин                    → 90 €
--   погрузка 1 ч 15 мин + выгрузка 1 ч 10  → 45 + 45 = 90 €
--
-- В коде норма нигде не зашита: доплату за простой платформа сама не
-- считает, она выставляется по претензии DOWNTIME. Поэтому меняется
-- только текст.
--
-- Черновик SHIPPER_AGREEMENT заводится от действующей v7. Активация —
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

do $$
declare
  v_doc uuid := pg_temp.draft_of('SHIPPER_AGREEMENT');
  v_hit integer;
begin
  update public.legal_clauses
  set body = replace(
    body,
    'Hintaan sisältyy erikseen 2 tuntia lastaukseen ja erikseen 2 tuntia purkuun.',
    'Hintaan sisältyy erikseen 1 tunti lastaukseen ja erikseen 1 tunti purkuun.')
  where document_id = v_doc and path = array[5, 1] and locale = 'fi';

  update public.legal_clauses
  set body = replace(
    body,
    'The price includes 2 hours for loading and, separately, 2 hours for unloading.',
    'The price includes 1 hour for loading and, separately, 1 hour for unloading.')
  where document_id = v_doc and path = array[5, 1] and locale = 'en';

  update public.legal_clauses
  set body = 'Esimerkkejä: lastaus 1 tunti 15 minuuttia - lisä 45 euroa; lastaus 2 tuntia 15 minuuttia - 90 euroa; lastaus 1 tunti 15 minuuttia ja purku 1 tunti 10 minuuttia - yhteensä 90 euroa ilman arvonlisäveroa.'
  where document_id = v_doc and path = array[5, 3] and locale = 'fi'
    and body like 'Esimerkkejä: lastaus 2 tuntia 15 minuuttia - lisä 45 euroa;%';

  update public.legal_clauses
  set body = 'Examples: loading 1 hour 15 minutes - a surcharge of 45 euros; loading 2 hours 15 minutes - 90 euros; loading 1 hour 15 minutes and unloading 1 hour 10 minutes - 90 euros excluding value added tax in total.'
  where document_id = v_doc and path = array[5, 3] and locale = 'en'
    and body like 'Examples: loading 2 hours 15 minutes - a surcharge of 45 euros;%';

  select count(*) into v_hit
  from public.legal_clauses c
  where c.document_id = v_doc
    and (
      (c.path = array[5, 1] and (c.body like '%1 tunti lastaukseen%' or c.body like '%1 hour for loading%'))
      or (c.path = array[5, 3] and (c.body like '%lastaus 1 tunti 15%' or c.body like '%loading 1 hour 15%'))
    );

  if v_hit <> 4 then
    raise exception 'Заменены не все четыре текста (получилось %).', v_hit using errcode = '55000';
  end if;
end;
$$;

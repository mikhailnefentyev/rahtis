-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · документы: приглашение перевозчика
--
-- Под поведение 20261005100000: приглашение бывает не только заказчику, но и
-- другому перевозчику. PRIVACY 2.11 — новый черновик (v16 действует).
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
  v_privacy uuid := pg_temp.draft_of('PRIVACY');
begin
  update public.legal_clauses
  set body = replace(body, 'kun kuljetusliike kutsuu asiakkaansa palveluun,', 'kun kuljetusliike kutsuu asiakkaansa tai toisen kuljetusliikkeen palveluun,')
  where document_id = v_privacy and path = array[2, 11] and locale = 'fi';

  update public.legal_clauses
  set body = replace(body, 'when a carrier invites its customer to the service,', 'when a carrier invites its customer or another carrier to the service,')
  where document_id = v_privacy and path = array[2, 11] and locale = 'en';

  if (select count(*) from public.legal_clauses where document_id = v_privacy and path = array[2, 11]
      and (body like '%toisen kuljetusliikkeen%' or body like '%another carrier%')) <> 2 then
    raise exception 'PRIVACY 2.11: формулировка о приглашениях не найдена.';
  end if;
end;
$$;

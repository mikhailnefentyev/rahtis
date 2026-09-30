-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · документы: сначала своим, потом на стол
--
-- Под поведение 20260930160000: заказ группе знакомых машин на 15–120
-- минут, первый взявший получает подтверждённым, потом — стол. TERMS
-- 6.6 — дополнение в черновик v18. Активация — решение пользователя.
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
begin
  update public.legal_clauses
  set body = body || case locale when 'fi' then ' Tilaaja voi myös tarjota toimeksiannon ensin ryhmälle tuttuja ajoneuvoja (2–10) valitsemakseen ajaksi (15–120 minuuttia). Tänä aikana toimeksianto näkyy vain näiden ajoneuvojen kuljetusliikkeille, eikä tarjouspöydän tarjouksia oteta. Ensimmäinen kuljetusliike, joka ottaa toimeksiannon ryhmän ajoneuvolle, saa sen, ja kuljetussopimus syntyy ottamisesta ilman erillistä vahvistusta. Jos kukaan ei ota toimeksiantoa määräajassa, se julkaistaan tarjouspöydällä muille kuljetusliikkeille.' else ' The shipper may also first offer a job to a group of known vehicles (2–10) for a period it chooses (15–120 minutes). During that period the job is visible only to the carriers of those vehicles, and no board offers are taken. The first carrier to take the job for a vehicle in the group gets it, and the contract of carriage is formed on taking without a separate confirmation. If nobody takes the job within the period, it is published on the board for other carriers.' end
  where document_id = v_terms and path = array[6, 6] and locale in ('fi', 'en')
    and body not like '%(2–10)%';
end;
$$;

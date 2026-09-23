-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · документы: формат сотрудничества меняет сам перевозчик
--
-- Пункт 8.5 говорит, что перевозчик выбирает способ, но молчит о том,
-- как и когда его менять. Теперь смена доступна в кабинете, и у неё
-- есть правило: не посреди рейсов в работе, и уже выполненные рейсы она
-- не переписывает. Оба условия должны стоять в условиях, а не
-- обнаруживаться нажатием.
--
-- Черновик заводится от действующей редакции: прежний стал действующим
-- 23.09.2026 в 21:45, и править задним числом принятый текст нельзя.
--
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

do $$
declare
  v_terms uuid := pg_temp.draft_of('TERMS');
  v_hit integer;
begin
  update public.legal_clauses
  set body = replace(
    body,
    'Palvelua voi käyttää kahdella tavalla, ja kuljetusliike valitsee kumpaa se käyttää.',
    'Palvelua voi käyttää kahdella tavalla, ja kuljetusliike valitsee kumpaa se käyttää. Tapaa voi vaihtaa palvelussa: vaihto koskee vaihdon jälkeen vahvistettuja keikkoja eikä muuta jo valmistuneiden keikkojen maksuja, eikä sitä voi tehdä silloin, kun kuljetusliikkeellä on keikkoja kesken.')
  where document_id = v_terms and path = array[8, 5] and locale = 'fi';

  update public.legal_clauses
  set body = replace(
    body,
    'The service can be used in two ways, and the carrier chooses which one it uses.',
    'The service can be used in two ways, and the carrier chooses which one it uses. The way can be changed in the service: the change applies to jobs confirmed after it, does not alter the fees on jobs already completed, and cannot be made while the carrier has jobs in progress.')
  where document_id = v_terms and path = array[8, 5] and locale = 'en';

  select count(*) into v_hit
  from public.legal_clauses c
  where c.document_id = v_terms and c.path = array[8, 5]
    and (c.body like '%Tapaa voi vaihtaa palvelussa%' or c.body like '%The way can be changed in the service%');

  if v_hit <> 2 then
    raise exception 'Заменены не оба текста (получилось %).', v_hit using errcode = '55000';
  end if;
end;
$$;

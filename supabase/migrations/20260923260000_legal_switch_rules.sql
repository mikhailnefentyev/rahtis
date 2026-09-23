-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · документы: когда смена формата вступает в силу
--
-- Черновик TERMS v13 обещал правило, которого больше нет: «менять
-- нельзя, пока есть рейсы в работе». Ограничение снято — сторона
-- договора теперь решается при взятии рейса и позже не меняется, так
-- что рейсам в пути смена не грозит.
--
-- Вместо него записано действующее правило: в подряд — сразу, обратно
-- в подписку — с первого числа следующего месяца.
--
-- Черновик заводится от действующей редакции: v13 вы активировали,
-- и принятый текст задним числом не правят.
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
    'Tapaa voi vaihtaa palvelussa: vaihto koskee vaihdon jälkeen vahvistettuja keikkoja eikä muuta jo valmistuneiden keikkojen maksuja, eikä sitä voi tehdä silloin, kun kuljetusliikkeellä on keikkoja kesken.',
    'Tapaa voi vaihtaa palvelussa, ja vaihto koskee vaihdon jälkeen vahvistettuja keikkoja: jo vahvistettujen ja valmistuneiden keikkojen maksut eivät muutu. Siirtyminen alihankintaan tulee voimaan heti. Paluu kuukausimaksuun tulee voimaan seuraavan kalenterikuukauden alusta, koska alihankintana otettu työ ajetaan loppuun sen ehdoilla.')
  where document_id = v_terms and path = array[8, 5] and locale = 'fi';

  update public.legal_clauses
  set body = replace(
    body,
    'The way can be changed in the service: the change applies to jobs confirmed after it, does not alter the fees on jobs already completed, and cannot be made while the carrier has jobs in progress.',
    'The way can be changed in the service, and the change applies to jobs confirmed after it: the fees on jobs already confirmed or completed do not change. A move to subcontracting takes effect immediately. A return to the monthly fee takes effect from the beginning of the next calendar month, because work taken as subcontracting is driven to the end on its terms.')
  where document_id = v_terms and path = array[8, 5] and locale = 'en';

  select count(*) into v_hit
  from public.legal_clauses c
  where c.document_id = v_terms and c.path = array[8, 5]
    and (c.body like '%seuraavan kalenterikuukauden alusta%'
      or c.body like '%from the beginning of the next calendar month%');

  if v_hit <> 2 then
    raise exception 'Заменены не оба текста (получилось %).', v_hit using errcode = '55000';
  end if;
end;
$$;

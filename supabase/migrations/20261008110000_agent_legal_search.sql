-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · помощник ищет ответ в договорах
--
-- 8.10.2026: перевозчик спросил помощника «кто отвечает за груз» и
-- получил «зависит от условий договора, передам оператору». Ответ есть
-- в договоре перевозчика (15.2, 4.1), но у помощника был только пункт по
-- номеру, и только из условий использования и политики приватности:
-- номера собеседник не знает, договоров сторон помощник не видел.
--
-- agent_legal_search — поиск по действующим редакциям: условия,
-- политика и договор своей стороны (перевозчику и водителю — договор
-- перевозчика, заказчику — договор заказчика, оператору — все).
-- Слова сравниваются по началу (пять букв): финские падежи
-- (vastuu, vastuussa, vastuun) находятся одним словом.
-- ═══════════════════════════════════════════════════════════════════

create or replace function public.agent_legal_search(
  p_conversation_id uuid,
  p_token uuid,
  p_query text,
  p_locale text default 'fi'
)
returns table (kind public.legal_kind, number text, section_title text, body text, hits integer, version integer)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_conversation public.conversations := app.agent_context(p_conversation_id, p_token);
  v_kinds public.legal_kind[];
  v_words text[];
begin
  v_kinds := case v_conversation.audience
    when 'SHIPPER' then array['TERMS', 'PRIVACY', 'SHIPPER_AGREEMENT']::public.legal_kind[]
    when 'ADMIN' then array['TERMS', 'PRIVACY', 'SHIPPER_AGREEMENT', 'CARRIER_AGREEMENT']::public.legal_kind[]
    else array['TERMS', 'PRIVACY', 'CARRIER_AGREEMENT']::public.legal_kind[]
  end;

  select array_agg(distinct left(w, 5))
  into v_words
  from regexp_split_to_table(lower(coalesce(p_query, '')), '[^[:alnum:]äöåÄÖÅ]+') w
  where length(w) >= 4;

  if v_words is null then
    return;
  end if;

  return query
  select
    d.kind,
    c.number,
    (
      select s.title from public.legal_clauses s
      where s.document_id = c.document_id and s.locale = c.locale and s.path = c.path[1:1]
    ),
    c.body,
    (select count(*)::integer from unnest(v_words) w where position(w in lower(coalesce(c.title, '') || ' ' || coalesce(c.body, ''))) > 0) as hits,
    d.version
  from public.legal_clauses c
  join public.legal_documents d on d.id = c.document_id
  where d.status = 'ACTIVE'
    and d.kind = any (v_kinds)
    and c.locale = case when p_locale in ('fi', 'en') then p_locale else 'fi' end
    and c.body is not null
    and exists (select 1 from unnest(v_words) w where position(w in lower(coalesce(c.title, '') || ' ' || c.body)) > 0)
  order by hits desc, d.kind, c.path
  limit 8;
end;
$$;

revoke all on function public.agent_legal_search(uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.agent_legal_search(uuid, uuid, text, text) to agent, service_role;

-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · документы: ассистент кабинета отвечает через OpenAI
--
-- 1.10.2026 workflow агента в n8n переведён с Claude (Anthropic) на
-- OpenAI gpt-4.1-mini: Anthropic у пользователя не работает. PRIVACY 5.4
-- называл поставщиком Anthropic — правка в черновик v16, передача за
-- ЕЭЗ — по пункту 6.4. Активация — решение пользователя.
-- ═══════════════════════════════════════════════════════════════════

do $$
declare
  v_privacy uuid;
begin
  select id into v_privacy from public.legal_documents
  where kind = 'PRIVACY' and status = 'DRAFT'
  order by version desc limit 1;

  if v_privacy is null then
    raise exception 'Нет черновика PRIVACY.';
  end if;

  update public.legal_clauses
  set body = replace(body, 'muodostetaan Anthropicin kielimallilla', 'muodostetaan OpenAI:n kielimallilla')
             || case when body like '%kohtaa 6.4%' then '' else ' OpenAI voi käsitellä tietoja ETA-alueen ulkopuolella, ja siirtoon sovelletaan kohtaa 6.4.' end
  where document_id = v_privacy and path = array[5, 4] and locale = 'fi';

  update public.legal_clauses
  set body = replace(body, 'produced with Anthropic''s language model', 'produced with OpenAI''s language model')
             || case when body like '%clause 6.4%' then '' else ' OpenAI may process data outside the EEA, and clause 6.4 applies to the transfer.' end
  where document_id = v_privacy and path = array[5, 4] and locale = 'en';

  if exists (select 1 from public.legal_clauses where document_id = v_privacy and path = array[5, 4] and body like '%Anthropic%') then
    raise exception 'PRIVACY 5.4: Anthropic не заменён.';
  end if;
end;
$$;

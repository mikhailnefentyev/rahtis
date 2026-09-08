-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · площадка отдаётся на одном языке
--
-- Каждая площадка лежит двумя строками, финской и английской, а поиск
-- языка не различал и возвращал обе. Модель получала один и тот же порт
-- дважды: лишние строки в ответе, а на запрос «порт» половина выдачи
-- уходила на повторы вместо других портов.
--
-- Язык приходит от вызывающего, по умолчанию финский — язык площадок и
-- ворот. Прежняя трёхаргументная функция удаляется, а не остаётся
-- рядом: с аргументом по умолчанию две подошли бы на один и тот же
-- вызов, и Postgres отказался бы выбирать.
-- ═══════════════════════════════════════════════════════════════════

drop function if exists public.agent_place_guide(uuid, uuid, text);

create or replace function public.agent_place_guide(
  p_conversation_id uuid,
  p_token uuid,
  p_query text,
  p_locale text default 'fi'
)
returns table (place_key text, title text, body text)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_ctx public.conversations;
  v_locale text;
begin
  v_ctx := app.agent_context(p_conversation_id, p_token);

  /* Незнакомый язык — финский: пустая выдача хуже выдачи не на том языке. */
  v_locale := case when p_locale in ('fi', 'en') then p_locale else 'fi' end;

  return query
  select g.place_key, g.title, g.body
  from public.place_guides g
  where g.locale = v_locale
    and (g.company_id is null or g.company_id = v_ctx.company_id)
    and (
      g.place_key ilike '%' || btrim(p_query) || '%'
      or g.title ilike '%' || btrim(p_query) || '%'
      /*
       * И по телу: там лежат слова, которыми площадку называют
       * диспетчеры, включая русские. Иначе «Вуосаари» не находит
       * ничего, а «Vuosaari» находит.
       */
      or g.body ilike '%' || btrim(p_query) || '%'
    )
  order by (g.company_id is not null) desc, g.place_key
  limit 10;
end;
$$;

comment on function public.agent_place_guide(uuid, uuid, text, text) is
  'Площадка из справочника: адрес ворот и координаты. Часов работы и порядка въезда в справочнике нет.';

revoke all on function public.agent_place_guide(uuid, uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.agent_place_guide(uuid, uuid, text, text) to agent, service_role;

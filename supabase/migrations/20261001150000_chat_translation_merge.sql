-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · перевод сообщения дописывается, а не перезаписывается
--
-- Проверка 1.10.2026: у всех водителей app_language пуст — язык
-- приложения берётся из браузера, и при отправке сообщения сайт не знал,
-- что водителю нужен русский. Теперь недостающий перевод делается при
-- чтении, на язык читателя. Читателей бывает несколько одновременно,
-- поэтому перевод дописывается в translations одной операцией (||), а
-- не «прочитал — дополнил — записал», где второй затёр бы первого.
--
-- Только служебному ключу: переводы пишет сайт.
-- ═══════════════════════════════════════════════════════════════════

create or replace function public.merge_message_translation(
  p_id bigint,
  p_lang text,
  p_text text,
  p_source text
)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.order_messages
  set translations = case
        when p_text is null or p_lang = coalesce(p_source, source_lang) then translations
        else translations || jsonb_build_object(p_lang, left(p_text, 2000))
      end,
      source_lang = coalesce(source_lang, p_source)
  where id = p_id
    and p_lang ~ '^[a-z]{2}$';
$$;

revoke all on function public.merge_message_translation(bigint, text, text, text) from public, anon, authenticated;
grant execute on function public.merge_message_translation(bigint, text, text, text) to service_role;

-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · переписку с помощником можно стереть
--
-- Тред один на компанию и роль, и он копится: пробные вопросы, разговор
-- за прошлый месяц, чужая смена. Убрать его было нельзя ничем — политики
-- на удаление у переписки нет вовсе, и это верно: стирать чужую строку
-- не должен никто. Но свою переписку человек стирать вправе.
--
-- Функцией, а не политикой DELETE. Политика пустила бы и точечное
-- удаление отдельных сообщений — а переписка, из которой выброшено одно
-- сообщение, хуже отсутствующей: по ней делают выводы. Здесь либо весь
-- тред, либо ничего.
--
-- ТРЕД В РАБОТЕ НЕ УДАЛЯЕТСЯ. Пока висит dispatch_token, вопрос ушёл в
-- воркфлоу и ответ ещё придёт. Удалив тред под ним, мы получили бы
-- ошибку «тред не найден» в чужом журнале и потерянный ответ. Отказ
-- honest: подождите ответа и удаляйте.
--
-- Сообщения уходят каскадом: внешний ключ messages.conversation_id
-- объявлен on delete cascade с первого дня.
-- ═══════════════════════════════════════════════════════════════════

create or replace function public.delete_conversation(p_conversation_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_conversation public.conversations;
begin
  select * into v_conversation
  from public.conversations
  where id = p_conversation_id;

  if v_conversation.id is null then
    raise exception 'Переписка не найдена.' using errcode = 'P0002';
  end if;

  /*
   * Свой тред — это тред своей компании; у оператора своими считаются
   * операторские, без компании. Оператор при этом не получает права
   * стирать переписку сторон: их треды принадлежат компаниям, и
   * вмешиваться в них ему незачем.
   */
  if v_conversation.company_id is null then
    if not (select app.is_admin()) then
      raise exception 'Эта переписка не ваша.' using errcode = '42501';
    end if;
  elsif v_conversation.company_id is distinct from (select app.current_company_id()) then
    raise exception 'Эта переписка не ваша.' using errcode = '42501';
  end if;

  if v_conversation.dispatch_token is not null then
    raise exception 'Помощник отвечает на последний вопрос. Дождитесь ответа.'
      using errcode = '55000';
  end if;

  delete from public.conversations where id = p_conversation_id;

  return p_conversation_id;
end;
$$;

comment on function public.delete_conversation(uuid) is
  'Стирает переписку с помощником целиком. Только свою и только когда помощник не отвечает.';

revoke all on function public.delete_conversation(uuid) from public, anon;
grant execute on function public.delete_conversation(uuid) to authenticated, service_role;

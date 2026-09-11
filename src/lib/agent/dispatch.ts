import 'server-only';

import { createAdminClient } from '@/lib/supabase/admin';
import { n8nWebhookUrl, agentSecret, signOutgoing } from './signature';
import { agentSystemPrompt, agentTools } from '@/lib/agent/brief';
import { emailLocaleOf } from '@/lib/email/text';

/**
 * Отправка вопроса во внешний воркфлоу.
 *
 * Пропуск выдаётся здесь и живёт до ответа. Он не защищает от того, кто
 * читает наш трафик — для этого подпись, — а ограничивает
 * скомпрометированный n8n: инструменты откроются ему только по треду,
 * который сейчас в работе, а не по любому, чей идентификатор он когда-то
 * видел.
 *
 * Отсутствие адреса воркфлоу не ошибка: пока n8n не подключён, вопрос
 * остаётся в чате и ждёт оператора. Молчание агента лучше, чем сломанная
 * отправка сообщения.
 */
type Delivery = { url: string; secret: string; body: string; conversationId: string };

/**
 * Пометка ожидания и сбор запроса — без обращения к воркфлоу.
 *
 * Отделено от доставки намеренно. Раньше отправка сообщения ждала
 * ответа n8n целиком, и человек по восемь секунд смотрел на форму,
 * которая будто не нажалась. Пометка ставится здесь и сразу, а стучаться
 * наружу можно уже после того, как страница отрисована.
 */
export async function prepareDispatch(
  conversationId: string,
  messageId: string,
): Promise<Delivery | null> {
  const admin = createAdminClient();

  const token = crypto.randomUUID();

  const { data: conversation, error } = await admin
    .from('conversations')
    .update({ dispatch_token: token, pending_since: new Date().toISOString() })
    .eq('id', conversationId)
    .select('id, company_id, audience, channel')
    .single();

  if (error || !conversation) {
    console.error('Тред не помечен ожидающим:', error?.message);
    return null;
  }

  const url = n8nWebhookUrl();
  const secret = agentSecret();

  if (!url || !secret) {
    console.info('agent: воркфлоу не настроен, вопрос ждёт в чате');
    return null;
  }

  /*
   * У треда оператора компании нет: он посредник, а не сторона сделки.
   * Спрашивать её в этом случае незачем — и нельзя, запрос по пустому
   * идентификатору вернул бы ошибку, из-за которой вопрос не ушёл бы в
   * воркфлоу вовсе.
   */
  const [{ data: company }, { data: message }] = await Promise.all([
    conversation.company_id
      ? admin
          .from('companies')
          .select('name, kind, language')
          .eq('id', conversation.company_id)
          .single()
      : Promise.resolve({ data: null }),
    admin.from('messages').select('body, sender_user_id').eq('id', messageId).single(),
  ]);

  const body = JSON.stringify({
    conversation_id: conversation.id,
    dispatch_token: token,
    audience: conversation.audience,
    channel: conversation.channel,
    company_id: conversation.company_id,
    company_name: company?.name ?? null,
    party_role: company?.kind ?? null,
    message_id: messageId,
    text: message?.body ?? '',
    /*
     * Наставление и список инструментов собирает платформа, а не n8n.
     *
     * Так они едут вместе с кодом: правка роли попадает в работу
     * выкладкой, а не переимпортом воркфлоу руками. Прежде правда жила в
     * двух местах, и это выстрелило — аудиторию оператора завели в базе и
     * в файле, а в работающем n8n осталась старая ветка, и помощник
     * ответил оператору «платформа открывает мне только данные вашей
     * компании».
     */
    system: agentSystemPrompt({
      audience: conversation.audience,
      companyName: company?.name ?? null,
    }),
    tools: agentTools(conversation.audience),
    /*
     * Язык переписки компании, а не константа.
     *
     * Здесь стояло жёсткое 'fi' — с тех пор, когда весь рынок был
     * финским и другого языка у писем не было. Агент отвечает на языке
     * собеседника, и в большинстве случаев этого хватает; но по «RS-2026-0043?»
     * язык не определить, и тогда нужен запасной. Финский по умолчанию
     * отвечал бы датчанину по-фински на его же вопрос без слов.
     */
    locale: emailLocaleOf(company?.language),
  });

  return { url, secret, body, conversationId: conversation.id };
}

/** Собственно обращение к воркфлоу: долгое, и делать его надо не на глазах у человека. */
export async function deliverDispatch({ url, secret, body, conversationId }: Delivery): Promise<void> {
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: signOutgoing(secret, body),
      body,
      /*
       * Двадцать секунд, а не десять: ответа теперь ждёт человек, и
       * круг с вызовом инструментов в десять не укладывался. Если не
       * успеет и это — лента дождётся ответа опросом.
       */
      signal: AbortSignal.timeout(20_000),
    });

    /*
     * Воркфлоу отвечает 200 и на своих провалах: код ответа относится к
     * вебхуку, а не к тому, что внутри. Пока разбирали только код, отказ
     * подписи и молчание модели выглядели снаружи одинаково — успехом.
     * Поэтому читаем тело: ok, а при неудаче — шаг и причина.
     */
    if (!response.ok) {
      console.error('agent: воркфлоу ответил', response.status);
      return;
    }

    const outcome = (await response.json().catch(() => null)) as
      | { ok?: boolean; stage?: string | null; detail?: string | null; tools?: string[] }
      | null;

    if (!outcome?.ok) {
      console.error(
        'agent: воркфлоу не ответил в тред',
        conversationId,
        outcome?.stage ?? 'без шага',
        outcome?.detail ?? 'без причины',
      );
    }

    /*
     * Отказ инструмента ответ не срывает: агент честно говорит, что
     * данных не нашёл. Но молчать о нём нельзя — для человека это
     * выглядит как «агент не знает», а на деле сломан один запрос.
     */
    if (outcome?.tools?.length) {
      console.error('agent: инструменты отказали', conversationId, outcome.tools.join(' | '));
    }
  } catch (cause) {
    /*
     * Недоступный воркфлоу не роняет отправку сообщения: вопрос уже в
     * чате, и человек его видит. Снимать пометку ожидания здесь нельзя —
     * ответ может прийти позже.
     */
    console.error('agent: воркфлоу недоступен:', cause instanceof Error ? cause.message : cause);
  }
}

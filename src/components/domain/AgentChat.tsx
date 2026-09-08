import { Card, CardBody } from '@/components/ui';
import { getI18n, type Locale } from '@/lib/i18n';
import { createClient } from '@/lib/supabase/server';
import { AgentChatLive, type ChatMessage } from './AgentChatLive';

/**
 * Окно чата с агентом в кабинете.
 *
 * Тред один на компанию и роль: разговор с помощником — это не тикеты, а
 * переписка, и делить её на обращения значило бы каждый раз объяснять
 * заново, о какой компании речь.
 *
 * Сервер отдаёт историю и уходит. Дальше лента живёт в браузере: вопрос
 * появляется мгновенно, ответ дорисовывается на место, страница не
 * перерисовывается. Раньше каждое сообщение стоило полной перерисовки
 * кабинета — она и подбрасывала страницу, теряя прокрутку.
 */
export async function AgentChat({
  locale,
  role,
}: {
  locale: Locale;
  role: 'CARRIER' | 'SHIPPER' | 'ADMIN';
}) {
  const [{ t }, supabase] = await Promise.all([getI18n(locale), createClient()]);

  const { data: conversation } = await supabase
    .from('conversations')
    .select('id')
    .eq('audience', role)
    .order('last_message_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: messages } = conversation
    ? await supabase
        .from('messages')
        .select('id, sender, body, created_at')
        .eq('conversation_id', conversation.id)
        .order('created_at')
        .limit(100)
    : { data: [] };

  return (
    <Card className="mt-4">
      <CardBody className="flex flex-col gap-3">
        <div>
          <h2 className="text-[15px] font-semibold tracking-tight">{t.chat.title}</h2>
          <p className="mt-1 text-[13px] text-ink-muted">{t.chat.hint}</p>
        </div>

        <AgentChatLive
          initial={(messages ?? []) as ChatMessage[]}
          conversationId={conversation?.id ?? null}
        />
      </CardBody>
    </Card>
  );
}

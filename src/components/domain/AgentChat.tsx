import { Card, CardBody, Mono } from '@/components/ui';
import { getI18n, type Locale } from '@/lib/i18n';
import { createClient } from '@/lib/supabase/server';
import { AgentChatForm } from './AgentChatForm';

/**
 * Окно чата с агентом в кабинете.
 *
 * Тред один на компанию и роль: разговор с помощником — это не тикеты, а
 * переписка, и делить её на обращения значило бы каждый раз объяснять
 * заново, о какой компании речь.
 *
 * Серверная часть отдельно от формы: лента и история читаются на
 * сервере, в браузер уезжает только поле ввода. Переписка может быть
 * длинной, и тащить её через клиентский компонент незачем.
 */
export async function AgentChat({ locale, role }: { locale: Locale; role: 'CARRIER' | 'SHIPPER' | 'ADMIN' }) {
  const [{ t, f }, supabase] = await Promise.all([getI18n(locale), createClient()]);

  const { data: conversation } = await supabase
    .from('conversations')
    .select('id, pending_since')
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

  const list = messages ?? [];

  const who = {
    USER: t.chat.you,
    AGENT: t.chat.agent,
    OPERATOR: t.chat.operator,
  } as const;

  return (
    <Card className="mt-4">
      <CardBody className="flex flex-col gap-3">
        <div>
          <h2 className="text-[15px] font-semibold tracking-tight">{t.chat.title}</h2>
          <p className="mt-1 text-[13px] text-ink-muted">{t.chat.hint}</p>
        </div>

        {list.length === 0 ? (
          <p className="text-[13px] text-ink-muted">{t.chat.emptyHint}</p>
        ) : (
          <ul className="flex max-h-96 flex-col gap-2 overflow-y-auto">
            {list.map((message) => {
              const own = message.sender === 'USER';

              return (
                <li
                  key={message.id}
                  className={own ? 'flex flex-col items-end' : 'flex flex-col items-start'}
                >
                  <span className="label-micro mb-1 text-ink-faint">
                    {who[message.sender]} · <Mono>{f.time(message.created_at)}</Mono>
                  </span>
                  <span
                    className={
                      own
                        ? 'max-w-[85%] rounded-xl rounded-br-[4px] border border-accent-line bg-accent-wash px-3 py-2 text-[13px] leading-snug whitespace-pre-wrap'
                        : 'max-w-[85%] rounded-xl rounded-bl-[4px] border border-line bg-sunken px-3 py-2 text-[13px] leading-snug whitespace-pre-wrap'
                    }
                  >
                    {message.body}
                  </span>
                </li>
              );
            })}
          </ul>
        )}

        {/*
          * «Агент думает» рисуется по времени отправки, а не по флагу:
          * зависший запрос видно по возрасту, а флаг о возрасте молчит.
          */}
        {conversation?.pending_since && (
          <p className="flex items-center gap-2 text-[13px] text-ink-muted">
            <span className="agent-pulse" aria-hidden="true" />
            {t.chat.thinking}
          </p>
        )}

        <AgentChatForm locale={locale} conversationId={conversation?.id ?? null} />
      </CardBody>
    </Card>
  );
}

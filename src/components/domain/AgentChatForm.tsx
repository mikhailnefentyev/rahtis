'use client';

import { useActionState, useRef } from 'react';
import { Button, Textarea } from '@/components/ui';
import { sendAgentMessageAction, type ChatState } from '@/lib/agent/actions';
import { useI18n } from '@/lib/i18n/provider';

const initial: ChatState = { error: null };

/** Поле ввода — единственная клиентская часть чата. */
export function AgentChatForm({
  locale,
  conversationId,
}: {
  locale: string;
  conversationId: string | null;
}) {
  const { t } = useI18n();
  const [state, formAction, pending] = useActionState(sendAgentMessageAction, initial);
  /* Ссылка на форму, а не на поле: Textarea из UI-кита ref не пробрасывает. */
  const form = useRef<HTMLFormElement>(null);

  return (
    <form
      ref={form}
      action={(data) => {
        formAction(data);
        /* Поле очищается сразу: ответ придёт позже, а вопрос уже отправлен. */
        form.current?.reset();
      }}
      className="flex flex-col gap-2"
    >
      <input type="hidden" name="locale" value={locale} />
      {conversationId && <input type="hidden" name="conversation_id" value={conversationId} />}

      <Textarea
        name="text"
        rows={2}
        maxLength={8000}
        required
        placeholder={t.chat.placeholder}
      />

      {state.error && (
        <p role="alert" className="text-[13px] text-danger">
          {state.error}
        </p>
      )}

      <Button type="submit" size="md" className="self-start" disabled={pending}>
        {pending ? t.chat.sending : t.chat.send}
      </Button>
    </form>
  );
}

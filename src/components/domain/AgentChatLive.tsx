'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Button, Mono, Textarea } from '@/components/ui';
import { useI18n } from '@/lib/i18n/provider';

/**
 * Переписка с агентом целиком в браузере.
 *
 * История приезжает с сервера готовой, дальше лента живёт сама: вопрос
 * появляется мгновенно, под ним «агент думает», ответ дорисовывается на
 * место. Страница при этом не перерисовывается — а именно перерисовка и
 * подбрасывала её вверх, теряя прокрутку и уводя поле ввода из-под
 * курсора.
 *
 * Ответ приходит тем же запросом, которым ушёл вопрос. Опрос остаётся
 * только как запасной путь: если воркфлоу не уложился в отведённое
 * время, ответ придёт позже, и терять его нельзя.
 */

export type ChatMessage = {
  id: string;
  sender: string;
  body: string;
  created_at: string;
};

const POLL_MS = 2000;
const POLL_LIMIT_MS = 120_000;

export function AgentChatLive({
  initial,
  conversationId,
}: {
  initial: ChatMessage[];
  conversationId: string | null;
}) {
  const { t, f } = useI18n();

  const [messages, setMessages] = useState<ChatMessage[]>(initial);
  const [thread, setThread] = useState<string | null>(conversationId);
  const [pending, setPending] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clearing, setClearing] = useState(false);
  /* Второе нажатие подтверждает: переписка стирается целиком и насовсем. */
  const [confirming, setConfirming] = useState(false);

  const box = useRef<HTMLUListElement>(null);
  const field = useRef<HTMLTextAreaElement>(null);

  /* Лента всегда стоит у последнего сообщения: свежее внизу. */
  useEffect(() => {
    const el = box.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length, pending]);

  /* Один и тот же ответ не должен лечь в ленту дважды. */
  const merge = useCallback((incoming: ChatMessage[]) => {
    if (!incoming.length) return;
    setMessages((current) => {
      const known = new Set(current.map((m) => m.id));
      const fresh = incoming.filter((m) => !known.has(m.id));
      return fresh.length ? [...current, ...fresh] : current;
    });
  }, []);

  /*
   * Запасной путь: воркфлоу не уложился в срок, ответ придёт позже.
   * Опрос идёт от последнего известного сообщения и сам смолкает, когда
   * пометка ожидания снята — или когда ждать уже незачем.
   */
  useEffect(() => {
    /*
     * Пока запрос в пути, опрашивать нечего: ответ придёт им же. Без
     * этого опрос успевал сходить в базу и притащить оттуда копию
     * только что отправленного вопроса — он двоился в ленте до самого
     * ответа, а потом лишний исчезал.
     */
    if (!pending || !thread || sending) return;

    const startedAt = Date.now();
    const timer = setInterval(async () => {
      if (Date.now() - startedAt > POLL_LIMIT_MS) {
        setPending(false);
        return;
      }

      /*
       * Отсчёт от последнего записанного сообщения, а не от временного:
       * у временного метка с часов браузера, и она вполне может
       * отставать от серверной.
       */
      const last = [...messages].reverse().find((m) => !m.id.startsWith('local-'));
      if (!last) return;

      try {
        const response = await fetch(
          `/api/agent/ask?conversation=${encodeURIComponent(thread)}&after=${encodeURIComponent(last.created_at)}`,
        );
        if (!response.ok) return;

        const data = (await response.json()) as { messages: ChatMessage[]; pending: boolean };
        merge(data.messages);
        setPending(data.pending);
      } catch {
        /* Оборванная сеть не повод гасить ожидание: следующий заход повторит. */
      }
    }, POLL_MS);

    return () => clearInterval(timer);
  }, [pending, thread, sending, messages, merge]);

  async function send(text: string) {
    /*
     * Вопрос встаёт в ленту сразу, ещё до ответа сервера: ждать секунду
     * ради собственных слов незачем, а видеть их надо немедленно.
     * Временная запись живёт до ответа и заменяется настоящей — с той
     * же меткой времени, что записана в базе.
     */
    const draft: ChatMessage = {
      id: `local-${Date.now()}`,
      sender: 'USER',
      body: text,
      created_at: new Date().toISOString(),
    };

    setMessages((current) => [...current, draft]);
    setSending(true);
    setError(null);
    setPending(true);

    const withoutDraft = (list: ChatMessage[]) => list.filter((m) => m.id !== draft.id);

    try {
      const response = await fetch('/api/agent/ask', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text, conversation_id: thread ?? undefined }),
      });

      if (!response.ok) {
        setMessages(withoutDraft);
        setPending(false);
        setError(t.chat.failed);
        return;
      }

      const data = (await response.json()) as {
        conversation_id: string;
        messages: ChatMessage[];
        pending: boolean;
      };

      setThread(data.conversation_id);
      setMessages((current) => {
        const known = new Set(current.map((m) => m.id));
        const fresh = data.messages.filter((m) => !known.has(m.id));
        return [...withoutDraft(current), ...fresh];
      });
      setPending(data.pending);
    } catch {
      /*
       * Оборвалась связь или запрос не уложился в отведённое время.
       * Вопрос при этом мог быть записан, и ответ придёт позже: если
       * тред известен, за ним сходит опрос. Временную запись убираем —
       * настоящую он принесёт вместе с ответом.
       */
      setMessages(withoutDraft);
      if (thread) {
        setPending(true);
      } else {
        setPending(false);
        setError(t.chat.failed);
      }
    } finally {
      setSending(false);
      field.current?.focus();
    }
  }

  /**
   * Стереть переписку.
   *
   * Целиком, а не по сообщению: переписка, из которой выброшено одно
   * сообщение, хуже отсутствующей — по ней делают выводы.
   *
   * Лента очищается только после ответа сервера. Очистив сразу, мы
   * показали бы пустой чат там, где база отказала, — а отказывает она по
   * делу: пока помощник отвечает, тред трогать нельзя.
   */
  async function clearThread() {
    if (!thread || clearing) return;
    setClearing(true);
    setError(null);
    try {
      const response = await fetch(`/api/agent/ask?conversation=${encodeURIComponent(thread)}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { detail?: string } | null;
        setError(data?.detail ?? t.chat.failed);
        return;
      }
      setMessages([]);
      setThread(null);
      setPending(false);
      setConfirming(false);
    } catch {
      setError(t.chat.failed);
    } finally {
      setClearing(false);
    }
  }

  const who: Record<string, string> = {
    USER: t.chat.you,
    AGENT: t.chat.agent,
    OPERATOR: t.chat.operator,
  };

  return (
    <>
      {messages.length === 0 ? (
        <p className="text-[13px] text-ink-muted">{t.chat.emptyHint}</p>
      ) : (
        <ul ref={box} className="flex max-h-96 flex-col gap-2 overflow-y-auto">
          {messages.map((message) => {
            const own = message.sender === 'USER';

            return (
              <li
                key={message.id}
                className={own ? 'flex flex-col items-end' : 'flex flex-col items-start'}
              >
                <span className="label-micro mb-1 text-ink-faint">
                  {who[message.sender] ?? message.sender} · <Mono>{f.time(message.created_at)}</Mono>
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
        * Строка занимает место и когда молчит: появляясь и исчезая, она
        * толкала форму под собой, и поле ввода уезжало из-под курсора.
        */}
      <p
        aria-live="polite"
        className="flex min-h-[18px] items-center gap-2 text-[13px] text-ink-muted"
      >
        {pending && (
          <>
            <span className="agent-pulse" aria-hidden="true" />
            {t.chat.thinking}
          </>
        )}

        {/*
          * Кнопка появляется только когда есть что стирать, и молчит,
          * пока помощник отвечает: база в этот момент откажет, и
          * предлагать нажатие, которое не сработает, незачем.
          */}
        {thread && messages.length > 0 && !pending && (
          <span className="ml-auto flex items-center gap-2">
            {confirming && <span className="text-ink-dim">{t.chat.clearConfirm}</span>}
            <Button
              size="sm"
              variant={confirming ? 'danger' : 'ghost'}
              disabled={clearing}
              onClick={() => (confirming ? void clearThread() : setConfirming(true))}
            >
              {confirming ? t.chat.clearYes : t.chat.clear}
            </Button>
            {confirming && (
              <Button size="sm" variant="ghost" onClick={() => setConfirming(false)}>
                {t.action.cancel}
              </Button>
            )}
          </span>
        )}
      </p>

      <form
        className="flex flex-col gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          const text = field.current?.value.trim() ?? '';
          if (!text || sending) return;
          /* Поле очищается сразу: вопрос уже в ленте, а ответ придёт позже. */
          if (field.current) field.current.value = '';
          void send(text);
        }}
      >
        <Textarea
          ref={field}
          name="text"
          rows={2}
          maxLength={8000}
          required
          placeholder={t.chat.placeholder}
          onKeyDown={(event) => {
            /* Enter отправляет, Shift+Enter переносит строку — как в любом чате. */
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              event.currentTarget.form?.requestSubmit();
            }
          }}
        />

        {error && (
          <p role="alert" className="text-[13px] text-danger">
            {error}
          </p>
        )}

        <Button type="submit" size="md" className="self-start" disabled={sending}>
          {sending ? t.chat.sending : t.chat.send}
        </Button>
      </form>
    </>
  );
}

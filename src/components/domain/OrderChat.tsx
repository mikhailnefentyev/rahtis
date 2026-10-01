'use client';

import { useCallback, useEffect, useState } from 'react';
import { cn } from '@/lib/cn';
import { loadChatAction, postChatAction, type PostResult } from '@/lib/chat/actions';
import { CABINET_QUICK, DRIVER_QUICK, displayText, type Chat } from '@/lib/chat/langs';
import { useI18n } from '@/lib/i18n/provider';

const POLL_MS = 15_000;

/**
 * Переписка по рейсу: заказчик, перевозчик и водитель.
 *
 * В кабинете свёрнута и грузится по раскрытию — карточек рейсов на
 * экране много, и спрашивать базу за каждую впустую незачем. У водителя
 * раскрыта сразу: это экран одного рейса. Пока открыта — обновляется
 * раз в 15 секунд.
 *
 * lang — язык читателя: на нём быстрые ответы и переводы свободного
 * текста. Оригинал всегда можно открыть.
 */
export function OrderChat({
  orderId,
  lang,
  variant = 'cabinet',
  className,
}: {
  orderId: string;
  lang: string;
  variant?: 'cabinet' | 'driver';
  className?: string;
}) {
  const { t, f } = useI18n();
  const c = t.driverApp;
  const driver = variant === 'driver';

  const [open, setOpen] = useState(driver);
  const [chat, setChat] = useState<Chat | null>(null);
  const [text, setText] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<PostResult['error']>(null);
  const [original, setOriginal] = useState<Set<number>>(new Set());

  const load = useCallback(async () => {
    const next = await loadChatAction(orderId, lang);
    if (next) setChat(next);
  }, [orderId, lang]);

  useEffect(() => {
    if (!open) return;
    let active = true;
    const tick = () => {
      if (active) void load();
    };
    tick();
    const timer = setInterval(tick, POLL_MS);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [open, load]);

  const quickText = (code: string) => (c.chatQuick as Record<string, string>)[code];

  async function send(body: string, quick: string | null) {
    if (!body.trim() || pending) return;
    setPending(true);
    setError(null);
    const result = await postChatAction(orderId, body, quick);
    setPending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    if (!quick) setText('');
    await load();
  }

  const count = chat?.messages.length ?? 0;
  const quickCodes = driver ? DRIVER_QUICK : CABINET_QUICK;

  return (
    <section className={cn('rounded-card border border-line bg-surface', className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={cn(
          'flex w-full items-center justify-between gap-3 px-4 text-left font-semibold',
          driver ? 'min-h-14 text-[17px]' : 'min-h-11 text-[14px]',
        )}
      >
        <span>
          {c.chatTitle}
          {count > 0 && <span className="ml-2 text-ink-muted">· {count}</span>}
        </span>
        <span aria-hidden className="text-ink-faint">
          {open ? '−' : '+'}
        </span>
      </button>

      {open && (
        <div className="border-t border-line px-4 pt-3 pb-4">
          {chat === null ? (
            <p className="text-[13px] text-ink-muted">…</p>
          ) : chat.messages.length === 0 ? (
            <p className={cn('text-ink-muted', driver ? 'text-[15px]' : 'text-[13px]')}>{c.chatEmpty}</p>
          ) : (
            <ul className="flex max-h-96 flex-col gap-2 overflow-y-auto">
              {chat.messages.map((message) => {
                const shown = displayText(message, lang, quickText);
                const showOriginal = original.has(message.id);
                const who =
                  message.author_role === 'DRIVER' && message.author_name
                    ? `${c.chatRole.DRIVER} ${message.author_name}`
                    : c.chatRole[message.author_role];
                return (
                  <li
                    key={message.id}
                    className={cn(
                      'max-w-[85%] rounded-control px-3 py-2',
                      message.mine ? 'self-end bg-accent-wash' : 'self-start bg-sunken',
                    )}
                  >
                    <p className="text-[12px] text-ink-dim">
                      {message.mine ? c.chatYou : who} · {f.time(message.created_at)}
                    </p>
                    <p className={cn('whitespace-pre-wrap break-words', driver ? 'text-[16px]' : 'text-[14px]')}>
                      {showOriginal ? message.body : shown.text}
                    </p>
                    {shown.translated && (
                      <button
                        type="button"
                        className="mt-1 text-[12px] text-accent underline"
                        onClick={() =>
                          setOriginal((set) => {
                            const next = new Set(set);
                            if (next.has(message.id)) next.delete(message.id);
                            else next.add(message.id);
                            return next;
                          })
                        }
                      >
                        {showOriginal ? c.chatShowTranslation : c.chatShowOriginal}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          {chat?.open ? (
            <div className="mt-3 flex flex-col gap-2">
              <div className="flex flex-wrap gap-2">
                {quickCodes.map((code) => (
                  <button
                    key={code}
                    type="button"
                    disabled={pending}
                    onClick={() => send(quickText(code) ?? code, code)}
                    className={cn(
                      'rounded-full border border-line px-3 font-medium hover:border-accent disabled:opacity-60',
                      driver ? 'min-h-12 text-[15px]' : 'min-h-9 text-[13px]',
                    )}
                  >
                    {quickText(code)}
                  </button>
                ))}
              </div>
              <form
                className="flex items-end gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  void send(text, null);
                }}
              >
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  maxLength={1000}
                  rows={driver ? 2 : 1}
                  placeholder={c.chatPlaceholder}
                  aria-label={c.chatPlaceholder}
                  className={cn(
                    'min-w-0 flex-1 resize-y rounded-control border border-line bg-surface px-3 py-2',
                    driver ? 'text-[16px]' : 'text-[14px]',
                  )}
                />
                <button
                  type="submit"
                  disabled={pending || !text.trim()}
                  className={cn(
                    'shrink-0 rounded-control bg-accent px-4 font-semibold text-accent-ink disabled:opacity-60',
                    driver ? 'h-12 text-[16px]' : 'h-9 text-[14px]',
                  )}
                >
                  {c.chatSend}
                </button>
              </form>
              {error && <p className="text-[13px] text-danger">{c.chatError[error]}</p>}
              <p className="text-[12px] text-ink-dim">{c.chatNote}</p>
            </div>
          ) : (
            chat && <p className="mt-3 text-[13px] text-ink-dim">{chat.role === 'ADMIN' ? c.chatAdminNote : c.chatClosed}</p>
          )}
        </div>
      )}
    </section>
  );
}

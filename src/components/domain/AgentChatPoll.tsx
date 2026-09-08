'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Добор ответа, пока агент думает.
 *
 * Лента читается на сервере и рисуется один раз. Своё сообщение человек
 * видит сразу — страница перерисовывается после отправки, — а ответ
 * приходит через воркфлоу секундами позже, и забрать его некому: до
 * этого ответ появлялся только после обновления страницы вручную.
 *
 * Опрос, а не подписка на изменения: ждать приходится секунды и только
 * после своего же вопроса, а живое соединение стоило бы ключа в браузере
 * и правил доступа к чужим тредам.
 */
const EVERY_MS = 2000;
const LIMIT_MS = 120_000;

export function AgentChatPoll({ pending }: { pending: boolean }) {
  const router = useRouter();
  const startedAt = useRef<number | null>(null);

  useEffect(() => {
    if (!pending) {
      /*
       * Один добор после снятия пометки: платформа гасит пропуск и
       * пишет ответ двумя шагами, и между ними страница успевает
       * обновиться ещё без ответа.
       */
      if (startedAt.current === null) return;
      startedAt.current = null;

      const once = setTimeout(() => router.refresh(), EVERY_MS);
      return () => clearTimeout(once);
    }

    if (startedAt.current === null) startedAt.current = Date.now();

    const timer = setInterval(() => {
      /* Молчащий воркфлоу не должен опрашиваться до конца дня. */
      if (Date.now() - (startedAt.current ?? 0) > LIMIT_MS) {
        clearInterval(timer);
        return;
      }
      router.refresh();
    }, EVERY_MS);

    return () => clearInterval(timer);
  }, [pending, router]);

  return null;
}

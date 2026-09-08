'use client';

import { useEffect, useRef, type ReactNode } from 'react';

/**
 * Лента переписки, прокрученная к последнему сообщению.
 *
 * Свежее сообщение внизу, а окно ленты после перерисовки открывалось
 * сверху: и своё отправленное, и пришедший ответ приходилось искать
 * прокруткой. Прокручивается только сама лента — уводить всю страницу к
 * чату, когда человек смотрит в другое место, было бы хуже молчания.
 *
 * Сообщения приходят готовой разметкой с сервера, здесь только ссылка на
 * окно и число сообщений: по нему и видно, что появилось новое.
 */
export function AgentChatLog({ count, children }: { count: number; children: ReactNode }) {
  const box = useRef<HTMLUListElement>(null);

  useEffect(() => {
    const el = box.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [count]);

  return (
    <ul ref={box} className="flex max-h-96 flex-col gap-2 overflow-y-auto">
      {children}
    </ul>
  );
}

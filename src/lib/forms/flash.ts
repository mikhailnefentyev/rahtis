import 'server-only';

import { cookies } from 'next/headers';
import { getDictionary, type Locale } from '@/lib/i18n';

/**
 * Отказ для действий без своего места под ошибку.
 *
 * Кнопки «удалить», «отправить на допуск», «посадить водителя» — это
 * формы без состояния: действие возвращает void, и отказ базы пропадал
 * молча — человек нажимал, и ничего не происходило (прогон 13.10.2026).
 * Переводить каждую такую кнопку на useActionState значило бы завести
 * клиентскую обёртку на два десятка мест; вместо этого действие кладёт
 * текст в короткоживущую куку, а оболочка кабинета показывает его один
 * раз (components/layout/FlashNotice).
 *
 * В куке только готовый текст из словаря: ни кодов, ни сообщений базы.
 */

export const FLASH_COOKIE = 'rahtis_flash';

export async function flashError(message: string): Promise<void> {
  const store = await cookies();
  /* Метка времени отличает два одинаковых отказа подряд: второй тоже должен показаться. */
  store.set(FLASH_COOKIE, `${Date.now()}|${message.slice(0, 400)}`, {
    path: '/',
    maxAge: 30,
    sameSite: 'lax',
    /* Клиент сам стирает куку после показа. */
    httpOnly: false,
  });
}

/** Отказ базы → текст. Известные коды называются своими словами, остальное — общим. */
export async function flashFailure(
  locale: Locale,
  error: { code?: string } | null | undefined,
  known?: Record<string, string>,
): Promise<boolean> {
  if (!error) return false;
  const t = await getDictionary(locale);
  await flashError(known?.[error.code ?? ''] ?? t.error.generic);
  return true;
}

export async function readFlash(): Promise<{ id: string; message: string } | null> {
  const raw = (await cookies()).get(FLASH_COOKIE)?.value;
  if (!raw) return null;
  const cut = raw.indexOf('|');
  if (cut < 1) return null;
  const message = raw.slice(cut + 1).trim();
  return message ? { id: raw.slice(0, cut), message } : null;
}

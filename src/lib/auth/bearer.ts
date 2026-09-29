import 'server-only';

import { createHash, timingSafeEqual } from 'node:crypto';

/**
 * Заголовок Authorization: Bearer <секрет> — сравнение за постоянное время.
 *
 * Обычное === выходит на первом несовпавшем символе, и по времени ответа
 * секрет в принципе подбирается посимвольно. Хэши обеих строк одной
 * длины, поэтому timingSafeEqual не зависит и от длины присланного.
 */
export function bearerMatches(header: string | null, secret: string | undefined): boolean {
  if (!secret || !header) return false;
  const sent = createHash('sha256').update(header, 'utf8').digest();
  const wanted = createHash('sha256').update(`Bearer ${secret}`, 'utf8').digest();
  return timingSafeEqual(sent, wanted);
}

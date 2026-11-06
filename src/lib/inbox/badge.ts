import 'server-only';

import { headers } from 'next/headers';
import { getViewer } from '@/lib/auth/viewer';
import type { Locale } from '@/lib/i18n';
import type { PartyRole } from '@/types/db';
import { loadCarrierInbox } from './carrier';
import { inboxTotalKey, inboxTotals } from './memo';
import { loadShipperInbox } from './shipper';

/**
 * Число в меню «Требует действия». Полный список считает обзор; меню
 * берёт его итог не старше минуты (src/lib/inbox/memo) и считает заново,
 * только когда памяти нет. После серверного действия — всегда заново:
 * человек только что что-то сделал, и счётчик должен это показать.
 */
export async function inboxBadgeCount(locale: Locale, role: PartyRole): Promise<number> {
  if (role !== 'CARRIER' && role !== 'SHIPPER') return 0;
  const [viewer, head] = await Promise.all([getViewer(), headers()]);
  if (viewer.status !== 'ready') return 0;

  const type = head.get('content-type') ?? '';
  const mutation = head.has('next-action') || type.startsWith('multipart/form-data') || type.startsWith('application/x-www-form-urlencoded');
  if (!mutation) {
    const known = inboxTotals.get(inboxTotalKey(viewer.userId, role));
    if (known !== undefined) return known;
  }
  /* Расчёт сам кладёт итог в память (loadCarrierInbox / loadShipperInbox). */
  const inbox = role === 'CARRIER' ? await loadCarrierInbox(locale) : await loadShipperInbox(locale);
  return inbox.total;
}

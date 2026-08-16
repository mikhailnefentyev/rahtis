import { redirect } from 'next/navigation';
import type { Locale } from '@/lib/i18n';
import type { PartyRole } from '@/types/db';
import { cabinetPath, noAccessPath, signInPath } from './paths';
import { getViewer, type Viewer } from './viewer';

type ReadyViewer = Extract<Viewer, { status: 'ready' }>;

/**
 * Пропускает в кабинет только владельца соответствующей роли.
 *
 * Это второй слой защиты, не единственный. Первый — proxy.ts, он отсекает
 * неавторизованных без запроса к базе. Третий и главный — RLS: даже если
 * первые два обойти, база чужих строк не отдаст. У Next.js уже бывали
 * уязвимости с обходом middleware, поэтому навигация и доступ к данным
 * защищены раздельно.
 */
export async function requireRole(locale: Locale, role: PartyRole): Promise<ReadyViewer> {
  const viewer = await getViewer();

  if (viewer.status === 'guest') {
    redirect(signInPath(locale, cabinetPath(locale, role)));
  }

  if (viewer.status === 'orphan') {
    redirect(noAccessPath(locale));
  }

  /*
   * Компания отклонена — кабинет закрыт. Пользователь при этом остаётся
   * в системе: удалять его нельзя, иначе исчезнет история модерации.
   */
  if (viewer.company?.status === 'REJECTED') {
    redirect(noAccessPath(locale));
  }

  /* Чужой кабинет — не ошибка, а промах: уводим в свой. */
  if (viewer.role !== role) {
    redirect(cabinetPath(locale, viewer.role));
  }

  return viewer;
}

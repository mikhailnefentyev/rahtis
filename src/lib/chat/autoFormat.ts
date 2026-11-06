import type { Format } from '@/lib/format';
import type { Dictionary } from '@/lib/i18n/dictionaries';
import { stopTitle, type HaulKind } from '@/lib/orders/haul';
import { scheduledZone, stopEta } from '@/lib/orders/stopTime';
import type { StopRole } from '@/types/db';
import { composeAutoAnswer, type AutoFacts } from './autoAnswer';

/**
 * Автоответ на языке и во времени читателя: сервер пишет им body для
 * спросившего, переписка — показывает остальным. Время точки — по поясу
 * её страны, как на странице отслеживания.
 */
export function autoAnswerText(facts: AutoFacts, t: Dictionary, f: Format): string {
  const haul = (facts.haulKind ?? 'TRAILER') as HaulKind;
  return composeAutoAnswer(facts, t.chatAuto, {
    stop: (role) => stopTitle(t, role as StopRole, haul),
    at: (iso, country) => stopEta(f, iso, country),
    planned: (date, time, country) => {
      const day = f.date(`${date}T12:00:00Z`);
      if (!time) return day;
      const zone = scheduledZone(date, time, country, f.zone);
      return `${day} ${time.slice(0, 5)}${zone ? ` ${zone}` : ''}`;
    },
  });
}

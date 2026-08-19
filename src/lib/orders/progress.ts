import type { StopRole } from '@/types/db';

/**
 * Этап рейса выводится из пройденных точек, а не хранится отдельно.
 *
 * ТЗ §7 задаёт шесть этапов: принял, забрал прицеп, загрузился, в пути,
 * выгрузился, сдал. Список написан под модель «забор → выгрузка», в
 * которой каждый этап случается один раз. В нынешней модели рейс — это
 * последовательность точек, и выгрузок с загрузками может быть сколько
 * угодно: «Загрузился» перестал быть одиночным событием.
 *
 * Поэтому этап не хранится, а вычисляется. Все шесть состояний из ТЗ
 * сохраняются, но обретают место: не просто «Выгрузился», а
 * «Выгрузился · Turku» — иначе при двух выгрузках статус ничего не
 * сообщает.
 *
 * Один источник на все три роли: заказчик, перевозчик и оператор считают
 * этап по одним и тем же точкам (ТЗ §7, «единый статус»).
 */

export type TripStop = {
  sequence: number;
  role: StopRole;
  city: string;
  place_name?: string | null;
  company_name?: string | null;
  completed_at?: string | null;
  damage_note?: string | null;
};

export type TripProgress = {
  /** Сколько точек пройдено из скольких. */
  done: number;
  total: number;
  /** Последняя пройденная точка — по ней и называется этап. */
  last: TripStop | null;
  /** Следующая точка. NULL, когда пройдены все. */
  next: TripStop | null;
  /** Все точки пройдены: рейс сдан и ждёт закрытия документами. */
  finished: boolean;
  /** Где замечены повреждения. Пусто — рейс чистый. */
  damaged: TripStop[];
};

/** Точки приходят упорядоченными, но полагаться на это нельзя. */
function bySequence(a: TripStop, b: TripStop): number {
  return a.sequence - b.sequence;
}

export function tripProgress(stops: TripStop[]): TripProgress {
  const ordered = [...stops].sort(bySequence);
  const completed = ordered.filter((s) => s.completed_at);

  return {
    done: completed.length,
    total: ordered.length,
    last: completed.at(-1) ?? null,
    next: ordered.find((s) => !s.completed_at) ?? null,
    finished: ordered.length > 0 && completed.length === ordered.length,
    damaged: ordered.filter((s) => s.damage_note),
  };
}

/** Место точки одной строкой: название площадки, компания или город. */
export function stopPlace(stop: TripStop): string {
  return stop.place_name ?? stop.company_name ?? stop.city;
}

/**
 * Ключ подписи этапа для словаря.
 *
 * Возвращается ключ, а не готовый текст: сборка фразы — дело словаря,
 * иначе в финском и русском получились бы разные порядки слов, склеенные
 * в коде (см. правила i18n в README).
 */
export type TripStageKey =
  | 'accepted'
  | 'trailerPicked'
  | 'loaded'
  | 'unloaded'
  | 'enRoute'
  | 'handedOver';

export function tripStageKey(progress: TripProgress): TripStageKey {
  if (progress.finished) return 'handedOver';
  if (!progress.last) return 'accepted';

  switch (progress.last.role) {
    case 'PICKUP':
      return 'trailerPicked';
    case 'EXTRA_LOAD':
    case 'CONTINUATION':
      return 'loaded';
    case 'EXTRA_UNLOAD':
    case 'DELIVERY':
      return 'unloaded';
    case 'TRAILER_RETURN':
      return 'handedOver';
    default:
      return 'enRoute';
  }
}

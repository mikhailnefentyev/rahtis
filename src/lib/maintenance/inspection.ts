/**
 * Ежедневный осмотр машины водителем (lähtötarkastus).
 *
 * Список пунктов совпадает с public.driver_inspection_add (v_keys) и
 * app.inspection_area: порядок — обход машины, каждый пункт — узел
 * дефекта, если он «не в порядке».
 *
 * Без зависимостей — модуль читают экран водителя, кабинет и тесты.
 */

export const INSPECTION_ITEMS = ['TYRES', 'BRAKES', 'LIGHTS', 'FLUIDS', 'DASHBOARD', 'VISIBILITY', 'COUPLING', 'TACHOGRAPH', 'SAFETY'] as const;
export type InspectionItem = (typeof INSPECTION_ITEMS)[number];

export type InspectionAnswer = { ok: true } | { ok: false; severity: 'CAN_DRIVE' | 'UNSAFE' | null; description: string };

export type InspectionPayload = {
  odometer_km: number | null;
  items: { key: InspectionItem; ok: boolean; severity?: 'CAN_DRIVE' | 'UNSAFE'; description?: string }[];
};

/** Почему осмотр ещё нельзя отправить: не все пункты, у неисправности нет «можно ли ехать» или слов. */
export type InspectionProblem = 'unanswered' | 'severity' | 'description';

export function inspectionProblem(answers: Partial<Record<InspectionItem, InspectionAnswer>>): InspectionProblem | null {
  for (const key of INSPECTION_ITEMS) {
    const answer = answers[key];
    if (!answer) return 'unanswered';
    if (!answer.ok) {
      if (!answer.severity) return 'severity';
      if (answer.description.trim().length < 3) return 'description';
    }
  }
  return null;
}

/** Ответы экрана → данные для базы. Пробег — только целое больше нуля. */
export function inspectionPayload(answers: Record<InspectionItem, InspectionAnswer>, odometer: string): InspectionPayload {
  const km = Number.parseInt(odometer.replace(/[\s ]/g, ''), 10);
  return {
    odometer_km: Number.isFinite(km) && km > 0 && km <= 9_999_999 ? km : null,
    items: INSPECTION_ITEMS.map((key) => {
      const answer = answers[key];
      return answer.ok
        ? { key, ok: true }
        : { key, ok: false, severity: answer.severity ?? 'CAN_DRIVE', description: answer.description.trim().slice(0, 1000) };
    }),
  };
}

/** Сколько неисправностей и есть ли «ехать нельзя». */
export function inspectionFaults(answers: Partial<Record<InspectionItem, InspectionAnswer>>): { count: number; unsafe: boolean } {
  let count = 0;
  let unsafe = false;
  for (const key of INSPECTION_ITEMS) {
    const answer = answers[key];
    if (answer && !answer.ok) {
      count += 1;
      if (answer.severity === 'UNSAFE') unsafe = true;
    }
  }
  return { count, unsafe };
}

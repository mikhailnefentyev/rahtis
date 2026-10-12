import type { StopRole } from '@/types/db';

/**
 * Перегон: единицу забирают в одном месте и оставляют в другом, без
 * погрузки и выгрузки между ними (как rantaveto в порту).
 *
 * Отдельного типа рейса у перегона нет — это обычный рейс с маршрутом
 * «забор → возврат». Поэтому он узнаётся по точкам, здесь и в базе
 * (app.order_is_transfer) одинаково.
 */
export function isTransfer(stops: ReadonlyArray<{ role: StopRole }>): boolean {
  return (
    stops.some((stop) => stop.role === 'TRAILER_RETURN') &&
    stops.every((stop) => stop.role === 'PICKUP' || stop.role === 'TRAILER_RETURN')
  );
}

/**
 * Есть ли у перегона фото при сдаче — им он закрывается вместо накладной.
 *
 * Снимок из приложения водителя привязан к точке возврата; загруженный
 * из кабинета — нет, и тогда годится снимок, сделанный после прибытия на
 * неё. То же правило проверяет база (app.order_closing_evidence_ok).
 */
export function hasHandoverPhoto(
  stops: ReadonlyArray<{ id?: string; role: StopRole; arrived_at?: string | null; completed_at?: string | null }>,
  documents: ReadonlyArray<{ kind: string; stop_id: string | null; created_at: string }>,
): boolean {
  const drop = stops.find((stop) => stop.role === 'TRAILER_RETURN');
  if (!drop) return false;

  const since = drop.arrived_at ?? drop.completed_at ?? null;

  return documents.some(
    (doc) =>
      doc.kind !== 'CMR' &&
      (doc.stop_id != null
        ? doc.stop_id === drop.id
        : since != null && new Date(doc.created_at).getTime() >= new Date(since).getTime()),
  );
}

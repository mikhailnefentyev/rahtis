import type { Dictionary } from '@/lib/i18n';
import { isDowntimeConflict } from '@/lib/maintenance/conflict';

/** Отказ базы → текст. */
export function explainCapacityError(t: Dictionary, error: { code?: string; message?: string } | null): string {
  const c = t.capacity;
  /* Машина или прицеп рейса вне работы в дни заказа (обслуживание, дефект). */
  if (isDowntimeConflict(error)) return t.maintenance.downtime.orderConflict;
  switch (error?.code) {
    case '55000':
      return c.unavailable;
    case '55004':
      return c.vehicleIdle;
    case '55009':
      return c.termsChanged;
    /* Заказчику-экспедитору нужны принятые выписка и полис (forwarder_docs_gate). */
    case '55018':
      return t.docsGate.error;
    case '23505':
      return c.alreadyRequested;
    case '42501':
      return t.error.forbidden;
    case 'P0002':
      return c.unavailable;
    case '22023':
      if (error.message?.includes('помещается')) return c.noFit;
      if (error.message?.includes('Даты')) return c.badDates;
      return c.badPrice;
    default:
      return t.error.generic;
  }
}

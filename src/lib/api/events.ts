/**
 * События вебхуков — один список для кабинета, проверки на сервере и
 * описания API. Совпадает с ограничением api_webhooks_events_known в базе.
 */
export const WEBHOOK_EVENTS = [
  'offer.received',
  'order.taken',
  'order.started',
  'order.reopened',
  'order.stop_arrived',
  'order.stop_completed',
  'order.eta_changed',
  'order.late',
  'order.waiting',
  'order.amended',
  'order.closed',
  'order.cancelled',
  'document.added',
  'claim.updated',
] as const;

export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];

import type { CompanyStatus, OrderStatus, VehicleAccess } from '@/types/db';

/**
 * Тон — семантическая роль элемента, а не его цвет.
 *
 * Компоненты кита принимают tone, а не hex и не класс. Благодаря этому
 * правило «акцент только для интерактива, семантика только для состояния»
 * держится само собой: у Badge нет тона accent, у Button нет тона live.
 */

/** Тона состояния: статусы, бейджи, индикаторы. */
export type StatusTone = 'neutral' | 'ok' | 'warn' | 'danger' | 'live' | 'info';

export const statusToneClass: Record<StatusTone, string> = {
  neutral: 'text-ink-faint border-line bg-raised',
  ok: 'text-ok border-ok/35 bg-ok/10',
  warn: 'text-warn border-warn/35 bg-warn/10',
  danger: 'text-danger border-danger/35 bg-danger/10',
  live: 'text-live border-live/35 bg-live/10',
  info: 'text-accent border-accent/35 bg-accent/10',
};

/** Цвет текста в тон состоянию — для цифр в метриках и ячеек таблиц. */
export const statusTextClass: Record<StatusTone, string> = {
  neutral: 'text-ink',
  ok: 'text-ok',
  warn: 'text-warn',
  danger: 'text-danger',
  live: 'text-live',
  info: 'text-accent',
};

/* ── Соответствие доменных статусов тонам ────────────────────────────

   Эти карты — единственное место, где статус превращается в цвет.

   Каждая типизирована через Record по enum'у из схемы, а не по string.
   Разница существенная: при добавлении статуса в базу и в словарь
   компилятор потребует определить и тон. С Record<string, …> новый
   статус молча падал бы в undefined и красил бы бейдж в никуда. */

export const orderStatusTone = {
  DRAFT: 'neutral',
  OPEN: 'info',
  REQUESTED: 'warn',
  AWAIT_DRIVER: 'warn',
  IN_PROGRESS: 'live',
  DONE: 'ok',
  CANCELLED: 'neutral',
} as const satisfies Record<OrderStatus, StatusTone>;

export const companyStatusTone = {
  PENDING: 'warn',
  APPROVED: 'info',
  ACTIVE: 'ok',
  REJECTED: 'danger',
} as const satisfies Record<CompanyStatus, StatusTone>;

export const vehicleAccessTone = {
  DRAFT: 'neutral',
  PENDING: 'warn',
  APPROVED: 'ok',
  REJECTED: 'danger',
} as const satisfies Record<VehicleAccess, StatusTone>;

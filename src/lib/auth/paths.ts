import type { Locale } from '@/lib/i18n';
import type { PartyRole } from '@/types/db';

/**
 * Адреса, завязанные на роль и локаль.
 *
 * Собраны в одном месте, чтобы переименование раздела не превратилось
 * в охоту за строками по всему проекту.
 */

const cabinetSegment: Record<PartyRole, string> = {
  CARRIER: 'carrier',
  SHIPPER: 'shipper',
  ADMIN: 'admin',
};

/** Разделы, доступные только вошедшим. Проверяется в proxy.ts. */
export const PROTECTED_SEGMENTS = Object.values(cabinetSegment);

export function cabinetPath(locale: Locale, role: PartyRole): string {
  return `/${locale}/${cabinetSegment[role]}`;
}

export function signInPath(locale: Locale, redirectTo?: string): string {
  const base = `/${locale}/signin`;
  return redirectTo ? `${base}?next=${encodeURIComponent(redirectTo)}` : base;
}

export function noAccessPath(locale: Locale): string {
  return `/${locale}/no-access`;
}

export function homePath(locale: Locale): string {
  return `/${locale}`;
}

/**
 * Куда вести после входа. Адрес из параметра next принимается, только если
 * он ведёт внутрь сайта: открытый редирект по чужому URL — классический
 * способ увести пользователя на фишинговую копию страницы входа.
 */
export function safeRedirect(next: string | null | undefined, fallback: string): string {
  if (!next) return fallback;
  if (!next.startsWith('/') || next.startsWith('//')) return fallback;
  return next;
}

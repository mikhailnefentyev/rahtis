'use client';

import { useMemo } from 'react';
import { Badge } from '@/components/ui';
import { useI18n } from '@/lib/i18n/provider';

/**
 * Общее для наборов оплаты и суточных по странам: флаг и название
 * страны, степень законности и источник шаблона.
 */

/* ЕС и ЕЭЗ: здесь оплата преимущественно за км или фрахт запрещена (Reg. 561/2006 ст. 10). */
const EEA = new Set([
  'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU',
  'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE', 'NO', 'IS', 'LI',
]);

export const inEea = (country: string | null | undefined) => EEA.has((country ?? '').toUpperCase());

export type Legality = 'LEGAL' | 'GREY' | 'NON_COMPLIANT';

export const asLegality = (value: string | null | undefined): Legality =>
  value === 'GREY' || value === 'NON_COMPLIANT' ? value : 'LEGAL';

/** Флаг из кода страны: региональные буквы Юникода. */
export function flag(code: string): string {
  if (!/^[A-Z]{2}$/.test(code)) return '🌐';
  return String.fromCodePoint(...[...code].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}

/** Название страны на языке кабинета; неизвестный код — сам код. */
export function useCountryName() {
  const { locale } = useI18n();
  const names = useMemo(() => {
    try {
      return new Intl.DisplayNames([locale], { type: 'region' });
    } catch {
      return null;
    }
  }, [locale]);
  return (code: string) => {
    if (!/^[A-Z]{2}$/.test(code)) return code;
    try {
      return names?.of(code) ?? code;
    } catch {
      return code;
    }
  };
}

export function CountryLabel({ code }: { code: string }) {
  const name = useCountryName();
  return (
    <span className="whitespace-nowrap">
      <span aria-hidden>{flag(code)}</span> {name(code)}
    </span>
  );
}

export function LegalityBadge({ legality }: { legality: string | null | undefined }) {
  const { t } = useI18n();
  const level = asLegality(legality);
  const tone = level === 'LEGAL' ? 'ok' : level === 'GREY' ? 'warn' : 'danger';
  return <Badge tone={tone}>{t.paySetup.legality[level]}</Badge>;
}

/** Источник шаблона — свёрнутым: длинный, на языке страны. */
export function SourceNote({ note }: { note: string | null | undefined }) {
  const { t } = useI18n();
  if (!note) return null;
  return (
    <details className="mt-1.5">
      <summary className="cursor-pointer text-xs font-semibold text-ink-muted">{t.paySetup.source}</summary>
      <p className="mt-1 text-xs break-words whitespace-pre-line text-ink-dim">{note}</p>
    </details>
  );
}

/** Группы по странам: страна компании первой, остальные — по названию. */
export function byCountry<T extends { country: string }>(
  rows: T[],
  home: string,
  name: (code: string) => string,
): { home: T[]; others: Array<[string, T[]]> } {
  const groups = new Map<string, T[]>();
  for (const row of rows) {
    const list = groups.get(row.country) ?? [];
    list.push(row);
    groups.set(row.country, list);
  }
  const others = [...groups.entries()]
    .filter(([code]) => code !== home)
    .sort(([a], [b]) => name(a).localeCompare(name(b)));
  return { home: groups.get(home) ?? [], others };
}

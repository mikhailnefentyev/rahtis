'use client';

import Link from 'next/link';
import { useI18n } from '@/lib/i18n/provider';

/**
 * Ссылка на страницу «Отходы» заказа: отметка и документ Приложения VII.
 * Одна и та же у заказчика и у перевозчика — страницу открывают обе стороны.
 */
export function WasteLink({ orderId, className }: { orderId: string; className?: string }) {
  const { t, locale } = useI18n();
  return (
    <Link href={`/${locale}/waste/${orderId}`} className={`text-xs text-ink-faint underline underline-offset-2 hover:text-ink-muted ${className ?? ''}`}>
      ♻ {t.waste.link}
    </Link>
  );
}

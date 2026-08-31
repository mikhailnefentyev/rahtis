import Link from 'next/link';
import { notFound } from 'next/navigation';
import { LocaleSwitch } from '@/components/layout/LocaleSwitch';
import { LegalDocument } from '@/components/domain/LegalDocument';
import { APP } from '@/lib/config';
import { getI18n, isLocale } from '@/lib/i18n';
import type { Database } from '@/types/database';

type Kind = Database['public']['Enums']['legal_kind'];

/**
 * Обёртка юридической страницы.
 *
 * Общая на все четыре адреса: /fi/kayttoehdot, /fi/tietosuoja и их
 * английские двойники — это один и тот же экран с разным типом
 * документа. Отдельные маршруты, а не один с параметром, потому что
 * адреса заказаны человекочитаемыми на каждом языке, а не /legal/terms.
 *
 * Страница открыта анониму: условия читают до того, как согласятся, а не
 * после входа.
 */
export async function LegalPage({ locale: raw, kind }: { locale: string; kind: Kind }) {
  if (!isLocale(raw)) notFound();
  const locale = raw;

  const { t } = await getI18n(locale);

  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-10">
      <nav className="mb-8 flex items-center justify-between gap-4">
        <Link href={`/${locale}`} className="text-[13px] text-ink-muted hover:text-ink">
          ← {t.brand.name}
        </Link>
        <LocaleSwitch current={locale} />
      </nav>

      <h1 className="text-2xl font-semibold tracking-tight">{t.legal[kind]}</h1>

      <LegalDocument locale={locale} kind={kind} />

      <p className="mt-10 border-t border-line pt-4 text-xs text-ink-dim">
        {t.brand.legalEntity} · {APP.operator.businessId} · {t.landing.footerCountry}
      </p>
    </main>
  );
}

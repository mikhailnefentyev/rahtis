import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireRole } from '@/lib/auth/guard';
import { isLocale } from '@/lib/i18n';
import { createClient } from '@/lib/supabase/server';
import { getViewerI18n } from '@/lib/i18n/viewer';
import { AllowancesView } from './AllowancesView';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const { t } = await getViewerI18n(locale);
  return { title: t.allowanceSetup.title };
}

/**
 * Наборы суточных по странам: шаблоны оператора и свои наборы компании.
 * Справочно, как и оплата: окончательный расчёт — у работодателя.
 */
export default async function AllowancesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const viewer = await requireRole(locale, 'CARRIER');
  const [{ t }, supabase] = await Promise.all([getViewerI18n(locale), createClient()]);

  /* RLS отдаёт свои наборы и шаблоны оператора (company_id is null) — и их ставки. */
  const [{ data: sets }, { data: rates }] = await Promise.all([
    supabase.from('allowance_rule_sets').select('*').order('country').order('name'),
    supabase
      .from('allowance_rates')
      .select('rule_set_id, country, currency, day_cents, hotel_limit_cents')
      .order('country'),
  ]);

  return (
    <main className="cab-page">
      <Link href={`/${locale}/carrier/drivers/tes`} className="text-[13px] text-ink-faint hover:text-ink">
        ← {t.tes.title}
      </Link>
      <h1 className="page-title mt-3">{t.allowanceSetup.title}</h1>
      <p className="mt-2 mb-4 max-w-xl text-[13px] leading-relaxed text-ink-muted">{t.allowanceSetup.subtitle}</p>
      {/* Справка, а не расчёт — до любой суммы. */}
      <p className="mb-6 max-w-xl rounded-control border border-warn/35 bg-warn/10 px-3 py-2 text-[13px] text-warn">
        {t.allowanceSetup.disclaimer}
      </p>

      <AllowancesView
        own={(sets ?? []).filter((s) => s.company_id !== null)}
        templates={(sets ?? []).filter((s) => s.company_id === null)}
        rates={rates ?? []}
        home={viewer.company?.country ?? 'FI'}
      />
    </main>
  );
}

import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { buttonClass } from '@/components/ui';
import { requireRole } from '@/lib/auth/guard';
import { isLocale } from '@/lib/i18n';
import { createClient } from '@/lib/supabase/server';
import { TesView } from './TesView';
import { getViewerI18n } from '@/lib/i18n/viewer';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const { t } = await getViewerI18n(locale);
  return { title: t.tes.title };
}

export default async function TesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const viewer = await requireRole(locale, 'CARRIER');
  const [{ t }, supabase] = await Promise.all([getViewerI18n(locale), createClient()]);

  /* RLS отдаёт свои наборы и шаблоны оператора (company_id is null). */
  const [{ data: sets }, { data: rates }] = await Promise.all([
    supabase.from('tes_rule_sets').select('*').order('valid_from', { ascending: false }),
    supabase
      .from('tes_wage_rates')
      .select('rule_set_id, grade, label, sort, valid_from, hourly_cents')
      .order('sort')
      .order('valid_from'),
  ]);

  return (
    <main className="cab-page">
      <Link href={`/${locale}/carrier/drivers`} className="text-[13px] text-ink-faint hover:text-ink">
        ← {t.drivers.back}
      </Link>
      <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
        <h1 className="page-title">{t.tes.title}</h1>
        <Link
          href={`/${locale}/carrier/drivers/allowances`}
          className={buttonClass({ variant: 'default', size: 'sm' })}
        >
          {t.allowanceSetup.title}
        </Link>
      </div>
      <p className="mt-2 mb-2 max-w-xl text-[13px] leading-relaxed text-ink-muted">{t.tes.subtitle}</p>
      <p className="mb-4 max-w-xl text-xs text-ink-dim">{t.tes.later}</p>
      {/* Справка, а не расчёт зарплаты — до любой суммы. */}
      <p className="mb-6 max-w-xl rounded-control border border-warn/35 bg-warn/10 px-3 py-2 text-[13px] text-warn">
        {t.pay.disclaimer}
      </p>

      <TesView
        own={(sets ?? []).filter((s) => s.company_id !== null)}
        templates={(sets ?? []).filter((s) => s.company_id === null)}
        rates={rates ?? []}
        home={viewer.company?.country ?? 'FI'}
      />
    </main>
  );
}

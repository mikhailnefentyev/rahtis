import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CompletedCabinet } from '@/components/domain/CompletedCabinet';
import { requireRole } from '@/lib/auth/guard';
import { isLocale } from '@/lib/i18n';
import { getViewerI18n } from '@/lib/i18n/viewer';
import { createClient } from '@/lib/supabase/server';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const { t } = await getViewerI18n(locale);
  return { title: t.done.titleCarrier };
}

export default async function DonePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  /*
   * Счета за прямые перевозки, которые RAHTIS отправил заказчикам от имени
   * перевозчика (22.11.2026): у них своя страница, и вход на неё — отсюда,
   * где перевозчик смотрит выполненные рейсы. Строка видна, только когда
   * такие счета есть; сумма — неоплаченные, по валютам.
   */
  const viewer = await requireRole(locale, 'CARRIER');
  const [{ t, f }, supabase] = await Promise.all([getViewerI18n(locale), createClient()]);
  const { data: invoices } = await supabase
    .from('carrier_invoices')
    .select('total_cents, currency, paid_at')
    .eq('company_id', viewer.company?.id ?? '00000000-0000-0000-0000-000000000000')
    .eq('kind', 'FREIGHT')
    .not('number', 'like', 'DRAFT-%')
    .order('issued_on', { ascending: false })
    .limit(200);
  const open = new Map<string, number>();
  for (const inv of invoices ?? []) {
    if (!inv.paid_at) open.set(inv.currency, (open.get(inv.currency) ?? 0) + Number(inv.total_cents));
  }

  return (
    <>
      {(invoices ?? []).length > 0 && (
        <div className="w-full max-w-[1180px] px-5 pt-5 sm:px-8">
          <Link
            href={`/${locale}/carrier/invoices`}
            className="flex flex-wrap items-baseline gap-x-4 gap-y-1 rounded-control border border-line bg-surface px-3 py-2.5 text-[13px] hover:border-accent"
          >
            <span className="font-semibold text-accent">{t.carrierInvoices.title} →</span>
            {open.size > 0 && (
              <span className="text-ink-muted">
                {t.shipperInvoices.openTotal}: {[...open].map(([currency, cents]) => f.money(cents, currency)).join(' · ')}
              </span>
            )}
          </Link>
        </div>
      )}
      <CompletedCabinet locale={locale} role="CARRIER" />
    </>
  );
}

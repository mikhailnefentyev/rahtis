import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { EmptyState } from '@/components/ui';
import { VerificationPackageView } from '@/components/domain/VerificationPackageView';
import { requireRole } from '@/lib/auth/guard';
import { isLocale } from '@/lib/i18n';
import { getViewerI18n } from '@/lib/i18n/viewer';
import { loadPackage } from '@/lib/verification/package';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const { t } = await getViewerI18n(locale);
  return { title: t.verification.viewPackage };
}

/**
 * Пакет tilaajavastuu перевозчика глазами заказчика — без ссылки.
 *
 * Доступ решает база (public.verification_package): заказчику пакет
 * открыт, только если перевозчик ему и так известен по имени — прямые
 * заказы подписчика по активной связи. На заказах стола по договору с
 * RAHTIS перевозчик анонимен, и там заказчик видит только значок.
 */
export default async function ShipperCarrierPackagePage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  if (!isLocale(locale) || !/^[0-9a-f-]{36}$/.test(id)) notFound();

  await requireRole(locale, 'SHIPPER');
  const i18n = await getViewerI18n(locale);
  const v = i18n.t.verification;
  const pkg = await loadPackage(id);

  return (
    <main className="cab-page">
      <nav className="mb-6">
        <Link href={`/${locale}/shipper/vehicles`} className="text-[13px] text-ink-muted hover:text-ink">
          ← {v.back}
        </Link>
      </nav>
      <h1 className="page-title">{v.sharePageTitle}</h1>
      {pkg ? (
        <>
          <p className="mt-2 mb-6 max-w-2xl text-[13px] leading-relaxed text-ink-muted">{v.sharePageLead}</p>
          <VerificationPackageView pkg={pkg} i18n={i18n} />
        </>
      ) : (
        <div className="mt-6">
          <EmptyState title={v.packageUnavailable} />
        </div>
      )}
    </main>
  );
}

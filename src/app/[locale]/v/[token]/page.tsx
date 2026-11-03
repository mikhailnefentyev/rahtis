import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { VerificationPackageView } from '@/components/domain/VerificationPackageView';
import { fill } from '@/lib/verification/fill';
import { getI18n, isLocale } from '@/lib/i18n';
import { loadSharedPackage } from '@/lib/verification/package';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const { t } = await getI18n(locale);
  return {
    title: t.verification.sharePageTitle,
    robots: { index: false, follow: false },
    /* Токен в адресе страницы не должен уходить в Referer при открытии файла. */
    referrer: 'no-referrer',
  };
}

/**
 * Пакет tilaajavastuu по ссылке — для заказчика, который RAHTIS не
 * пользуется. Без входа: ссылка — случайный токен из 256 бит, перевозчик
 * её отзывает или ставит срок. Файлы — подписанные ссылки на десять
 * минут, выписанные при открытии страницы.
 */
export default async function SharedVerificationPage({ params }: { params: Promise<{ locale: string; token: string }> }) {
  const { locale, token } = await params;
  if (!isLocale(locale)) notFound();
  const i18n = await getI18n(locale);
  const v = i18n.t.verification;

  const pkg = await loadSharedPackage(token);

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-10 sm:px-5">
      <p className="label-micro">{v.sharePageTitle}</p>
      {pkg ? (
        <>
          <p className="mt-2 mb-6 text-[13px] leading-relaxed text-ink-muted">{v.sharePageLead}</p>
          <VerificationPackageView pkg={pkg} i18n={i18n} />
          {pkg.verified && pkg.granted_at && (
            <p className="mt-4 text-xs text-ink-dim">
              {v.badgeHint} {fill(v.adminGrantedAt, { date: i18n.f.date(pkg.granted_at) })}
            </p>
          )}
          <p className="mt-6 text-xs text-ink-dim">{v.sharedBy}</p>
        </>
      ) : (
        <p className="mt-3 text-[13px] text-ink-muted">{v.shareNotFound}</p>
      )}
    </main>
  );
}

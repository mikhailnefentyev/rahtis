import { notFound } from 'next/navigation';
import { CabinetShell } from '@/components/layout/CabinetShell';
import { FlashNotice } from '@/components/layout/FlashNotice';
import { requireRole } from '@/lib/auth/guard';
import { getDictionary, isLocale } from '@/lib/i18n';
import { ForwarderDocsBanner } from '@/components/domain/ForwarderDocsBanner';
import { DocsGateProvider } from '@/lib/forwarders/DocsGateProvider';
import { gateBlocked } from '@/lib/forwarders/docsGate';
import { loadOwnDocsGate } from '@/lib/forwarders/docsGateServer';
import { TimeZoneProvider } from '@/lib/i18n/provider';
import { viewerMoney } from '@/lib/i18n/viewer';
import { stopTimeZone } from '@/lib/country';

/**
 * Гейт кабинета. requireRole уводит гостя на вход, пользователя без
 * профиля и отклонённую компанию — на страницу-тупик, а чужую роль —
 * в её собственный кабинет.
 */
export default async function ShipperLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const viewer = await requireRole(locale, 'SHIPPER');
  /*
   * Экспедитор без принятых выписки и полиса (11.11.2026): смотрит всё,
   * но публикует и назначает только после проверки. Плашка над каждой
   * страницей, кнопки гаснут через DocsGateProvider; запрет — в базе.
   */
  const [gate, t] = await Promise.all([
    viewer.company?.status === 'ACTIVE' ? loadOwnDocsGate() : null,
    getDictionary(locale),
  ]);

  return (
    /* Время в кабинете — по стране компании (src/lib/i18n/viewer). */
    <TimeZoneProvider
      zone={stopTimeZone(viewer.company?.country)}
      country={viewer.company?.country ?? null}
      money={await viewerMoney()}
    >
      <CabinetShell locale={locale} role="SHIPPER" company={viewer.company}>
        <FlashNotice />
        {gate && gateBlocked(gate) && (
          /* Тот же левый край и ширина, что у .cab-page под ней. */
          <div className="w-full max-w-[1180px] px-5 pt-6 sm:px-8">
            <ForwarderDocsBanner locale={locale} t={t} gate={gate} />
          </div>
        )}
        <DocsGateProvider blocked={gate ? gateBlocked(gate) : false}>{children}</DocsGateProvider>
      </CabinetShell>
    </TimeZoneProvider>
  );
}

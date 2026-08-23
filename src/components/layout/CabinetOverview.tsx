import Link from 'next/link';
import { CabinetPulse } from '@/components/domain/CabinetPulse';
import { Badge, buttonClass, Card, CardBody, Kv, Mono } from '@/components/ui';
import { companyStatusTone } from '@/components/ui/tone';
import { getI18n, type Locale } from '@/lib/i18n';
import type { Company, PartyRole } from '@/types/db';

/**
 * Первый экран кабинета: кто вы и куда отсюда идти.
 *
 * Слева компания и её состояние, справа то, что можно сделать. Разделов
 * ровно столько, сколько работает: пока работал один вход, здесь стояла
 * оговорка «раздел откроется позже» — она пережила семь этапов и висела
 * под работающими кнопками, обещая, что кабинета ещё нет.
 */
export async function CabinetOverview({
  locale,
  role,
  company,
}: {
  locale: Locale;
  role: PartyRole;
  company: Company | null;
}) {
  const { t, f } = await getI18n(locale);

  /* Одобрена, но ещё не активна — значит реквизиты не заполнены. */
  const needsRequisites = company?.status === 'APPROVED';

  const hint =
    company?.status === 'APPROVED'
      ? role === 'CARRIER'
        ? t.cabinet.approvedCarrierHint
        : role === 'SHIPPER'
          ? t.cabinet.approvedShipperHint
          : null
      : null;

  return (
    <main className="mx-auto w-full max-w-6xl px-5 py-8">
      <h1 className="text-xl font-semibold tracking-tight">{t.role[role]}</h1>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardBody className="flex flex-col gap-2.5">
            {company ? (
              <>
                <div className="flex flex-wrap items-center gap-2.5">
                  <h2 className="text-[15px] font-semibold tracking-tight">{company.name}</h2>
                  <Badge tone={companyStatusTone[company.status]}>
                    {t.companyStatus[company.status]}
                  </Badge>
                </div>
                <div className="mt-1 flex flex-col gap-1.5">
                  <Kv k={t.cabinet.businessId} v={<Mono>{company.business_id}</Mono>} />
                  <Kv k={t.company.email} v={company.contact_email} />
                  <Kv k={t.cabinet.yourRole} v={t.role[role]} />
                  {company.approved_at && (
                    <Kv k={t.companyStatus.APPROVED} v={<Mono>{f.date(company.approved_at)}</Mono>} />
                  )}
                </div>
              </>
            ) : (
              <>
                <h2 className="text-[15px] font-semibold tracking-tight">{t.brand.operator}</h2>
                <Kv k={t.cabinet.yourRole} v={t.role[role]} />
              </>
            )}
          </CardBody>
        </Card>

        <Card stripe={needsRequisites ? 'warn' : 'neutral'}>
          <CardBody className="flex flex-col gap-3">
            {needsRequisites && (
              <>
                <p className="text-[13px] leading-relaxed text-ink">
                  {t.requisites.fillToActivate}
                </p>
                <Link
                  href={`/${locale}/requisites`}
                  className={buttonClass({ variant: 'primary', size: 'md', className: 'self-start' })}
                >
                  {t.requisites.openForm}
                </Link>
              </>
            )}
            {hint && <p className="text-[13px] leading-relaxed text-ink-muted">{hint}</p>}

            {role === 'CARRIER' && (
              <div className="flex flex-wrap gap-2">
                <Link
                  href={`/${locale}/carrier/desk`}
                  className={buttonClass({ variant: 'primary', size: 'md' })}
                >
                  {t.desk.title}
                </Link>
                <Link
                  href={`/${locale}/carrier/fleet`}
                  className={buttonClass({ variant: 'default', size: 'md' })}
                >
                  {t.fleet.title}
                </Link>
                <Link
                  href={`/${locale}/carrier/done`}
                  className={buttonClass({ variant: 'default', size: 'md' })}
                >
                  {t.done.titleCarrier}
                </Link>
              </div>
            )}

            {role === 'SHIPPER' && (
              <div className="flex flex-wrap gap-2">
                <Link
                  href={`/${locale}/shipper/orders`}
                  className={buttonClass({
                    variant: needsRequisites ? 'default' : 'primary',
                    size: 'md',
                  })}
                >
                  {t.orders.title}
                </Link>
                <Link
                  href={`/${locale}/shipper/done`}
                  className={buttonClass({ variant: 'default', size: 'md' })}
                >
                  {t.done.titleShipper}
                </Link>
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      <CabinetPulse locale={locale} role={role} />
    </main>
  );
}

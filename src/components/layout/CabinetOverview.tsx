import Link from 'next/link';
import { Badge, buttonClass, Card, CardBody, Kv, Mono } from '@/components/ui';
import { companyStatusTone } from '@/components/ui/tone';
import { getI18n, type Locale } from '@/lib/i18n';
import type { Company, PartyRole } from '@/types/db';

/**
 * Содержимое кабинета на Этапе 1.
 *
 * Показывает то, что уже существует: компанию, её статус и роль
 * пользователя. Всё остальное появится на следующих этапах, и об этом
 * сказано прямо — пустой кабинет без объяснения выглядит как поломка.
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
            <p className="text-[13px] leading-relaxed text-ink-muted">{t.cabinet.stageNotice}</p>
          </CardBody>
        </Card>
      </div>
    </main>
  );
}

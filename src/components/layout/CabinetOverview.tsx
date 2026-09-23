import Link from 'next/link';
import { AgentChat } from '@/components/domain/AgentChat';
import { CabinetPulse } from '@/components/domain/CabinetPulse';
import { CarrierPresence } from '@/components/domain/CarrierPresence';
import { ReportArchive } from '@/components/domain/ReportArchive';
import { Badge, Button, buttonClass, Card, CardBody, Kv, Mono } from '@/components/ui';
import { companyStatusTone } from '@/components/ui/tone';
import { accountPath } from '@/lib/auth/paths';
import { setOwnPartnershipAction } from '@/lib/companies/actions';
import { freeUntil } from '@/lib/config';
import { todayInHelsinki } from '@/lib/dates';
import { getI18n, type Locale } from '@/lib/i18n';
import { createClient } from '@/lib/supabase/server';
import type { Company, PartyRole } from '@/types/db';

/**
 * Первый экран кабинета: кто вы и куда отсюда идти.
 *
 * Слева компания и её состояние, справа — то, что требует действия
 * прямо сейчас.
 *
 * Кнопок разделов здесь больше нет: они переехали во вкладки шапки и
 * висят там всегда, а не только на первом экране. Оставленные заодно,
 * они дублировали строку вкладок ровно под ней, и вторая карточка
 * состояла из одной этой строки.
 *
 * Поэтому карточка условная. Ей нечего сказать активной компании без
 * незакрытых дел — и тогда её нет вовсе, а не стоит пустой белый
 * прямоугольник в половину экрана.
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

  /*
   * Ветка и её цена. Перевозчик узнавал, за что с него берут, только из
   * счёта или отчёта — то есть после того, как деньги посчитаны.
   *
   * Непогашенный месячный сбор показывается отдельно: у подписчика,
   * который возит своих клиентов, выплаты от нас нет, и вычесть сбор не
   * из чего — счёт приходит письмом и иначе на глаза не попадётся.
   */
  const subscriber = role === 'CARRIER' && company?.partnership === 'SUBSCRIBER';
  const free = role === 'CARRIER' ? freeUntil(company?.approved_at ?? null) : null;

  let openFee = 0;
  if (subscriber) {
    const supabase = await createClient();
    const { data: fees } = await supabase
      .from('carrier_subscription_fees')
      .select('gross_cents, paid_at, invoice_id, carrier_fee_deductions(amount_cents)')
      .is('paid_at', null)
      .not('invoice_id', 'is', null);

    for (const fee of fees ?? []) {
      const taken = (fee.carrier_fee_deductions ?? []).reduce(
        (sum: number, d: { amount_cents: number }) => sum + d.amount_cents,
        0,
      );
      openFee += Math.max(fee.gross_cents - taken, 0);
    }
  }

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

  const aside = needsRequisites || hint !== null;

  return (
    <main className="mx-auto w-full max-w-6xl px-5 py-8">
      <h1 className="text-xl font-semibold tracking-tight">{t.role[role]}</h1>

      <div className={`mt-6 grid gap-4 ${aside ? 'lg:grid-cols-2' : ''}`}>
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

                {role === 'CARRIER' && company.partnership && (
                  <div className="mt-1 flex flex-col gap-1 border-t border-line pt-2.5">
                    <p className="label-micro">{t.cabinet.partnership}</p>
                    <p className="text-[13px] font-semibold">
                      {subscriber ? t.cabinet.partnershipSub : t.cabinet.partnershipCon}
                    </p>
                    <p className="text-[12px] leading-relaxed text-ink-muted">
                      {subscriber ? t.cabinet.partnershipSubText : t.cabinet.partnershipConText}
                    </p>
                    {free && free >= todayInHelsinki() && (
                      <p className="text-[12px] text-ok">
                        {t.cabinet.freeUntil.replace('{date}', f.date(free))}
                      </p>
                    )}
                    {openFee > 0 && (
                      <p className="text-[12px] font-medium text-warn">
                        {t.cabinet.feeOpen.replace('{amount}', f.eur(openFee))}
                      </p>
                    )}
                    {/*
                      * Заявленная смена показывается вместо кнопки: пока
                      * она висит, нажимать нечего — кроме отмены.
                      */}
                    {company.pending_partnership && company.pending_partnership_from ? (
                      <form action={setOwnPartnershipAction} className="mt-1 flex flex-col gap-1">
                        <input type="hidden" name="locale" value={locale} />
                        <input type="hidden" name="mode" value={company.partnership} />
                        <p className="text-[12px] font-medium text-warn">
                          {t.cabinet.partnershipPending
                            .replace(
                              '{mode}',
                              company.pending_partnership === 'SUBSCRIBER'
                                ? t.cabinet.partnershipSub
                                : t.cabinet.partnershipCon,
                            )
                            .replace('{date}', f.date(company.pending_partnership_from))}
                        </p>
                        <Button type="submit" size="sm" variant="default" className="self-start">
                          {t.cabinet.partnershipCancel}
                        </Button>
                      </form>
                    ) : (
                      <form action={setOwnPartnershipAction} className="mt-1 flex flex-col gap-1">
                        <input type="hidden" name="locale" value={locale} />
                        <input
                          type="hidden"
                          name="mode"
                          value={subscriber ? 'SUBCONTRACTOR' : 'SUBSCRIBER'}
                        />
                        {/*
                          * Кнопка акцентная: это выбор, за который платят,
                          * и он не должен выглядеть служебной ссылкой.
                          */}
                        <Button type="submit" size="md" variant="primary" className="self-start">
                          {t.cabinet.partnershipSwitch.replace(
                            '{mode}',
                            subscriber ? t.cabinet.partnershipCon : t.cabinet.partnershipSub,
                          )}
                        </Button>
                        {/*
                          * Когда смена вступит в силу, сказано до нажатия:
                          * уход из подряда действует со следующего месяца,
                          * и узнавать об этом постфактум неприятно.
                          */}
                        <span className="text-[12px] text-ink-dim">
                          {subscriber ? t.cabinet.partnershipNow : t.cabinet.partnershipNextMonth}
                        </span>
                      </form>
                    )}
                  </div>
                )}
              </>
            ) : (
              <>
                <h2 className="text-[15px] font-semibold tracking-tight">{t.brand.operator}</h2>
                <Kv k={t.cabinet.yourRole} v={t.role[role]} />
              </>
            )}
          </CardBody>
        </Card>

        {aside && (
          <Card stripe={needsRequisites ? 'warn' : 'neutral'}>
            <CardBody className="flex flex-col gap-3">
              {needsRequisites && (
                <>
                  <p className="text-[13px] leading-relaxed text-ink">
                    {t.requisites.fillToActivate}
                  </p>
                  <Link
                    href={accountPath(locale)}
                    className={buttonClass({
                      variant: 'primary',
                      size: 'md',
                      className: 'self-start',
                    })}
                  >
                    {t.requisites.openForm}
                  </Link>
                </>
              )}
              {hint && <p className="text-[13px] leading-relaxed text-ink-muted">{hint}</p>}
            </CardBody>
          </Card>
        )}
      </div>

      <CabinetPulse locale={locale} role={role} />

      {/*
        * Карта транспорта — только заказчику и оператору.
        *
        * Перевозчику она сказала бы, где стоят конкуренты, и не сказала
        * бы ничего о его работе: заказы он ищет на столе, а не по чужим
        * базам. Тот же круг зашит в carrier_presence, здесь только не
        * делается лишний запрос.
        */}
      {role !== 'CARRIER' && <CarrierPresence locale={locale} />}

      <AgentChat locale={locale} role={role} />

      <ReportArchive locale={locale} role={role} />
    </main>
  );
}

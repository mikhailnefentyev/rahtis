import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { CompletedList } from '@/components/domain/CompletedList';
import { OperatorTrend } from '@/components/domain/OperatorTrend';
import { Button, Mono, Stars, Stat, StatRow, Table, TableFrame, Td, Th, Tr } from '@/components/ui';
import { AdminError } from '@/components/layout/AdminError';
import { requireRole } from '@/lib/auth/guard';
import { setSubscriptionPaidAction } from '@/lib/billing/actions';
import { COMPLETED_WEEKS } from '@/lib/config';
import { weeksAgoMonday } from '@/lib/dates';
import { getI18n, isLocale, type Locale } from '@/lib/i18n';
import { createClient } from '@/lib/supabase/server';
import type { Database } from '@/types/database';
import type { PartnerTotal } from '@/types/db';
import { ReportsButton } from '../ReportsButton';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const { t } = await getI18n(locale);
  return { title: t.billingDesk.title };
}

type I18n = Awaited<ReturnType<typeof getI18n>>;
type SubscriptionFee = Database['public']['Functions']['subscription_fees_overview']['Returns'][number];

/**
 * Laskutus — расчёты оператора.
 *
 * С 6.11.2026 договор перевозки заключают заказчик и перевозчик напрямую:
 * платформа не выставляет счета за рейсы и ничего не выплачивает. Деньги
 * оператора — только абонентская плата перевозчиков, она и стоит первой.
 * Полумесячные периоды, счета заказчикам, выплаты перевозчикам и «наша
 * доля» прежней модели убраны (08.11.2026: заказов прежней модели не
 * осталось). Ниже — динамика оборота и сводка по партнёрам.
 */
export default async function BillingPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  await requireRole(locale, 'ADMIN');
  const { error: failure } = await searchParams;

  const [i18n, supabase] = await Promise.all([getI18n(locale), createClient()]);
  const { t, f } = i18n;

  const [{ data: partners }, { data: orders }, { data: totals }, { data: subscriptions }] = await Promise.all([
    supabase.rpc('partner_totals', {}),
    supabase.rpc('completed_orders', { p_from: weeksAgoMonday(COMPLETED_WEEKS * 2) }),
    supabase.rpc('weekly_totals', { p_weeks: 12 }),
    supabase.rpc('subscription_fees_overview'),
  ]);

  const fees = (subscriptions ?? []) as SubscriptionFee[];
  const unpaid = fees.filter((r) => r.open_cents > 0 && !r.paid_at);
  const paid = fees.filter((r) => r.paid_at);

  return (
    <main className="cab-page cab-page--wide">
      <AdminError locale={locale} code={failure} />

      <h1 className="page-title">{t.billingDesk.title}</h1>
      <p className="mt-2 mb-6 max-w-2xl text-[13px] leading-relaxed text-ink-muted">{t.billingDesk.subsLede}</p>

      <StatRow>
        <Stat
          label={t.billingDesk.subsColOpen}
          value={f.eur(unpaid.reduce((s, r) => s + r.open_cents, 0))}
          tone={unpaid.length > 0 ? 'warn' : undefined}
        />
        <Stat label={t.billingDesk.subsPaid} value={f.eur(paid.reduce((s, r) => s + r.gross_cents, 0))} tone="ok" />
      </StatRow>

      <SubscriptionFees rows={fees} locale={locale} i18n={i18n} />

      <OperatorTrend totals={totals ?? []} weeks={12} i18n={i18n} />

      <details className="mt-10">
        <summary className="cursor-pointer border-b border-line pb-2 text-[13px] font-semibold tracking-tight text-ink-faint">
          {t.billingDesk.summary}
        </summary>
        <PartnerTables partners={(partners ?? []) as PartnerTotal[]} i18n={i18n} />
        <div className="mt-8">
          <CompletedList orders={orders ?? []} totals={totals ?? []} />
        </div>
      </details>

      <ReportsButton locale={locale} />
    </main>
  );
}

/**
 * Абонентская плата перевозчиков по месяцам: машины, сумма, счёт и
 * отметка об оплате — единственное, что оператор отмечает руками.
 */
function SubscriptionFees({
  rows,
  locale,
  i18n: { t, f },
}: {
  rows: SubscriptionFee[];
  locale: Locale;
  i18n: I18n;
}) {
  if (rows.length === 0) {
    return (
      <section className="mt-10">
        <h2 className="border-b border-line pb-2 text-[13px] font-semibold tracking-tight">{t.billingDesk.subsTitle}</h2>
        <p className="mt-3 text-[13px] text-ink-dim">{t.billingDesk.subsNone}</p>
      </section>
    );
  }

  return (
    <section className="mt-10">
      <h2 className="border-b border-line pb-2 text-[13px] font-semibold tracking-tight">{t.billingDesk.subsTitle}</h2>
      <div className="mt-3" />

      <TableFrame>
        <Table>
          <thead>
            <Tr>
              <Th>{t.billingDesk.subsColMonth}</Th>
              <Th>{t.billingDesk.colCarrier}</Th>
              <Th numeric>{t.billingDesk.subsColVehicles}</Th>
              <Th numeric>{t.billingDesk.subsColTotal}</Th>
              <Th numeric>{t.billingDesk.subsColOpen}</Th>
              <Th>{t.billingDesk.colInvoice}</Th>
              <Th>{t.billingDesk.colStatus}</Th>
            </Tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <Tr key={row.fee_id}>
                <Td mono>{row.month.slice(0, 7)}</Td>
                <Td>{row.carrier_name}</Td>
                <Td numeric>{row.active_vehicles}</Td>
                <Td numeric>{f.eur(row.gross_cents)}</Td>
                <Td numeric>{row.open_cents > 0 ? f.eur(row.open_cents) : '—'}</Td>
                <Td mono>
                  {row.invoice_number ?? <span className="text-ink-dim">{t.billingDesk.subsNoInvoice}</span>}
                </Td>
                <Td>
                  {row.open_cents === 0 ? (
                    <span className="text-ink-dim">—</span>
                  ) : row.paid_at ? (
                    <form action={setSubscriptionPaidAction} className="flex items-center gap-2">
                      <input type="hidden" name="locale" value={locale} />
                      <input type="hidden" name="fee" value={row.fee_id} />
                      <input type="hidden" name="paid" value="false" />
                      <span className="text-ok">{t.billingDesk.subsPaid}</span>
                      <button type="submit" className="text-[12px] text-ink-dim underline underline-offset-2">
                        {t.billingDesk.subsUndo}
                      </button>
                    </form>
                  ) : (
                    <form action={setSubscriptionPaidAction}>
                      <input type="hidden" name="locale" value={locale} />
                      <input type="hidden" name="fee" value={row.fee_id} />
                      <input type="hidden" name="paid" value="true" />
                      <Button type="submit" size="sm" variant="ghost">
                        {t.billingDesk.subsMarkPaid}
                      </Button>
                    </form>
                  )}
                </Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      </TableFrame>
    </section>
  );
}

/** Сводка по контрагентам: рейсы, километры, стоимость перевозок. */
function PartnerTables({ partners, i18n: { t, m, f } }: { partners: PartnerTotal[]; i18n: I18n }) {
  const clients = partners.filter((r) => r.party === 'SHIPPER');
  const carriers = partners.filter((r) => r.party === 'CARRIER');

  const table = (list: PartnerTotal[], moneyLabel: string, money: (r: PartnerTotal) => number, withRating = false) => (
    <TableFrame>
      <Table>
        <thead>
          <Tr>
            <Th>{t.done.company}</Th>
            <Th>{t.done.trips}</Th>
            <Th>{t.done.distance}</Th>
            <Th>{moneyLabel}</Th>
            {withRating && <Th>{t.rating.title}</Th>}
          </Tr>
        </thead>
        <tbody>
          {list.map((r) => (
            <Tr key={`${r.party}-${r.company_id}`}>
              <Td>
                <span className="font-semibold text-ink">{r.company_name}</span>
                <br />
                <Mono className="text-xs text-ink-dim">{r.business_id}</Mono>
              </Td>
              <Td>
                <Mono>{r.orders_count}</Mono>
              </Td>
              <Td>
                <Mono>{m('order.distance', { km: Number(r.distance_km) })}</Mono>
              </Td>
              <Td>
                <span className="font-semibold text-ink">{f.eur(money(r))}</span>
              </Td>
              {withRating && (
                <Td>
                  <Stars value={r.rating === null ? null : Number(r.rating)} count={r.ratings_count ?? undefined} />
                </Td>
              )}
            </Tr>
          ))}
        </tbody>
      </Table>
    </TableFrame>
  );

  return (
    <div className="mt-4 flex flex-col gap-6">
      <div>
        <h3 className="mb-2 text-[13px] font-semibold text-ink-faint">{t.done.clients}</h3>
        {table(clients, t.done.rate, (r) => Number(r.rate_cents))}
      </div>
      <div>
        <h3 className="mb-2 text-[13px] font-semibold text-ink-faint">{t.done.carriers}</h3>
        {table(carriers, t.done.rate, (r) => Number(r.rate_cents), true)}
      </div>
    </div>
  );
}

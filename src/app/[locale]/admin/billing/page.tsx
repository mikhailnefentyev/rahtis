import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { CompletedList } from '@/components/domain/CompletedList';
import { OperatorTrend } from '@/components/domain/OperatorTrend';
import {
  Badge,
  Button,
  Card,
  CardBody,
  Mono,
  Stars,
  Stat,
  StatRow,
  Table,
  TableFrame,
  Td,
  Th,
  Tr,
} from '@/components/ui';
import { AdminError } from '@/components/layout/AdminError';
import { requireRole } from '@/lib/auth/guard';
import {
  issuePeriodInvoicesAction,
  setBillingBatchAction,
  setSubscriptionPaidAction,
} from '@/lib/billing/actions';
import { COMPLETED_WEEKS, vatBpsFor, withVat } from '@/lib/config';
import { todayInHelsinki, weeksAgoMonday } from '@/lib/dates';
import { getI18n, isLocale, type Locale } from '@/lib/i18n';
import { formatIban } from '@/lib/operator/profile';
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

type Row = Database['public']['Functions']['billing_overview']['Returns'][number];
type I18n = Awaited<ReturnType<typeof getI18n>>;

/** Рейсы одной компании в периоде: сумма без налога и с налогом по её стране. */
type Party = {
  id: string;
  rows: Row[];
  net: number;
  gross: number;
  /** Удержанный из выплаты месячный сбор (с ALV). Только у перевозчика. */
  deducted: number;
};

/** Удержания сбора: перевозчик|начало периода → сумма с ALV. */
type Deductions = Map<string, number>;

type Period = {
  start: string;
  end: string;
  invoiceDue: string;
  payoutDue: string;
  rows: Row[];
};

function parties(
  rows: Row[],
  id: (r: Row) => string,
  amount: (r: Row) => number,
  country: (r: Row) => string | null,
): Party[] {
  const map = new Map<string, Party>();
  for (const row of rows) {
    const key = id(row);
    const party = map.get(key) ?? { id: key, rows: [], net: 0, gross: 0, deducted: 0 };
    party.rows.push(row);
    party.net += amount(row);
    map.set(key, party);
  }
  for (const party of map.values()) {
    party.gross = withVat(party.net, vatBpsFor(country(party.rows[0]!)));
  }
  return [...map.values()];
}

/* Заказчику — цена плюс плата 3 % за заказ со стола. */
const shippersOf = (rows: Row[]) =>
  parties(
    rows,
    (r) => r.shipper_id,
    (r) => r.rate_cents + r.shipper_fee_cents,
    (r) => r.shipper_country,
  );

/* Перевозчику — выплата минус месячный сбор, удержанный в этом периоде. */
const carriersOf = (rows: Row[], period?: string, deductions?: Deductions) => {
  const list = parties(
    rows.filter((r) => r.carrier_id),
    (r) => r.carrier_id,
    (r) => r.payout_cents,
    (r) => r.carrier_country,
  );
  if (period && deductions) {
    for (const party of list) {
      party.deducted = deductions.get(`${party.id}|${period}`) ?? 0;
      party.gross -= party.deducted;
    }
  }
  return list;
};

const sumOf = (list: Party[]) => list.reduce((s, p) => s + p.gross, 0);

/** День после конца периода: утром планировщик выпускает счета. */
function dayAfter(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/**
 * Laskutus ja tilitykset — расчёты оператора по расчётным периодам.
 *
 * Деньги живут периодами (1–15 и 16–конец месяца), и страница показывает их
 * так же: сверху идущий период, ниже закрытые, свежие первыми. У
 * закрытого периода две таблицы — счета заказчикам и выплаты
 * перевозчикам, по строке на компанию, со статусом словами.
 *
 * Счета оператор не выставляет: они уходят сами после конца периода,
 * с номером, и рейсы сами становятся «выставленными». Руками — только
 * то, чего платформа знать не может: деньги пришли, деньги ушли. Если
 * выпуск не прошёл, у периода появляется кнопка выпустить его сейчас.
 *
 * Полностью закрытые периоды свёрнуты внизу, прежняя сводка по
 * контрагентам — за раскрытием: они для разбора, а не для работы.
 */
type SubscriptionFee = Database['public']['Functions']['subscription_fees_overview']['Returns'][number];

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
  const { t, m, f } = i18n;

  const [
    { data: overview },
    { data: current },
    { data: partners },
    { data: orders },
    { data: totals },
    { data: feeRows },
    { data: subscriptions },
  ] = await Promise.all([
      supabase.rpc('billing_overview'),
      supabase.rpc('settlement_period', {}),
      supabase.rpc('partner_totals', {}),
      supabase.rpc('completed_orders', { p_from: weeksAgoMonday(COMPLETED_WEEKS * 2) }),
      supabase.rpc('weekly_totals', { p_weeks: 12 }),
      supabase
        .from('carrier_fee_deductions')
        .select('period_start, amount_cents, fee:carrier_subscription_fees(carrier_company_id)'),
      supabase.rpc('subscription_fees_overview'),
    ]);

  const deductions: Deductions = new Map();
  for (const d of feeRows ?? []) {
    const carrierId = (d.fee as { carrier_company_id: string } | null)?.carrier_company_id;
    if (!carrierId) continue;
    const key = `${carrierId}|${d.period_start}`;
    deductions.set(key, (deductions.get(key) ?? 0) + d.amount_cents);
  }

  const today = todayInHelsinki();
  const all = overview ?? [];

  const byStart = new Map<string, Period>();
  for (const row of all) {
    const period = byStart.get(row.period_start) ?? {
      start: row.period_start,
      end: row.period_end,
      invoiceDue: row.invoice_due,
      payoutDue: row.payout_due,
      rows: [],
    };
    period.rows.push(row);
    byStart.set(row.period_start, period);
  }
  const periods = [...byStart.values()].sort((a, b) => b.start.localeCompare(a.start));

  const running = periods.filter((p) => p.end >= today);
  const closed = periods.filter((p) => p.end < today);
  const open = closed.filter((p) => p.rows.some((r) => r.billing !== 'SETTLED'));
  const finished = closed.filter((p) => p.rows.every((r) => r.billing === 'SETTLED'));

  /* Итоги сверху: сколько ждём, сколько просрочено, сколько платить. */
  const awaiting = all.filter((r) => r.billing === 'INVOICED');
  const overdue = awaiting.filter((r) => r.invoice_due < today);
  /* Доход оператора: плата заказчиков по выставленным счетам и удержанный сбор перевозчиков. */
  const margin =
    all.filter((r) => r.billing !== 'PENDING').reduce((s, r) => s + r.shipper_fee_cents + r.commission_cents, 0) +
    [...deductions.values()].reduce((s, v) => s + v, 0);

  const currentPeriod = Array.isArray(current) ? current[0] : current;

  return (
    <main className="mx-auto w-full max-w-6xl px-5 py-8">
      <AdminError locale={locale} code={failure} />

      <h1 className="text-xl font-semibold tracking-tight">{t.billingDesk.title}</h1>
      <p className="mt-2 mb-6 max-w-2xl text-[13px] leading-relaxed text-ink-muted">{t.billingDesk.subtitle}</p>

      <StatRow>
        <Stat
          label={t.billingDesk.statAwaiting}
          value={f.eur(sumOf(shippersOf(awaiting)))}
          hint={m('billingDesk.trips', { count: awaiting.length })}
        />
        <Stat
          label={t.billingDesk.statOverdue}
          value={f.eur(sumOf(shippersOf(overdue)))}
          hint={m('billingDesk.trips', { count: overdue.length })}
          tone={overdue.length > 0 ? 'warn' : undefined}
        />
        <Stat
          label={t.billingDesk.statToPay}
          value={f.eur(
            periods.reduce(
              (s, p) => s + sumOf(carriersOf(p.rows.filter((r) => r.billing === 'PAID'), p.start, deductions)),
              0,
            ),
          )}
        />
        <Stat label={t.billingDesk.statMargin} value={f.eur(margin)} tone="ok" />
      </StatRow>

      {currentPeriod && (
        <RunningPeriod
          start={currentPeriod.period_start}
          end={currentPeriod.period_end}
          rows={running.flatMap((p) => p.rows)}
          i18n={i18n}
        />
      )}

      {open.map((period) => (
        <ClosedPeriod
          key={period.start}
          period={period}
          today={today}
          locale={locale}
          i18n={i18n}
          deductions={deductions}
        />
      ))}

      {periods.length === 0 && <p className="mt-10 text-[13px] text-ink-dim">{t.billingDesk.nothing}</p>}

      {finished.length > 0 && (
        <details className="mt-10">
          <summary className="cursor-pointer border-b border-line pb-2 text-[13px] font-semibold tracking-tight text-ink-faint">
            {t.billingDesk.closed} · {finished.length}
          </summary>
          {finished.map((period) => (
            <ClosedPeriod
              key={period.start}
              period={period}
              today={today}
              locale={locale}
              i18n={i18n}
              deductions={deductions}
            />
          ))}
        </details>
      )}

      {/*
        * Динамика стоит после периодов и до сборов: сначала оператор
        * видит, что нужно сделать сегодня, потом — куда движется дело.
        */}
      <OperatorTrend totals={totals ?? []} weeks={12} i18n={i18n} />

      <SubscriptionFees rows={(subscriptions ?? []) as SubscriptionFee[]} locale={locale} i18n={i18n} />

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
 * Месячные сборы подписчиков.
 *
 * Отдельным разделом, а не строкой в периоде: сбор живёт по месяцам, а
 * не по полумесячным периодам, и у подписчика, возящего своих клиентов,
 * выплаты нет вовсе — вычесть не из чего, остаётся счёт. Пока такой
 * сбор не оплачен, он единственное, чего оператор не увидит больше
 * нигде.
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
      <p className="mt-2 mb-3 max-w-2xl text-[13px] leading-relaxed text-ink-muted">{t.billingDesk.subsLede}</p>

      <TableFrame>
        <Table>
          <thead>
            <Tr>
              <Th>{t.billingDesk.subsColMonth}</Th>
              <Th>{t.billingDesk.colCarrier}</Th>
              <Th numeric>{t.billingDesk.subsColVehicles}</Th>
              <Th numeric>{t.billingDesk.subsColTotal}</Th>
              <Th numeric>{t.billingDesk.subsColDeducted}</Th>
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
                <Td numeric className="text-ink-muted">
                  {row.deducted_cents > 0 ? f.eur(row.deducted_cents) : '—'}
                </Td>
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

/** Идущий период: сколько уже набралось и когда уйдут счета. */
function RunningPeriod({
  start,
  end,
  rows,
  i18n: { t, m, f },
}: {
  start: string;
  end: string;
  rows: Row[];
  i18n: I18n;
}) {
  const customers = shippersOf(rows);
  return (
    <section className="mt-10">
      <PeriodHead
        title={m('billingDesk.period', { from: f.date(start), to: f.date(end) })}
        badge={<Badge tone="info">{t.billingDesk.current}</Badge>}
        lines={[m('billingDesk.autoInvoice', { date: f.date(dayAfter(end)) })]}
      />
      <Card>
        <CardBody className="flex flex-wrap items-baseline justify-between gap-3">
          <span className="text-[13px] text-ink-muted">{m('billingDesk.trips', { count: rows.length })}</span>
          <span className="font-mono text-[15px] font-semibold">{f.eur(sumOf(customers))}</span>
        </CardBody>
      </Card>
    </section>
  );
}

function ClosedPeriod({
  period,
  today,
  locale,
  i18n,
  deductions,
}: {
  period: Period;
  today: string;
  locale: Locale;
  i18n: I18n;
  deductions: Deductions;
}) {
  const { t, m, f } = i18n;
  const customers = shippersOf(period.rows);
  const carriers = carriersOf(period.rows, period.start, deductions);
  const notSent = period.rows.some((r) => r.billing === 'PENDING');

  return (
    <section className="mt-10">
      <PeriodHead
        title={m('billingDesk.period', { from: f.date(period.start), to: f.date(period.end) })}
        lines={[
          m('billingDesk.customerDue', { date: f.date(period.invoiceDue) }),
          m('billingDesk.payoutDue', { date: f.date(period.payoutDue) }),
        ]}
      />

      {notSent && (
        <Card stripe="warn" className="mb-3">
          <CardBody className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-[13px]">{t.billingDesk.notSent}</p>
            <form action={issuePeriodInvoicesAction}>
              <input type="hidden" name="locale" value={locale} />
              <input type="hidden" name="period_start" value={period.start} />
              <Button type="submit" variant="primary" size="sm">
                {t.billingDesk.sendNow}
              </Button>
            </form>
          </CardBody>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <div>
          <h3 className="mb-2 text-[13px] font-semibold text-ink-faint">{t.billingDesk.invoices}</h3>
          <TableFrame>
            <Table>
              <thead>
                <tr>
                  <Th>{t.billingDesk.colCustomer}</Th>
                  <Th numeric>{t.billingDesk.colGross}</Th>
                  <Th>{t.billingDesk.colStatus}</Th>
                  <Th />
                </tr>
              </thead>
              <tbody>
                {customers.map((c) => {
                  const head = c.rows[0]!;
                  const invoiced = c.rows.filter((r) => r.billing === 'INVOICED');
                  const state = c.rows.some((r) => r.billing === 'PENDING')
                    ? { tone: 'warn' as const, label: t.billingDesk.stNotSent }
                    : invoiced.length > 0
                      ? period.invoiceDue < today
                        ? { tone: 'danger' as const, label: t.billingDesk.stOverdue }
                        : { tone: 'info' as const, label: t.billingDesk.stSent }
                      : { tone: 'ok' as const, label: t.billingDesk.stPaid };
                  return (
                    <Tr key={c.id}>
                      <Td>
                        <span className="font-semibold text-ink">{head.shipper_name}</span>
                        <br />
                        <span className="text-xs text-ink-dim">
                          {head.invoice_ref ? (
                            <>
                              {t.billingDesk.colInvoice} <Mono>{head.invoice_ref}</Mono> ·{' '}
                            </>
                          ) : null}
                          <Trips rows={c.rows} amount={(r) => r.rate_cents + r.shipper_fee_cents} i18n={i18n} />
                        </span>
                      </Td>
                      <Td numeric>{f.eur(c.gross)}</Td>
                      <Td>
                        <Badge tone={state.tone}>{state.label}</Badge>
                      </Td>
                      <Td>
                        {invoiced.length > 0 && (
                          <BatchButton
                            ids={invoiced.map((r) => r.id)}
                            next="PAID"
                            label={t.billingDesk.markPaid}
                            locale={locale}
                          />
                        )}
                      </Td>
                    </Tr>
                  );
                })}
              </tbody>
            </Table>
          </TableFrame>
        </div>

        <div>
          <h3 className="mb-2 text-[13px] font-semibold text-ink-faint">{t.billingDesk.payouts}</h3>
          <TableFrame>
            <Table>
              <thead>
                <tr>
                  <Th>{t.billingDesk.colCarrier}</Th>
                  <Th numeric>{t.billingDesk.colGross}</Th>
                  <Th>{t.billingDesk.colStatus}</Th>
                  <Th />
                </tr>
              </thead>
              <tbody>
                {carriers.map((c) => {
                  const head = c.rows[0]!;
                  const ready = c.rows.filter((r) => r.billing === 'PAID');
                  const waiting = c.rows.some((r) => r.billing === 'PENDING' || r.billing === 'INVOICED');
                  const state =
                    ready.length > 0
                      ? { tone: 'warn' as const, label: t.billingDesk.stReady }
                      : waiting
                        ? { tone: 'neutral' as const, label: t.billingDesk.stWaiting }
                        : { tone: 'ok' as const, label: t.billingDesk.stSettled };
                  return (
                    <Tr key={c.id}>
                      <Td>
                        <span className="font-semibold text-ink">{head.carrier_name ?? '—'}</span>
                        <br />
                        <span className="text-xs text-ink-dim">
                          {head.carrier_iban ? (
                            <>
                              {t.billingDesk.account} <Mono>{formatIban(head.carrier_iban)}</Mono>
                              {head.carrier_bic ? <> · {head.carrier_bic}</> : null} ·{' '}
                            </>
                          ) : (
                            <span className="text-warn">{t.billingDesk.noIban} · </span>
                          )}
                          <Trips rows={c.rows} amount={(r) => r.payout_cents} i18n={i18n} />
                          {c.deducted > 0 && ` · ${t.billingDesk.feeDeducted} −${f.eur(c.deducted)}`}
                        </span>
                      </Td>
                      <Td numeric>{f.eur(c.gross)}</Td>
                      <Td>
                        <Badge tone={state.tone}>{state.label}</Badge>
                      </Td>
                      <Td>
                        {ready.length > 0 && (
                          <BatchButton
                            ids={ready.map((r) => r.id)}
                            next="SETTLED"
                            label={t.billingDesk.markSettled}
                            locale={locale}
                          />
                        )}
                      </Td>
                    </Tr>
                  );
                })}
              </tbody>
            </Table>
          </TableFrame>
        </div>
      </div>
    </section>
  );
}

function PeriodHead({ title, badge, lines }: { title: string; badge?: React.ReactNode; lines: string[] }) {
  return (
    <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-line pb-2">
      <h2 className="flex items-center gap-2 text-[15px] font-semibold tracking-tight">
        {title}
        {badge}
      </h2>
      <p className="text-xs text-ink-muted">{lines.join(' · ')}</p>
    </div>
  );
}

/** Число рейсов; раскрывается в список: дата, номер, маршрут, сумма без налога. */
function Trips({ rows, amount, i18n: { t, m, f } }: { rows: Row[]; amount: (r: Row) => number; i18n: I18n }) {
  return (
    <details className="inline">
      <summary className="inline cursor-pointer underline decoration-dotted">
        {m('billingDesk.trips', { count: rows.length })}
      </summary>
      <table className="mt-1.5 text-xs">
        <thead className="sr-only">
          <tr>
            <th>{t.billingDesk.colDate}</th>
            <th>{t.billingDesk.colRef}</th>
            <th>{t.billingDesk.colRoute}</th>
            <th>{t.billingDesk.colAmount}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td className="pr-3">{r.closed_at ? f.date(r.closed_at) : '—'}</td>
              <td className="pr-3 font-mono">{r.ref}</td>
              <td className="pr-3">
                {r.route_from ?? '—'} → {r.route_to ?? '—'}
              </td>
              <td className="text-right font-mono">{f.eur(amount(r))}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  );
}

function BatchButton({
  ids,
  next,
  label,
  locale,
}: {
  ids: string[];
  next: 'PAID' | 'SETTLED';
  label: string;
  locale: Locale;
}) {
  return (
    <form action={setBillingBatchAction}>
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="next" value={next} />
      {ids.map((id) => (
        <input key={id} type="hidden" name="order_id" value={id} />
      ))}
      <Button type="submit" size="sm" className="whitespace-nowrap">
        {label}
      </Button>
    </form>
  );
}

/** Прежняя сводка по контрагентам — для разбора, а не для работы. */
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
        {table(carriers, t.done.payout, (r) => Number(r.payout_cents), true)}
      </div>
    </div>
  );
}

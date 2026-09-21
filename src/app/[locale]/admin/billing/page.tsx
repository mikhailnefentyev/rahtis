import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { CompletedList } from '@/components/domain/CompletedList';
import {
  Badge,
  Button,
  Card,
  CardBody,
  Input,
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
import { setBillingBatchAction } from '@/lib/billing/actions';
import { COMPLETED_WEEKS, vatBpsFor, withVat } from '@/lib/config';
import { weeksAgoMonday } from '@/lib/dates';
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

type Group = {
  key: string;
  rows: Row[];
  net: number;
  vatBps: number;
};

/** Рейсы этапа, сгруппированные по ключу, с суммой без налога. */
function groupBy(rows: Row[], key: (r: Row) => string, amount: (r: Row) => number, country: (r: Row) => string | null) {
  const map = new Map<string, Group>();
  for (const row of rows) {
    const k = key(row);
    const g = map.get(k) ?? { key: k, rows: [], net: 0, vatBps: vatBpsFor(country(row)) };
    g.rows.push(row);
    g.net += amount(row);
    map.set(k, g);
  }
  return [...map.values()];
}

const DAY = 86_400_000;
/** Срок оплаты заказчиком — 15 дней (условия, 6.5). */
const DUE_DAYS = 15;

/**
 * Laskutus ja tilitykset — расчёты оператора по шагам денег.
 *
 * Страница отвечает на три вопроса в том порядке, в каком по ним идут
 * деньги: кому выставить счёт, кто ещё не заплатил, кому перевести
 * выплату. Каждый шаг — по компании, а не по рейсу: счёт заказчику один
 * на период, перевод перевозчику один. Налог считается по стране
 * контрагента тем же vatBpsFor, что в документах периода, и показан
 * числом — оператор выставляет и платит с ALV.
 *
 * Сводка по контрагентам и лента рейсов, которыми страница была раньше,
 * остались — внизу, за раскрытием: они для разбора, а не для работы.
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

  const [{ t, m, f }, supabase] = await Promise.all([getI18n(locale), createClient()]);

  const [{ data: overview }, { data: partners }, { data: orders }, { data: totals }] = await Promise.all([
    supabase.rpc('billing_overview'),
    supabase.rpc('partner_totals', {}),
    supabase.rpc('completed_orders', { p_from: weeksAgoMonday(COMPLETED_WEEKS * 2) }),
    supabase.rpc('weekly_totals', { p_weeks: 12 }),
  ]);

  const all = overview ?? [];
  const now = new Date().getTime();

  const pending = all.filter((r) => r.billing === 'PENDING');
  const invoiced = all.filter((r) => r.billing === 'INVOICED');
  const paid = all.filter((r) => r.billing === 'PAID');
  const settled = all.filter((r) => r.billing === 'SETTLED');

  const shipperGroups = (rows: Row[], byInvoice = false) =>
    groupBy(
      rows,
      (r) => (byInvoice ? `${r.shipper_id}|${r.invoice_ref ?? ''}` : r.shipper_id),
      (r) => r.rate_cents,
      (r) => r.shipper_country,
    );
  const carrierGroups = (rows: Row[]) =>
    groupBy(
      rows,
      (r) => r.carrier_id ?? 'none',
      (r) => r.payout_cents,
      (r) => r.carrier_country,
    );

  const gross = (g: Group) => withVat(g.net, g.vatBps);
  const sumGross = (groups: Group[]) => groups.reduce((s, g) => s + gross(g), 0);

  const toInvoice = shipperGroups(pending);
  const awaiting = shipperGroups(invoiced, true);
  const toPay = carrierGroups(paid);
  const done = carrierGroups(settled);

  const overdueCount = invoiced.filter(
    (r) => r.invoiced_at && now - Date.parse(r.invoiced_at) > DUE_DAYS * DAY,
  ).length;
  const margin = all
    .filter((r) => r.billing !== 'PENDING')
    .reduce((s, r) => s + r.commission_cents, 0);

  /* Налог словами: ставка или обратное начисление. */
  const vatLabel = (bps: number) =>
    bps > 0 ? m('billingDesk.vatDomestic', { rate: f.percent(bps / 10_000, 1) }) : t.billingDesk.vatReverse;

  const days = (iso: string | null) => (iso ? Math.floor((now - Date.parse(iso)) / DAY) : 0);

  return (
    <main className="mx-auto w-full max-w-6xl px-5 py-8">
      <AdminError locale={locale} code={failure} />

      <h1 className="text-xl font-semibold tracking-tight">{t.billingDesk.title}</h1>
      <p className="mt-2 mb-6 max-w-2xl text-[13px] leading-relaxed text-ink-muted">{t.billingDesk.subtitle}</p>

      <StatRow>
        <Stat
          label={t.billingDesk.statToInvoice}
          value={f.eur(sumGross(toInvoice))}
          hint={m('billingDesk.trips', { count: pending.length })}
        />
        <Stat
          label={t.billingDesk.statAwaiting}
          value={f.eur(sumGross(awaiting))}
          hint={
            overdueCount > 0
              ? `${m('billingDesk.trips', { count: invoiced.length })} · ${t.billingDesk.overdue}: ${overdueCount}`
              : m('billingDesk.trips', { count: invoiced.length })
          }
          tone={overdueCount > 0 ? 'warn' : undefined}
        />
        <Stat
          label={t.billingDesk.statToPay}
          value={f.eur(sumGross(toPay))}
          hint={m('billingDesk.trips', { count: paid.length })}
        />
        <Stat label={t.billingDesk.statMargin} value={f.eur(margin)} tone="ok" />
      </StatRow>

      {/* ── 1 · Счета заказчикам ───────────────────────────────── */}
      <Step title={t.billingDesk.step1} hint={t.billingDesk.step1Hint} empty={toInvoice.length === 0} t={t}>
        {toInvoice.map((g) => {
          const head = g.rows[0];
          return (
            <Card key={g.key}>
              <CardBody className="flex flex-col gap-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[15px] font-semibold">
                      {head.shipper_name} <Mono className="text-xs text-ink-dim">{head.shipper_business_id}</Mono>
                    </p>
                    <p className="mt-0.5 text-xs text-ink-muted">
                      {t.billingDesk.sendTo}: {head.shipper_billing_email}
                      {head.shipper_einvoice_ovt &&
                        ` · ${t.billingDesk.einvoice}: ${head.shipper_einvoice_ovt}${head.shipper_einvoice_operator ? ` / ${head.shipper_einvoice_operator}` : ''}`}
                      {head.shipper_billing_reference && ` · ${t.billingDesk.reference}: ${head.shipper_billing_reference}`}
                    </p>
                  </div>
                  <Money group={g} vatLabel={vatLabel(g.vatBps)} locale={locale} />
                </div>

                <Trips rows={g.rows} amount={(r) => r.rate_cents} locale={locale} />

                <form action={setBillingBatchAction} className="flex flex-wrap items-center justify-end gap-2">
                  <input type="hidden" name="locale" value={locale} />
                  <input type="hidden" name="next" value="INVOICED" />
                  {g.rows.map((r) => (
                    <input key={r.id} type="hidden" name="order_id" value={r.id} />
                  ))}
                  <Input
                    name="invoice_ref"
                    placeholder={t.billing.invoiceRefPlaceholder}
                    aria-label={t.billingDesk.invoiceNo}
                    className="h-9 w-36"
                  />
                  <Button type="submit" variant="primary" size="sm" formNoValidate>
                    {m('billingDesk.markCount', { label: t.billingDesk.markInvoiced, count: g.rows.length })}
                  </Button>
                </form>
              </CardBody>
            </Card>
          );
        })}
      </Step>

      {/* ── 2 · Ждём оплату ────────────────────────────────────── */}
      <Step title={t.billingDesk.step2} hint={t.billingDesk.step2Hint} empty={awaiting.length === 0} t={t}>
        {awaiting.map((g) => {
          const head = g.rows[0];
          const age = days(head.invoiced_at);
          const late = age > DUE_DAYS;
          return (
            <Card key={g.key} stripe={late ? 'warn' : undefined}>
              <CardBody className="flex flex-col gap-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[15px] font-semibold">
                      {head.shipper_name} · <Mono>{head.invoice_ref ?? '—'}</Mono>
                    </p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-ink-muted">
                      {t.billingDesk.invoicedOn} {head.invoiced_at ? f.date(head.invoiced_at) : '—'} ·{' '}
                      {m('billingDesk.daysAgo', { days: age })}
                      {late && <Badge tone="warn">{t.billingDesk.overdue}</Badge>}
                    </p>
                  </div>
                  <Money group={g} vatLabel={vatLabel(g.vatBps)} locale={locale} />
                </div>

                <Trips rows={g.rows} amount={(r) => r.rate_cents} locale={locale} />

                <BatchButton
                  ids={g.rows.map((r) => r.id)}
                  next="PAID"
                  label={m('billingDesk.markCount', { label: t.billingDesk.markPaid, count: g.rows.length })}
                  locale={locale}
                />
              </CardBody>
            </Card>
          );
        })}
      </Step>

      {/* ── 3 · Выплаты перевозчикам ───────────────────────────── */}
      <Step title={t.billingDesk.step3} hint={t.billingDesk.step3Hint} empty={toPay.length === 0} t={t}>
        {toPay.map((g) => {
          const head = g.rows[0];
          const waiting = [...pending, ...invoiced].filter((r) => r.carrier_id === head.carrier_id).length;
          return (
            <Card key={g.key}>
              <CardBody className="flex flex-col gap-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[15px] font-semibold">
                      {head.carrier_name ?? '—'} <Mono className="text-xs text-ink-dim">{head.carrier_business_id}</Mono>
                    </p>
                    {head.carrier_iban ? (
                      <p className="mt-0.5 text-xs text-ink-muted">
                        {t.billingDesk.account}: <Mono>{formatIban(head.carrier_iban)}</Mono>
                        {head.carrier_bic && <> · BIC <Mono>{head.carrier_bic}</Mono></>}
                      </p>
                    ) : (
                      <p className="mt-0.5 text-xs text-warn">{t.billingDesk.noIban}</p>
                    )}
                    {waiting > 0 && (
                      <p className="mt-0.5 text-xs text-ink-dim">{m('billingDesk.waitingCustomer', { count: waiting })}</p>
                    )}
                  </div>
                  <Money group={g} vatLabel={vatLabel(g.vatBps)} locale={locale} />
                </div>

                <Trips rows={g.rows} amount={(r) => r.payout_cents} locale={locale} />

                <BatchButton
                  ids={g.rows.map((r) => r.id)}
                  next="SETTLED"
                  label={m('billingDesk.markCount', { label: t.billingDesk.markSettled, count: g.rows.length })}
                  locale={locale}
                />
              </CardBody>
            </Card>
          );
        })}
      </Step>

      {/* ── 4 · Закрыто ────────────────────────────────────────── */}
      {done.length > 0 && (
        <details className="mt-10">
          <summary className="cursor-pointer border-b border-line pb-2 text-[13px] font-semibold tracking-tight text-ink-faint">
            {t.billingDesk.step4} · {f.eur(sumGross(done))}
          </summary>
          <div className="mt-4 flex flex-col gap-3">
            {done.map((g) => (
              <Card key={g.key}>
                <CardBody className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[15px] font-semibold">{g.rows[0].carrier_name ?? '—'}</p>
                    <p className="mt-0.5 text-xs text-ink-muted">
                      {m('billingDesk.trips', { count: g.rows.length })} · {t.billingDesk.settledOn}{' '}
                      {g.rows.map((r) => r.settled_at && f.date(r.settled_at)).filter(Boolean).at(-1)}
                    </p>
                  </div>
                  <Money group={g} vatLabel={vatLabel(g.vatBps)} locale={locale} />
                </CardBody>
              </Card>
            ))}
          </div>
        </details>
      )}

      {/* ── Сводка для разбора ─────────────────────────────────── */}
      <details className="mt-10">
        <summary className="cursor-pointer border-b border-line pb-2 text-[13px] font-semibold tracking-tight text-ink-faint">
          {t.billingDesk.summary}
        </summary>
        <PartnerTables partners={(partners ?? []) as PartnerTotal[]} locale={locale} />
        <div className="mt-8">
          <CompletedList orders={orders ?? []} totals={totals ?? []} />
        </div>
      </details>

      <ReportsButton locale={locale} />
    </main>
  );
}

async function Step({
  title,
  hint,
  empty,
  t,
  children,
}: {
  title: string;
  hint: string;
  empty: boolean;
  t: Awaited<ReturnType<typeof getI18n>>['t'];
  children: React.ReactNode;
}) {
  return (
    <section className="mt-10">
      <h2 className="border-b border-line pb-2 text-[15px] font-semibold tracking-tight">{title}</h2>
      <p className="mt-2 mb-4 max-w-2xl text-xs text-ink-muted">{hint}</p>
      {empty ? <p className="text-[13px] text-ink-dim">{t.billingDesk.nothing}</p> : <div className="flex flex-col gap-3">{children}</div>}
    </section>
  );
}

/** Сумма группы: без налога, налог словами и числом, итог. */
async function Money({ group, vatLabel, locale }: { group: Group; vatLabel: string; locale: Locale }) {
  const { t, f } = await getI18n(locale);
  const total = withVat(group.net, group.vatBps);
  return (
    <dl className="grid grid-cols-[auto_auto] gap-x-4 gap-y-0.5 text-right text-[13px]">
      <dt className="text-ink-muted">{t.billingDesk.net}</dt>
      <dd className="font-mono">{f.eur(group.net)}</dd>
      <dt className="text-ink-muted">{vatLabel}</dt>
      <dd className="font-mono">{f.eur(total - group.net)}</dd>
      <dt className="font-semibold">{t.billingDesk.gross}</dt>
      <dd className="font-mono text-[15px] font-semibold">{f.eur(total)}</dd>
    </dl>
  );
}

async function Trips({ rows, amount, locale }: { rows: Row[]; amount: (r: Row) => number; locale: Locale }) {
  const { t, f } = await getI18n(locale);
  return (
    <TableFrame>
      <Table>
        <thead>
          <tr>
            <Th>{t.billingDesk.colDate}</Th>
            <Th>{t.billingDesk.colRef}</Th>
            <Th>{t.billingDesk.colRoute}</Th>
            <Th numeric>{t.billingDesk.colAmount}</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <Tr key={r.id}>
              <Td>{r.closed_at ? f.date(r.closed_at) : '—'}</Td>
              <Td mono>
                {r.ref}
                {r.shipper_ref ? <span className="text-ink-dim"> · {r.shipper_ref}</span> : null}
              </Td>
              <Td>
                {r.route_from ?? '—'} → {r.route_to ?? '—'}
              </Td>
              <Td numeric>{f.eur(amount(r))}</Td>
            </Tr>
          ))}
        </tbody>
      </Table>
    </TableFrame>
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
    <form action={setBillingBatchAction} className="flex justify-end">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="next" value={next} />
      {ids.map((id) => (
        <input key={id} type="hidden" name="order_id" value={id} />
      ))}
      <Button type="submit" variant="primary" size="sm">
        {label}
      </Button>
    </form>
  );
}

/** Прежняя сводка по контрагентам — для разбора, а не для работы. */
async function PartnerTables({ partners, locale }: { partners: PartnerTotal[]; locale: Locale }) {
  const { t, m, f } = await getI18n(locale);
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

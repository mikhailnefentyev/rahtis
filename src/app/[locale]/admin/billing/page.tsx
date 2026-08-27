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
import type { StatusTone } from '@/components/ui/tone';
import { requireRole } from '@/lib/auth/guard';
import { setBillingAction } from '@/lib/billing/actions';
import { ReportsButton } from '../ReportsButton';
import { withVat } from '@/lib/config';
import { getI18n, isLocale } from '@/lib/i18n';
import { createClient } from '@/lib/supabase/server';
import type { Database } from '@/types/database';
import type { PartnerTotal } from '@/types/db';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const { t } = await getI18n(locale);
  return { title: t.done.titleAdmin };
}

/**
 * Счета и выплаты (ТЗ §11).
 *
 * Две таблицы контрагентов и под ними те же рейсы, из которых обе
 * посчитаны. Порядок именно такой: оператор приходит сюда с вопросом
 * «кому сколько выставить», а не «что происходило на неделе», — но
 * ответить на второй должен уметь тот же экран, иначе разбор спорной
 * суммы уходит в другое место и в другой запрос.
 */
/** Цвет состояния расчётов: тот же язык, что у статусов рейса. */
const billingTone: Record<Database['public']['Enums']['billing_status'], StatusTone> = {
  PENDING: 'neutral',
  INVOICED: 'warn',
  PAID: 'live',
  SETTLED: 'ok',
};

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

  const [{ data: partners }, { data: orders }, { data: totals }, { data: billing }] =
    await Promise.all([
    supabase.rpc('partner_totals', {}),
    supabase.rpc('completed_orders', {}),
    supabase.rpc('weekly_totals', { p_weeks: 12 }),
    /*
     * Состояние расчётов отдельным запросом, а не из completed_orders:
     * та функция описывает рейс, и добавлять в неё колонки бухгалтерии
     * значит показывать их всем, кто её зовёт, включая обе стороны.
     */
    supabase
      .from('orders')
      .select('id, ref, rate_cents, commission_bps, billing, invoice_ref, closed_at')
      .eq('status', 'DONE')
      .order('closed_at', { ascending: false })
      .limit(50),
  ]);

  const rows = (partners ?? []) as PartnerTotal[];
  const clients = rows.filter((r) => r.party === 'SHIPPER');
  const carriers = rows.filter((r) => r.party === 'CARRIER');

  /* Выручка, выплаты и маржа — по заказчикам: рейс у них считается один раз. */
  const revenue = clients.reduce((sum, r) => sum + Number(r.rate_cents), 0);
  const commission = clients.reduce((sum, r) => sum + Number(r.commission_cents), 0);
  const payout = clients.reduce((sum, r) => sum + Number(r.payout_cents), 0);

  /*
   * Здесь налог появляется числом, а не подписью: оператор приходит
   * выставлять счета и платить, а обе операции идут с ALV. Нетто
   * остаётся значением плитки, брутто — подсказкой под ним, чтобы одно
   * не подменяло другое.
   */
  const invoiceTotal = withVat(revenue);
  const payoutTotal = withVat(payout);

  /*
   * Оценка стоит в одной таблице с выплатой: решение «кому давать больше
   * заказов» принимается по обоим числам сразу, а не по двум экранам.
   * У заказчиков колонки нет — обратная оценка это отдельный разговор.
   */
  const table = (
    list: PartnerTotal[],
    moneyLabel: string,
    money: (r: PartnerTotal) => number,
    withRating = false,
  ) => (
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
    <main className="mx-auto w-full max-w-6xl px-5 py-8">
      <AdminError locale={locale} code={failure} />


      <h1 className="text-xl font-semibold tracking-tight">{t.done.titleAdmin}</h1>
      <p className="mt-2 mb-6 max-w-xl text-[13px] leading-relaxed text-ink-muted">
        {t.done.subtitleAdmin} {t.money.calcNote}
      </p>

      <StatRow>
        <Stat
          label={t.money.revenue}
          value={f.eur(revenue)}
          hint={m('money.withVat', { amount: f.eur(invoiceTotal) })}
        />
        <Stat
          label={t.done.payout}
          value={f.eur(payout)}
          hint={m('money.withVat', { amount: f.eur(payoutTotal) })}
        />
        {/* Маржа без налога и без подсказки: ALV здесь транзитный. */}
        <Stat label={t.done.margin} value={f.eur(commission)} tone="ok" />
      </StatRow>

      <section className="mt-8">
        <h2 className="mb-3 border-b border-line pb-2 text-[13px] font-semibold tracking-tight text-ink-faint">
          {t.done.clients}
        </h2>
        {clients.length > 0 ? (
          table(clients, t.done.rate, (r) => Number(r.rate_cents))
        ) : (
          <Card>
            <CardBody>
              <p className="text-[13px] text-ink-muted">{t.done.noPartners}</p>
            </CardBody>
          </Card>
        )}
      </section>

      <section className="mt-8">
        <h2 className="mb-3 border-b border-line pb-2 text-[13px] font-semibold tracking-tight text-ink-faint">
          {t.done.carriers}
        </h2>
        {carriers.length > 0 &&
          table(carriers, t.done.payout, (r) => Number(r.payout_cents), true)}
      </section>

      <section className="mt-10">
        <h2 className="mb-3 border-b border-line pb-2 text-[13px] font-semibold tracking-tight text-ink-faint">
          {t.billing.title}
        </h2>

        {(billing ?? []).length === 0 ? (
          <Card>
            <CardBody>
              <p className="text-[13px] text-ink-muted">{t.done.none}</p>
            </CardBody>
          </Card>
        ) : (
          <TableFrame caption={t.billing.title}>
            <Table>
              <thead>
                <tr>
                  <Th>{t.order.ref}</Th>
                  <Th numeric>{t.done.rate}</Th>
                  <Th>{t.billing.invoiceRef}</Th>
                  <Th>{t.billing.title}</Th>
                  <Th />
                </tr>
              </thead>
              <tbody>
                {(billing ?? []).map((order) => {
                  /*
                   * Следующий шаг один, поэтому и кнопка одна. Выпадающий
                   * список из четырёх состояний позволил бы отметить рейс
                   * оплаченным до выставления счёта — база это отклонит, но
                   * узнает об этом оператор уже после нажатия.
                   */
                  const next =
                    order.billing === 'PENDING'
                      ? ('INVOICED' as const)
                      : order.billing === 'INVOICED'
                        ? ('PAID' as const)
                        : order.billing === 'PAID'
                          ? ('SETTLED' as const)
                          : null;

                  return (
                    <Tr key={order.id}>
                      <Td mono>{order.ref}</Td>
                      <Td numeric>{f.eur(order.rate_cents ?? 0)}</Td>
                      <Td mono>{order.invoice_ref ?? '—'}</Td>
                      <Td>
                        <Badge tone={billingTone[order.billing]}>{t.billing[order.billing]}</Badge>
                      </Td>
                      <Td>
                        {next && (
                          <form action={setBillingAction} className="flex items-center gap-2">
                            <input type="hidden" name="locale" value={locale} />
                            <input type="hidden" name="order_id" value={order.id} />
                            <input type="hidden" name="next" value={next} />
                            {next === 'INVOICED' && (
                              <Input
                                name="invoice_ref"
                                placeholder={t.billing.invoiceRefPlaceholder}
                                className="h-8 w-28 text-[12px]"
                              />
                            )}
                            <Button type="submit" size="sm" formNoValidate>
                              {next === 'INVOICED'
                                ? t.billing.toInvoiced
                                : next === 'PAID'
                                  ? t.billing.toPaid
                                  : t.billing.toSettled}
                            </Button>
                          </form>
                        )}
                      </Td>
                    </Tr>
                  );
                })}
              </tbody>
            </Table>
          </TableFrame>
        )}
      </section>

      <section className="mt-10">
        <h2 className="mb-4 border-b border-line pb-2 text-[13px] font-semibold tracking-tight text-ink-faint">
          {t.done.titleCarrier}
        </h2>
        <CompletedList orders={orders ?? []} totals={totals ?? []} />
      </section>

      <ReportsButton locale={locale} />
    </main>
  );
}

import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CompletedList } from '@/components/domain/CompletedList';
import {
  Card,
  CardBody,
  Mono,
  Stat,
  StatRow,
  Table,
  TableFrame,
  Td,
  Th,
  Tr,
} from '@/components/ui';
import { requireRole } from '@/lib/auth/guard';
import { cabinetPath } from '@/lib/auth/paths';
import { getI18n, isLocale } from '@/lib/i18n';
import { createClient } from '@/lib/supabase/server';
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
export default async function BillingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  await requireRole(locale, 'ADMIN');

  const [{ t, m, f }, supabase] = await Promise.all([getI18n(locale), createClient()]);

  const [{ data: partners }, { data: orders }, { data: totals }] = await Promise.all([
    supabase.rpc('partner_totals', {}),
    supabase.rpc('completed_orders', {}),
    supabase.rpc('weekly_totals', { p_weeks: 12 }),
  ]);

  const rows = (partners ?? []) as PartnerTotal[];
  const clients = rows.filter((r) => r.party === 'SHIPPER');
  const carriers = rows.filter((r) => r.party === 'CARRIER');

  /* Выручка, выплаты и маржа — по заказчикам: рейс у них считается один раз. */
  const revenue = clients.reduce((sum, r) => sum + Number(r.rate_cents), 0);
  const commission = clients.reduce((sum, r) => sum + Number(r.commission_cents), 0);
  const payout = clients.reduce((sum, r) => sum + Number(r.payout_cents), 0);

  const table = (list: PartnerTotal[], moneyLabel: string, money: (r: PartnerTotal) => number) => (
    <TableFrame>
      <Table>
        <thead>
          <Tr>
            <Th>{t.done.company}</Th>
            <Th>{t.done.trips}</Th>
            <Th>{t.done.distance}</Th>
            <Th>{moneyLabel}</Th>
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
            </Tr>
          ))}
        </tbody>
      </Table>
    </TableFrame>
  );

  return (
    <main className="mx-auto w-full max-w-6xl px-5 py-8">
      <nav className="mb-6">
        <Link
          href={cabinetPath(locale, 'ADMIN')}
          className="text-[13px] text-ink-muted hover:text-ink"
        >
          ← {t.role.ADMIN}
        </Link>
      </nav>

      <h1 className="text-xl font-semibold tracking-tight">{t.done.titleAdmin}</h1>
      <p className="mt-2 mb-6 max-w-xl text-[13px] leading-relaxed text-ink-muted">
        {t.done.subtitleAdmin}
      </p>

      <StatRow>
        <Stat label={t.money.revenue} value={f.eur(revenue)} />
        <Stat label={t.done.payout} value={f.eur(payout)} />
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
        {carriers.length > 0 && table(carriers, t.done.payout, (r) => Number(r.payout_cents))}
      </section>

      <section className="mt-10">
        <h2 className="mb-4 border-b border-line pb-2 text-[13px] font-semibold tracking-tight text-ink-faint">
          {t.done.titleCarrier}
        </h2>
        <CompletedList orders={orders ?? []} totals={totals ?? []} />
      </section>
    </main>
  );
}

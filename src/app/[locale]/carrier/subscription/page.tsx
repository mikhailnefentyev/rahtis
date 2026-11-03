import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Badge, Card, CardBody, Stat, StatRow, Table, TableFrame, Td, Th, Tr } from '@/components/ui';
import { requireRole } from '@/lib/auth/guard';
import { ANNUAL_DISCOUNT_BPS, ladderStepLabel, ON_REQUEST_FROM, SUBSCRIPTION_LADDER, subscriptionLadderCents } from '@/lib/config';
import { isLocale } from '@/lib/i18n';
import { getViewerI18n } from '@/lib/i18n/viewer';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { AnnualForm } from './AnnualForm';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const { t } = await getViewerI18n(locale);
  return { title: t.subscription.title };
}

/* Первая версия условий с оплатой года вперёд — та же, что app.annual_terms_version(). */
const ANNUAL_TERMS_VERSION = 21;

/**
 * Абонемент перевозчика: цена (первая машина бесплатно), сколько машин работало в этом месяце
 * и примерная сумма, оплата года вперёд (−10 %) и начисления.
 */
export default async function SubscriptionPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const viewer = await requireRole(locale, 'CARRIER');
  const company = viewer.company!;
  const [{ t, f }, supabase] = await Promise.all([getViewerI18n(locale), createClient()]);
  const s = t.subscription;
  const admin = createAdminClient();

  const now = new Date();
  const helsinki = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Helsinki', year: 'numeric', month: '2-digit' }).format(now);
  const monthStart = `${helsinki}-01`;
  const [y, m] = helsinki.split('-').map(Number);
  const nextMonth = `${m === 12 ? y + 1 : y}-${String(m === 12 ? 1 : m + 1).padStart(2, '0')}-01`;

  /* Заказы — служебным клиентом: колонки orders открыты перевозчику выборочно. Только свои. */
  const [{ data: orders }, { data: fees }, { data: plans }, { data: terms }] = await Promise.all([
    admin
      .from('orders')
      .select('assigned_vehicle_id')
      .eq('assigned_company_id', company.id)
      .eq('status', 'DONE')
      .gte('closed_at', `${monthStart}T00:00:00+02:00`)
      .not('assigned_vehicle_id', 'is', null)
      .limit(5000),
    supabase
      .from('carrier_subscription_fees')
      .select('id, month, kind, active_vehicles, net_cents, gross_cents, vat_bps')
      .eq('carrier_company_id', company.id)
      .order('month', { ascending: false })
      .limit(24),
    supabase.from('carrier_annual_plans').select('id, vehicles, starts_on, ends_on, cancelled_at').eq('company_id', company.id).order('starts_on', { ascending: false }),
    admin.from('legal_documents').select('version').eq('kind', 'TERMS').eq('status', 'ACTIVE').maybeSingle(),
  ]);

  const active = new Set((orders ?? []).map((o) => o.assigned_vehicle_id)).size;
  const estimate = subscriptionLadderCents(active);
  const subscriber = company.partnership === 'SUBSCRIBER';
  const plan = (plans ?? []).find((p) => !p.cancelled_at && p.ends_on >= monthStart) ?? null;
  const annualOpen = (terms?.version ?? 0) >= ANNUAL_TERMS_VERSION;
  const date = (iso: string) => f.date(`${iso}T12:00:00Z`);
  const examples = [2, 5, 10, 20];

  return (
    <main className="cab-page">
      <h1 className="page-title">{s.title}</h1>
      <p className="mt-2 max-w-3xl text-[13px] leading-relaxed text-ink-muted">{s.lede}</p>

      {!subscriber && (
        <Card className="mt-6 max-w-3xl">
          <CardBody>
            <p className="text-[13px]">{s.notSubscriber}</p>
          </CardBody>
        </Card>
      )}

      {subscriber && (
        <div className="mt-6">
          <StatRow>
            <Stat label={s.activeNow} value={String(active)} hint={s.activeHint} />
            <Stat label={s.estimateNow} value={f.eur(estimate)} hint={active >= ON_REQUEST_FROM ? s.estimateLarge : s.vatExcl} />
            <Stat label={s.planNow} value={plan ? String(plan.vehicles) : '—'} hint={plan ? `${date(plan.starts_on)}–${date(plan.ends_on)}` : s.noPlan} />
          </StatRow>
        </div>
      )}

      <div className="mt-6 grid max-w-5xl gap-4 lg:grid-cols-2">
        <TableFrame caption={s.ladderTitle}>
          <Table>
            <thead>
              <tr>
                <Th>{s.colVehicles}</Th>
                <Th numeric>{s.colPrice}</Th>
              </tr>
            </thead>
            <tbody>
              {SUBSCRIPTION_LADDER.map((step) => (
                <Tr key={step.from}>
                  <Td>{ladderStepLabel(step)}</Td>
                  <Td numeric>{step.cents === 0 ? s.free : f.eur(step.cents)}</Td>
                </Tr>
              ))}
              <Tr>
                <Td>{s.fromN.replace('{n}', String(ON_REQUEST_FROM))}</Td>
                <Td numeric>{s.onRequest}</Td>
              </Tr>
            </tbody>
          </Table>
        </TableFrame>
        <TableFrame caption={s.examplesTitle}>
          <Table>
            <thead>
              <tr>
                <Th>{s.colVehicles}</Th>
                <Th numeric>{s.colMonth}</Th>
                <Th numeric>{s.colAverage}</Th>
              </tr>
            </thead>
            <tbody>
              {examples.map((n) => (
                <Tr key={n}>
                  <Td>{n}</Td>
                  <Td numeric>{f.eur(subscriptionLadderCents(n))}</Td>
                  <Td numeric>{f.eur(Math.round(subscriptionLadderCents(n) / n))}</Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </TableFrame>
      </div>
      <p className="mt-2 max-w-3xl text-[12px] leading-relaxed text-ink-dim">{s.ladderNote.replace('{pct}', String(ANNUAL_DISCOUNT_BPS / 100))}</p>

      {subscriber && (
        <div className="mt-6 max-w-3xl">
          {plan ? (
            <Card>
              <CardBody>
                <p className="text-[13px]">
                  {s.planActive.replace('{n}', String(plan.vehicles)).replace('{from}', date(plan.starts_on)).replace('{to}', date(plan.ends_on))}
                </p>
              </CardBody>
            </Card>
          ) : annualOpen ? (
            <AnnualForm suggested={active} startsOn={date(nextMonth)} />
          ) : (
            <Card>
              <CardBody>
                <p className="text-[13px] text-ink-muted">{s.annualSoon}</p>
              </CardBody>
            </Card>
          )}
        </div>
      )}

      {(fees ?? []).length > 0 && (
        <TableFrame caption={s.feesTitle} className="mt-6 max-w-5xl">
          <Table>
            <thead>
              <tr>
                <Th>{s.colPeriod}</Th>
                <Th>{s.colKind}</Th>
                <Th numeric>{s.colVehicles}</Th>
                <Th numeric>{s.colNet}</Th>
                <Th numeric>{s.colGross}</Th>
              </tr>
            </thead>
            <tbody>
              {(fees ?? []).map((fee) => (
                <Tr key={fee.id}>
                  <Td mono>{`${Number(fee.month.slice(5, 7))}/${fee.month.slice(0, 4)}`}</Td>
                  <Td>
                    <Badge tone={fee.kind === 'ANNUAL' ? 'ok' : 'neutral'}>{fee.kind === 'ANNUAL' ? s.kindAnnual : s.kindMonth}</Badge>
                  </Td>
                  <Td numeric>{fee.active_vehicles}</Td>
                  <Td numeric>{f.eur(fee.net_cents)}</Td>
                  <Td numeric>{f.eur(fee.gross_cents)}</Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </TableFrame>
      )}
    </main>
  );
}

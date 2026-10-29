import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Card, CardBody, Stat, StatRow, Table, TableFrame, Td, Th, Tr } from '@/components/ui';
import { requireRole } from '@/lib/auth/guard';
import { loadEconomics, monthRange } from '@/lib/economics/load';
import type { MonthEconomics } from '@/lib/economics/profit';
import { currentFuelMonth, nextMonth, parseFuelMonth } from '@/lib/fuel/month';
import { isLocale } from '@/lib/i18n';
import { getViewerI18n } from '@/lib/i18n/viewer';
import { createClient } from '@/lib/supabase/server';
import { EmployerCostForm } from './EmployerCostForm';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const { t } = await getViewerI18n(locale);
  return { title: t.economics.title };
}

/**
 * Kannattavuus: доходы, расходы и прибыль каждой машины и парка за месяц,
 * плюс итоги парка за год. Оценка для решений, не бухгалтерия: зарплата —
 * ориентировочная по сменам, купленная сразу машина — с износом.
 */
export default async function EconomicsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ month?: string }>;
}) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  if (!isLocale(locale)) notFound();

  const viewer = await requireRole(locale, 'CARRIER');
  const company = viewer.company!;
  const [{ t, f }, supabase] = await Promise.all([getViewerI18n(locale), createClient()]);
  const s = t.economics;

  const { data: access } = await supabase.rpc('own_orders_access');
  if (!access) {
    return (
      <main className="cab-page">
        <h1 className="page-title">{s.title}</h1>
        <Card className="mt-6 max-w-2xl">
          <CardBody>
            <p className="text-[13px]">{s.locked}</p>
          </CardBody>
        </Card>
      </main>
    );
  }

  const current = currentFuelMonth();
  const month = parseFuelMonth(query.month);
  const months = monthRange(month, 12);
  const data = await loadEconomics(supabase, { id: company.id, partnership: company.partnership ?? null }, months);

  const monthLabel = new Intl.DateTimeFormat(t.meta.intl, { month: 'short', year: 'numeric', timeZone: 'UTC' });
  const monthLong = new Intl.DateTimeFormat(t.meta.intl, { month: 'long', year: 'numeric', timeZone: 'UTC' });
  const label = (m: string) => monthLabel.format(new Date(`${m}-15T00:00:00Z`));
  const prev = monthRange(month, 2)[0];
  const base = `/${locale}/carrier/economics`;

  const fleet = data.fleet.find((m) => m.month === month)!;
  const rows = data.economics.map((v) => ({ ...v, m: v.months.find((x) => x.month === month)! }));
  const eur = (cents: number) => f.eur(cents);
  const tone = (cents: number) => (cents < 0 ? 'text-danger' : '');
  const insuranceTax = (m: MonthEconomics) => m.costs.insurance + m.costs.tax;
  const vehicleCost = (m: MonthEconomics) => m.costs.financing + m.costs.depreciation;
  const other = (m: MonthEconomics) => m.costs.fixed + m.costs.journal + m.costs.rahtis;

  return (
    <main className="cab-page">
      <h1 className="page-title">{s.title}</h1>
      <p className="mt-2 mb-6 max-w-3xl text-[13px] leading-relaxed text-ink-muted">{s.lede}</p>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Link href={`${base}?month=${prev}`} className="text-[13px] text-accent">
          ‹ {label(prev)}
        </Link>
        <h2 className="text-[15px] font-semibold capitalize">{monthLong.format(new Date(`${month}-15T00:00:00Z`))}</h2>
        {month < current && (
          <Link href={`${base}?month=${nextMonth(month)}`} className="text-[13px] text-accent">
            {label(nextMonth(month))} ›
          </Link>
        )}
      </div>

      <StatRow>
        <Stat label={s.statRevenue} value={eur(fleet.revenue.total)} />
        <Stat label={s.statCosts} value={eur(fleet.costs.total)} />
        <Stat label={s.statProfit} value={eur(fleet.profit)} />
        <Stat label={s.statMargin} value={fleet.marginPct != null ? `${f.decimal(fleet.marginPct)} %` : '—'} />
      </StatRow>

      <TableFrame caption={s.byVehicle} className="mt-6">
        <Table>
          <thead>
            <tr>
              <Th>{s.colVehicle}</Th>
              <Th numeric>{s.colRevenue}</Th>
              <Th numeric>{s.colFuel}</Th>
              <Th numeric>{s.colDriver}</Th>
              <Th numeric>{s.colVehicleCost}</Th>
              <Th numeric>{s.colInsurance}</Th>
              <Th numeric>{s.colOther}</Th>
              <Th numeric>{s.colProfit}</Th>
              <Th numeric>{s.colMargin}</Th>
              <Th numeric>{s.colPayback}</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <Tr key={r.vehicleId}>
                <Td mono>
                  <Link href={`${base}/${r.vehicleId}?month=${month}`} className="text-accent hover:underline">
                    {r.plate}
                  </Link>
                  {!data.finance.has(r.vehicleId) && <span className="block font-sans text-[11px] text-warn">{s.noFinance}</span>}
                </Td>
                <Td numeric>{eur(r.m.revenue.total)}</Td>
                <Td numeric>{eur(r.m.costs.fuel)}</Td>
                <Td numeric>{eur(r.m.costs.driver)}</Td>
                <Td numeric>{eur(vehicleCost(r.m))}</Td>
                <Td numeric>{eur(insuranceTax(r.m))}</Td>
                <Td numeric>{eur(other(r.m))}</Td>
                <Td numeric className={`font-semibold ${tone(r.m.profit)}`}>{eur(r.m.profit)}</Td>
                <Td numeric>{r.m.marginPct != null ? `${f.decimal(r.m.marginPct)} %` : '—'}</Td>
                <Td numeric>{r.paybackPct != null ? `${f.decimal(r.paybackPct)} %` : '—'}</Td>
              </Tr>
            ))}
            <Tr>
              <Td className="font-semibold">{s.fleetTotal}</Td>
              <Td numeric className="font-semibold">{eur(fleet.revenue.total)}</Td>
              <Td numeric>{eur(fleet.costs.fuel)}</Td>
              <Td numeric>{eur(fleet.costs.driver)}</Td>
              <Td numeric>{eur(vehicleCost(fleet))}</Td>
              <Td numeric>{eur(insuranceTax(fleet))}</Td>
              <Td numeric>{eur(other(fleet))}</Td>
              <Td numeric className={`font-semibold ${tone(fleet.profit)}`}>{eur(fleet.profit)}</Td>
              <Td numeric>{fleet.marginPct != null ? `${f.decimal(fleet.marginPct)} %` : '—'}</Td>
              <Td numeric />
            </Tr>
          </tbody>
        </Table>
      </TableFrame>
      {data.unassignedPayCents > 0 && (
        <p className="mt-2 text-[12px] text-warn">{s.unassignedPay.replace('{amount}', eur(data.unassignedPayCents))}</p>
      )}
      <p className="mt-2 max-w-4xl text-[12px] leading-relaxed text-ink-dim">{s.estimateNote}</p>

      <TableFrame caption={s.trendTitle} className="mt-6">
        <Table>
          <thead>
            <tr>
              <Th>{s.month}</Th>
              <Th numeric>{s.colRevenue}</Th>
              <Th numeric>{s.statCosts}</Th>
              <Th numeric>{s.colProfit}</Th>
              <Th numeric>{s.colMargin}</Th>
            </tr>
          </thead>
          <tbody>
            {[...data.fleet].reverse().map((m) => (
              <Tr key={m.month}>
                <Td>
                  <Link href={`${base}?month=${m.month}`} className={m.month === month ? 'font-semibold' : 'text-accent hover:underline'}>
                    {label(m.month)}
                  </Link>
                </Td>
                <Td numeric>{eur(m.revenue.total)}</Td>
                <Td numeric>{eur(m.costs.total)}</Td>
                <Td numeric className={tone(m.profit)}>{eur(m.profit)}</Td>
                <Td numeric>{m.marginPct != null ? `${f.decimal(m.marginPct)} %` : '—'}</Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      </TableFrame>

      <EmployerCostForm bps={data.employerCostBps} />
    </main>
  );
}

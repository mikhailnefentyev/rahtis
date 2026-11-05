import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Card, CardBody, Table, TableFrame, Td, Th, Tr, buttonClass } from '@/components/ui';
import { requireRole } from '@/lib/auth/guard';
import { deleteVehicleCostAction } from '@/lib/economics/actions';
import { loadEconomics, monthRange } from '@/lib/economics/load';
import type { MonthEconomics } from '@/lib/economics/profit';
import { parseFuelMonth } from '@/lib/fuel/month';
import { isLocale } from '@/lib/i18n';
import { getViewerI18n } from '@/lib/i18n/viewer';
import { createClient } from '@/lib/supabase/server';
import { CostForm } from './CostForm';
import { FinanceForm } from './FinanceForm';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const { t } = await getViewerI18n(locale);
  return { title: t.economics.title };
}

/**
 * Доходность одной машины: карточка финансов, журнал разовых расходов и
 * разбивка доходов и расходов за 12 месяцев.
 */
export default async function VehicleEconomicsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; vehicleId: string }>;
  searchParams: Promise<{ month?: string }>;
}) {
  const [{ locale, vehicleId }, query] = await Promise.all([params, searchParams]);
  if (!isLocale(locale)) notFound();

  const viewer = await requireRole(locale, 'CARRIER');
  const company = viewer.company!;
  const [{ t, f }, supabase] = await Promise.all([getViewerI18n(locale), createClient()]);
  const s = t.economics;

  const { data: access } = await supabase.rpc('own_orders_access');
  if (!access) notFound();

  const month = parseFuelMonth(query.month);
  const months = monthRange(month, 12);
  const data = await loadEconomics(supabase, { id: company.id, partnership: company.partnership ?? null, currency: f.currency }, months);
  const vehicle = data.vehicles.find((v) => v.id === vehicleId);
  const econ = data.economics.find((v) => v.vehicleId === vehicleId);
  if (!vehicle || !econ) notFound();

  const monthLabel = new Intl.DateTimeFormat(t.meta.intl, { month: 'short', year: 'numeric', timeZone: 'UTC' });
  const label = (m: string) => monthLabel.format(new Date(`${m}-15T00:00:00Z`));
  /* Разбивка — в рабочей валюте компании; карточка и журнал — в своей валюте строки. */
  const eur = (cents: number) => (cents ? f.money(cents, data.currency) : '—');
  const list = [...econ.months].reverse();
  const costs = data.costs.filter((c) => c.vehicle_id === vehicleId);
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Helsinki' }).format(new Date());

  const fin = data.finance.get(vehicleId);
  /* Износ купленной сразу машины — с расчётом: это доля цены в месяц, а не платёж. */
  const depLabel =
    fin?.financing === 'CASH' && fin.purchase_price_cents
      ? `${s.lineDepreciation} (${fin.residual_cents ? `(${f.money(fin.purchase_price_cents, fin.currency)} − ${f.money(fin.residual_cents, fin.currency)})` : f.money(fin.purchase_price_cents, fin.currency)} ÷ ${fin.useful_life_months} ${s.monthsShort})`
      : s.lineDepreciation;
  const lines: { label: string; get: (m: MonthEconomics) => number; strong?: boolean }[] = [
    { label: s.revenuePlatform, get: (m) => m.revenue.platform },
    { label: s.revenueOwn, get: (m) => m.revenue.own },
    { label: s.revenueSite, get: (m) => m.revenue.site },
    { label: s.colRevenue, get: (m) => m.revenue.total, strong: true },
    { label: s.colFuel, get: (m) => -m.costs.fuel },
    { label: s.colDriver, get: (m) => -m.costs.driver },
    { label: s.lineFinancing, get: (m) => -m.costs.financing },
    { label: depLabel, get: (m) => -m.costs.depreciation },
    { label: s.lineInsurance, get: (m) => -m.costs.insurance },
    { label: s.lineTax, get: (m) => -m.costs.tax },
    { label: s.lineFixed, get: (m) => -m.costs.fixed },
    { label: s.lineJournal, get: (m) => -m.costs.journal },
    { label: s.lineRahtis, get: (m) => -m.costs.rahtis },
    { label: s.colProfit, get: (m) => m.profit, strong: true },
  ];

  return (
    <main className="cab-page">
      <Link href={`/${locale}/carrier/economics?month=${month}`} className="text-[13px] text-accent">
        ‹ {s.title}
      </Link>
      <h1 className="page-title mt-2">
        {vehicle.plate}
        {vehicle.make ? <span className="ml-2 text-[15px] font-normal text-ink-muted">{vehicle.make}</span> : null}
      </h1>
      {econ.paybackPct != null && <p className="mt-2 text-[13px] text-ink-muted">{s.paybackLine.replace('{pct}', f.decimal(econ.paybackPct))}</p>}
      <div className="mt-3 flex items-center gap-2">
        <span className="text-[12px] text-ink-muted">{s.download}</span>
        {(['pdf', 'csv'] as const).map((format) => (
          <a
            key={format}
            href={`/${locale}/carrier/economics/export?format=${format}&month=${month}&vehicle=${vehicleId}`}
            className={buttonClass({ variant: 'default', size: 'sm' })}
            download
          >
            {format.toUpperCase()}
          </a>
        ))}
      </div>

      <div className="mt-6 flex max-w-5xl flex-col gap-4">
        <FinanceForm vehicleId={vehicleId} finance={data.finance.get(vehicleId) ?? null} />
      </div>

      <TableFrame caption={s.monthsTitle} className="mt-6">
        <Table>
          <thead>
            <tr>
              <Th />
              {list.map((m) => (
                <Th key={m.month} numeric>
                  {label(m.month)}
                </Th>
              ))}
            </tr>
          </thead>
          <tbody>
            {lines.map((line) => (
              <Tr key={line.label}>
                <Td className={line.strong ? 'font-semibold' : 'text-ink-muted'}>{line.label}</Td>
                {list.map((m) => {
                  const v = line.get(m);
                  return (
                    <Td key={m.month} numeric className={`${line.strong ? 'font-semibold' : ''} ${v < 0 && line.strong ? 'text-danger' : ''}`}>
                      {eur(v)}
                    </Td>
                  );
                })}
              </Tr>
            ))}
          </tbody>
        </Table>
      </TableFrame>
      <p className="mt-2 max-w-4xl text-[12px] leading-relaxed text-ink-dim">{s.estimateNote}</p>

      <div className="mt-6 flex max-w-5xl flex-col gap-4">
        <CostForm vehicleId={vehicleId} today={today} />
        {costs.length === 0 ? (
          <Card>
            <CardBody>
              <p className="text-[13px] text-ink-muted">{s.noCosts}</p>
            </CardBody>
          </Card>
        ) : (
          <TableFrame caption={s.costsTitle}>
            <Table>
              <thead>
                <tr>
                  <Th>{s.spentOn}</Th>
                  <Th>{s.category}</Th>
                  <Th numeric>{f.label(s.amount)}</Th>
                  <Th>{s.note}</Th>
                  <Th />
                </tr>
              </thead>
              <tbody>
                {costs.map((c) => (
                  <Tr key={c.id}>
                    <Td mono>{f.date(`${c.spent_on}T12:00:00Z`)}</Td>
                    <Td>{s.categories[c.category as keyof typeof s.categories] ?? c.category}</Td>
                    <Td numeric>{f.money(c.amount_cents, c.currency)}</Td>
                    <Td className="whitespace-normal">{[c.supplier, c.note].filter(Boolean).join(' · ')}</Td>
                    <Td>
                      <form action={deleteVehicleCostAction}>
                        <input type="hidden" name="locale" value={locale} />
                        <input type="hidden" name="id" value={c.id} />
                        <button type="submit" className="text-[12px] text-danger hover:underline">
                          {s.delete}
                        </button>
                      </form>
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </TableFrame>
        )}
      </div>
    </main>
  );
}

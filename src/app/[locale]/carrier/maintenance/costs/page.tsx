import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Badge, Card, CardBody, EmptyState, Plate, Stat, StatRow, Table, TableFrame, Td, Th, Tr } from '@/components/ui';
import { requireRole } from '@/lib/auth/guard';
import { todayInHelsinki } from '@/lib/dates';
import { companyConverter } from '@/lib/economics/convert';
import { monthRange } from '@/lib/economics/load';
import { isLocale } from '@/lib/i18n';
import { getViewerI18n } from '@/lib/i18n/viewer';
import { summarizeCosts, type CostDefect, type CostRecord } from '@/lib/maintenance/costs';
import { asCurrency } from '@/lib/money/currency';
import { loadFxHistory } from '@/lib/money/fx';
import { createClient } from '@/lib/supabase/server';
import { MonthlyChart } from './MonthlyChart';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const { t } = await getViewerI18n(locale);
  return { title: t.maintenance.costs.title };
}

const MONTHS = 12;

/**
 * Huoltokulut — во что обходится парк за 12 месяцев: плановое и
 * ремонты по месяцам, по машинам с евро на километр, повторяющиеся
 * поломки. Источник — суммы сервисной книжки (без ALV) и дефекты; не
 * закрыто подпиской, как и весь раздел: это свои же записи перевозчика.
 */
export default async function MaintenanceCostsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const viewer = await requireRole(locale, 'CARRIER');
  const company = viewer.company!;
  const [i18n, supabase] = await Promise.all([getViewerI18n(locale), createClient()]);
  const { t, f } = i18n;
  const s = t.maintenance.costs;
  const areas = t.maintenance.defects.areas;

  const today = todayInHelsinki();
  const months = monthRange(today.slice(0, 7), MONTHS);
  const from = `${months[0]}-01`;
  const currency = asCurrency(company.currency, 'EUR');

  const [{ data: vehicles }, { data: trailers }, { data: records }, { data: defects }, { data: spans }, fx] = await Promise.all([
    supabase.from('vehicles').select('id, plate, make').eq('company_id', company.id).order('plate'),
    supabase.from('trailers').select('id, plate, kind').eq('company_id', company.id).order('plate'),
    supabase
      .from('maintenance_records')
      .select('vehicle_id, trailer_id, kind, done_on, amount_cents, currency')
      .eq('company_id', company.id)
      .gte('done_on', from)
      .limit(5000),
    supabase
      .from('vehicle_defects')
      .select('vehicle_id, trailer_id, area, reported_at')
      .eq('company_id', company.id)
      .gte('reported_at', `${from}T00:00:00Z`)
      .limit(5000),
    supabase.rpc('fleet_km_span', { p_from: from }),
    loadFxHistory(supabase, from, today),
  ]);
  const conv = companyConverter(fx, currency);

  const assets = [
    ...(vehicles ?? []).map((v) => ({ id: v.id, plate: v.plate, label: v.make, trailer: false })),
    ...(trailers ?? []).map((tr) => ({ id: tr.id, plate: tr.plate, label: t.mass.kinds[tr.kind as keyof typeof t.mass.kinds] ?? tr.kind, trailer: true })),
  ];
  const byId = new Map(assets.map((a) => [a.id, a]));

  const costRecords: CostRecord[] = (records ?? []).map((r) => ({
    assetId: (r.vehicle_id ?? r.trailer_id)!,
    kind: r.kind,
    doneOn: r.done_on,
    cents: r.amount_cents != null ? conv.cents(r.amount_cents, r.currency, r.done_on) : null,
  }));
  const costDefects: CostDefect[] = (defects ?? []).map((d) => ({
    assetId: (d.vehicle_id ?? d.trailer_id)!,
    area: d.area,
    reportedOn: d.reported_at.slice(0, 10),
  }));
  const summary = summarizeCosts({
    months,
    records: costRecords,
    defects: costDefects,
    km: new Map((spans ?? []).map((sp) => [sp.vehicle_id, sp])),
    assetIds: assets.map((a) => a.id),
  });

  const monthName = new Intl.DateTimeFormat(t.meta.intl, { month: 'short', timeZone: 'UTC' });
  const chartMonths = summary.months.map((m) => ({ ...m, label: monthName.format(new Date(`${m.month}-15T12:00:00Z`)) }));
  const rows = summary.assets.filter((a) => a.visits > 0 || a.defects > 0);
  const repairShare = summary.total > 0 ? summary.repairs / summary.total : 0;
  const perKm = (cents: number) => f.money(Math.round(cents * 100) / 100);

  return (
    <main className="cab-page">
      <Link href={`/${locale}/carrier/maintenance`} className="text-[13px] text-accent hover:underline">
        ← {t.maintenance.title}
      </Link>
      <h1 className="page-title mt-3">{s.title}</h1>
      <p className="mt-2 mb-6 max-w-3xl text-[13px] leading-relaxed text-ink-muted">
        {s.lede} {f.label(s.amountsIn, currency)}
      </p>

      <StatRow className="mb-8">
        <Stat label={s.total} value={f.money(summary.total)} />
        <Stat label={s.planned} value={f.money(summary.planned)} />
        <Stat label={s.repairs} value={f.money(summary.repairs)} hint={summary.total > 0 ? `${f.percent(repairShare)} ${s.ofTotal}` : undefined} />
        <Stat label={s.perKm} value={summary.fleetPerKm != null ? perKm(summary.fleetPerKm) : '—'} hint={summary.fleetPerKm != null ? s.perKmHint : s.perKmNone} />
      </StatRow>

      {conv.missing > 0 && <p className="-mt-5 mb-6 text-[12px] text-warn">{s.missingRates}</p>}

      {summary.total === 0 && rows.length === 0 ? (
        <EmptyState
          title={s.emptyTitle}
          description={s.empty}
          action={
            <Link href={`/${locale}/carrier/maintenance`} className="text-accent hover:underline">
              {t.maintenance.title} →
            </Link>
          }
        />
      ) : (
        <>
          <section className="mb-8">
            <h2 className="mb-3 border-b border-line pb-2 text-[13px] font-semibold tracking-tight text-ink-faint">{s.chartTitle}</h2>
            <Card>
              <CardBody>
                <MonthlyChart months={chartMonths} />
              </CardBody>
            </Card>
          </section>

          <section className="mb-8">
            <h2 className="mb-3 border-b border-line pb-2 text-[13px] font-semibold tracking-tight text-ink-faint">{s.byAsset}</h2>
            <TableFrame>
              <Table>
                <thead>
                  <tr>
                    <Th>{s.colAsset}</Th>
                    <Th className="text-right">{s.total}</Th>
                    <Th className="text-right">{s.planned}</Th>
                    <Th className="text-right">{s.repairs}</Th>
                    <Th className="text-right">{s.colKm}</Th>
                    <Th className="text-right">{s.perKm}</Th>
                    <Th className="text-right">{s.colDefects}</Th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const asset = byId.get(row.assetId)!;
                    return (
                      <Tr key={row.assetId}>
                        <Td>
                          <Link href={`/${locale}/carrier/maintenance/${row.assetId}`} className="hover:underline">
                            <Plate>{asset.plate}</Plate>
                          </Link>
                          <span className="ml-2 text-[12px] text-ink-muted">{asset.label}</span>
                        </Td>
                        <Td className="text-right font-mono">{f.money(row.total)}</Td>
                        <Td className="text-right font-mono">{f.money(row.planned)}</Td>
                        <Td className="text-right font-mono">{f.money(row.repairs)}</Td>
                        <Td className="text-right font-mono">{asset.trailer ? '—' : row.km != null ? f.number(row.km) : '—'}</Td>
                        <Td className="text-right font-mono">{row.perKm != null ? perKm(row.perKm) : '—'}</Td>
                        <Td className="text-right">
                          {row.defects > 0 ? row.defects : '—'}
                          {row.repeatAreas.length > 0 && (
                            <span className="ml-2 inline-flex flex-wrap justify-end gap-1">
                              {row.repeatAreas.map((r) => (
                                <Badge key={r.area} tone="warn">
                                  {areas[r.area as keyof typeof areas] ?? r.area} ×{r.count}
                                </Badge>
                              ))}
                            </span>
                          )}
                        </Td>
                      </Tr>
                    );
                  })}
                </tbody>
              </Table>
            </TableFrame>
            <p className="mt-2 text-[12px] text-ink-muted">{s.kmNote}</p>
          </section>

          <section>
            <h2 className="mb-3 border-b border-line pb-2 text-[13px] font-semibold tracking-tight text-ink-faint">{s.repeatsTitle}</h2>
            {summary.repeats.length === 0 ? (
              <p className="text-[13px] text-ink-muted">{s.repeatsEmpty}</p>
            ) : (
              <>
                <p className="mb-3 max-w-3xl text-[13px] text-ink-muted">{s.repeatsHint}</p>
                <ul className="flex flex-col gap-2">
                  {summary.repeats.map((r) => (
                    <li key={`${r.assetId}-${r.area}`} className="flex flex-wrap items-center gap-2 text-[13px]">
                      <Link href={`/${locale}/carrier/maintenance/${r.assetId}`} className="hover:underline">
                        <Plate>{byId.get(r.assetId)?.plate ?? '—'}</Plate>
                      </Link>
                      <span className="font-semibold">{areas[r.area as keyof typeof areas] ?? r.area}</span>
                      <Badge tone="warn">×{r.count}</Badge>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>
        </>
      )}
    </main>
  );
}

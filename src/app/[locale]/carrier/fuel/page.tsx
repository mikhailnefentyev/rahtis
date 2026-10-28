import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Badge, Bars, Card, CardBody, EmptyState, Stat, StatRow, Table, TableFrame, Td, Th, Tr } from '@/components/ui';
import { requireRole } from '@/lib/auth/guard';
import { deleteFuelEntryAction } from '@/lib/fuel/actions';
import { fuelStats, monthOf, monthsBack, type FuelRow, type MonthStat } from '@/lib/fuel/fuel';
import { isLocale } from '@/lib/i18n';
import { getViewerI18n } from '@/lib/i18n/viewer';
import { createClient } from '@/lib/supabase/server';
import { FuelEntryForm } from './FuelEntryForm';
import { FuelUpload } from './FuelUpload';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const { t } = await getViewerI18n(locale);
  return { title: t.fuel.title };
}

/* Разбор отчёта моделью идёт внутри действия загрузки: до двух минут. */
export const maxDuration = 120;

const MONTHS = 12;

/**
 * Топливо перевозчика: расход машин, траты, заправки и месячные отчёты.
 *
 * Строки — водитель (приложение), отчёт заправщика (загрузка) и ручной
 * ввод. Расход — методом полного бака (src/lib/fuel/stats.ts) за
 * двенадцать месяцев: интервал, начатый в прошлом месяце, закрывается в
 * этом, поэтому месяц без предыдущего посчитался бы неверно.
 *
 * Входит в подписку — как свои рейсы (own_orders_access).
 */
export default async function FuelPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ month?: string; imported?: string }>;
}) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  if (!isLocale(locale)) notFound();

  const viewer = await requireRole(locale, 'CARRIER');
  const company = viewer.company!;
  const [{ t, f }, supabase] = await Promise.all([getViewerI18n(locale), createClient()]);
  const s = t.fuel;

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

  const current = monthOf(new Date().toISOString());
  const month = /^\d{4}-\d{2}$/.test(query.month ?? '') && query.month! <= current ? query.month! : current;
  const months = monthsBack(month, MONTHS);
  /* С запасом в месяц: первый интервал года открывается заправкой месяцем раньше. */
  const since = `${monthsBack(months[0], 2)[0]}-01T00:00:00Z`;
  const untilNext = `${nextMonth(month)}-01T00:00:00Z`;

  const [{ data: entries }, { data: vehicles }, { data: drivers }, { data: imports }] = await Promise.all([
    supabase
      .from('fuel_entries')
      .select('id, vehicle_id, driver_id, filled_at, product, quantity, unit, amount_cents, odometer_km, full_tank, station, source, receipt_path')
      .eq('company_id', company.id)
      .gte('filled_at', since)
      .lt('filled_at', untilNext)
      .order('filled_at', { ascending: true })
      .limit(5000),
    supabase.from('vehicles').select('id, plate').eq('company_id', company.id).order('plate'),
    supabase.from('drivers').select('id, full_name').eq('company_id', company.id),
    supabase
      .from('fuel_imports')
      .select('id, file_name, status, supplier, created_at, inserted, merged')
      .eq('company_id', company.id)
      .order('created_at', { ascending: false })
      .limit(8),
  ]);

  const rows = (entries ?? []).map((e) => ({ ...e, quantity: Number(e.quantity) }));
  const stats = fuelStats(rows as FuelRow[]);
  const plates = new Map((vehicles ?? []).map((v) => [v.id, v.plate]));
  const driverNames = new Map((drivers ?? []).map((d) => [d.id, d.full_name]));

  const fleetByMonth = new Map(stats.fleet.map((m) => [m.month, m]));
  const thisMonth = fleetByMonth.get(month);
  const monthRows = rows.filter((row) => monthOf(row.filled_at) === month).reverse();

  const monthLabel = new Intl.DateTimeFormat(t.meta.intl, { month: 'short', timeZone: 'UTC' });
  const monthLong = new Intl.DateTimeFormat(t.meta.intl, { month: 'long', year: 'numeric', timeZone: 'UTC' });
  const label = (m: string) => monthLabel.format(new Date(`${m}-15T00:00:00Z`));
  const prev = monthsBack(month, 2)[0];
  const base = `/${locale}/carrier/fuel`;

  const vehicleStats = [...stats.byVehicle.entries()]
    .map(([id, list]) => ({ id, plate: plates.get(id) ?? '—', stat: list.find((m) => m.month === month) }))
    .filter((v): v is { id: string; plate: string; stat: MonthStat } => Boolean(v.stat))
    .sort((a, b) => a.plate.localeCompare(b.plate));

  const fleetL100 = months.map((m) => fleetByMonth.get(m)?.l100 ?? 0);
  const fleetSpend = months.map((m) => fleetByMonth.get(m)?.amountCents ?? 0);

  return (
    <main className="cab-page">
      <h1 className="page-title">{s.title}</h1>
      <p className="mt-2 mb-6 max-w-2xl text-[13px] leading-relaxed text-ink-muted">{s.lede}</p>

      {query.imported && <p className="mb-4 text-[13px] text-ok">{s.importedNote}</p>}

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Link href={`${base}?month=${prev}`} className="text-[13px] text-accent" aria-label={s.prevMonth}>
          ‹ {label(prev)}
        </Link>
        <h2 className="text-[15px] font-semibold capitalize">{monthLong.format(new Date(`${month}-15T00:00:00Z`))}</h2>
        {month < current && (
          <Link href={`${base}?month=${nextMonth(month)}`} className="text-[13px] text-accent" aria-label={s.nextMonth}>
            {label(nextMonth(month))} ›
          </Link>
        )}
      </div>

      <StatRow>
        <Stat label={s.statLitres} value={thisMonth ? f.number(Math.round(thisMonth.liquidL)) : '—'} hint={thisMonth?.gasKg ? `${s.statGas}: ${f.number(Math.round(thisMonth.gasKg))}` : undefined} />
        <Stat label={s.statAmount} value={thisMonth ? f.eur(thisMonth.amountCents) : '—'} />
        <Stat label={s.statL100} value={thisMonth?.l100 != null ? f.decimal(thisMonth.l100) : '—'} hint={thisMonth?.kg100 != null ? `${f.decimal(thisMonth.kg100)} kg/100 km` : 'l/100 km'} />
        <Stat
          label={s.statCentsKm}
          value={thisMonth?.centsPerKm != null ? f.eur(Math.round(thisMonth.centsPerKm)) : '—'}
          hint={thisMonth?.adbluePct != null ? `AdBlue ${f.decimal(thisMonth.adbluePct)} %` : undefined}
        />
      </StatRow>

      {rows.length > 0 && (
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <Card>
            <CardBody className="flex flex-col gap-3">
              <p className="label-micro">{s.trendL100}</p>
              <Bars
                points={months.map((m, i) => ({
                  value: fleetL100[i],
                  label: label(m),
                  title: fleetL100[i] ? `${label(m)}: ${f.decimal(fleetL100[i])} l/100 km` : `${label(m)}: —`,
                }))}
              />
            </CardBody>
          </Card>
          <Card>
            <CardBody className="flex flex-col gap-3">
              <p className="label-micro">{s.trendAmount}</p>
              <Bars
                points={months.map((m, i) => ({
                  value: fleetSpend[i],
                  label: label(m),
                  title: `${label(m)}: ${f.eur(fleetSpend[i])}`,
                }))}
              />
            </CardBody>
          </Card>
        </div>
      )}
      <p className="mt-2 text-[12px] text-ink-dim">{s.trendHint}</p>

      {vehicleStats.length > 0 && (
        <TableFrame caption={s.byVehicle} className="mt-6">
          <Table>
            <thead>
              <tr>
                <Th>{s.colVehicle}</Th>
                <Th numeric>{s.colLitres}</Th>
                <Th numeric>AdBlue, l</Th>
                <Th numeric>{s.colGas}</Th>
                <Th numeric>{s.colAmount}</Th>
                <Th numeric>km</Th>
                <Th numeric>l/100 km</Th>
                <Th numeric>{s.colPerKm}</Th>
              </tr>
            </thead>
            <tbody>
              {vehicleStats.map(({ id, plate, stat }) => (
                <Tr key={id}>
                  <Td mono>{plate}</Td>
                  <Td numeric>{stat.liquidL ? f.decimal(stat.liquidL) : '—'}</Td>
                  <Td numeric>{stat.adblueL ? f.decimal(stat.adblueL) : '—'}</Td>
                  <Td numeric>{stat.gasKg ? f.decimal(stat.gasKg) : '—'}</Td>
                  <Td numeric>{stat.amountCents ? f.eur(stat.amountCents) : '—'}</Td>
                  <Td numeric>{stat.km ? f.number(stat.km) : '—'}</Td>
                  <Td numeric>{stat.l100 != null ? f.decimal(stat.l100) : stat.kg100 != null ? `${f.decimal(stat.kg100)} kg` : '—'}</Td>
                  <Td numeric>{stat.centsPerKm != null ? f.eur(Math.round(stat.centsPerKm)) : '—'}</Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </TableFrame>
      )}

      <section className="mt-8 grid gap-4 lg:grid-cols-2">
        <FuelUpload />
        <FuelEntryForm vehicles={vehicles ?? []} />
      </section>

      {(imports ?? []).length > 0 && (
        <TableFrame caption={s.imports} className="mt-6">
          <Table>
            <tbody>
              {(imports ?? []).map((imp) => (
                <Tr key={imp.id}>
                  <Td>
                    <Link href={`${base}/import/${imp.id}`} className="text-accent">
                      {imp.file_name}
                    </Link>
                  </Td>
                  <Td>{imp.supplier ?? '—'}</Td>
                  <Td>{f.date(imp.created_at)}</Td>
                  <Td>
                    <Badge tone={imp.status === 'DONE' ? 'ok' : imp.status === 'FAILED' ? 'danger' : 'warn'}>
                      {s.importStatus[imp.status as keyof typeof s.importStatus]}
                    </Badge>
                  </Td>
                  <Td numeric>{imp.status === 'DONE' ? `+${imp.inserted ?? 0} / ${imp.merged ?? 0}` : ''}</Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </TableFrame>
      )}

      <h2 className="mt-8 border-b border-line pb-2 text-[13px] font-semibold tracking-tight">{s.entries}</h2>
      {monthRows.length === 0 ? (
        <div className="mt-3">
          <EmptyState title={s.entries} description={s.noEntries} />
        </div>
      ) : (
        <TableFrame className="mt-3">
          <Table>
            <thead>
              <tr>
                <Th>{s.colDate}</Th>
                <Th>{s.colVehicle}</Th>
                <Th>{s.colDriver}</Th>
                <Th>{s.colProduct}</Th>
                <Th numeric>{s.colQty}</Th>
                <Th numeric>{s.colAmount}</Th>
                <Th numeric>{s.colOdometer}</Th>
                <Th>{s.colStation}</Th>
                <Th>{s.colSource}</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {monthRows.map((row) => {
                const flag = stats.flags.get(row.id);
                return (
                  <Tr key={row.id}>
                    <Td mono>{f.dateTime(row.filled_at)}</Td>
                    <Td mono>{plates.get(row.vehicle_id) ?? '—'}</Td>
                    <Td>{row.driver_id ? (driverNames.get(row.driver_id) ?? '—') : '—'}</Td>
                    <Td>
                      {t.fuelDriver.products[row.product as keyof typeof t.fuelDriver.products] ?? row.product}
                      {!row.full_tank && <span className="text-ink-faint"> · {s.partial}</span>}
                    </Td>
                    <Td numeric>
                      {f.decimal(row.quantity)} {row.unit}
                    </Td>
                    <Td numeric>{row.amount_cents != null ? f.eur(row.amount_cents) : '—'}</Td>
                    <Td numeric>
                      {row.odometer_km != null ? f.number(row.odometer_km) : '—'}
                      {flag && (
                        <span className="ml-2">
                          <Badge tone="warn">{s.flag[flag]}</Badge>
                        </span>
                      )}
                    </Td>
                    <Td>{row.station ?? ''}</Td>
                    <Td>
                      {s.source[row.source as keyof typeof s.source]}
                      {row.receipt_path && (
                        <>
                          {' · '}
                          <a href={`/api/fuel/receipt/${row.id}`} target="_blank" rel="noreferrer" className="text-accent">
                            {s.receipt}
                          </a>
                        </>
                      )}
                    </Td>
                    <Td>
                      <form action={deleteFuelEntryAction}>
                        <input type="hidden" name="locale" value={locale} />
                        <input type="hidden" name="id" value={row.id} />
                        <button type="submit" className="text-[12px] text-danger hover:underline">
                          {s.delete}
                        </button>
                      </form>
                    </Td>
                  </Tr>
                );
              })}
            </tbody>
          </Table>
        </TableFrame>
      )}
      <p className="mt-2 text-[12px] text-ink-dim">{s.driverHint}</p>
    </main>
  );
}

function nextMonth(month: string): string {
  const [y, m] = month.split('-').map(Number);
  const date = new Date(Date.UTC(y, m, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

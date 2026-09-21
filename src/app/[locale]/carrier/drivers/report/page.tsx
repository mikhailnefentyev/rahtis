import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  Button,
  Card,
  CardBody,
  EmptyState,
  Input,
  Select,
  Table,
  TableFrame,
  Td,
  Th,
  Tr,
  buttonClass,
} from '@/components/ui';
import { requireRole } from '@/lib/auth/guard';
import { payableKm } from '@/lib/driverPay';
import { buildDriverReport } from '@/lib/drivers/report';
import { getI18n, isLocale } from '@/lib/i18n';
import { QUICK_PERIODS, parseRange, quickRange } from '@/lib/reports/periods';
import { createClient } from '@/lib/supabase/server';
import { WorkSummary } from '../WorkSummary';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const { t } = await getI18n(locale);
  return { title: t.workReport.title };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Отчёт по водителям за период.
 *
 * Выбор периода устроен как у отчёта за период — те же быстрые кнопки и
 * тот же адрес с from/to, — чтобы перевозчик не учил второй способ.
 */
export default async function DriverReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ from?: string; to?: string; driver?: string }>;
}) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  if (!isLocale(locale)) notFound();

  await requireRole(locale, 'CARRIER');
  const [{ t, m, f }, supabase] = await Promise.all([getI18n(locale), createClient()]);

  const asked = Boolean(query.from || query.to);
  const range = asked ? parseRange(query.from, query.to) : quickRange('thisMonth');
  const driverId = query.driver && UUID.test(query.driver) ? query.driver : null;

  const [{ data: drivers }, report] = await Promise.all([
    supabase.from('drivers').select('id, full_name').order('full_name'),
    range ? buildDriverReport({ from: range.from, to: range.to, driverId }) : Promise.resolve(null),
  ]);

  const base = `/${locale}/carrier/drivers/report`;
  const href = (from: string, to: string) => {
    const q = new URLSearchParams({ from, to });
    if (driverId) q.set('driver', driverId);
    return `${base}?${q}`;
  };
  const exportHref = (format: string) => {
    const q = new URLSearchParams({ from: range!.from, to: range!.to, format });
    if (driverId) q.set('driver', driverId);
    return `${base}/export?${q}`;
  };
  const hours = (minutes: number) => f.decimal(minutes / 60, 2);

  return (
    <main className="mx-auto w-full max-w-5xl px-5 py-8">
      <Link href={`/${locale}/carrier/drivers`} className="text-[13px] text-ink-faint hover:text-ink">
        ← {t.drivers.back}
      </Link>
      <h1 className="mt-3 text-xl font-semibold tracking-tight">{t.workReport.title}</h1>
      <p className="mt-2 mb-4 max-w-xl text-[13px] leading-relaxed text-ink-muted">
        {t.workReport.subtitle}
      </p>
      <p className="mb-5 rounded-control border border-warn/35 bg-warn/10 px-3 py-2 text-[13px] text-warn">
        {t.pay.disclaimer}
      </p>

      <Card>
        <CardBody className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-1.5">
            {QUICK_PERIODS.map((period) => {
              const r = quickRange(period);
              const on = range && r.from === range.from && r.to === range.to;
              return (
                <Link
                  key={period}
                  href={href(r.from, r.to)}
                  aria-current={on ? 'true' : undefined}
                  className={[
                    'rounded-pill border px-3 py-1 text-xs',
                    on
                      ? 'border-accent font-semibold text-ink'
                      : 'border-line text-ink-muted hover:border-line-strong hover:text-ink',
                  ].join(' ')}
                >
                  {t.periodReport[period]}
                </Link>
              );
            })}
          </div>

          <form method="get" action={base} className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="label-micro">{t.workReport.from}</span>
              <Input type="date" name="from" defaultValue={range?.from ?? query.from} required className="w-40" />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="label-micro">{t.workReport.to}</span>
              <Input type="date" name="to" defaultValue={range?.to ?? query.to} required className="w-40" />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="label-micro">{t.workReport.driver}</span>
              <Select name="driver" defaultValue={driverId ?? ''} className="w-56">
                <option value="">{t.workReport.allDrivers}</option>
                {(drivers ?? []).map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.full_name}
                  </option>
                ))}
              </Select>
            </label>
            <Button type="submit" variant="primary">
              {t.workReport.show}
            </Button>
          </form>

          {!range && (
            <p role="alert" className="text-xs text-danger">
              {t.periodReport.invalid}
            </p>
          )}

          {range && report && (
            <div className="flex flex-wrap items-center gap-2 border-t border-line pt-4">
              <span className="text-[13px] text-ink-muted">
                {m('periodReport.range', {
                  from: f.date(`${range.from}T12:00:00Z`),
                  to: f.date(`${range.to}T12:00:00Z`),
                })}{' '}
                · {t.periodReport.download}:
              </span>
              {(['pdf', 'xlsx', 'csv'] as const).map((format) => (
                <a key={format} href={exportHref(format)} className={buttonClass({ size: 'sm' })}>
                  {t.workReport[format]}
                </a>
              ))}
            </div>
          )}
        </CardBody>
      </Card>

      {report && report.entries.length === 0 && (
        <EmptyState title={t.workReport.empty} className="mt-6" />
      )}

      {report?.entries.map((entry) => (
        <section key={entry.driver.id} className="mt-8">
          <h2 className="mb-3 border-b border-line pb-2 text-[13px] font-semibold tracking-tight">
            <Link href={`/${locale}/carrier/drivers/${entry.driver.id}`} className="hover:underline">
              {entry.driver.full_name}
            </Link>
          </h2>

          <WorkSummary summary={entry.summary} className="mb-4" />

          {entry.summary.days.length > 0 && (
            <TableFrame>
              <Table>
                <thead>
                  <tr>
                    <Th>{t.workReport.colDate}</Th>
                    <Th numeric>{t.workReport.colHours}</Th>
                    <Th numeric>{t.workReport.colEvening}</Th>
                    <Th numeric>{t.workReport.colNight}</Th>
                    <Th numeric>{t.workReport.colOvertime}</Th>
                    <Th numeric>{t.workReport.colKm}</Th>
                    <Th numeric>{t.workReport.colTrips}</Th>
                    <Th>{t.workReport.colModel}</Th>
                    <Th numeric>{t.workReport.colAmount}</Th>
                  </tr>
                </thead>
                <tbody>
                  {entry.summary.days.map((day) => (
                    <Tr key={day.date}>
                      <Td>{f.date(`${day.date}T12:00:00Z`)}</Td>
                      <Td numeric>{hours(day.workMinutes)}</Td>
                      <Td numeric>{hours(day.eveningMinutes)}</Td>
                      <Td numeric>{hours(day.nightMinutes)}</Td>
                      <Td numeric>{hours(day.overtime1Minutes + day.overtime2Minutes)}</Td>
                      <Td numeric>{f.number(payableKm(day))}</Td>
                      <Td numeric>{f.number(day.trips)}</Td>
                      <Td>{day.model ? t.payModel[day.model] : t.workReport.noRate}</Td>
                      <Td numeric>{day.amountCents == null ? '—' : f.eur(day.amountCents)}</Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            </TableFrame>
          )}
        </section>
      ))}
    </main>
  );
}

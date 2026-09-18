import Link from 'next/link';
import {
  Badge,
  Button,
  Card,
  CardBody,
  EmptyState,
  Input,
  Mono,
  Select,
  Table,
  TableFrame,
  Td,
  Th,
  Tr,
  buttonClass,
  claimStatusTone,
} from '@/components/ui';
import { requireRole } from '@/lib/auth/guard';
import { cabinetPath } from '@/lib/auth/paths';
import { getI18n, type Locale } from '@/lib/i18n';
import { buildPeriodReport } from '@/lib/reports/period';
import { summaryRows } from '@/lib/reports/periodExport';
import { QUICK_PERIODS, parseRange, quickRange } from '@/lib/reports/periods';
import { createClient } from '@/lib/supabase/server';
import type { PartyRole } from '@/types/db';

/**
 * Отчёты за период — один раздел на три кабинета.
 *
 * Страница без клиентского кода: период живёт в адресной строке, форма
 * отправляется GET, быстрые периоды — ссылки. Ссылку на «отчёт за
 * третий квартал» можно переслать бухгалтеру, и у него откроется тот
 * же отчёт — своими правами, а не правами отправителя.
 *
 * Предпросмотр и файлы строятся одной функцией (period.ts), поэтому
 * число на экране равно числу в Excel.
 */
export async function PeriodReportCabinet({
  locale,
  role,
  searchParams,
}: {
  locale: Locale;
  role: PartyRole;
  searchParams: { from?: string; to?: string; company?: string };
}) {
  const viewer = await requireRole(locale, role);
  const { t, m, f } = await getI18n(locale);

  const base = `/${locale}/${role === 'ADMIN' ? 'admin' : role === 'CARRIER' ? 'carrier' : 'shipper'}/reports`;
  const asked = searchParams.from || searchParams.to;
  const range = asked ? parseRange(searchParams.from, searchParams.to) : quickRange('thisMonth');
  const company = role === 'ADMIN' ? searchParams.company || null : null;

  const companies =
    role === 'ADMIN'
      ? ((await (await createClient()).from('companies').select('id, name, kind').order('name'))
          .data ?? [])
      : [];

  const built = range
    ? await buildPeriodReport({
        role,
        from: range.from,
        to: range.to,
        country: viewer.company?.country ?? null,
        companyId: company,
      })
    : null;

  const report = built?.report ?? null;

  const query = (format: string) => {
    const q = new URLSearchParams({ from: range!.from, to: range!.to, format });
    if (company) q.set('company', company);
    return `/${locale}/reports/period?${q.toString()}`;
  };

  const quickHref = (period: (typeof QUICK_PERIODS)[number]) => {
    const r = quickRange(period);
    const q = new URLSearchParams(r);
    if (company) q.set('company', company);
    return `${base}?${q.toString()}`;
  };

  return (
    <main className="mx-auto w-full max-w-6xl px-5 py-8">
      <nav className="mb-6">
        <Link
          href={cabinetPath(locale, role)}
          className="text-[13px] text-ink-muted hover:text-ink"
        >
          ← {t.role[role]}
        </Link>
      </nav>

      <h1 className="text-xl font-semibold tracking-tight">{t.periodReport.title}</h1>
      <p className="mt-2 mb-5 max-w-xl text-[13px] leading-relaxed text-ink-muted">
        {t.periodReport.subtitle}
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
                  href={quickHref(period)}
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
              <span className="label-micro">{t.periodReport.from}</span>
              <Input
                type="date"
                name="from"
                defaultValue={range?.from ?? searchParams.from}
                required
                className="w-40"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="label-micro">{t.periodReport.to}</span>
              <Input
                type="date"
                name="to"
                defaultValue={range?.to ?? searchParams.to}
                required
                className="w-40"
              />
            </label>
            {role === 'ADMIN' && (
              <label className="flex flex-col gap-1.5">
                <span className="label-micro">{t.periodReport.company}</span>
                <Select name="company" defaultValue={company ?? ''} className="w-56">
                  <option value="">{t.periodReport.allCompanies}</option>
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} · {t.role[c.kind]}
                    </option>
                  ))}
                </Select>
              </label>
            )}
            <Button type="submit" variant="primary">
              {t.periodReport.show}
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
                <a key={format} href={query(format)} className={buttonClass({ size: 'sm' })}>
                  {t.periodReport[format]}
                </a>
              ))}
            </div>
          )}
        </CardBody>
      </Card>

      {built?.error && (
        <p role="alert" className="mt-4 text-xs text-danger">
          {t.periodReport.invalid}
        </p>
      )}

      {report && (
        <>
          <section className="mt-6">
            <p className="label-micro mb-2.5">{t.periodReport.summary}</p>
            <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-5">
              {summaryRows(report, t).map(([label, value, kind]) => (
                <div key={label} className="rounded-control border border-line bg-sunken px-3 py-2">
                  <p className="text-[11px] text-ink-dim">{label}</p>
                  <p className="mt-0.5 font-mono text-[15px] font-semibold">
                    {kind === 'money' ? f.eur(value) : f.number(value)}
                  </p>
                </div>
              ))}
            </div>
            <p className="mt-2 text-xs text-ink-dim">{t.periodReport.basis}</p>
          </section>

          <section className="mt-6">
            {report.lines.length === 0 ? (
              <EmptyState title={t.periodReport.empty} />
            ) : (
              <TableFrame
                caption={`${t.periodReport.trips} · ${m('periodReport.tripsCount', { count: report.lines.length })}`}
              >
                <div className="overflow-x-auto">
                  <Table>
                    <thead>
                      <tr>
                        <Th>{t.periodReport.colDate}</Th>
                        <Th>{t.periodReport.colRef}</Th>
                        {role !== 'SHIPPER' && <Th>{t.periodReport.colShipper}</Th>}
                        {role === 'ADMIN' && <Th>{t.periodReport.colCarrier}</Th>}
                        <Th>{t.periodReport.colRoute}</Th>
                        <Th>{t.periodReport.colVehicle}</Th>
                        <Th className="text-right">{t.periodReport.colKm}</Th>
                        <Th className="text-right">{t.periodReport.colRate}</Th>
                        {role !== 'SHIPPER' && (
                          <Th className="text-right">{t.periodReport.colCommission}</Th>
                        )}
                        {role !== 'SHIPPER' && (
                          <Th className="text-right">{t.periodReport.colPayout}</Th>
                        )}
                        <Th className="text-right">{t.periodReport.colVat}</Th>
                        <Th className="text-right">{t.periodReport.colGross}</Th>
                        <Th>{t.periodReport.colClaims}</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.lines.map((line) => (
                        <Tr key={line.ref}>
                          <Td>
                            <Mono>{f.date(`${line.closedOn}T12:00:00Z`)}</Mono>
                          </Td>
                          <Td>
                            <Mono>{line.ref}</Mono>
                          </Td>
                          {role !== 'SHIPPER' && <Td>{line.shipper ?? '—'}</Td>}
                          {role === 'ADMIN' && <Td>{line.carrier ?? '—'}</Td>}
                          <Td>{line.route}</Td>
                          <Td>
                            <Mono>{line.vehicle ?? '—'}</Mono>
                          </Td>
                          <Td className="text-right">
                            <Mono>{line.km}</Mono>
                          </Td>
                          <Td className="text-right">
                            <Mono>{f.eur(line.rate)}</Mono>
                          </Td>
                          {role !== 'SHIPPER' && (
                            <Td className="text-right">
                              <Mono>{line.commission != null ? f.eur(line.commission) : '—'}</Mono>
                            </Td>
                          )}
                          {role !== 'SHIPPER' && (
                            <Td className="text-right">
                              <Mono>{line.payout != null ? f.eur(line.payout) : '—'}</Mono>
                            </Td>
                          )}
                          <Td className="text-right">
                            <Mono>{f.eur(line.vat)}</Mono>
                          </Td>
                          <Td className="text-right">
                            <Mono>{f.eur(line.gross)}</Mono>
                          </Td>
                          <Td>
                            <div className="flex flex-wrap gap-1">
                              {line.claims.map((c) => (
                                <Badge key={c.ref} tone={claimStatusTone[c.status]}>
                                  {t.claimStatus[c.status]}
                                </Badge>
                              ))}
                            </div>
                          </Td>
                        </Tr>
                      ))}
                    </tbody>
                  </Table>
                </div>
              </TableFrame>
            )}
          </section>

          <section className="mt-6">
            <p className="label-micro mb-2.5">{t.periodReport.claims}</p>
            {report.claims.length === 0 ? (
              <p className="text-xs text-ink-dim">{t.periodReport.noClaims}</p>
            ) : (
              <ul className="flex flex-col gap-1.5">
                {report.claims.map((c) => (
                  <li key={c.ref} className="flex flex-wrap items-center gap-2 text-[13px]">
                    <Badge tone={claimStatusTone[c.status]}>{t.claimStatus[c.status]}</Badge>
                    <Mono className="text-xs">{c.ref}</Mono>
                    <span>{t.claimKind[c.kind]}</span>
                    <span className="text-ink-dim">
                      {t.claims.author[c.filedByRole]} · {f.date(c.createdAt)}
                      {c.amount != null ? ` · ${f.eur(c.amount)}` : ''}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </main>
  );
}

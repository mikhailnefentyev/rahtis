import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Button, Card, CardBody, Table, TableFrame, Td, Th, Tr } from '@/components/ui';
import { requireRole } from '@/lib/auth/guard';
import { confirmFuelImportAction, deleteFuelImportAction } from '@/lib/fuel/actions';
import type { ImportRow } from '@/lib/fuel/fuel';
import { isLocale } from '@/lib/i18n';
import { getViewerI18n } from '@/lib/i18n/viewer';
import { createClient } from '@/lib/supabase/server';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const { t } = await getViewerI18n(locale);
  return { title: t.fuel.review };
}

/**
 * Проверка месячного отчёта перед сохранением.
 *
 * Каждая строка — галочка «брать» и машина. Машина подставлена, если
 * нашлась по номеру или по запомненной карте; иначе её выбирает
 * перевозчик, а строка без машины не сохраняется. Совпавшие с уже
 * внесёнными заправками строки база сольёт, а не задвоит.
 */
export default async function FuelImportPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  if (!isLocale(locale)) notFound();

  const viewer = await requireRole(locale, 'CARRIER');
  const [{ t, f }, supabase] = await Promise.all([getViewerI18n(locale), createClient()]);
  const s = t.fuel;

  const [{ data: report }, { data: vehicles }] = await Promise.all([
    supabase.from('fuel_imports').select('*').eq('id', id).eq('company_id', viewer.company!.id).maybeSingle(),
    supabase.from('vehicles').select('id, plate').eq('company_id', viewer.company!.id).order('plate'),
  ]);
  if (!report) notFound();

  const rows = (Array.isArray(report.rows) ? report.rows : []) as unknown as ImportRow[];
  const back = `/${locale}/carrier/fuel`;
  const failure = report.error as keyof typeof s.failed | null;

  const discard = (
    <form action={deleteFuelImportAction}>
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="import_id" value={report.id} />
      <Button type="submit" variant="danger">
        {s.discard}
      </Button>
    </form>
  );

  return (
    <main className="cab-page">
      <Link href={back} className="text-[13px] text-accent">
        ‹ {s.title}
      </Link>
      <h1 className="page-title mt-2">{s.review}</h1>
      <p className="mt-2 text-[13px] text-ink-muted">
        {report.file_name}
        {report.supplier ? ` · ${report.supplier}` : ''} · {f.dateTime(report.created_at)}
      </p>

      {report.status === 'FAILED' && (
        <Card className="mt-6 max-w-2xl">
          <CardBody className="flex flex-col gap-3">
            <p className="text-[13px]">{(failure && s.failed[failure]) || s.failed.failed}</p>
            <div>{discard}</div>
          </CardBody>
        </Card>
      )}

      {report.status === 'DONE' && (
        <Card className="mt-6 max-w-2xl">
          <CardBody>
            <p className="text-[13px] text-ok">
              {s.importStatus.DONE}: +{report.inserted ?? 0} / {s.mergedCount} {report.merged ?? 0}
            </p>
          </CardBody>
        </Card>
      )}

      {report.status === 'REVIEW' && (
        <>
          <p className="mt-4 mb-4 max-w-2xl text-[13px] leading-relaxed text-ink-muted">{s.reviewLede}</p>
          <form action={confirmFuelImportAction}>
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="import_id" value={report.id} />
            <TableFrame>
              <Table>
                <thead>
                  <tr>
                    <Th>{s.take}</Th>
                    <Th>{s.colDate}</Th>
                    <Th>{s.colVehicle}</Th>
                    <Th>{s.inReport}</Th>
                    <Th>{s.colProduct}</Th>
                    <Th numeric>{s.colQty}</Th>
                    <Th numeric>{s.colAmount}</Th>
                    <Th numeric>{s.colOdometer}</Th>
                    <Th>{s.colStation}</Th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, index) => (
                    <Tr key={index}>
                      <Td>
                        <input type="checkbox" name={`take_${index}`} value="1" defaultChecked aria-label={s.take} />
                      </Td>
                      <Td mono>
                        {row.date}
                        {row.time ? ` ${row.time}` : ''}
                      </Td>
                      <Td>
                        <select
                          name={`vehicle_${index}`}
                          defaultValue={row.vehicle_id ?? ''}
                          className="h-7 rounded-control border border-line bg-sunken px-1.5 font-mono text-[12px] aria-invalid:border-danger"
                          aria-invalid={row.vehicle_id ? undefined : true}
                        >
                          <option value="">{s.unmatched}</option>
                          {(vehicles ?? []).map((v) => (
                            <option key={v.id} value={v.id}>
                              {v.plate}
                            </option>
                          ))}
                        </select>
                      </Td>
                      <Td mono className="text-ink-muted">
                        {row.plate ?? row.card_ref ?? '—'}
                      </Td>
                      <Td>{t.fuelDriver.products[row.product]}</Td>
                      <Td numeric>
                        {f.decimal(row.quantity, 2)} {row.product === 'LNG' || row.product === 'LBG' || row.product === 'CNG' || row.product === 'CBG' ? 'kg' : 'l'}
                      </Td>
                      <Td numeric>{row.amount_cents != null ? f.eur(row.amount_cents) : '—'}</Td>
                      <Td numeric>{row.odometer_km != null ? f.number(row.odometer_km) : '—'}</Td>
                      <Td>{row.station ?? ''}</Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            </TableFrame>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button type="submit" variant="primary">
                {s.confirm}
              </Button>
            </div>
          </form>
          <div className="mt-3">{discard}</div>
        </>
      )}
    </main>
  );
}

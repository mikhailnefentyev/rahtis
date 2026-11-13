import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Button, Plate, Table, TableFrame, Td, Th, Tr } from '@/components/ui';
import { requireRole } from '@/lib/auth/guard';
import { todayInHelsinki } from '@/lib/dates';
import { isLocale } from '@/lib/i18n';
import { getViewerI18n } from '@/lib/i18n/viewer';
import { deleteMaintenanceRecordAction } from '@/lib/maintenance/actions';
import { loadFleetMaintenance } from '@/lib/maintenance/load';
import { createClient } from '@/lib/supabase/server';
import { DefectCard } from '../DefectCard';
import { DowntimeCard } from '../DowntimeCard';
import { itemLabel } from '../format';
import { AssetActions, PlanItemCard } from './AssetForms';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const { t } = await getViewerI18n(locale);
  return { title: t.maintenance.title };
}

/**
 * Обслуживание одной машины или прицепа: открытые дефекты, план со
 * сроками и отметкой «сделано», разовый ремонт, сервисная книжка и
 * закрытые дефекты.
 */
export default async function AssetMaintenancePage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  if (!isLocale(locale) || !/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const viewer = await requireRole(locale, 'CARRIER');
  const [i18n, supabase] = await Promise.all([getViewerI18n(locale), createClient()]);
  const { t, f } = i18n;
  const s = t.maintenance;

  const [data, { data: records }, { data: access }] = await Promise.all([
    loadFleetMaintenance(supabase, {
      companyId: viewer.company!.id,
      today: todayInHelsinki(),
      trailerKinds: t.mass.kinds,
      assetId: id,
      withClosed: true,
    }),
    supabase
      .from('maintenance_records')
      .select('*')
      .eq('company_id', viewer.company!.id)
      .or(`vehicle_id.eq.${id},trailer_id.eq.${id}`)
      .order('done_on', { ascending: false })
      .limit(200),
    supabase.rpc('own_orders_access'),
  ]);

  const asset = data.assets.find((a) => a.id === id);
  if (!asset) notFound();

  const items = data.items.filter((i) => i.asset.id === id);
  const openDefects = data.defects.filter((d) => d.status === 'OPEN');
  const closedDefects = data.defects.filter((d) => d.status !== 'OPEN');
  const trailer = asset.type === 'TRAILER';
  const downtime = data.downtime.filter((d) => d.vehicle_id === id);

  return (
    <main className="cab-page">
      <Link href={`/${locale}/carrier/maintenance`} className="text-[13px] text-accent hover:underline">
        ← {s.title}
      </Link>
      <div className="mt-3 mb-1 flex flex-wrap items-baseline gap-3">
        <h1 className="page-title">
          <Plate className="text-[22px]">{asset.plate}</Plate>
        </h1>
        <span className="text-[13px] text-ink-muted">{trailer ? `${s.trailer} · ${asset.label}` : asset.label}</span>
      </div>
      <p className="mb-6 text-[13px] text-ink-muted">
        {trailer ? s.trailerNoKm : asset.odometer != null ? `${s.odometerNow}: ${f.number(asset.odometer)} km` : s.odometerUnknown}
      </p>

      {/* Вне работы — самое важное на странице машины: она сейчас не выходит на рейсы. */}
      {downtime.length > 0 && (
        <section className="mb-8 flex flex-col gap-3">
          {downtime.map((d) => (
            <DowntimeCard key={d.id} downtime={d} />
          ))}
        </section>
      )}

      {openDefects.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 border-b border-line pb-2 text-[13px] font-semibold tracking-tight text-ink-faint">{s.defectsTitle}</h2>
          <div className="grid gap-3 lg:grid-cols-2">
            {openDefects.map((defect) => (
              <DefectCard key={defect.id} defect={defect} plate={asset.plate} />
            ))}
          </div>
        </section>
      )}

      <section className="mb-8">
        <h2 className="mb-3 border-b border-line pb-2 text-[13px] font-semibold tracking-tight text-ink-faint">{s.planTitle}</h2>
        {items.length === 0 && <p className="mb-3 text-[13px] text-ink-muted">{s.planEmpty}</p>}
        <div className="flex flex-col gap-3">
          {items.map((item) => (
            <PlanItemCard
              key={item.id}
              item={item}
              trailer={trailer}
              odometer={asset.odometer}
              openDefects={openDefects.map((d) => ({ id: d.id, label: `${s.defects.areas[d.area as keyof typeof s.defects.areas] ?? d.area}: ${d.description.slice(0, 60)}` }))}
              today={data.today}
              costsOpen={!!access}
            />
          ))}
        </div>
      </section>

      <AssetActions
        asset={{ id: asset.id, type: asset.type, odometer: asset.odometer }}
        openDefects={openDefects.map((d) => ({ id: d.id, label: `${s.defects.areas[d.area as keyof typeof s.defects.areas] ?? d.area}: ${d.description.slice(0, 60)}` }))}
        today={data.today}
        costsOpen={!!access}
      />

      <section className="mt-8 mb-8">
        <h2 className="mb-3 border-b border-line pb-2 text-[13px] font-semibold tracking-tight text-ink-faint">{s.history.title}</h2>
        {(records ?? []).length === 0 ? (
          <p className="text-[13px] text-ink-muted">{s.history.empty}</p>
        ) : (
          <TableFrame>
            <Table>
              <thead>
                <tr>
                  <Th>{s.history.date}</Th>
                  <Th>{s.history.work}</Th>
                  {!trailer && <Th className="text-right">km</Th>}
                  <Th>{s.history.workshop}</Th>
                  <Th className="text-right">{s.history.amount}</Th>
                  <Th />
                </tr>
              </thead>
              <tbody>
                {(records ?? []).map((r) => (
                  <Tr key={r.id}>
                    <Td className="whitespace-nowrap">{f.date(`${r.done_on}T12:00:00Z`)}</Td>
                    <Td>
                      <span className="font-semibold">{itemLabel(i18n, r)}</span>
                      {r.note && <span className="block text-[12px] text-ink-muted">{r.note}</span>}
                    </Td>
                    {!trailer && <Td className="text-right font-mono">{r.odometer_km != null ? f.number(r.odometer_km) : '—'}</Td>}
                    <Td>{r.workshop ?? '—'}</Td>
                    <Td className="text-right font-mono">{r.amount_cents != null ? f.money(r.amount_cents, r.currency) : '—'}</Td>
                    <Td className="text-right">
                      <form action={deleteMaintenanceRecordAction}>
                        <input type="hidden" name="locale" value={locale} />
                        <input type="hidden" name="id" value={r.id} />
                        <Button type="submit" size="sm" variant="ghost">
                          {s.history.delete}
                        </Button>
                      </form>
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </TableFrame>
        )}
      </section>

      {closedDefects.length > 0 && (
        <section>
          <h2 className="mb-3 border-b border-line pb-2 text-[13px] font-semibold tracking-tight text-ink-faint">{s.defects.closedTitle}</h2>
          <div className="grid gap-3 lg:grid-cols-2">
            {closedDefects.map((defect) => (
              <DefectCard key={defect.id} defect={defect} plate={asset.plate} />
            ))}
          </div>
        </section>
      )}
    </main>
  );
}

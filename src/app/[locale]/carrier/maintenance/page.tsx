import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Badge, Card, CardBody, EmptyState, Plate, Stat, StatRow, Table, TableFrame, Td, Th, Tr } from '@/components/ui';
import { requireRole } from '@/lib/auth/guard';
import { todayInHelsinki } from '@/lib/dates';
import { isLocale } from '@/lib/i18n';
import { getViewerI18n } from '@/lib/i18n/viewer';
import { loadFleetMaintenance } from '@/lib/maintenance/load';
import { createClient } from '@/lib/supabase/server';
import { DefectCard } from './DefectCard';
import { DowntimeCard } from './DowntimeCard';
import { dueParts, dueTone, itemLabel } from './format';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const { t } = await getViewerI18n(locale);
  return { title: t.maintenance.title };
}

/**
 * Huolto — обслуживание всего парка на одном экране, как «очередь
 * ремонта» у Samsara и Motive: сначала то, что требует действия
 * (открытые дефекты, просроченные и близкие сроки), потом машины и
 * прицепы со значком состояния. Пункты и книжка — на странице машины.
 */
export default async function MaintenancePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const viewer = await requireRole(locale, 'CARRIER');
  const [i18n, supabase] = await Promise.all([getViewerI18n(locale), createClient()]);
  const { t, m, f } = i18n;
  const s = t.maintenance;

  const data = await loadFleetMaintenance(supabase, {
    companyId: viewer.company!.id,
    today: todayInHelsinki(),
    trailerKinds: t.mass.kinds,
  });

  const urgent = data.items.filter((i) => i.status.state === 'OVERDUE' || i.status.state === 'SOON');
  const overdue = urgent.filter((i) => i.status.state === 'OVERDUE').length;
  const unsafe = data.defects.filter((d) => d.severity === 'UNSAFE').length;
  const plateOf = new Map(data.assets.map((a) => [a.id, a.plate]));
  const outNow = new Set(data.downtime.filter((d) => d.current).map((d) => d.vehicle_id ?? d.trailer_id)).size;

  return (
    <main className="cab-page">
      <h1 className="page-title">{s.title}</h1>
      <p className="mt-2 mb-6 max-w-3xl text-[13px] leading-relaxed text-ink-muted">{s.lede}</p>

      <StatRow className="mb-8">
        <Stat label={s.statOverdue} value={overdue} tone={overdue > 0 ? 'danger' : 'neutral'} />
        <Stat label={s.statSoon} value={urgent.length - overdue} tone={urgent.length - overdue > 0 ? 'warn' : 'neutral'} />
        <Stat label={s.statDefects} value={data.defects.length} tone={data.defects.length > 0 ? 'warn' : 'neutral'} />
        <Stat label={s.statOut} value={outNow} tone={outNow > 0 ? 'danger' : 'neutral'} hint={unsafe > 0 ? `${s.statUnsafe}: ${unsafe}` : undefined} />
      </StatRow>

      {data.assets.length === 0 ? (
        <EmptyState
          title={s.noFleet}
          action={
            <Link href={`/${locale}/carrier/fleet`} className="text-accent hover:underline">
              {t.fleet.title} →
            </Link>
          }
        />
      ) : (
        <>
          {/* Машины вне работы — первым: они прямо сейчас не выходят на рейсы. */}
          {data.downtime.length > 0 && (
            <section className="mb-8">
              <h2 className="mb-3 border-b border-line pb-2 text-[13px] font-semibold tracking-tight text-ink-faint">{s.downtime.title}</h2>
              <div className="grid gap-3 lg:grid-cols-2">
                {data.downtime.map((d) => (
                  <DowntimeCard key={d.id} downtime={d} plate={plateOf.get(d.vehicle_id ?? d.trailer_id ?? '') ?? '—'} />
                ))}
              </div>
            </section>
          )}

          <section className="mb-8">
            <h2 className="mb-3 border-b border-line pb-2 text-[13px] font-semibold tracking-tight text-ink-faint">{s.defectsTitle}</h2>
            {data.defects.length === 0 ? (
              <p className="text-[13px] text-ink-muted">{s.defectsEmpty}</p>
            ) : (
              <div className="grid gap-3 lg:grid-cols-2">
                {data.defects.map((defect) => (
                  <DefectCard key={defect.id} defect={defect} plate={plateOf.get(defect.vehicle_id ?? defect.trailer_id ?? '') ?? '—'} showAsset />
                ))}
              </div>
            )}
          </section>

          <section className="mb-8">
            <h2 className="mb-3 border-b border-line pb-2 text-[13px] font-semibold tracking-tight text-ink-faint">{s.dueTitle}</h2>
            {urgent.length === 0 ? (
              <p className="text-[13px] text-ink-muted">{s.dueEmpty}</p>
            ) : (
              <TableFrame>
                <Table>
                  <thead>
                    <tr>
                      <Th>{s.colAsset}</Th>
                      <Th>{s.colItem}</Th>
                      <Th>{s.colDue}</Th>
                      <Th>{s.colState}</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {urgent.map((item) => (
                      <Tr key={item.id}>
                        <Td>
                          <Link href={`/${locale}/carrier/maintenance/${item.asset.id}`} className="hover:underline">
                            <Plate>{item.asset.plate}</Plate>
                          </Link>
                        </Td>
                        <Td>{itemLabel(i18n, item)}</Td>
                        <Td className="text-[13px]">{dueParts(i18n, item, item.status).join(' / ')}</Td>
                        <Td>
                          <Badge tone={dueTone[item.status.state]}>{s.state[item.status.state]}</Badge>
                        </Td>
                      </Tr>
                    ))}
                  </tbody>
                </Table>
              </TableFrame>
            )}
          </section>

          <section>
            <h2 className="mb-3 border-b border-line pb-2 text-[13px] font-semibold tracking-tight text-ink-faint">{s.fleetTitle}</h2>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {[...data.summaries.values()].map(({ asset, state, items, openDefects, unsafe: assetUnsafe, outOfService }) => (
                <Link key={asset.id} href={`/${locale}/carrier/maintenance/${asset.id}`} className="block">
                  <Card stripe={outOfService || assetUnsafe ? 'danger' : state === 'OVERDUE' ? 'danger' : state === 'SOON' || openDefects > 0 ? 'warn' : items > 0 ? 'ok' : undefined}>
                    <CardBody className="flex flex-col gap-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <Plate className="text-[15px]">{asset.plate}</Plate>
                        <span className="text-[12px] text-ink-dim">{asset.type === 'TRAILER' ? s.trailer : asset.label}</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {items === 0 ? (
                          <Badge tone="neutral">{s.noPlan}</Badge>
                        ) : (
                          <Badge tone={dueTone[state]}>{s.state[state]}</Badge>
                        )}
                        {outOfService && <Badge tone="danger">{s.downtime.outNow}</Badge>}
                        {openDefects > 0 && <Badge tone={assetUnsafe ? 'danger' : 'warn'}>{m('maintenance.defectCount', { count: openDefects })}</Badge>}
                      </div>
                      <p className="text-[12px] text-ink-muted">
                        {items > 0 ? m('maintenance.planCount', { count: items }) : s.addPlanHint}
                        {asset.odometer != null && ` · ${f.number(asset.odometer)} km`}
                      </p>
                    </CardBody>
                  </Card>
                </Link>
              ))}
            </div>
          </section>
        </>
      )}
    </main>
  );
}

import { EmptyState, Table, TableFrame, Td, Th, Tr } from '@/components/ui';
import { getI18n, type Locale } from '@/lib/i18n';
import { formatWaitMinutes } from '@/lib/orders/waiting';
import { createClient } from '@/lib/supabase/server';

/**
 * Площадки заказчика и сколько на них обычно стоят.
 *
 * Цифры — по всем рейсам на площадке за 12 месяцев, не только его:
 * так видно, долго ли стоят вообще или только его машины. Меньше трёх
 * рейсов — площадки в списке нет (shipper_sites_waiting).
 */
export async function SiteWaitingTable({ locale }: { locale: Locale }) {
  const [{ t }, supabase] = await Promise.all([getI18n(locale), createClient()]);
  const { data: sites } = await supabase.rpc('shipper_sites_waiting');

  return (
    <section className="mt-10">
      <h2 className="text-[15px] font-semibold tracking-tight">{t.siteWaiting.title}</h2>
      <p className="mt-1 max-w-2xl text-[13px] text-ink-muted">{t.siteWaiting.text}</p>

      <div className="mt-4">
        {(sites ?? []).length === 0 ? (
          <EmptyState title={t.siteWaiting.empty} />
        ) : (
          <TableFrame caption={t.siteWaiting.caption}>
            <div className="overflow-x-auto">
              <Table>
                <thead>
                  <tr>
                    <Th>{t.siteWaiting.colPlace}</Th>
                    <Th className="text-right">{t.siteWaiting.colMedian}</Th>
                    <Th className="text-right">{t.siteWaiting.colOverHour}</Th>
                    <Th className="text-right">{t.siteWaiting.colTrips}</Th>
                  </tr>
                </thead>
                <tbody>
                  {(sites ?? []).map((site) => (
                    <Tr key={`${site.city}|${site.address}`}>
                      <Td>
                        <span className="font-medium">{site.place_name || site.address}</span>
                        <span className="block text-xs text-ink-dim">
                          {site.place_name ? `${site.address} · ` : ''}
                          {site.city}
                        </span>
                      </Td>
                      <Td className="text-right font-mono">{formatWaitMinutes(site.median_minutes)}</Td>
                      <Td className="text-right font-mono">{site.over_hour_pct} %</Td>
                      <Td className="text-right font-mono">
                        {site.my_stops} / {site.samples}
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            </div>
          </TableFrame>
        )}
      </div>
    </section>
  );
}

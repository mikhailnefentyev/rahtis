import Link from 'next/link';
import { Badge, Card, CardBody, Plate, buttonClass } from '@/components/ui';
import { RADII, type Radius } from '@/lib/backhaul/radius';
import type { I18n } from '@/lib/i18n';
import type { Database } from '@/types/database';

export type BackhaulRow = Database['public']['Functions']['backhaul_suggestions']['Returns'][number];

/**
 * «Paluukuorma» — компактный блок над столом.
 *
 * По строке на машину: где и когда она освободится и сколько заказов
 * стола рядом; под ней до пяти лучших, ближайшие и «к дому» первыми.
 * Всё считает база (backhaul_suggestions) из того, что перевозчику и так
 * открыто на столе; здесь только вывод. Карточка заказа — ниже, на
 * столе: ссылка ведёт к ней, откликаются там же.
 */
export function BackhaulBlock({
  rows,
  radius,
  region,
  i18n,
  locale,
  currencyByOrder = {},
}: {
  rows: BackhaulRow[];
  /** Валюта цены по id заказа; нет — евро (стол RAHTIS). */
  currencyByOrder?: Record<string, string>;
  radius: Radius;
  region: string | undefined;
  i18n: I18n;
  locale: string;
}) {
  const { t, m, f } = i18n;
  const b = t.backhaul;

  const vehicles = new Map<string, { head: BackhaulRow; items: BackhaulRow[] }>();
  for (const row of rows) {
    const entry = vehicles.get(row.vehicle_id) ?? { head: row, items: [] };
    if (row.order_id) entry.items.push(row);
    vehicles.set(row.vehicle_id, entry);
  }

  const href = (r: number) => {
    const q = new URLSearchParams();
    if (region) q.set('region', region);
    q.set('r', String(r));
    return `/${locale}/carrier/desk?${q.toString()}#paluukuorma`;
  };

  return (
    <Card id="paluukuorma" stripe="ok" className="mb-6 scroll-mt-24">
      <CardBody className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-[15px] font-semibold tracking-tight">{b.title}</h2>
            <p className="mt-0.5 max-w-xl text-[12.5px] leading-relaxed text-ink-muted">
              {m('backhaul.hint', { km: radius })}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="label-micro mr-1">{b.radius}</span>
            {RADII.map((r) => (
              <Link
                key={r}
                href={href(r)}
                aria-current={r === radius ? 'true' : undefined}
                className={buttonClass({ variant: r === radius ? 'primary' : 'default', size: 'sm' })}
              >
                {r} km
              </Link>
            ))}
            <Link href={`/${locale}/carrier/desk/watch`} className={buttonClass({ variant: 'default', size: 'sm' })}>
              {b.watchTitle}
            </Link>
          </div>
        </div>

        {vehicles.size === 0 ? (
          <p className="text-[13px] text-ink-muted">{b.noVehicles}</p>
        ) : (
          <ul className="flex flex-col divide-y divide-line">
            {[...vehicles.values()].map(({ head, items }) => (
              <li key={head.vehicle_id} className="py-3 first:pt-0 last:pb-0">
                <p className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1 text-[13px]">
                  <Plate>{head.plate}</Plate>
                  <span className="text-ink">
                    {head.free_source === 'GPS'
                      ? m('backhaul.freeNow', { count: head.total_count })
                      : m('backhaul.freeAt', {
                          city: head.free_city ?? '—',
                          date: f.date(head.free_date),
                          time: (head.free_time ?? '').slice(0, 5),
                          count: head.total_count,
                        })}
                  </span>
                  {head.after_ref && <span className="font-mono text-[12px] text-ink-faint">{head.after_ref}</span>}
                </p>

                {items.length > 0 && (
                  <ul className="mt-2 flex flex-col gap-1.5">
                    {items.map((item) => (
                      <li key={item.order_id} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px]">
                        <Link
                          href={`#desk-${item.order_id}`}
                          className="font-mono font-semibold text-ink underline decoration-line underline-offset-2 hover:decoration-ink"
                        >
                          {item.ref}
                        </Link>
                        <span className="text-ink">
                          {item.pickup_city} → {item.finish_city}
                        </span>
                        {item.pickup_date && (
                          <span className="text-ink-muted">
                            {[f.date(item.pickup_date), item.pickup_time?.slice(0, 5)].filter(Boolean).join(' · ')}
                          </span>
                        )}
                        <span className="text-ink-muted">{m('backhaul.deadhead', { km: item.deadhead_km ?? 0 })}</span>
                        {item.rate_cents ? (
                          <span className="font-semibold text-ink">
                            {f.money(item.rate_cents, currencyByOrder[item.order_id] ?? 'EUR')}
                          </span>
                        ) : null}
                        {item.toward_home && <Badge tone="ok">{b.towardHome}</Badge>}
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}

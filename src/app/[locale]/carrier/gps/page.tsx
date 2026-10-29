import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Badge, Button, Card, CardBody, EmptyState, Table, TableFrame, Td, Th, Tr } from '@/components/ui';
import { requireRole } from '@/lib/auth/guard';
import { deleteGpsConnectionAction, refreshGpsAction } from '@/lib/gps/actions';
import { GPS_REFRESH_MS, syncGpsConnection } from '@/lib/gps/sync';
import { isLocale } from '@/lib/i18n';
import { getViewerI18n } from '@/lib/i18n/viewer';
import { createClient } from '@/lib/supabase/server';
import { PROVIDER_CATALOG } from '@/lib/gps/catalog';
import type { GpsProvider } from '@/lib/gps/types';
import { ConnectGps } from './ConnectGps';
import { FleetMap, type FleetPoint } from './FleetMap';
import { UnitVehicleSelect } from './UnitVehicleSelect';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const { t } = await getViewerI18n(locale);
  return { title: t.gps.title };
}

export const maxDuration = 60;

/* Точка свежее 15 минут — машина на связи. */
const FRESH_MS = 15 * 60_000;

/* Серверный компонент: «сейчас» — момент запроса. */
function requestTime(): number {
  return Date.now();
}

/**
 * GPS-seuranta: парк перевозчика на карте из его собственной системы
 * слежения (Wialon, Mapon, Navirec, Ruptela, Navixy, Samsara): точка,
 * состояние «едет / стоит» и с какого времени, топливо, пробег, водитель.
 *
 * Точки обновляются при открытии страницы (не чаще раза в минуту на
 * подключение) и дальше раз в минуту, пока страница открыта. Хранится
 * только последняя точка — истории перемещений нет (PRIVACY 2.18).
 */
export default async function GpsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const viewer = await requireRole(locale, 'CARRIER');
  const company = viewer.company!;
  const [{ t, f }, supabase] = await Promise.all([getViewerI18n(locale), createClient()]);
  const s = t.gps;

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

  const { data: before } = await supabase
    .from('gps_connections')
    .select('id, last_sync_at')
    .eq('company_id', company.id);
  const due = (before ?? []).filter((c) => !c.last_sync_at || requestTime() - Date.parse(c.last_sync_at) > GPS_REFRESH_MS);
  if (due.length) await Promise.all(due.map((c) => syncGpsConnection(c.id, company.id)));

  const [{ data: connections }, { data: units }, { data: vehicles }] = await Promise.all([
    supabase
      .from('gps_connections')
      .select('id, provider, label, api_host, status, account_name, last_sync_at, last_error, unit_count')
      .eq('company_id', company.id)
      .order('created_at'),
    supabase
      .from('gps_units')
      .select('id, connection_id, name, plate, vehicle_id, lat, lon, speed_kmh, position_at, odometer_km, engine_hours, ignition, fuel_level_pct, fuel_level_l, tank_l, state, state_since, driver, address')
      .eq('company_id', company.id)
      .order('name'),
    supabase.from('vehicles').select('id, plate').eq('company_id', company.id).order('plate'),
  ]);

  const plateOf = new Map((vehicles ?? []).map((v) => [v.id, v.plate]));
  const now = requestTime();
  const rows = (units ?? []).map((u) => {
    const at = u.position_at ? Date.parse(u.position_at) : null;
    return {
      ...u,
      label: (u.vehicle_id && plateOf.get(u.vehicle_id)) || u.plate || u.name,
      fresh: at != null && now - at < FRESH_MS,
      at,
    };
  });

  const stateText = (r: (typeof rows)[number]) =>
    r.state ? `${s.states[r.state as keyof typeof s.states] ?? r.state}${r.state_since ? ` · ${s.since.replace('{time}', f.dateTime(r.state_since))}` : ''}` : null;
  const fuelText = (r: (typeof rows)[number]) => {
    if (r.fuel_level_l != null) return `${f.decimal(Number(r.fuel_level_l))} l${r.tank_l ? ` / ${f.number(Number(r.tank_l))} l` : ''}`;
    if (r.fuel_level_pct != null) return `${f.decimal(Number(r.fuel_level_pct))} %`;
    return null;
  };

  const points: FleetPoint[] = rows
    .filter((r) => r.lat != null && r.lon != null)
    .map((r) => ({
      id: r.id,
      label: r.label,
      lat: r.lat!,
      lon: r.lon!,
      fresh: r.fresh,
      detail: [r.at ? f.dateTime(r.at) : null, r.speed_kmh != null ? `${r.speed_kmh} km/h` : null, stateText(r), fuelText(r)]
        .filter(Boolean)
        .join(' · '),
    }));

  const hasConnections = (connections ?? []).length > 0;
  const errorText = (kind: string | null) =>
    kind === 'KEY' ? s.errKey : kind === 'INPUT' ? s.errInput : s.errUnreachable;

  return (
    <main className="cab-page">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="page-title">{s.title}</h1>
          <p className="mt-2 max-w-3xl text-[13px] leading-relaxed text-ink-muted">{s.lede}</p>
        </div>
        {hasConnections && (
          <form action={refreshGpsAction}>
            <input type="hidden" name="locale" value={locale} />
            <Button type="submit">{s.refresh}</Button>
          </form>
        )}
      </div>

      {hasConnections && (
        <section className="mt-6">
          {points.length > 0 ? (
            <FleetMap points={points} autoRefresh />
          ) : (
            <EmptyState title={s.noPositions} />
          )}
          <p className="mt-2 text-[12px] text-ink-muted">
            {s.legend} · {s.freshCount.replace('{n}', String(rows.filter((r) => r.fresh).length)).replace('{total}', String(rows.length))}
          </p>
        </section>
      )}

      {rows.length > 0 && (
        <TableFrame caption={s.unitsTitle} className="mt-6">
          <Table>
            <thead>
              <Tr>
                <Th>{s.colUnit}</Th>
                <Th>{s.colVehicle}</Th>
                <Th>{s.colSeen}</Th>
                <Th>{s.colState}</Th>
                <Th numeric>{s.colFuel}</Th>
                <Th numeric>{s.colOdometer}</Th>
                <Th>{s.colDriver}</Th>
              </Tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <Tr key={r.id}>
                  <Td>
                    <span className="font-medium">{r.name}</span>
                    {r.plate && r.plate !== r.name && <span className="ml-2 font-mono text-[12px] text-ink-muted">{r.plate}</span>}
                  </Td>
                  <Td>
                    <UnitVehicleSelect unitId={r.id} vehicleId={r.vehicle_id} vehicles={vehicles ?? []} />
                  </Td>
                  <Td>
                    {r.at ? (
                      <Badge tone={r.fresh ? 'ok' : 'neutral'}>{f.dateTime(r.at)}</Badge>
                    ) : (
                      <span className="text-ink-muted">{s.noSignal}</span>
                    )}
                  </Td>
                  <Td className="whitespace-normal">
                    {stateText(r) ?? '—'}
                    {r.speed_kmh != null && r.speed_kmh > 0 && <span className="block text-[11px] text-ink-dim">{r.speed_kmh} km/h</span>}
                    {r.address && <span className="block max-w-[220px] text-[11px] text-ink-dim">{r.address}</span>}
                  </Td>
                  <Td numeric>{fuelText(r) ?? '—'}</Td>
                  <Td numeric>
                    {r.odometer_km != null ? `${f.number(r.odometer_km)} km` : '—'}
                    {r.engine_hours != null && <span className="block text-[11px] text-ink-dim">{f.decimal(Number(r.engine_hours))} h</span>}
                  </Td>
                  <Td className="whitespace-normal">{r.driver ?? '—'}</Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </TableFrame>
      )}

      <section className="mt-6 flex max-w-3xl flex-col gap-3">
        {(connections ?? []).map((c) => (
          <Card key={c.id}>
            <CardBody>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="text-[13px]">
                  <p className="font-semibold">
                    {PROVIDER_CATALOG[c.provider as GpsProvider]?.name ?? c.provider} · {c.label || c.account_name || c.api_host}
                  </p>
                  <p className="mt-1 text-ink-muted">
                    {c.api_host} · {s.unitsCount.replace('{n}', String(c.unit_count))}
                    {c.last_sync_at ? ` · ${s.synced} ${f.dateTime(c.last_sync_at)}` : ''}
                  </p>
                  {c.status === 'ERROR' && <p className="mt-1 text-xs text-danger">{errorText(c.last_error)}</p>}
                </div>
                <form action={deleteGpsConnectionAction}>
                  <input type="hidden" name="locale" value={locale} />
                  <input type="hidden" name="id" value={c.id} />
                  <Button type="submit" variant="ghost">
                    {s.disconnect}
                  </Button>
                </form>
              </div>
            </CardBody>
          </Card>
        ))}
        <ConnectGps startOpen={!hasConnections} />
      </section>
    </main>
  );
}

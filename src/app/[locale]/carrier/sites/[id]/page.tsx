import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Badge, Button, Card, CardBody, EmptyState } from '@/components/ui';
import { requireRole } from '@/lib/auth/guard';
import { siteUrl } from '@/lib/config';
import { combinationMass, isMassCountry } from '@/lib/fleet/mass';
import { isLocale } from '@/lib/i18n';
import { getViewerI18n } from '@/lib/i18n/viewer';
import { dayEnd, dayMinutes, hoursLabel, siteAmountCents } from '@/lib/sites/work';
import { createClient } from '@/lib/supabase/server';
import { carrierApproveDayAction } from '@/lib/sites/actions';
import { JobControls } from './JobControls';

export async function generateMetadata({ params }: { params: Promise<{ locale: string; id: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const { t } = await getViewerI18n(locale);
  return { title: t.sites.title };
}

const tonnes = (kg: number) => (kg / 1000).toLocaleString('fi-FI', { maximumFractionDigits: 1 });

/**
 * Объект: дни водителей (прибытие, конец, часы, рейсы, тонны,
 * подтверждение прораба), рейсы с весами и документом на перевозку,
 * итог и сумма по выбранной оплате.
 */
export default async function SiteJobPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  if (!isLocale(locale)) notFound();

  const viewer = await requireRole(locale, 'CARRIER');
  const company = viewer.company!;
  const [{ t, f }, supabase] = await Promise.all([getViewerI18n(locale), createClient()]);
  const s = t.sites;

  const { data: job } = await supabase.from('site_jobs').select('*').eq('id', id).eq('company_id', company.id).maybeSingle();
  if (!job) notFound();

  const [{ data: days }, { data: loads }, { data: scaleSites }, { data: drivers }, { data: vehicles }, { data: trailers }] = await Promise.all([
    supabase.from('site_days').select('*').eq('job_id', job.id).order('day', { ascending: false }),
    supabase.from('site_loads').select('*').eq('job_id', job.id).order('unloaded_at', { ascending: true }),
    supabase.from('scale_sites').select('id, name, city').order('name'),
    supabase.from('drivers').select('id, full_name').eq('company_id', company.id),
    supabase.from('vehicles').select('id, plate, vehicle_class, axles, gross_max_kg').eq('company_id', company.id),
    supabase.from('trailers').select('id, plate, kind, axles, twin_wheels, gross_max_kg').eq('company_id', company.id),
  ]);

  const driverName = new Map((drivers ?? []).map((d) => [d.id, d.full_name]));
  const vehicleById = new Map((vehicles ?? []).map((v) => [v.id, v]));
  const trailerById = new Map((trailers ?? []).map((tr) => [tr.id, tr]));
  const siteName = new Map((scaleSites ?? []).map((x) => [x.id, x.name]));
  const country = isMassCountry(company.country) ? company.country : 'FI';

  const loadsByDay = new Map<string, NonNullable<typeof loads>>();
  for (const load of loads ?? []) {
    const list = loadsByDay.get(load.day_id) ?? [];
    list.push(load);
    loadsByDay.set(load.day_id, list);
  }

  const rows = (days ?? []).map((day) => {
    const dayLoads = loadsByDay.get(day.id) ?? [];
    const times = { arrivedAt: day.arrived_at, endedAt: day.ended_at, bufferMinutes: day.buffer_minutes, unloads: dayLoads.map((l) => l.unloaded_at) };
    const vehicle = day.vehicle_id ? vehicleById.get(day.vehicle_id) : undefined;
    const trailer = day.trailer_id ? trailerById.get(day.trailer_id) : undefined;
    const limitKg = vehicle
      ? combinationMass(
          country,
          { kind: vehicle.vehicle_class === 'TRACTOR' ? 'TRACTOR' : 'TRUCK', axles: vehicle.axles, grossMaxKg: vehicle.gross_max_kg },
          trailer ? [{ kind: trailer.kind, axles: trailer.axles, twinWheels: trailer.twin_wheels, grossMaxKg: trailer.gross_max_kg }] : [],
        ).limitKg
      : null;
    return {
      day,
      loads: dayLoads,
      end: dayEnd(times),
      minutes: dayMinutes(times),
      netKg: dayLoads.reduce((sum, l) => sum + (l.net_kg ?? 0), 0),
      plate: [vehicle?.plate, trailer?.plate].filter(Boolean).join(' + '),
      limitKg,
    };
  });

  const totals = rows.reduce(
    (acc, r) => ({ minutes: acc.minutes + (r.minutes ?? 0), loads: acc.loads + r.loads.length, netKg: acc.netKg + r.netKg }),
    { minutes: 0, loads: 0, netKg: 0 },
  );
  const amount = siteAmountCents(job.pricing, job.rate_cents, totals);

  return (
    <main className="cab-page">
      <Link href={`/${locale}/carrier/sites`} className="text-[13px] text-ink-muted hover:text-ink">
        ← {s.back}
      </Link>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <h1 className="page-title">{job.name}</h1>
        <Badge tone={job.status === 'ACTIVE' ? 'ok' : 'neutral'}>{job.status === 'ACTIVE' ? s.active : s.closed}</Badge>
      </div>
      <p className="mt-1 mb-6 text-[13px] text-ink-muted">
        {job.customer_name}
        {job.address ? ` · ${job.address}` : ''} · {s.pricingOptions[job.pricing]} {f.eur(job.rate_cents)} ·{' '}
        {t.siteWork.materials[job.material_code as keyof typeof t.siteWork.materials] ?? job.material_code}
      </p>

      <JobControls job={job} scaleSites={scaleSites ?? []} foremanUrl={`${siteUrl()}/${locale}/site/${job.foreman_token}`} />

      <Card className="mb-8">
        <CardBody className="flex flex-wrap gap-x-8 gap-y-2 text-[13px]">
          <span>
            {s.colHours}: <span className="font-mono font-semibold">{hoursLabel(totals.minutes)}</span>
          </span>
          <span>
            {s.colLoads}: <span className="font-mono font-semibold">{totals.loads}</span>
          </span>
          <span>
            {s.colTonnes}: <span className="font-mono font-semibold">{tonnes(totals.netKg)}</span>
          </span>
          <span>
            {s.amount}: <span className="font-mono font-semibold">{f.eur(amount)}</span>
          </span>
        </CardBody>
      </Card>

      <h2 className="mb-3 border-b border-line pb-2 text-[13px] font-semibold tracking-tight text-ink-faint">{s.days}</h2>
      {rows.length === 0 ? (
        <EmptyState title={s.days} description={s.noDays} />
      ) : (
        <div className="flex flex-col gap-4">
          {rows.map((r) => (
            <Card key={r.day.id}>
              <CardBody className="flex flex-col gap-3">
                <div className="flex flex-wrap items-center justify-between gap-2 text-[13px]">
                  <span className="font-semibold">
                    {f.date(`${r.day.day}T12:00:00Z`)} · {driverName.get(r.day.driver_id) ?? '—'}
                    {r.plate && <span className="font-mono font-normal text-ink-muted"> · {r.plate}</span>}
                  </span>
                  {r.day.approved_at ? (
                    <Badge tone="ok">
                      {s.approvedBy} {r.day.approved_by}
                    </Badge>
                  ) : (
                    <Badge tone="warn">{s.notApproved}</Badge>
                  )}
                </div>
                <p className="text-[13px]">
                  {s.colArrived} <span className="font-mono">{f.time(r.day.arrived_at)}</span> · {s.colEnd}{' '}
                  <span className="font-mono">{r.end ? f.time(r.end) : s.open}</span> · {s.colHours}{' '}
                  <span className="font-mono font-semibold">{r.minutes != null ? hoursLabel(r.minutes) : '—'}</span> · {s.colLoads}{' '}
                  <span className="font-mono">{r.loads.length}</span> · {s.colTonnes} <span className="font-mono">{tonnes(r.netKg)}</span>
                </p>
                {r.day.approval_note && <p className="text-[13px] text-ink-muted">“{r.day.approval_note}”</p>}
                {!r.day.approved_at && (
                  <form action={carrierApproveDayAction} className="flex flex-wrap items-center gap-3">
                    <input type="hidden" name="locale" value={locale} />
                    <input type="hidden" name="day_id" value={r.day.id} />
                    <Button type="submit" size="sm">
                      {s.approveSelf}
                    </Button>
                    <span className="text-xs text-ink-dim">{s.approveSelfHint}</span>
                  </form>
                )}
                {r.loads.length > 0 && (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[620px] text-[13px]">
                      <thead className="text-left text-xs text-ink-faint">
                        <tr>
                          <th className="py-1 pr-3 font-medium">{s.colTime}</th>
                          <th className="py-1 pr-3 font-medium">{s.colMaterial}</th>
                          <th className="py-1 pr-3 font-medium">{s.colScale}</th>
                          <th className="py-1 pr-3 font-medium">{s.colGross}</th>
                          <th className="py-1 pr-3 font-medium">{s.colTare}</th>
                          <th className="py-1 pr-3 font-medium">{s.colNet}</th>
                          <th className="py-1 pr-3 font-medium">{s.colTicket}</th>
                          <th className="py-1 font-medium" />
                        </tr>
                      </thead>
                      <tbody>
                        {r.loads.map((l) => {
                          const over = r.limitKg && l.gross_kg && l.gross_kg > r.limitKg ? l.gross_kg - r.limitKg : 0;
                          return (
                            <tr key={l.id} className="border-t border-line">
                              <td className="py-1 pr-3 font-mono">{f.time(l.unloaded_at)}</td>
                              <td className="py-1 pr-3">{t.siteWork.materials[l.material_code as keyof typeof t.siteWork.materials] ?? l.material_code}</td>
                              <td className="py-1 pr-3">{l.scale_site_id ? siteName.get(l.scale_site_id) ?? '—' : '—'}</td>
                              <td className="py-1 pr-3 font-mono">
                                {l.gross_kg ? tonnes(l.gross_kg) : '—'}
                                {over > 0 && <span className="ml-1 text-danger">({s.overload} {over} kg)</span>}
                              </td>
                              <td className="py-1 pr-3 font-mono">{l.tare_kg ? tonnes(l.tare_kg) : '—'}</td>
                              <td className="py-1 pr-3 font-mono font-semibold">{l.net_kg != null ? tonnes(l.net_kg) : '—'}</td>
                              <td className="py-1 pr-3 font-mono">{l.ticket_no ?? '—'}</td>
                              <td className="py-1">
                                {/^\d{6}$/.test(l.material_code) && (
                                  <Link className="text-accent underline" href={`/${locale}/carrier/sites/${job.id}/load/${l.id}`}>
                                    {s.transferDoc}
                                  </Link>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardBody>
            </Card>
          ))}
        </div>
      )}
    </main>
  );
}

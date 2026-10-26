import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getI18n, isLocale } from '@/lib/i18n';
import { dayEnd, dayMinutes, hoursLabel } from '@/lib/sites/work';
import { createClient } from '@/lib/supabase/server';
import { ApproveDay } from './ApproveDay';

export const metadata: Metadata = { title: 'RAHTIS', robots: { index: false, follow: false } };

type ForemanView = {
  job: { name: string; address: string | null; customer_name: string; carrier: string; pricing: string; material_code: string };
  days: {
    id: string;
    day: string;
    arrived_at: string;
    ended_at: string | null;
    buffer_minutes: number;
    approved_at: string | null;
    approved_by: string | null;
    driver: string;
    plate: string | null;
    trailer_plate: string | null;
    loads: { material_code: string; net_kg: number | null; unloaded_at: string; ticket_no: string | null; scale_site: string | null }[];
  }[];
};

const tonnes = (kg: number) => (kg / 1000).toLocaleString('fi-FI', { maximumFractionDigits: 1 });

/**
 * Страница прораба: дни водителей на объекте, рейсы и часы, кнопка
 * «подтвердить день». Без учётной записи — по ссылке с токеном объекта.
 * Ставок и сумм здесь нет: это дело перевозчика и бухгалтерии заказчика.
 */
export default async function ForemanPage({ params }: { params: Promise<{ locale: string; token: string }> }) {
  const { locale, token } = await params;
  if (!isLocale(locale) || !/^[0-9a-f-]{36}$/i.test(token)) notFound();

  const [{ t, f }, supabase] = await Promise.all([getI18n(locale), createClient()]);
  const { data } = await supabase.rpc('site_foreman_view', { p_token: token });
  const view = data as unknown as ForemanView | null;
  const s = t.sites;

  if (!view) {
    return (
      <main className="mx-auto w-full max-w-3xl px-5 py-10">
        <p className="text-[15px] text-ink-muted">{s.notFound}</p>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-8">
      <p className="text-[12px] text-ink-faint">RAHTIS · {view.job.carrier}</p>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight">{view.job.name}</h1>
      <p className="mt-1 text-[13px] text-ink-muted">
        {view.job.customer_name}
        {view.job.address ? ` · ${view.job.address}` : ''}
      </p>
      <p className="mt-4 mb-6 text-[13px] text-ink-muted">{s.foremanLede}</p>

      {view.days.length === 0 ? (
        <p className="text-[14px] text-ink-muted">{s.noDays}</p>
      ) : (
        <div className="flex flex-col gap-4">
          {view.days.map((day) => {
            const times = { arrivedAt: day.arrived_at, endedAt: day.ended_at, bufferMinutes: day.buffer_minutes, unloads: day.loads.map((l) => l.unloaded_at) };
            const end = dayEnd(times);
            const minutes = dayMinutes(times);
            const net = day.loads.reduce((sum, l) => sum + (l.net_kg ?? 0), 0);
            return (
              <section key={day.id} className="rounded-card border border-line bg-surface p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h2 className="text-[15px] font-semibold">
                    {f.date(`${day.day}T12:00:00Z`)} · {day.driver}
                    <span className="font-mono text-[13px] font-normal text-ink-muted">
                      {day.plate ? ` · ${day.plate}` : ''}
                      {day.trailer_plate ? ` + ${day.trailer_plate}` : ''}
                    </span>
                  </h2>
                </div>
                <p className="mt-1 text-[13px]">
                  {s.colArrived} <span className="font-mono">{f.time(day.arrived_at)}</span> · {s.colEnd}{' '}
                  <span className="font-mono">{end ? f.time(end) : s.open}</span> · {s.colHours}{' '}
                  <span className="font-mono font-semibold">{minutes != null ? hoursLabel(minutes) : '—'}</span> · {s.colLoads}{' '}
                  <span className="font-mono">{day.loads.length}</span> · {s.colTonnes} <span className="font-mono">{tonnes(net)}</span>
                </p>
                {day.loads.length > 0 && (
                  <ul className="mt-2 divide-y divide-line border-t border-line text-[13px]">
                    {day.loads.map((l, i) => (
                      <li key={i} className="flex flex-wrap justify-between gap-2 py-1.5">
                        <span>
                          <span className="font-mono">{f.time(l.unloaded_at)}</span> ·{' '}
                          {t.siteWork.materials[l.material_code as keyof typeof t.siteWork.materials] ?? l.material_code}
                          {l.scale_site ? ` · ${l.scale_site}` : ''}
                        </span>
                        <span className="font-mono">
                          {l.net_kg != null ? `${tonnes(l.net_kg)} t` : '—'}
                          {l.ticket_no ? ` · #${l.ticket_no}` : ''}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="mt-3">
                  {day.approved_at ? (
                    <p className="text-[13px] text-ok">
                      {s.approvedBy} {day.approved_by} · {f.dateTime(day.approved_at)}
                    </p>
                  ) : (
                    <ApproveDay token={token} dayId={day.id} />
                  )}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </main>
  );
}

import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Badge, Mono } from '@/components/ui';
import { requireRole } from '@/lib/auth/guard';
import { buildDriverReport } from '@/lib/drivers/report';
import { getI18n, isLocale } from '@/lib/i18n';
import { helsinkiToday } from '@/lib/reports/periods';
import { createClient } from '@/lib/supabase/server';
import { PayProfilePanel } from './PayProfilePanel';
import { ShiftsPanel } from './ShiftsPanel';
import { WorkSummary } from '../WorkSummary';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const { t } = await getI18n(locale);
  return { title: t.drivers.open };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Месяц из адреса («2026-09») или текущий по Хельсинки. */
function monthRange(month: string | undefined): { month: string; from: string; to: string } {
  const value = month && /^\d{4}-\d{2}$/.test(month) ? month : helsinkiToday().slice(0, 7);
  const [y, m] = value.split('-').map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { month: value, from: `${value}-01`, to: `${value}-${String(last).padStart(2, '0')}` };
}

export default async function DriverPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; id: string }>;
  searchParams: Promise<{ month?: string }>;
}) {
  const [{ locale, id }, { month: monthParam }] = await Promise.all([params, searchParams]);
  if (!isLocale(locale) || !UUID.test(id)) notFound();

  const viewer = await requireRole(locale, 'CARRIER');
  const company = viewer.company!;

  const [{ t, f }, supabase] = await Promise.all([getI18n(locale), createClient()]);
  const period = monthRange(monthParam);

  const since = new Date(`${period.from}T00:00:00Z`);
  since.setUTCDate(since.getUTCDate() - 1);

  const [
    { data: driver },
    { data: profiles },
    { data: sets },
    { data: vehicles },
    { data: shifts },
    report,
    { data: rates },
  ] = await Promise.all([
      supabase.from('drivers').select('*').eq('id', id).maybeSingle(),
      supabase
        .from('driver_pay_profiles')
        .select('*')
        .eq('driver_id', id)
        .order('valid_from', { ascending: false }),
      supabase.from('tes_rule_sets').select('id, name, valid_from, company_id').order('valid_from', {
        ascending: false,
      }),
      supabase.from('vehicles').select('id, plate').eq('company_id', company.id).order('plate'),
      supabase
        .from('driver_shifts')
        .select('*, driver_breaks(started_at, ended_at)')
        .eq('driver_id', id)
        .gte('started_at', since.toISOString())
        .lte('started_at', `${period.to}T23:59:59Z`)
        .order('started_at', { ascending: false }),
      buildDriverReport({ from: period.from, to: period.to, driverId: id }),
      /* Категории таблиц ставок — для выбора в модели оплаты; одна строка на категорию. */
      supabase.from('tes_wage_rates').select('rule_set_id, grade, label, sort').order('sort'),
    ]);

  const grades = [
    ...new Map((rates ?? []).map((r) => [`${r.rule_set_id}:${r.grade}`, r])).values(),
  ];

  if (!driver || driver.company_id !== company.id) notFound();

  const entry = report.entries[0] ?? null;
  const plates = new Map((vehicles ?? []).map((v) => [v.id, v.plate]));

  /* Соседние месяцы — ссылками: отчёт за произвольный период живёт на странице отчёта. */
  const shiftMonth = (delta: number) => {
    const [y, mo] = period.month.split('-').map(Number);
    const d = new Date(Date.UTC(y, mo - 1 + delta, 1));
    return d.toISOString().slice(0, 7);
  };

  return (
    <main className="mx-auto w-full max-w-4xl px-5 py-8">
      <Link href={`/${locale}/carrier/drivers`} className="text-[13px] text-ink-faint hover:text-ink">
        ← {t.drivers.back}
      </Link>

      <div className="mt-3 flex flex-wrap items-center gap-2.5">
        <h1 className="text-xl font-semibold tracking-tight">{driver.full_name}</h1>
        {driver.status === 'ARCHIVED' && <Badge tone="neutral">{t.drivers.archived}</Badge>}
      </div>
      <p className="mt-1 text-[13px] text-ink-muted">
        <Mono>{driver.phone}</Mono> · {driver.languages.join('/')}
      </p>

      {/* Дисклеймер — первым, до любой суммы: это справка, а не расчёт зарплаты. */}
      <p className="mt-6 rounded-control border border-warn/35 bg-warn/10 px-3 py-2 text-[13px] text-warn">
        {t.pay.disclaimer}
      </p>

      <section className="mt-8">
        <h2 className="mb-4 border-b border-line pb-2 text-[13px] font-semibold tracking-tight text-ink-faint">
          {t.pay.title}
        </h2>
        <PayProfilePanel
          driverId={driver.id}
          profiles={profiles ?? []}
          sets={sets ?? []}
          grades={grades}
          today={helsinkiToday()}
        />
      </section>

      <section className="mt-10">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-line pb-2">
          <h2 className="text-[13px] font-semibold tracking-tight text-ink-faint">
            {t.shifts.title} · {f.date(`${period.from}T12:00:00Z`)}–{f.date(`${period.to}T12:00:00Z`)}
          </h2>
          <div className="flex gap-3 text-[13px]">
            <Link href={`?month=${shiftMonth(-1)}`} className="text-ink-faint hover:text-ink">
              ←
            </Link>
            <Link href={`?month=${shiftMonth(1)}`} className="text-ink-faint hover:text-ink">
              →
            </Link>
          </div>
        </div>

        {entry && <WorkSummary summary={entry.summary} className="mb-6" />}

        <ShiftsPanel
          driverId={driver.id}
          shifts={(shifts ?? []).map((s) => ({
            ...s,
            plate: s.vehicle_id ? (plates.get(s.vehicle_id) ?? null) : null,
            breaks: s.driver_breaks ?? [],
          }))}
          vehicles={vehicles ?? []}
          defaultVehicleId={null}
        />
      </section>
    </main>
  );
}

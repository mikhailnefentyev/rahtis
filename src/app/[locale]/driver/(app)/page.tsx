import Link from 'next/link';
import { addressWithCity } from '@/lib/orders/stopTime';
import { notFound } from 'next/navigation';
import { acceptTaskAction } from '@/lib/driverApp/actions';
import { getDriver } from '@/lib/driverApp/session';
import { getDriverTasks, nextStop, type DriverTask } from '@/lib/driverApp/tasks';
import { isLocale, type Locale } from '@/lib/i18n';
import { getDriverI18n } from '@/lib/driverApp/i18n';
import { stopTitle } from '@/lib/orders/haul';
import { GaugeIcon } from '../training/icons';
import { DeclineTask } from './DeclineTask';
import { PushSetup } from './PushSetup';
import { ShiftBar } from './ShiftBar';
import { TaskTabs } from './TaskTabs';
import { createClient } from '@/lib/supabase/server';
import type { SiteState } from './site/SiteScreen';

/**
 * Главный экран водителя: смена и задания.
 *
 * Карточка задания отвечает на один вопрос — что делать дальше. Поэтому
 * в ней номер единицы крупно, первая непройденная точка и одна кнопка.
 */
export default async function DriverHome({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const [{ locale }, { tab }] = await Promise.all([params, searchParams]);
  if (!isLocale(locale)) notFound();

  const supabase = await createClient();
  const [driver, tasks, { t }, { data: siteData }] = await Promise.all([
    getDriver(),
    getDriverTasks(),
    getDriverI18n(locale),
    supabase.rpc('driver_site_state'),
  ]);
  /* Прицеп рейса перевозчика (конструктор сцепок) — водитель видит, что цеплять. */
  const { data: tripTrailerRows } = await supabase.rpc('driver_trip_trailers');
  const ownTrailer = new Map((tripTrailerRows ?? []).map((r) => [r.order_id, r.plate]));
  if (!driver) return null;

  const showDone = tab === 'done';
  const visible = tasks.filter((task) => (showDone ? task.status === 'DONE' : task.status !== 'DONE'));
  /* Работа на объекте — такое же задание, как рейс: открытые объекты компании в общем списке. */
  /* Объект под самосвальный заказ показывается карточкой заказа, а не второй раз объектом. */
  const siteJobs = showDone ? [] : ((siteData as unknown as SiteState | null)?.jobs ?? []).filter((job) => !job.order_id);

  return (
    <main className="flex flex-col gap-4">
      <header className="flex items-baseline justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">{t.driverApp.tasks}</h1>
        {/* Не приветствие, а машина: водитель, пересевший на другую, видит это сразу. */}
        <span className="font-mono text-[17px] font-bold tracking-tight">{driver.plate ?? t.driverApp.noVehicle}</span>
      </header>

      {/* Без уведомлений прямой заказ водитель увидит, только открыв приложение. */}
      <PushSetup compact />

      {/* Порядок — как идёт день: смена, быстрые действия, работа. */}
      <ShiftBar shift={driver.shift} />

      {/*
        Быстрые действия — плитками в один ряд, не выше карточки смены:
        заправка — у колонки одной кнопкой, тренажёр — в свободную минуту.
        Задания и смена остаются главным на экране.
      */}
      <div className="grid grid-cols-2 gap-3">
        <QuickTile href={`/${locale}/driver/fuel`} icon={<FuelIcon />} label={t.fuelDriver.entry} />
        <QuickTile href={`/${locale}/driver/training`} icon={<GaugeIcon />} label={t.training.title} />
      </div>

      <TaskTabs showDone={showDone} />

      {visible.length === 0 && siteJobs.length === 0 ? (
        <p className="py-12 text-center text-[17px] text-ink-muted">{t.driverApp.noTasks}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {siteJobs.map((job) => (
            <li key={job.id}>
              <SiteJobCard job={job} locale={locale} />
            </li>
          ))}
          {visible.map((task) => (
            <li key={task.id}>
              <TaskCard task={task} locale={locale} ownTrailer={ownTrailer.get(task.id) ?? null} />
            </li>
          ))}
        </ul>
      )}

    </main>
  );
}

async function TaskCard({ task, locale, ownTrailer = null }: { task: DriverTask; locale: Locale; ownTrailer?: string | null }) {
  const { t, f } = await getDriverI18n(locale);
  const stop = nextStop(task) ?? task.stops[0];
  /* Единица заказчика (перецеп, контейнер) или свой прицеп рейса. */
  const unit = task.trailer_plate ?? ownTrailer ?? (task.container_feet ? `${task.container_feet} ft` : null);

  return (
    <article className="overflow-hidden rounded-card border border-line bg-surface">
      <div className="flex items-center justify-between gap-3 bg-ink px-4 py-3 text-surface">
        <span className="font-mono text-[17px] font-bold tracking-tight">{task.ref}</span>
        <span className="text-sm">{t.orderStatus[task.status]}</span>
      </div>

      <div className="flex flex-col gap-3 px-4 py-4">
        <dl className="grid grid-cols-2 gap-3">
          <div>
            <dt className="label-micro">{t.driverApp.unit}</dt>
            <dd className="font-mono text-xl font-bold tracking-tight">{unit ?? t.haulKind[task.haul_kind]}</dd>
          </div>
          <div>
            <dt className="label-micro">{t.driverApp.vehicle}</dt>
            <dd className="font-mono text-xl font-bold tracking-tight">{task.plate ?? '—'}</dd>
          </div>
        </dl>

        {stop && (
          <div>
            <p className="label-micro">
              {t.driverApp.next} · {stopTitle(t, stop.role, task.haul_kind)}
            </p>
            <p className="text-[17px] font-semibold">{stop.place_name ?? stop.company_name ?? stop.city}</p>
            <p className="text-[15px] text-ink-muted">
              {addressWithCity(stop.address, stop.city)}
            </p>
            {stop.scheduled_date && (
              <p className="mt-0.5 text-[15px] text-ink-muted">
                {f.date(`${stop.scheduled_date}T12:00:00Z`)}
                {stop.scheduled_time ? ` · ${stop.scheduled_time.slice(0, 5)}` : ''}
              </p>
            )}
          </div>
        )}

        {task.status === 'AWAIT_DRIVER' ? (
          <>
            <p className="text-[15px] text-ink-muted">
              {task.direct ? t.driverApp.directHint : t.driverApp.awaitHint}
            </p>
            <form action={acceptTaskAction}>
              <input type="hidden" name="locale" value={locale} />
              <input type="hidden" name="order_id" value={task.id} />
              <button className="h-14 w-full rounded-control bg-accent text-[17px] font-semibold text-accent-ink">
                ✓ {t.driverApp.accept}
              </button>
            </form>
            <DeclineTask
              locale={locale}
              orderId={task.id}
              labels={{
                decline: t.driverApp.decline,
                confirm: t.driverApp.declineConfirm,
                yes: t.driverApp.declineYes,
              }}
            />
          </>
        ) : (
          <Link
            /* Стройка идёт экраном объекта: прибытие, рейсы с весами, конец дня. */
            href={task.haul_kind === 'TIPPER' ? `/${locale}/driver/site?order=${task.id}` : `/${locale}/driver/task/${task.id}`}
            className="flex h-14 items-center justify-center rounded-control bg-accent text-[17px] font-semibold text-accent-ink"
          >
            {t.driverApp.open}
          </Link>
        )}
      </div>
    </article>
  );
}

/** Объект на главном экране: где, для кого и сколько рейсов сегодня. Работа — на экране объекта. */
async function SiteJobCard({ job, locale }: { job: SiteState['jobs'][number]; locale: Locale }) {
  const { t, f } = await getDriverI18n(locale);
  const day = job.day;

  return (
    <article className="overflow-hidden rounded-card border border-line bg-surface">
      <div className="flex items-center justify-between gap-3 bg-ink px-4 py-3 text-surface">
        <span className="min-w-0 truncate text-[17px] font-bold tracking-tight">{job.name}</span>
        <span className="shrink-0 text-sm">{t.siteWork.title}</span>
      </div>
      <div className="flex flex-col gap-3 px-4 py-4">
        <div>
          <p className="text-[17px] font-semibold">{job.customer_name}</p>
          {job.address && <p className="text-[15px] text-ink-muted">{job.address}</p>}
          {day && (
            <p className="mt-1 text-[15px]">
              {t.siteWork.arrivedAt} <span className="font-mono font-semibold">{f.time(day.arrived_at)}</span> ·{' '}
              {t.siteWork.loadsToday}: <span className="font-semibold">{day.loads.length}</span>
            </p>
          )}
        </div>
        <Link
          href={`/${locale}/driver/site?job=${job.id}`}
          className="flex h-14 items-center justify-center rounded-control bg-accent text-[17px] font-semibold text-accent-ink"
        >
          {day ? t.driverApp.open : t.siteWork.arrive}
        </Link>
      </div>
    </article>
  );
}

/** Плитка быстрого действия: значок и подпись, во всю высоту под палец. */
function QuickTile({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  return (
    <Link
      href={href}
      className="flex min-h-20 flex-col items-start justify-between gap-2 rounded-card border border-line bg-surface px-4 py-3"
    >
      <span className="flex size-10 items-center justify-center rounded-control bg-accent-wash text-accent">{icon}</span>
      <span className="text-[16px] leading-tight font-semibold">{label}</span>
    </Link>
  );
}

/** Заправка: колонка с пистолетом. */
function FuelIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden className="size-6">
      <path d="M4 21V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v16" />
      <path d="M3 21h12" />
      <path d="M7 8h4" />
      <path d="M14 10h2a2 2 0 0 1 2 2v5a1.5 1.5 0 0 0 3 0V8l-3-3" />
    </svg>
  );
}

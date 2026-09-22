import Link from 'next/link';
import { notFound } from 'next/navigation';
import { acceptTaskAction, declineTaskAction } from '@/lib/driverApp/actions';
import { getDriver } from '@/lib/driverApp/session';
import { getDriverTasks, nextStop, type DriverTask } from '@/lib/driverApp/tasks';
import { isLocale, type Locale } from '@/lib/i18n';
import { getDriverI18n } from '@/lib/driverApp/i18n';
import { PushSetup } from './PushSetup';
import { ShiftBar } from './ShiftBar';
import { TaskTabs } from './TaskTabs';

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

  const [driver, tasks, { t, m }] = await Promise.all([getDriver(), getDriverTasks(), getDriverI18n(locale)]);
  if (!driver) return null;

  const showDone = tab === 'done';
  const visible = tasks.filter((task) => (showDone ? task.status === 'DONE' : task.status !== 'DONE'));

  return (
    <main className="flex flex-col gap-4">
      <header className="flex items-baseline justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">{t.driverApp.tasks}</h1>
        <span className="text-[15px] text-ink-muted">
          {m('driverApp.welcome', { name: driver.full_name.split(' ')[0] ?? driver.full_name })}
        </span>
      </header>

      <ShiftBar shift={driver.shift} />

      <PushSetup compact />

      <TaskTabs showDone={showDone} />

      {visible.length === 0 ? (
        <p className="py-12 text-center text-[17px] text-ink-muted">{t.driverApp.noTasks}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {visible.map((task) => (
            <li key={task.id}>
              <TaskCard task={task} locale={locale} />
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

async function TaskCard({ task, locale }: { task: DriverTask; locale: Locale }) {
  const { t, f } = await getDriverI18n(locale);
  const stop = nextStop(task) ?? task.stops[0];
  const unit = task.trailer_plate ?? (task.container_feet ? `${task.container_feet} ft` : null);

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
              {t.driverApp.next} · {t.stopKind[stop.role]}
            </p>
            <p className="text-[17px] font-semibold">{stop.place_name ?? stop.company_name ?? stop.city}</p>
            <p className="text-[15px] text-ink-muted">
              {stop.address}, {stop.city}
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
            <form action={declineTaskAction}>
              <input type="hidden" name="locale" value={locale} />
              <input type="hidden" name="order_id" value={task.id} />
              <button className="h-12 w-full rounded-control border border-line text-[15px] font-semibold text-danger">
                {t.driverApp.decline}
              </button>
            </form>
          </>
        ) : (
          <Link
            href={`/${locale}/driver/task/${task.id}`}
            className="flex h-14 items-center justify-center rounded-control bg-accent text-[17px] font-semibold text-accent-ink"
          >
            {t.driverApp.open}
          </Link>
        )}
      </div>
    </article>
  );
}

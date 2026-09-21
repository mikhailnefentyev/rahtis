import Link from 'next/link';
import { notFound } from 'next/navigation';
import { cn } from '@/lib/cn';
import { getTripPhotos, type TripPhoto } from '@/lib/driverApp/photos';
import { getDriverTasks, type DriverStop, type DriverTask } from '@/lib/driverApp/tasks';
import { getI18n, isLocale, type Locale } from '@/lib/i18n';
import { Arrive } from './Arrive';
import { Confirmation } from './Confirmation';
import { Inspection } from './Inspection';
import { ProblemForm } from './ProblemForm';
import { StopDone } from './StopDone';
import { QueuedMark, StopDot, StopGate, TaskBanner, TaskProgress } from './TaskProgress';

/**
 * Задание водителя.
 *
 * Сверху — баннер следующего действия, как у DFDS: водитель не ищет, что
 * делать, экран говорит это одной строкой. Ниже — лента точек: пройденные
 * с отметкой, текущая раскрыта, будущие — адресом.
 *
 * Действия непройденных точек рисуются заранее, а показывает их
 * TaskProgress: без связи следующая точка должна открыться сразу после
 * «Tehty», не дожидаясь, пока отметка дойдёт до сервера.
 */
export default async function DriverTaskPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  if (!isLocale(locale)) notFound();

  const [tasks, { t, m }] = await Promise.all([getDriverTasks(), getI18n(locale)]);
  const task = tasks.find((x) => x.id === id);
  if (!task) notFound();

  const running = task.status === 'IN_PROGRESS';
  /* Снимки нужны только на идущем рейсе: там осмотр и сравнение сторон. */
  const photos = running ? await getTripPhotos(task.id) : [];

  const progress = task.stops.map((stop) => ({
    id: stop.id,
    sequence: stop.sequence,
    arrived: Boolean(stop.arrived_at),
    completed: Boolean(stop.completed_at),
    stopOf: m('driverApp.stopOf', { n: stop.sequence + 1, total: task.stops.length }),
    title: `${t.stopKind[stop.role]} · ${stop.city}`,
  }));

  const content = (
    <main className="flex flex-col gap-4">
      <header className="flex items-center justify-between gap-3">
        <Link href={`/${locale}/driver`} className="flex h-12 items-center text-[16px] font-semibold text-accent">
          ← {t.driverApp.back}
        </Link>
        <span className="font-mono text-[17px] font-bold tracking-tight">{task.ref}</span>
      </header>

      {running ? (
        <TaskBanner />
      ) : (
        <div className="rounded-card bg-accent px-4 py-4 text-center text-[17px] font-semibold text-accent-ink">
          {t.orderStatus[task.status]}
        </div>
      )}

      {(task.trailer_plate || task.trailer || task.comment) && (
        <section className="rounded-card border border-line bg-surface px-4 py-3">
          {task.trailer_plate && (
            <p className="font-mono text-2xl font-bold tracking-tight">{task.trailer_plate}</p>
          )}
          {task.trailer && <p className="text-[15px] text-ink-muted">{task.trailer}</p>}
          {task.comment && <p className="mt-2 text-[15px]">{task.comment}</p>}
        </section>
      )}

      <ol className="flex flex-col">
        {task.stops.map((stop, index) => (
          <StopItem
            key={stop.id}
            task={task}
            photos={photos}
            stop={stop}
            locale={locale}
            running={running}
            last={index === task.stops.length - 1}
          />
        ))}
      </ol>

      {running && <ProblemForm orderId={task.id} />}
    </main>
  );

  return running ? <TaskProgress stops={progress}>{content}</TaskProgress> : content;
}

/*
 * Где снимается осмотр и где берутся подпись и накладная.
 *
 * Осмотр — там, где единица меняет состояние: зацеп, выгрузка, отцепка.
 *
 * Подпись и CMR — только на погрузке и выгрузке, где есть человек,
 * который отдаёт или принимает груз. Зацеп и отцепка полуприцепа или
 * контейнера проходят на площадке без людей, и подписывать там некому.
 * У экспресса точка забора — это погрузка груза у отправителя, и там
 * подпись берётся.
 */
const INSPECT = new Set(['PICKUP', 'DELIVERY', 'TRAILER_RETURN']);

function confirmationAt(role: string, unit: boolean): 'load' | 'unload' | null {
  if (role === 'EXTRA_LOAD' || (role === 'PICKUP' && !unit)) return 'load';
  if (role === 'DELIVERY' || role === 'EXTRA_UNLOAD') return 'unload';
  return null;
}

async function StopItem({
  task,
  photos,
  stop,
  locale,
  running,
  last,
}: {
  task: DriverTask;
  photos: TripPhoto[];
  stop: DriverStop;
  locale: Locale;
  running: boolean;
  last: boolean;
}) {
  const { t, m, f } = await getI18n(locale);
  const done = Boolean(stop.completed_at);
  const unit = task.haul_kind === 'TRAILER' || task.haul_kind === 'CONTAINER';
  const confirmation = confirmationAt(stop.role, unit);

  const destination =
    stop.lat != null && stop.lon != null
      ? `${stop.lat},${stop.lon}`
      : encodeURIComponent(`${stop.address}, ${stop.city}`);

  return (
    <li className="flex gap-3">
      <div className="flex flex-col items-center">
        {running ? (
          <StopDot stopId={stop.id} />
        ) : (
          <span
            className={cn(
              'mt-1.5 flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold',
              done ? 'bg-ok text-white' : 'border-2 border-line-strong',
            )}
          >
            {done ? '✓' : ''}
          </span>
        )}
        {!last && <span className="w-0.5 flex-1 bg-line" />}
      </div>

      <div className={cn('flex-1 pb-6', done && 'text-ink-dim')}>
        <p className="label-micro">{t.stopKind[stop.role]}</p>
        <p className="text-[17px] font-semibold">{stop.place_name ?? stop.company_name ?? stop.city}</p>
        <p className="text-[15px]">
          {stop.address}, {stop.city}
        </p>

        {stop.scheduled_date && (
          <p className="mt-1 text-[15px]">
            {t.driverApp.window}: {f.date(`${stop.scheduled_date}T12:00:00Z`)}
            {stop.scheduled_time ? ` · ${stop.scheduled_time.slice(0, 5)}` : ''}
          </p>
        )}

        {done && stop.completed_at && (
          <p className="mt-1 text-[15px] font-semibold text-ok">
            {t.driverApp.stopDone} {f.dateTime(stop.completed_at)}
          </p>
        )}

        {running && !done && (
          <>
            <StopGate stopId={stop.id} when="completedQueued">
              <p className="mt-1 text-[15px] font-semibold text-ok">
                {t.driverApp.stopDone}
                <QueuedMark />
              </p>
            </StopGate>

            <StopGate stopId={stop.id} when="current">
              <div className="mt-3 flex flex-col gap-2">
                <dl className="flex flex-col gap-1 text-[15px]">
                  {stop.external_ref && (
                    <div>
                      <dt className="inline text-ink-muted">{t.driverApp.ref}: </dt>
                      <dd className="inline font-mono font-semibold">{stop.external_ref}</dd>
                    </div>
                  )}
                  {stop.trailer_loaded != null && (
                    <div>
                      {t.driverApp.unit}: {stop.trailer_loaded ? t.driverApp.loaded : t.driverApp.emptyUnit}
                    </div>
                  )}
                  {stop.cargo_weight_kg != null && (
                    <div>
                      {t.driverApp.weight}: {f.number(stop.cargo_weight_kg)} kg
                    </div>
                  )}
                  {stop.seal_required && <div className="font-semibold text-warn">{t.driverApp.seal}</div>}
                  {stop.note && (
                    <div>
                      {t.driverApp.note}: {stop.note}
                    </div>
                  )}
                  {stop.contact_name && (
                    <div>
                      {t.driverApp.contact}: {stop.contact_name}
                    </div>
                  )}
                </dl>

                <div className="flex gap-2">
                  <a
                    href={`https://www.google.com/maps/dir/?api=1&destination=${destination}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex h-12 flex-1 items-center justify-center rounded-control border border-line bg-surface text-[15px] font-semibold"
                  >
                    {t.driverApp.navigate}
                  </a>
                  {stop.contact_phone && (
                    <a
                      href={`tel:${stop.contact_phone}`}
                      className="flex h-12 flex-1 items-center justify-center rounded-control border border-line bg-surface text-[15px] font-semibold"
                    >
                      {t.driverApp.call}
                    </a>
                  )}
                </div>

                <StopGate stopId={stop.id} when="beforeArrive">
                  <Arrive stopId={stop.id} />
                </StopGate>

                <StopGate stopId={stop.id} when="afterArrive">
                  <p className="text-[15px] font-semibold text-ok">
                    ✓{' '}
                    {stop.arrived_at
                      ? m('driverApp.arrivedAt', { time: f.time(stop.arrived_at) })
                      : t.driverApp.arrive}
                    <StopGate stopId={stop.id} when="arrivedQueued">
                      <QueuedMark />
                    </StopGate>
                  </p>

                  {INSPECT.has(stop.role) && (
                    <Inspection
                      orderId={task.id}
                      stopId={stop.id}
                      unit={unit}
                      sealRequired={Boolean(stop.seal_required)}
                      delivery={stop.role !== 'PICKUP'}
                      photos={photos}
                    />
                  )}

                  {confirmation && (
                    <Confirmation
                      orderId={task.id}
                      stopId={stop.id}
                      photos={photos}
                      pickup={confirmation === 'load'}
                    />
                  )}

                  <StopDone stopId={stop.id} />
                </StopGate>
              </div>
            </StopGate>
          </>
        )}
      </div>
    </li>
  );
}

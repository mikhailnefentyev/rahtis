import { Bars, Card, CardBody, Mono } from '@/components/ui';
import { getI18n, type Locale } from '@/lib/i18n';
import { createClient } from '@/lib/supabase/server';
import type { Dictionary } from '@/lib/i18n';
import type { PartyRole } from '@/types/db';

/**
 * Нижняя часть кабинета: что идёт прямо сейчас и что было за восемь недель.
 *
 * Два блока в таком порядке намеренно. Полоса состояния отвечает на
 * вопрос сегодняшнего утра — сколько перевозок в работе и не ждёт ли
 * что-то решения. История за восемь недель отвечает на вопрос конца
 * месяца, и он задаётся реже.
 *
 * Рисование живёт в Bars: здесь только вопрос, какие числа показывать
 * какой стороне.
 */

/** Сколько недель показываем. Восемь — два месяца, влезает без прокрутки. */
const WEEKS = 8;

/**
 * Подписи счётчика — свои, не из orderStatus.
 *
 * Бейдж говорит про одну перевозку, счётчик про несколько, и по-фински
 * это разные слова: одна «Avoin», три «Avoimia 3».
 */
const COUNT_LABEL = {
  OPEN: 'countOpen',
  REQUESTED: 'countOffers',
  AWAIT_DRIVER: 'countAwaitDriver',
  IN_PROGRESS: 'countInProgress',
} as const satisfies Record<LiveStatus, keyof Dictionary['pulse']>;

/** Состояния, которые считает полоса: всё, что ещё не закрыто и не отменено. */
type LiveStatus = 'OPEN' | 'REQUESTED' | 'AWAIT_DRIVER' | 'IN_PROGRESS';

export async function CabinetPulse({ locale, role }: { locale: Locale; role: PartyRole }) {
  const [{ t, m, f }, supabase] = await Promise.all([getI18n(locale), createClient()]);

  const [live, weekly] = await Promise.all([
    liveCounts(supabase, role),
    supabase.rpc('weekly_totals', { p_weeks: WEEKS }),
  ]);

  /*
   * Заказчику показываем ставку — это его расход. Перевозчику выплату:
   * комиссия ему уже вычтена, и видеть он должен то, что придёт на счёт.
   * База сама не отдаёт заказчику ни комиссию, ни выплату.
   */
  const carrier = role === 'CARRIER';
  const series = fillWeeks(
    (weekly.data ?? []).map((row) => ({
      week: row.week,
      cents: Number(carrier ? (row.payout_cents ?? 0) : (row.rate_cents ?? 0)),
    })),
  );

  const total = series.reduce((sum, point) => sum + point.cents, 0);
  const hasHistory = series.some((point) => point.cents > 0);

  return (
    <div className="mt-4 grid gap-4 lg:grid-cols-2">
      <Card>
        <CardBody className="flex flex-col gap-3">
          <p className="label-micro">{t.pulse.now}</p>

          {live.length === 0 ? (
            <p className="text-[13px] text-ink-muted">{t.pulse.nowEmpty}</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {live.map(({ status, count }) => (
                <span key={status} className="pulse-chip">
                  {t.pulse[COUNT_LABEL[status]]}
                  <Mono className="pulse-chip__count">{count}</Mono>
                </span>
              ))}
            </div>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardBody className="flex flex-col gap-3">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <p className="label-micro">
              {carrier ? t.pulse.earnings : t.pulse.spend}
              {' · '}
              {t.pulse.vatFree}
            </p>
            {hasHistory && (
              <Mono className="text-[13px] font-semibold">
                {m('pulse.total', { weeks: WEEKS, amount: f.eur(total) })}
              </Mono>
            )}
          </div>

          {hasHistory ? (
            <Bars
              points={series.map((point) => ({
                value: point.cents,
                label: m('pulse.week', { no: isoWeek(point.week) }),
                title: m('pulse.weekAmount', {
                  no: isoWeek(point.week),
                  amount: f.eur(point.cents),
                }),
              }))}
            />
          ) : (
            <p className="text-[13px] text-ink-muted">{t.pulse.empty}</p>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

/* ── Данные ────────────────────────────────────────────────────────── */

type Live = { status: LiveStatus; count: number };

/**
 * Что в работе прямо сейчас.
 *
 * У сторон это разные вопросы. Заказчик смотрит на свои заказы целиком:
 * опубликован, собирает отклики, ждёт водителя, едет. Перевозчик — только
 * на взятые: чужие открытые заказы это стол, а не его дела.
 */
async function liveCounts(
  supabase: Awaited<ReturnType<typeof createClient>>,
  role: PartyRole,
): Promise<Live[]> {
  const order: LiveStatus[] = ['OPEN', 'REQUESTED', 'AWAIT_DRIVER', 'IN_PROGRESS'];

  const statuses =
    role === 'CARRIER'
      ? ((await supabase.rpc('my_assignments')).data ?? []).map((row) => row.status)
      : ((await supabase.from('orders').select('status').in('status', order)).data ?? []).map(
          (row) => row.status,
        );

  return order
    .map((status) => ({ status, count: statuses.filter((s) => s === status).length }))
    .filter((row) => row.count > 0);
}

/**
 * Достраивает пропущенные недели нулями.
 *
 * `weekly_totals` возвращает только недели, где были закрытые рейсы.
 * Отданные в график как есть, недели 30, 34 и 41 встанут тремя соседними
 * столбиками и соврут про равномерность работы.
 */
function fillWeeks(rows: { week: string; cents: number }[]): { week: string; cents: number }[] {
  const known = new Map(rows.map((row) => [row.week, row.cents]));
  const mondays: string[] = [];

  for (let back = WEEKS - 1; back >= 0; back -= 1) {
    mondays.push(mondayBefore(back));
  }

  return mondays.map((week) => ({ week, cents: known.get(week) ?? 0 }));
}

/**
 * Понедельник N недель назад, по часовому поясу операций.
 *
 * Неделя в отчётах начинается с понедельника в Хельсинки — так же, как в
 * `app.report_week`. Дата считается как календарная, без времени: иначе
 * переход на летнее время сдвигал бы границу недели на час и в конце
 * марта рейс попадал бы в соседнюю неделю.
 */
function mondayBefore(weeksBack: number): string {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Helsinki' }).format(new Date());
  const date = new Date(`${today}T00:00:00Z`);

  /* getUTCDay(): воскресенье 0, понедельник 1. Нам нужен сдвиг до понедельника. */
  const shift = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - shift - weeksBack * 7);

  return date.toISOString().slice(0, 10);
}

/** Номер недели по ISO 8601 — так недели называют в финских отчётах. */
function isoWeek(isoDate: string): number {
  const date = new Date(`${isoDate}T00:00:00Z`);

  /* Четверг той же недели определяет год и номер по ISO. */
  date.setUTCDate(date.getUTCDate() + 3);
  const firstThursday = new Date(Date.UTC(date.getUTCFullYear(), 0, 4));
  const shift = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - shift + 3);

  return 1 + Math.round((date.getTime() - firstThursday.getTime()) / (7 * 24 * 3600 * 1000));
}

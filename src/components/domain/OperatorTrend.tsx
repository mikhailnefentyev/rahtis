import { Bars, Card, CardBody, Mono } from '@/components/ui';
import { isoWeekNumber, weeksAgoMonday } from '@/lib/dates';
import type { I18n } from '@/lib/i18n';
import type { WeeklyTotal } from '@/types/db';

/**
 * Динамика для оператора: оборот и то, что из него остаётся нам.
 *
 * На странице расчётов были только списки и таблицы: сколько ждём,
 * сколько платить, кто не заплатил. На вопрос «идёт ли дело вверх»
 * ответить было нечем — а это первый вопрос к собственной платформе.
 *
 * Два ряда столбиков рядом, а не один с двумя цветами: оборот и выручка
 * отличаются в тридцать раз, и на общей шкале второй ряд был бы полоской
 * в пиксель. Разные шкалы честнее показывают форму каждой кривой, а
 * абсолютные числа стоят подписью.
 *
 * Рисуется разметкой (Bars), без графической библиотеки и без единого
 * килобайта JS: столбики работают на сервере, печатаются и не зависят от
 * того, дошёл ли до браузера бандл.
 */
export function OperatorTrend({
  totals,
  weeks,
  i18n: { t, m, f },
}: {
  totals: WeeklyTotal[];
  weeks: number;
  i18n: I18n;
}) {
  const series = fill(totals, weeks);

  const turnover = series.reduce((sum, point) => sum + point.rate, 0);
  const revenue = series.reduce((sum, point) => sum + point.revenue, 0);
  const trips = series.reduce((sum, point) => sum + point.trips, 0);

  if (trips === 0) return null;

  return (
    <section className="mt-10">
      <h2 className="border-b border-line pb-2 text-[13px] font-semibold tracking-tight">
        {t.billingDesk.trendTitle}
      </h2>

      <div className="mt-3 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardBody className="flex flex-col gap-3">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <p className="label-micro">{t.billingDesk.trendTurnover}</p>
              <Mono className="text-[13px] font-semibold">{f.eur(turnover)}</Mono>
            </div>

            <Bars
              points={series.map((point) => ({
                value: point.rate,
                label: m('billingDesk.week', { no: point.no }),
                title: m('billingDesk.weekTrips', { no: point.no, count: point.trips }),
              }))}
            />
          </CardBody>
        </Card>

        <Card>
          <CardBody className="flex flex-col gap-3">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <p className="label-micro">{t.billingDesk.trendRevenue}</p>
              <Mono className="text-[13px] font-semibold text-ok">{f.eur(revenue)}</Mono>
            </div>

            <Bars
              points={series.map((point) => ({
                value: point.revenue,
                label: m('billingDesk.week', { no: point.no }),
                title: m('billingDesk.weekAmount', { no: point.no, amount: f.eur(point.revenue) }),
              }))}
            />
          </CardBody>
        </Card>
      </div>

      <p className="mt-2 text-[12px] text-ink-dim">{t.billingDesk.trendHint}</p>
    </section>
  );
}

type Point = { no: number; rate: number; revenue: number; trips: number };

/**
 * Достраивает пропущенные недели нулями.
 *
 * weekly_totals отдаёт только недели с закрытыми рейсами. Отданные как
 * есть, недели 34 и 41 встанут соседними столбиками и соврут про
 * равномерность работы: между ними полтора месяца простоя.
 */
function fill(totals: WeeklyTotal[], weeks: number): Point[] {
  const known = new Map(totals.map((row) => [row.week, row]));
  const points: Point[] = [];

  for (let back = weeks - 1; back >= 0; back -= 1) {
    const week = weeksAgoMonday(back);
    const row = known.get(week);

    points.push({
      no: isoWeekNumber(week),
      rate: Number(row?.rate_cents ?? 0),
      /* Наша доля: процент с перевозчика по подряду плюс плата заказчика со стола. */
      revenue: Number(row?.commission_cents ?? 0) + Number(row?.shipper_fee_cents ?? 0),
      trips: row?.orders_count ?? 0,
    });
  }

  return points;
}

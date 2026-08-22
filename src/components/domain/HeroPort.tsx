import Link from 'next/link';
import { LocaleSwitch } from '@/components/layout/LocaleSwitch';
import {
  TripCycle,
  type CycleStage,
  type CycleTrip,
} from '@/components/domain/TripCycle';
import { buttonClass, Mono } from '@/components/ui';
import { signInPath } from '@/lib/auth/paths';
import { getI18n, type Locale } from '@/lib/i18n';
import { createClient } from '@/lib/supabase/server';

/**
 * Первый экран главной страницы.
 *
 * Фон — съёмка порта: единственный эффект поверх неё расфокус и
 * затемнение. Ни сетки, ни световой вуали: в макете именно они
 * превращали сцену в кашу, накладываясь друг на друга.
 *
 * Текст здесь белый, а не чернильный, как в кабинете. Это осознанное
 * исключение на одну секцию: поверх съёмки светлая типографика читается,
 * только если под ней настоящая темнота, а не полупрозрачная плёнка.
 */
export async function HeroPort({ locale }: { locale: Locale }) {
  const [{ t }, supabase] = await Promise.all([getI18n(locale), createClient()]);

  /*
   * Живые числа: столько машин имеет допуск прямо сейчас и в скольких
   * городах они стоят.
   *
   * Через функцию, а не запросом к vehicles: главную открывает аноним, а
   * RLS закрывает таблицу от него целиком — счётчик молча не рисовался
   * бы на живом сайте. Наружу выходят только два агрегата.
   */
  const { data: fleetRows } = await supabase.rpc('fleet_size');
  const fleet = fleetRows?.[0];

  return (
    <section className="hero-port">
      {/*
        * Съёмка обрезана и пережата заранее: 26 секунд, 720p, без звука,
        * 1,2 МБ вместо 66. Кадр всё равно уходит в расфокус, поэтому
        * полное разрешение здесь было бы чистой потерей трафика.
        *
        * poster показывается до первого кадра и остаётся единственным,
        * что видит браузер, если видео не запустилось.
        */}
      <video
        className="hero-port__video"
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
        poster="/media/rahtis-poster.jpg"
      >
        <source src="/media/rahtis.mp4" type="video/mp4" />
      </video>

      {/* Затемнение с уклоном в зелёный — единственный слой поверх видео. */}
      <div className="hero-port__shade" aria-hidden="true" />

      <div className="hero-port__inner">
        <div className="hero-port__copy">
          <p className="hero-port__eyebrow">{t.landing.eyebrow}</p>

          <h1 className="hero-port__title">
            {t.landing.titleA}
            <br />
            {t.landing.titleB}
            <br />
            {t.landing.titleC}
          </h1>

          <p className="hero-port__lede">{t.landing.lede}</p>
          <p className="hero-port__lede hero-port__lede--second">{t.landing.lede2}</p>

          <div className="hero-port__doors">
            <Link
              href="#roles"
              className={buttonClass({ variant: 'primary', size: 'lg' })}
            >
              {t.landing.asShipper}
            </Link>
            <Link href="#roles" className="hero-port__ghost">
              {t.landing.asCarrier}
            </Link>
          </div>

          {/* Пустой парк не показывается: ноль машин отговаривает вернее пустоты. */}
          {fleet && fleet.vehicles > 0 && (
            <p className="hero-port__fleet">
              <span className="hero-port__pulse" aria-hidden="true" />
              <Mono className="hero-port__count">{fleet.vehicles}</Mono> {t.landing.fleetLabel}
              <span className="hero-port__sep" aria-hidden="true" />
              <Mono className="hero-port__count">{fleet.regions}</Mono> {t.landing.regionsLabel}
              {/*
                * Пояснение отдельной строкой, а не третьим членом ряда:
                * на узком экране оно переносится, и разделитель остаётся
                * висеть в конце предыдущей строки.
                */}
              <span className="hero-port__fleetNote">{t.landing.fleetLive}</span>
            </p>
          )}

          <p className="hero-port__note">{t.landing.moderationNote}</p>
        </div>

        {/*
          * Карточка рейса остаётся светлой и непрозрачной: она — кусок
          * настоящего кабинета, и читаемость её содержимого важнее
          * единства с тёмным фоном.
          */}
        <div className="hero-port__card">
          <TripPreview locale={locale} />
        </div>
      </div>

      <div className="hero-port__corner">
        <LocaleSwitch current={locale} />
        <Link href={signInPath(locale)} className="hero-port__signin">
          {t.landing.signIn}
        </Link>
      </div>
    </section>
  );
}

/**
 * Карточка рейса — тот же вид, что в кабинете, только без данных из базы.
 *
 * Собирается на сервере целиком: клиентской части достаются готовые
 * строки, а не словарь. Стадий четыре, и это те же четыре состояния, что
 * заказ проходит по-настоящему — от публикации до приложенной накладной.
 */
async function TripPreview({ locale }: { locale: Locale }) {
  const { t, m } = await getI18n(locale);
  const l = t.landing;

  const trip: CycleTrip = {
    title: t.orderType.TRAILER_SWAP,
    ref: 'RS-2026-0041',
    plate: 'ABC-123',
    stops: [
      {
        kind: t.stopKind.PICKUP,
        place: 'Steveco Hanko',
        sub: 'Korsmaninkatu 6, 10900 Hanko',
        at: '22:10',
      },
      { kind: t.stopKind.EXTRA_UNLOAD, place: 'UPM Kotka', sub: 'UPM Kotka · Mika', at: '07:00' },
      { kind: t.stopKind.EXTRA_LOAD, place: 'LaserPoint Oy', sub: 'Kouvola', at: '09:30' },
      {
        kind: t.stopKind.TRAILER_RETURN,
        place: 'Viking Line Turku',
        /* Прицеп уходит на паром гружёным: в Коуволе его загрузили снова. */
        sub: t.orderForm.trailerLoaded,
        at: '14:30',
      },
    ],
    distance: m('order.distance', { km: 620 }),
    stopsCount: m('order.stopsCount', { count: 4 }),
    lane: 'Hanko → Turku',
  };

  const stages: CycleStage[] = [
    { status: l.cycle1, note: l.cycle1Note, tone: 'idle', done: 0, waiting: false },
    { status: l.cycle2, note: l.cycle2Note, tone: 'warn', done: 0, waiting: true },
    { status: l.cycle3, note: l.cycle3Note, tone: 'live', done: 1, waiting: false },
    { status: l.cycle4, note: l.cycle4Note, tone: 'ok', done: 4, waiting: false },
  ];

  return (
    <TripCycle
      trip={trip}
      stages={stages}
      stageLabel={stages.map((_, n) =>
        m('landing.cycleStage', { no: n + 1, total: stages.length }),
      )}
    />
  );
}

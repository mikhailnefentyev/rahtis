import Link from 'next/link';
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
              <span className="hero-port__sep" aria-hidden="true" />
              {t.landing.fleetLive}
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

      <Link href={signInPath(locale)} className="hero-port__signin">
        {t.landing.signIn}
      </Link>
    </section>
  );
}

/** Карточка рейса — тот же вид, что в кабинете, только без данных из базы. */
async function TripPreview({ locale }: { locale: Locale }) {
  const { t } = await getI18n(locale);

  const stops = [
    { kind: t.stopKind.PICKUP, place: 'Steveco Hanko', sub: 'Korsmaninkatu 6, 10900 Hanko', at: '22:10' },
    { kind: t.stopKind.EXTRA_UNLOAD, place: 'UPM Kotka', sub: 'UPM Kotka · Mika', at: '07:00' },
    { kind: t.stopKind.TRAILER_RETURN, place: 'DFDS Turku', sub: t.orderForm.trailerEmpty, at: '12:30' },
  ];

  return (
    <div className="trip-preview">
      <div className="trip-preview__top">
        <span className="trip-preview__title">{t.orderType.TRAILER_SWAP}</span>
        <span className="trip-preview__badge">{t.orderStatus.IN_PROGRESS}</span>
        <Mono className="trip-preview__ref">RS-2026-0041</Mono>
      </div>

      <ul className="trip-preview__route">
        {stops.map((stop) => (
          <li key={stop.place}>
            <span className="trip-preview__pin" aria-hidden="true" />
            <span>
              <span className="trip-preview__stop">
                {stop.kind} · {stop.place}
              </span>
              <span className="trip-preview__sub">{stop.sub}</span>
            </span>
            <Mono className="trip-preview__time">{stop.at}</Mono>
          </li>
        ))}
      </ul>

      <div className="trip-preview__foot">
        <Mono>580 {t.unit.km}</Mono>
        <Mono>Hanko → Turku</Mono>
      </div>
    </div>
  );
}

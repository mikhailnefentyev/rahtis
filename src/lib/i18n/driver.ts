import { getDictionary, type Dictionary } from './dictionaries';
import type { Locale } from './config';
import type { MessageKey } from './message';
import { type DriverLocale } from './driverLocale';

/**
 * Словарь приложения водителя.
 *
 * Переводится не весь словарь платформы, а его срез: экраны водителя,
 * точки маршрута, статусы рейса и карта — полторы сотни строк. Остальное
 * (кабинеты, отчёты, документы) водителю не показывается вовсе, и
 * держать для него перевод значило бы поддерживать десять словарей
 * платформы ради строк, которых никто не увидит.
 *
 * Сам выбор языка — в `driverLocale.ts`.
 */

export {
  DRIVER_LOCALES,
  DRIVER_LOCALE_NAMES,
  isDriverLocale,
  matchDriverLocale,
  type DriverLocale,
} from './driverLocale';

/** Сообщения ICU, которые нужны приложению водителя. */
export type DriverMessageKey = Extract<MessageKey, `driverApp.${string}` | `places.${string}`>;

/**
 * Срез словаря для приложения водителя.
 *
 * Типы берутся у финского словаря, поэтому забытый ключ в переводе —
 * ошибка компиляции, а не пустое место на экране в рейсе.
 */
export type DriverPack = {
  intl: string;
  driverApp: Dictionary['driverApp'];
  places: Dictionary['places'];
  stopKind: Dictionary['stopKind'];
  /*
   * Забор и возврат зависят от того, что везут: общий stopKind называет их
   * «прицепом», и экспресс на фургоне в приложении получал «забор
   * прицепа» (прогон 26.09.2026). driverDictionary кладёт их в haul.
   */
  haulStops: Record<'CONTAINER' | 'CARGO', { pickup: string; return: string }>;
  orderStatus: Dictionary['orderStatus'];
  haulKind: Dictionary['haulKind'];
  /** Единственная строка из раздела оплаты, которую видит водитель. */
  payDisclaimer: string;
  msg: Record<DriverMessageKey, string>;
};

/** Срез из готового словаря платформы — для финского и английского. */
function packOf(dictionary: Dictionary): DriverPack {
  const msg = Object.fromEntries(
    Object.entries(dictionary.msg).filter(
      ([key]) => key.startsWith('driverApp.') || key.startsWith('places.'),
    ),
  ) as Record<DriverMessageKey, string>;

  return {
    intl: dictionary.meta.intl,
    driverApp: dictionary.driverApp,
    places: dictionary.places,
    stopKind: dictionary.stopKind,
    haulStops: {
      CONTAINER: { pickup: dictionary.haul.CONTAINER.stopPickup, return: dictionary.haul.CONTAINER.stopReturn },
      CARGO: { pickup: dictionary.haul.VAN.stopPickup, return: dictionary.haul.VAN.stopReturn },
    },
    orderStatus: dictionary.orderStatus,
    haulKind: dictionary.haulKind,
    payDisclaimer: dictionary.pay.disclaimer,
    msg,
  };
}

async function loadPack(locale: DriverLocale): Promise<DriverPack> {
  switch (locale) {
    case 'et':
      return (await import('./driver/et')).et;
    case 'ru':
      return (await import('./driver/ru')).ru;
    case 'sv':
      return (await import('./driver/sv')).sv;
    case 'lv':
      return (await import('./driver/lv')).lv;
    case 'lt':
      return (await import('./driver/lt')).lt;
    case 'pl':
      return (await import('./driver/pl')).pl;
    case 'nb':
      return (await import('./driver/nb')).nb;
    case 'da':
      return (await import('./driver/da')).da;
    case 'en':
      return packOf(await getDictionary('en'));
    default:
      return packOf(await getDictionary('fi'));
  }
}

/**
 * Словарь страницы водителя: платформенный язык плюс срез на языке
 * водителя. Подписи вне среза (ошибки форм, общие кнопки) остаются на
 * языке адреса — их на экранах водителя единицы.
 */
export async function driverDictionary(
  locale: Locale,
  driverLocale: DriverLocale,
): Promise<Dictionary> {
  const base = await getDictionary(locale);
  if (driverLocale === locale) return base;

  const pack = await loadPack(driverLocale);

  return {
    ...base,
    meta: { ...base.meta, intl: pack.intl },
    driverApp: pack.driverApp,
    places: pack.places,
    stopKind: pack.stopKind,
    /*
     * Забор и возврат по виду перевозки: страницы водителя зовут тот же
     * stopTitle, что кабинеты, и он берёт названия отсюда. Остальные поля
     * haul (разделы формы заказа) водителю не показываются.
     */
    haul: {
      TRAILER: { ...base.haul.TRAILER, stopPickup: pack.stopKind.PICKUP, stopReturn: pack.stopKind.TRAILER_RETURN },
      CONTAINER: { ...base.haul.CONTAINER, stopPickup: pack.haulStops.CONTAINER.pickup, stopReturn: pack.haulStops.CONTAINER.return },
      VAN: { ...base.haul.VAN, stopPickup: pack.haulStops.CARGO.pickup, stopReturn: pack.haulStops.CARGO.return },
      TRUCK: { ...base.haul.TRUCK, stopPickup: pack.haulStops.CARGO.pickup, stopReturn: pack.haulStops.CARGO.return },
    },
    orderStatus: pack.orderStatus,
    haulKind: pack.haulKind,
    pay: { ...base.pay, disclaimer: pack.payDisclaimer },
    msg: { ...base.msg, ...pack.msg },
  };
}


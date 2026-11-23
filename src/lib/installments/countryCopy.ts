import type { Locale } from '@/lib/i18n/config';

/**
 * Тексты раздела рассрочки, появившиеся с правилом «сделка внутри одной
 * страны» (23.11.2026): подпись страны в каталоге, пометка у объявления
 * другой страны, отказ базы и ссылка на открытую страницу объявлений.
 * Отдельным модулем, а не в copy.ts: тексты там сверены носителями языка
 * по файлам, и эти строки сверяются отдельно. Название страны
 * подставляется в именительном падеже (Intl.DisplayNames) — поэтому оно
 * стоит в скобках, а не внутри фразы.
 */
export type InstallmentCountryCopy = {
  /** Подпись страны продавца в карточке каталога. */
  country: string;
  /** Вместо кнопки «сделать предложение» у объявления другой страны. */
  otherCountry: string;
  /** Отказ базы (код RC001): покупатель и продавец из разных стран. */
  differentCountry: string;
  /** Ссылка из раздела на открытую страницу объявлений. */
  publicLink: string;
};

const COPY: Record<Locale, InstallmentCountryCopy> = {
  fi: {
    country: 'Maa',
    otherCountry: 'Myydään vain saman maan yrityksille ({country})',
    differentCountry: 'Osamaksukaupan voi tehdä vain saman maan yritysten kesken. Myyjä on eri maasta kuin yrityksesi.',
    publicLink: 'Julkinen ilmoitussivu',
  },
  en: {
    country: 'Country',
    otherCountry: 'Sold within the same country only ({country})',
    differentCountry: 'An instalment sale can only be made between companies of the same country. The seller is from a different country than your company.',
    publicLink: 'Public listings page',
  },
  sv: {
    country: 'Land',
    otherCountry: 'Säljs endast till företag i samma land ({country})',
    differentCountry: 'Ett avbetalningsköp kan bara göras mellan företag i samma land. Säljaren finns i ett annat land än ditt företag.',
    publicLink: 'Offentlig annonssida',
  },
  et: {
    country: 'Riik',
    otherCountry: 'Müük ainult sama riigi ettevõtetele ({country})',
    differentCountry: 'Järelmaksumüügi saab sõlmida ainult sama riigi ettevõtete vahel. Müüja on teisest riigist kui teie ettevõte.',
    publicLink: 'Avalik kuulutuste leht',
  },
  lv: {
    country: 'Valsts',
    otherCountry: 'Pārdod tikai tās pašas valsts uzņēmumiem ({country})',
    differentCountry: 'Nomaksas pirkumu var noslēgt tikai vienas valsts uzņēmumu starpā. Pārdevējs ir no citas valsts nekā jūsu uzņēmums.',
    publicLink: 'Publiskā sludinājumu lapa',
  },
  lt: {
    country: 'Šalis',
    otherCountry: 'Parduodama tik tos pačios šalies įmonėms ({country})',
    differentCountry: 'Pardavimo išsimokėtinai sandorį galima sudaryti tik tarp tos pačios šalies įmonių. Pardavėjas yra iš kitos šalies nei jūsų įmonė.',
    publicLink: 'Viešas skelbimų puslapis',
  },
  pl: {
    country: 'Kraj',
    otherCountry: 'Sprzedaż tylko firmom z tego samego kraju ({country})',
    differentCountry: 'Sprzedaż na raty można zawrzeć tylko między firmami z tego samego kraju. Sprzedawca jest z innego kraju niż Twoja firma.',
    publicLink: 'Publiczna strona ogłoszeń',
  },
  de: {
    country: 'Land',
    otherCountry: 'Verkauf nur an Unternehmen im selben Land ({country})',
    differentCountry: 'Ein Ratenkauf ist nur zwischen Unternehmen desselben Landes möglich. Der Verkäufer hat seinen Sitz in einem anderen Land als Ihr Unternehmen.',
    publicLink: 'Öffentliche Angebotsseite',
  },
  ru: {
    country: 'Страна',
    otherCountry: 'Продаётся только компаниям своей страны ({country})',
    differentCountry: 'Сделку в рассрочку можно заключить только между компаниями одной страны. Продавец — из другой страны, чем ваша компания.',
    publicLink: 'Открытая страница объявлений',
  },
  ro: {
    country: 'Țara',
    otherCountry: 'Se vinde doar firmelor din aceeași țară ({country})',
    differentCountry: 'Vânzarea cu plata în rate se poate încheia doar între firme din aceeași țară. Vânzătorul este din altă țară decât firma dumneavoastră.',
    publicLink: 'Pagina publică de anunțuri',
  },
};

export function installmentCountryCopy(locale: Locale | string): InstallmentCountryCopy {
  return COPY[locale as Locale] ?? COPY.en;
}

/** Название страны на языке читающего, в именительном падеже; неизвестный код — как есть. */
export function countryName(locale: string, country: string | null | undefined): string {
  const code = (country ?? '').toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) return '';
  try {
    return new Intl.DisplayNames([locale === 'en' ? 'en-GB' : locale], { type: 'region' }).of(code) ?? code;
  } catch {
    return code;
  }
}

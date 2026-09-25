/**
 * Тексты писем на двух языках.
 *
 * Отдельным модулем, а не в общих словарях интерфейса, и это осознанно.
 * Словари кабинета — тысяча триста строк на язык, в которых живут кнопки,
 * подписи полей и статусы; письма к ним не относятся ничем, кроме языка.
 * Слитые вместе, они дают файл, в котором правку текста приглашения ищут
 * между «Отклики» и «Тип прицепа».
 *
 * Здесь же текст стоит рядом с шаблоном, который его собирает, и рядом с
 * комментариями, объясняющими, почему письмо устроено именно так: почему
 * у восстановления час, а у приглашения сутки; почему в письме заявителю
 * нет кнопки.
 *
 * ПОЧЕМУ ВООБЩЕ ДВА ЯЗЫКА. Раньше письма были финскими жёстко, и это было
 * верно, пока рынок был финским. Теперь платформа зовёт датских и
 * норвежских экспедиторов, а у письма, в отличие от кабинета, нет
 * переключателя языка: человек либо понимает присланное, либо нет.
 *
 * Язык берётся у компании — переписка ведётся с юридическим лицом, а не с
 * тем, кто сегодня сидит за экраном. Письма, адресованные оператору
 * (новая заявка, вопрос из кабинета), остаются финскими: оператор
 * финский, и переводить их не для кого.
 */

export type EmailLocale = 'fi' | 'en';

/** Язык переписки: всё, кроме известного английского, читается по-фински. */
export function emailLocaleOf(language: string | null | undefined): EmailLocale {
  return language === 'en' ? 'en' : 'fi';
}

type Texts = {
  /* Общее для всех писем: подвал и подпись. */
  signature: string;
  neverAsk: string;
  brandTagline: string;

  greeting: string;

  invite: {
    heading: (company: string) => string;
    subject: (company: string) => string;
    preheader: string;
    body: string;
    button: string;
    note: (operator: string) => string;
  };

  recovery: {
    heading: string;
    subject: string;
    preheader: string;
    body: string;
    button: string;
    note: string;
  };

  application: {
    heading: string;
    subject: (company: string) => string;
    preheader: string;
    thanks: string;
    next: string;
    note: (operator: string) => string;
    fieldCompany: string;
    fieldBusinessId: string;
    fieldRole: string;
    fieldEmail: string;
  };

  /*
   * Рассылка о новом заказе. Единственное письмо, которое уходит не
   * адресату события, а всем, кому работа открыта, — поэтому оно короче
   * остальных: перевозчик читает его на телефоне между рейсами и решает
   * одно, ехать смотреть или нет.
   */
  dispatch: {
    subject: (ref: string, from: string, to: string) => string;
    heading: (from: string, to: string) => string;
    preheader: (ref: string) => string;
    lead: string;
    button: string;
    note: string;
    fieldOrder: string;
    fieldPickup: string;
    fieldRoute: string;
    fieldUnit: string;
    fieldDistance: string;
    fieldRate: string;
  };

  direct: {
    subject: (ref: string, plate: string) => string;
    heading: (plate: string) => string;
    preheader: (shipper: string) => string;
    lead: (shipper: string) => string;
    button: string;
    note: string;
  };

  billing: {
    invoicedSubject: (ref: string) => string;
    invoicedHeading: (ref: string) => string;
    /** Ставка налога словами или null — обратное начисление. */
    invoicedLead: (vatRate: string | null) => string;
    settledSubject: (ref: string) => string;
    settledHeading: (ref: string) => string;
    settledLead: (vatRate: string | null) => string;
    preheader: (amount: string) => string;
    fieldOrder: string;
    fieldAmount: string;
    fieldVat: (rate: string) => string;
    fieldTotal: string;
    fieldInvoice: string;
    fieldSeller: string;
    fieldPayer: string;
    fieldBusinessId: string;
    fieldVatNumber: string;
    fieldAddress: string;
    fieldAccount: string;
    fieldReference: string;
    questions: (operator: string) => string;
  };
};

const fi: Texts = {
  signature: 'Rahtis Team',
  neverAsk: 'Emme koskaan kysy salasanaasi sähköpostitse emmekä puhelimessa.',
  brandTagline: 'Irtoperät ja kontit · Skandinavia',

  greeting: 'Hei,',

  invite: {
    heading: (company) => `${company} on hyväksytty RAHTIS-palveluun`,
    subject: (company) => `RAHTIS · tunnukset yritykselle ${company}`,
    preheader: 'Aseta salasana ja kirjaudu sisään.',
    body:
      'Yrityksenne tiedot on tarkistettu ja pääsy palveluun on avattu. ' +
      'Aseta salasana alla olevasta linkistä, niin pääset kirjautumaan sisään.',
    button: 'Aseta salasana',
    note: (operator) =>
      'Linkki on kertakäyttöinen ja voimassa vuorokauden. ' +
      `Jos se ehtii vanhentua, pyydä uusi osoitteesta ${operator}.`,
  },

  recovery: {
    heading: 'Salasanan palautus',
    subject: 'RAHTIS · salasanan palautus',
    preheader: 'Aseta uusi salasana vuorokauden sisällä.',
    body: 'Pyysit uutta salasanaa RAHTIS-tunnuksellesi. Aseta se alla olevasta linkistä.',
    button: 'Aseta uusi salasana',
    note:
      'Linkki on kertakäyttöinen ja voimassa vuorokauden. ' +
      'Jos et pyytänyt uutta salasanaa, voit jättää viestin huomiotta — ' +
      'salasanasi ei muutu ennen kuin linkkiä käytetään.',
  },

  application: {
    heading: 'Hakemuksenne on vastaanotettu',
    subject: (company) => `RAHTIS · hakemus vastaanotettu — ${company}`,
    preheader: 'Hakemus on kirjattu ja siirtynyt tarkastukseen.',
    thanks:
      'Kiitos hakemuksesta. Se on kirjattu ja siirtynyt tarkastukseen: ' +
      'käymme yrityksenne tiedot läpi PRH:n ja YTJ:n rekistereistä.',
    next:
      'Kun hakemus on hyväksytty, lähetämme tähän samaan osoitteeseen linkin, ' +
      'jolla asetat salasanan ja pääset kirjautumaan sisään. Sitä ennen ' +
      'palveluun ei pääse kirjautumaan.',
    note: (operator) =>
      'Tarkastuksen tekee ihminen, joten vastaus tulee arkipäivien aikana. ' +
      `Jos jokin tiedoista on väärin tai haluat kysyä hakemuksesta, vastaa tähän viestiin tai kirjoita osoitteeseen ${operator}.`,
    fieldCompany: 'Yritys',
    fieldBusinessId: 'Y-tunnus',
    fieldRole: 'Rooli',
    fieldEmail: 'Sähköposti',
  },

  dispatch: {
    subject: (ref, from, to) => `RAHTIS · uusi kuljetus ${ref} · ${from} → ${to}`,
    heading: (from, to) => `Uusi kuljetus: ${from} → ${to}`,
    preheader: (ref) => `Kuljetus ${ref} on avoimena tarjouspöydällä.`,
    lead: 'Kuljetus on avoinna tarjouspöydällä. Ensimmäiset kolme tarjousta pääsevät mukaan.',
    button: 'Avaa tarjouspöytä',
    note: 'Saat tämän viestin, koska yritykselläsi on hyväksytty auto palvelussa.',
    fieldOrder: 'Kuljetus',
    fieldPickup: 'Nouto',
    fieldRoute: 'Reitti',
    fieldUnit: 'Yksikkö',
    fieldDistance: 'Matka',
    fieldRate: 'Hinta',
  },

  direct: {
    subject: (ref, plate) => `RAHTIS · suora tilaus ${ref} autolle ${plate}`,
    heading: (plate) => `Suora tilaus autolle ${plate}`,
    preheader: (shipper) => `${shipper} lähetti kuljetuksen suoraan autollenne.`,
    lead: (shipper) =>
      `${shipper} lähetti kuljetuksen suoraan autollenne ohi yhteisen pöydän. Määräaikaa ei ole: kuljetus odottaa, kunnes te tai kuljettaja vahvistatte sen. Jos kieltäydytte, kuljetus siirtyy yhteiselle pöydälle.`,
    button: 'Vahvista tai kieltäydy',
    note: 'Saat tämän viestin, koska olet sallinut tälle tilaajalle suorat tilaukset. Luvan voi perua Asiakkaat-sivulla.',
  },

  billing: {
    invoicedSubject: (ref) => `RAHTIS · lasku kuljetuksesta ${ref}`,
    invoicedHeading: (ref) => `Lasku kuljetuksesta ${ref}`,
    invoicedLead: (vat) =>
      vat
        ? `Kuljetuksesta on lähetetty lasku. Laskuttaja on Aivomaa Oy (RAHTIS); summaan lisätään arvonlisävero ${vat}.`
        : 'Kuljetuksesta on lähetetty lasku. Laskuttaja on Aivomaa Oy (RAHTIS). Käännetty verovelvollisuus: ostaja tilittää veron omassa maassaan.',
    settledSubject: (ref) => `RAHTIS · tilitys kuljetuksesta ${ref}`,
    settledHeading: (ref) => `Tilitys kuljetuksesta ${ref}`,
    settledLead: (vat) =>
      vat
        ? `Kuljetuksesta on maksettu tilitys. Maksaja on Aivomaa Oy (RAHTIS); summaan sisältyy arvonlisävero ${vat}.`
        : 'Kuljetuksesta on maksettu tilitys. Maksaja on Aivomaa Oy (RAHTIS). Käännetty verovelvollisuus: summa on alv 0 %.',
    preheader: (amount) => `Summa ${amount}.`,
    fieldOrder: 'Kuljetus',
    fieldAmount: 'Veroton summa',
    fieldVat: (rate) => `ALV ${rate}`,
    fieldTotal: 'Yhteensä',
    fieldInvoice: 'Laskun numero',
    fieldSeller: 'Laskuttaja',
    fieldPayer: 'Maksaja',
    fieldBusinessId: 'Y-tunnus',
    fieldVatNumber: 'ALV-tunniste',
    fieldAddress: 'Osoite',
    fieldAccount: 'Tili',
    fieldReference: 'Viite',
    questions: (operator) => `Kysymykset: ${operator}`,
  },
};

const en: Texts = {
  signature: 'Rahtis Team',
  neverAsk: 'We never ask for your password by email or over the phone.',
  brandTagline: 'Trailers and containers · Scandinavia',

  greeting: 'Hello,',

  invite: {
    heading: (company) => `${company} has been approved for RAHTIS`,
    subject: (company) => `RAHTIS · credentials for ${company}`,
    preheader: 'Set a password and sign in.',
    body:
      'We have checked your company details and opened access to the service. ' +
      'Set a password from the link below and you can sign in.',
    button: 'Set a password',
    note: (operator) =>
      'The link works once and is valid for 24 hours. ' +
      `If it expires, ask for a new one at ${operator}.`,
  },

  recovery: {
    heading: 'Password reset',
    subject: 'RAHTIS · password reset',
    preheader: 'Set a new password within 24 hours.',
    body: 'You asked for a new password for your RAHTIS account. Set it from the link below.',
    button: 'Set a new password',
    note:
      'The link works once and is valid for 24 hours. ' +
      'If you did not ask for a new password, you can ignore this message — ' +
      'your password does not change until the link is used.',
  },

  application: {
    heading: 'We have received your application',
    subject: (company) => `RAHTIS · application received — ${company}`,
    preheader: 'The application is logged and under review.',
    thanks:
      'Thank you for your application. It has been logged and is now under review: ' +
      'we check company details against the Finnish PRH and YTJ registers.',
    next:
      'Once the application is approved we will send a link to this same address, ' +
      'where you set a password and can sign in. Until then the service cannot be ' +
      'signed into.',
    note: (operator) =>
      'A person does the review, so the answer comes during business days. ' +
      `If any of the details are wrong, or you want to ask about the application, reply to this message or write to ${operator}.`,
    fieldCompany: 'Company',
    fieldBusinessId: 'Y-tunnus',
    fieldRole: 'Role',
    fieldEmail: 'Email',
  },

  dispatch: {
    subject: (ref, from, to) => `RAHTIS · new transport ${ref} · ${from} → ${to}`,
    heading: (from, to) => `New transport: ${from} → ${to}`,
    preheader: (ref) => `Transport ${ref} is open on the load board.`,
    lead: 'This transport is open on the load board. The first three offers get in.',
    button: 'Open the load board',
    note: 'You are getting this because your company has an approved vehicle on the platform.',
    fieldOrder: 'Transport',
    fieldPickup: 'Pickup',
    fieldRoute: 'Route',
    fieldUnit: 'Unit',
    fieldDistance: 'Distance',
    fieldRate: 'Price',
  },

  direct: {
    subject: (ref, plate) => `RAHTIS · direct order ${ref} for ${plate}`,
    heading: (plate) => `Direct order for ${plate}`,
    preheader: (shipper) => `${shipper} sent a transport straight to your vehicle.`,
    lead: (shipper) =>
      `${shipper} sent this transport straight to your vehicle, bypassing the load board. There is no deadline: it waits until you or the driver confirm it. If you decline, it goes to the load board.`,
    button: 'Confirm or decline',
    note: 'You are getting this because you allowed this shipper to send you direct orders. You can withdraw that on the Customers page.',
  },

  billing: {
    invoicedSubject: (ref) => `RAHTIS · invoice for transport ${ref}`,
    invoicedHeading: (ref) => `Invoice for transport ${ref}`,
    invoicedLead: (vat) =>
      vat
        ? `An invoice for this transport has been sent. The seller is Aivomaa Oy (RAHTIS); VAT ${vat} is added to the amount.`
        : 'An invoice for this transport has been sent. The seller is Aivomaa Oy (RAHTIS). Reverse charge: the buyer accounts for the tax in their own country.',
    settledSubject: (ref) => `RAHTIS · payout for transport ${ref}`,
    settledHeading: (ref) => `Payout for transport ${ref}`,
    settledLead: (vat) =>
      vat
        ? `The payout for this transport has been paid. The payer is Aivomaa Oy (RAHTIS); the amount includes VAT ${vat}.`
        : 'The payout for this transport has been paid. The payer is Aivomaa Oy (RAHTIS). Reverse charge: the amount is at VAT 0%.',
    preheader: (amount) => `Amount ${amount}.`,
    fieldOrder: 'Transport',
    fieldAmount: 'Net amount',
    fieldVat: (rate) => `VAT ${rate}`,
    fieldTotal: 'Total',
    fieldInvoice: 'Invoice number',
    fieldSeller: 'Seller',
    fieldPayer: 'Payer',
    fieldBusinessId: 'Business ID',
    fieldVatNumber: 'VAT no.',
    fieldAddress: 'Address',
    fieldAccount: 'Account',
    fieldReference: 'Reference',
    questions: (operator) => `Questions: ${operator}`,
  },
};

const TEXTS: Record<EmailLocale, Texts> = { fi, en };

/** Тексты письма на языке переписки. */
export function emailText(locale: EmailLocale): Texts {
  return TEXTS[locale];
}

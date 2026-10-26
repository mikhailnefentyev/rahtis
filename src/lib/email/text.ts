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

/**
 * Язык переписки: финский — по-фински, любой другой (английский,
 * шведский, польский…) — по-английски: писем на других языках нет.
 * Пустой — по-фински, как было до языков интерфейса.
 */
export function emailLocaleOf(language: string | null | undefined): EmailLocale {
  return !language || language === 'fi' ? 'fi' : 'en';
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

  /** Главный пользователь компании приглашает диспетчера. */
  memberInvite: {
    subject: (company: string) => string;
    heading: (company: string) => string;
    preheader: string;
    body: (company: string) => string;
    button: string;
    note: string;
  };

  /** Перевозчик приглашает своего заказчика. */
  shipperInvite: {
    subject: (carrier: string) => string;
    heading: (carrier: string) => string;
    preheader: string;
    body: (carrier: string) => string;
    points: string[];
    button: string;
    note: (operator: string) => string;
  };

  /** Перевозчик приглашает другого перевозчика. */
  carrierInvite: {
    subject: (carrier: string) => string;
    heading: (carrier: string) => string;
    preheader: string;
    body: (carrier: string) => string;
    points: string[];
    button: string;
    note: (operator: string) => string;
  };

  /** Клиенту перевозчика: ссылка на ход его рейса. */
  ownTrack: {
    subject: (carrier: string, ref: string) => string;
    heading: (carrier: string) => string;
    preheader: string;
    body: (carrier: string) => string;
    route: (route: string) => string;
    button: string;
    note: (carrier: string) => string;
  };

  /** Приглашение от самой платформы: ежедневная рассылка оператора (outreach_targets). */
  operatorInvite: Record<
    'SHIPPER' | 'CARRIER',
    {
      subject: string;
      heading: string;
      preheader: string;
      body: string;
      points: string[];
      button: string;
    }
  > & { note: (operator: string) => string };

  /** Напоминания застрявшим на пути к первой работе (2, 5, 10 день на шаге). */
  onboarding: {
    subject: Record<'ACTIVATE' | 'SETUP' | 'FIRST_ORDER', (company: string) => string>;
    heading: Record<'ACTIVATE' | 'SETUP' | 'FIRST_ORDER', string>;
    body: Record<'ACTIVATE' | 'SETUP' | 'FIRST_ORDER', string>;
    button: Record<'ACTIVATE' | 'SETUP' | 'FIRST_ORDER', string>;
    help: (operator: string) => string;
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

  /* Отказ по заявке: текст пишет оператор, письмо только обрамляет его. */
  rejected: {
    heading: string;
    subject: (company: string) => string;
    preheader: string;
    note: (operator: string) => string;
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

  /*
   * Срок удостоверения водителя подходит к концу (6, 3, 1 месяц).
   * Уходит перевозчику: ему нужен допущенный водитель. Результатов
   * тренажёра в письме нет и быть не может.
   */
  certificate: {
    subject: (driver: string, type: string) => string;
    heading: (driver: string) => string;
    preheader: (type: string, date: string) => string;
    lead: (driver: string, type: string, date: string) => string;
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
  signature: 'RAHTIS-tiimi',
  neverAsk: 'Emme koskaan kysy salasanaanne sähköpostitse emmekä puhelimitse.',
  brandTagline: 'Irtoperät ja kontit · Pohjois-Eurooppa',

  greeting: 'Hei,',

  memberInvite: {
    subject: (company) => `RAHTIS · ${company} lisäsi teidät käyttäjäksi`,
    heading: (company) => `${company} kutsuu teidät RAHTIS-palveluun`,
    preheader: 'Asettakaa salasana ja kirjautukaa sisään.',
    body: (company) =>
      `${company} on lisännyt teidät yrityksen käyttäjäksi RAHTIS-palveluun. ` +
      'Saatte omat henkilökohtaiset tunnukset: asettakaa salasana alla olevasta linkistä, niin pääsette kirjautumaan sisään.',
    button: 'Aseta salasana',
    note:
      'Linkki on kertakäyttöinen ja voimassa vuorokauden. ' +
      'Jos se ehtii vanhentua, pyytäkää uusi kutsu yrityksenne pääkäyttäjältä. Jos ette odottaneet tätä viestiä, voitte jättää sen huomiotta.',
  },

  invite: {
    heading: (company) => `${company} on hyväksytty RAHTIS-palveluun`,
    subject: (company) => `RAHTIS · tunnukset yritykselle ${company}`,
    preheader: 'Asettakaa salasana ja kirjautukaa sisään.',
    body:
      'Olemme tarkistaneet yrityksenne tiedot ja avanneet teille pääsyn palveluun. ' +
      'Asettakaa salasana alla olevasta linkistä, niin pääsette kirjautumaan sisään.',
    button: 'Aseta salasana',
    note: (operator) =>
      'Linkki on kertakäyttöinen ja voimassa vuorokauden. ' +
      `Jos se ehtii vanhentua, pyytäkää uusi osoitteesta ${operator}.`,
  },

  shipperInvite: {
    subject: (carrier) => `${carrier} kutsuu teidät RAHTIS-palveluun`,
    heading: (carrier) => `${carrier} kutsuu teidät RAHTIKSEEN`,
    preheader: 'Tilatkaa kuljetukset suoraan tutulta kuljetusliikkeeltä, kaikki yhdessä paikassa.',
    body: (carrier) =>
      `Kuljetusliikkeenne ${carrier} käyttää RAHTIS-palvelua ja kutsuu teidät tilaamaan kuljetukset sen kautta.`,
    points: [
      'Suora tilaus tutulle autolle muutamalla napautuksella.',
      'Seuraatte kuljetusta: saapumiset, kuittaukset, kuvat ja rahtikirjat samassa paikassa.',
      'Tarvittaessa saman tilauksen voi laittaa tarjouspöydälle muille kuljetusliikkeille.',
    ],
    button: 'Hae mukaan — tiedot on täytetty valmiiksi',
    note: (operator) =>
      `Tarkistamme hakemuksen ennen kuin lähetämme tunnukset. Jos ette odottaneet tätä viestiä, voitte jättää sen huomiotta tai kirjoittaa osoitteeseen ${operator}.`,
  },

  carrierInvite: {
    subject: (carrier) => `${carrier} kutsuu kuljetusliikkeenne RAHTIS-palveluun`,
    heading: (carrier) => `${carrier} kutsuu teidät RAHTIKSEEN`,
    preheader: 'Kalusto, kuljettajat ja omat asiakkaat yhdessä paikassa — ja keikkoja tarjouspöydältä.',
    body: (carrier) => `${carrier} käyttää RAHTIS-palvelua ja kutsuu kuljetusliikkeenne mukaan.`,
    points: [
      'Keikkoja tarjouspöydältä: perävaunujen vaihdot, kontit ja pikakuljetukset satamissa ja koko Suomessa.',
      'Kuljettajan sovellus kymmenellä kielellä: saapumiset, kuvat ja rahtikirjat ilman paperia.',
      'Omat asiakkaat samaan paikkaan: 29,90 € kuukaudessa jokaisesta ajossa olleesta autosta, ensimmäinen kuukausi maksutta.',
    ],
    button: 'Hae mukaan — tiedot on täytetty valmiiksi',
    note: (operator) =>
      `Tarkistamme hakemuksen ennen kuin lähetämme tunnukset. Jos ette odottaneet tätä viestiä, voitte jättää sen huomiotta tai kirjoittaa osoitteeseen ${operator}.`,
  },

  ownTrack: {
    subject: (carrier, ref) => `${carrier} · kuljetus ${ref}`,
    heading: (carrier) => `${carrier} hoitaa kuljetuksenne`,
    preheader: 'Kuljetuksen eteneminen ja rahtikirja samasta linkistä.',
    body: (carrier) => `${carrier} hoitaa kuljetuksenne. Näette sen etenemisen RAHTIS-palvelussa.`,
    route: (route) => `Reitti: ${route}`,
    button: 'Seuraa kuljetusta',
    note: (carrier) =>
      `Linkki toimii ilman tunnuksia. Kysymykset kuljetuksesta: ${carrier}. Jos ette odottaneet tätä viestiä, voitte jättää sen huomiotta.`,
  },

  operatorInvite: {
    SHIPPER: {
      subject: 'RAHTIS — rahtipörssi ja suorat tilaukset omille kuljetusliikkeillenne, ensimmäinen kuukausi maksutta',
      heading: 'Perävaunu, kontti tai kuorma: julkaisette kerran ja seuraatte joka vaihetta',
      preheader: 'Yksi julkaisu alueen hyväksytyille kuljetusliikkeille tai suoraan tutulle autolle — tarjoukset, eteneminen, kuvat ja rahtikirja yhdessä näkymässä.',
      body: 'RAHTIS on kuljetusten hallintajärjestelmä ja rahtipörssi, joka toimii Pohjoismaissa, Baltiassa, Puolassa ja Saksassa. Julkaisette kuljetuksen kerran, ja se menee suoraan alueen hyväksytyille kuljetusliikkeille — tai lähetätte sen suoraan tutulle autolle. Perävaunujen vaihdot, kontit sekä pakettiauto- ja kuorma-autokuljetukset.',
      points: [
        'Enintään kolme tarjousta samassa näkymässä — valitsette hinnan, kaluston ja arvioiden perusteella. Hintaa ei huutokaupata alas.',
        'Jos auto peruu tai ei vahvista, kuljetus palaa tarjouspöydälle automaattisesti ja menee heti seuraaville sopiville autoille.',
        'Muutokset menevät suoraan kuljetusliikkeelle ja kuljettajalle; kuvat ja rahtikirja tulevat, kun kuljetus on perillä.',
        'Viikkoraportti ja maksuton rajapinta (API) omaan ERP- tai TMS-järjestelmäänne.',
        'Ensimmäinen kuukausi maksutta.',
      ],
      button: 'Hae mukaan',
    },
    CARRIER: {
      subject: 'RAHTIS — kuljetusten hallinta ja rahtipörssi kuljetusliikkeelle, ensimmäinen kuukausi maksutta',
      heading: 'Kalusto hallintaan, vapaat autot ajoon',
      preheader: 'Kalusto, kuljettajat ja omat asiakkaat yhdessä paikassa — ja keikkoja tarjouspöydältä, kun auto on vapaana.',
      body: 'RAHTIS on kuljetusten hallintajärjestelmä ja rahtipörssi, joka toimii Pohjoismaissa, Baltiassa, Puolassa ja Saksassa. Hallitsette kalustoa, kuljettajia ja omia asiakkaitanne samassa paikassa ja saatte keikkoja tarjouspöydältä, kun auto on vapaana: perävaunujen vaihdot, kontit sekä pakettiauto- ja kuorma-autokuljetukset.',
      points: [
        'Omat asiakkaat ja omat keikat: asiakas tilaa suoraan autollenne ja saa seurantalinkin. 29,90 € kuukaudessa jokaisesta ajossa olleesta autosta, ei prosenttia.',
        'Kuljettajan sovellus kymmenellä kielellä: saapumiset, kuvat, työaika ja rahtikirja skannattuna PDF:ksi.',
        'Keikkoja tarjouspöydältä satamista ja koko toiminta-alueelta. Alihankintakeikoista 3 % keikan hinnasta, ei kuukausimaksua.',
      ],
      button: 'Hae mukaan',
    },
    note: (operator) =>
      `Lähetimme tämän viestin yrityksenne julkiseen sähköpostiosoitteeseen. Jos ette halua viestejä meiltä, vastatkaa tähän viestiin, niin emme lähetä enempää. Kysymykset: ${operator}.`,
  },

  onboarding: {
    subject: {
      ACTIVATE: (company) => `RAHTIS · ${company}: kaksi minuuttia käyttöönottoon`,
      SETUP: (company) => `RAHTIS · ${company}: lisätkää auto, niin tarjouspöytä aukeaa`,
      FIRST_ORDER: (company) => `RAHTIS · ${company}: ensimmäinen kuljetus`,
    },
    heading: {
      ACTIVATE: 'Yrityksenne on hyväksytty — viimeistellään käyttöönotto',
      SETUP: 'Tarjouspöytä on vielä kiinni',
      FIRST_ORDER: 'Valmiina ensimmäiseen kuljetukseen',
    },
    body: {
      ACTIVATE:
        'Haemme osoitteen valmiiksi kaupparekisteristä, jos se löytyy sieltä. Lisätkää tilinumero, tarkistakaa tiedot ja hyväksykää ehdot — sen jälkeen voitte ladata luvat ja lisätä autot.',
      SETUP:
        'Avoimet kuljetukset näkyvät, kun liikennelupa ja vakuutus on ladattu, vähintään yksi auto on hyväksytty ja autolla on kuljettaja. Omien sivujen etusivulta näette, mikä vaihe vielä puuttuu.',
      FIRST_ORDER:
        'Julkaiskaa kuljetus tarjouspöydälle tai lähettäkää se suoraan tutulle autolle. Näette etenemisen, kuvat ja rahtikirjan samassa paikassa.',
    },
    button: {
      ACTIVATE: 'Viimeistele käyttöönotto',
      SETUP: 'Avaa omat sivut',
      FIRST_ORDER: 'Uusi tilaus',
    },
    help: (operator) => `Jos jokin on epäselvää, vastatkaa tähän viestiin tai kirjoittakaa osoitteeseen ${operator} — autamme mielellämme.`,
  },

  recovery: {
    heading: 'Salasanan palautus',
    subject: 'RAHTIS · salasanan palautus',
    preheader: 'Asettakaa uusi salasana vuorokauden sisällä.',
    body: 'Pyysitte uutta salasanaa RAHTIS-tunnuksellenne. Asettakaa se alla olevasta linkistä.',
    button: 'Aseta uusi salasana',
    note:
      'Linkki on kertakäyttöinen ja voimassa vuorokauden. ' +
      'Jos ette pyytäneet uutta salasanaa, voitte jättää viestin huomiotta — ' +
      'salasananne ei muutu, ellei linkkiä käytetä.',
  },

  application: {
    heading: 'Hakemuksenne on vastaanotettu',
    subject: (company) => `RAHTIS · hakemus vastaanotettu — ${company}`,
    preheader: 'Hakemus on kirjattu ja odottaa tarkistusta.',
    thanks:
      'Kiitos hakemuksesta. Se on kirjattu ja odottaa tarkistusta: ' +
      'käymme yrityksenne tiedot läpi PRH:n ja YTJ:n rekistereistä.',
    next:
      'Kun hakemus on hyväksytty, lähetämme tähän samaan osoitteeseen linkin, ' +
      'jolla asetatte salasanan ja pääsette kirjautumaan sisään. Sitä ennen ' +
      'palveluun ei pääse kirjautumaan.',
    note: (operator) =>
      'Hakemuksen tarkistaa ihminen, joten vastaus tulee arkipäivisin. ' +
      `Jos jokin tiedoista on väärin tai haluatte kysyä hakemuksesta, vastatkaa tähän viestiin tai kirjoittakaa osoitteeseen ${operator}.`,
    fieldCompany: 'Yritys',
    fieldBusinessId: 'Y-tunnus',
    fieldRole: 'Rooli',
    fieldEmail: 'Sähköposti',
  },

  rejected: {
    heading: 'Päätös hakemuksesta',
    subject: (company) => `RAHTIS · päätös hakemuksesta — ${company}`,
    preheader: 'Hakemuksenne on käsitelty.',
    note: (operator) =>
      `Jos haluatte kysyä päätöksestä, vastatkaa tähän viestiin tai kirjoittakaa osoitteeseen ${operator}.`,
  },

  dispatch: {
    subject: (ref, from, to) => `RAHTIS · uusi kuljetus ${ref} · ${from} → ${to}`,
    heading: (from, to) => `Uusi kuljetus: ${from} → ${to}`,
    preheader: (ref) => `Kuljetus ${ref} on avoinna tarjouspöydällä.`,
    lead: 'Kuljetus on avoinna tarjouspöydällä. Kolme ensimmäistä tarjousta pääsee mukaan.',
    button: 'Avaa tarjouspöytä',
    note: 'Saatte tämän viestin, koska yrityksellänne on palvelussa hyväksytty auto.',
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
      `${shipper} lähetti kuljetuksen suoraan autollenne, ohi tarjouspöydän. Määräaikaa ei ole: kuljetus odottaa, kunnes te tai kuljettaja vahvistatte sen. Jos kieltäydytte, kuljetus siirtyy tarjouspöydälle.`,
    button: 'Vahvista tai kieltäydy',
    note: 'Saatte tämän viestin, koska olette sallineet tälle tilaajalle suorat tilaukset. Luvan voi perua Asiakkaat-sivulla.',
  },

  certificate: {
    subject: (driver, type) => `${driver}: ${type} vanhenee pian`,
    heading: (driver) => `Kuljettajan ${driver} pätevyys on vanhenemassa`,
    preheader: (type, date) => `${type} on voimassa ${date} asti.`,
    lead: (driver, type, date) => `Kuljettajan ${driver} ${type} on voimassa ${date} asti. Huolehtikaa, että se uusitaan ajoissa, jotta kuljettaja voi jatkaa ajoja.`,
    button: 'Avaa kuljettajan tiedot',
    note: 'Kun pätevyys on uusittu, päivittäkää uusi päättymispäivä kuljettajan tietoihin tai pyytäkää kuljettajaa tekemään se sovelluksessa.',
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
        ? `Kuljetuksen tilitys on maksettu. Maksaja on Aivomaa Oy (RAHTIS); summaan sisältyy arvonlisävero ${vat}.`
        : 'Kuljetuksen tilitys on maksettu. Maksaja on Aivomaa Oy (RAHTIS). Käännetty verovelvollisuus: summa on ALV 0 %.',
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
    fieldAccount: 'Tilinumero',
    fieldReference: 'Viitenumero',
    questions: (operator) => `Kysymykset: ${operator}`,
  },
};

const en: Texts = {
  signature: 'The RAHTIS team',
  neverAsk: 'We never ask for your password by email or over the phone.',
  brandTagline: 'Trailers and containers · Northern Europe',

  greeting: 'Hello,',

  memberInvite: {
    subject: (company) => `RAHTIS · ${company} added you as a user`,
    heading: (company) => `${company} invites you to RAHTIS`,
    preheader: 'Set a password and sign in.',
    body: (company) =>
      `${company} has added you as a user of its RAHTIS account. ` +
      'You get your own personal login: set a password using the link below, and then you can sign in.',
    button: 'Set password',
    note:
      'The link works once and is valid for 24 hours. ' +
      'If it expires, ask your company’s main user for a new invitation. If you weren’t expecting this email, you can ignore it.',
  },

  invite: {
    heading: (company) => `${company} has been approved for RAHTIS`,
    subject: (company) => `RAHTIS · login for ${company}`,
    preheader: 'Set a password and sign in.',
    body:
      'We have checked your company details and opened your access to the service. ' +
      'Set a password using the link below, and then you can sign in.',
    button: 'Set password',
    note: (operator) =>
      'The link works once and is valid for 24 hours. ' +
      `If it expires, ask for a new one at ${operator}.`,
  },

  shipperInvite: {
    subject: (carrier) => `${carrier} invites you to RAHTIS`,
    heading: (carrier) => `${carrier} invites you to RAHTIS`,
    preheader: 'Book transport directly with a carrier you know, all in one place.',
    body: (carrier) => `Your carrier ${carrier} uses RAHTIS and invites you to book your transport through it.`,
    points: [
      'Book a truck you know directly in a few taps.',
      'Follow each shipment: arrivals, sign-offs, photos and consignment notes in one place.',
      'If needed, send the same order to the load board for other carriers.',
    ],
    button: 'Apply — your details are already filled in',
    note: (operator) =>
      `We check each application before sending a login. If you weren’t expecting this email, you can ignore it or write to ${operator}.`,
  },

  carrierInvite: {
    subject: (carrier) => `${carrier} invites your haulage company to RAHTIS`,
    heading: (carrier) => `${carrier} invites you to RAHTIS`,
    preheader: 'Fleet, drivers and your own customers in one place — plus jobs from the load board.',
    body: (carrier) => `${carrier} uses RAHTIS and invites your haulage company to join.`,
    points: [
      'Jobs from the load board: trailer swaps, containers and express runs in ports and across Finland.',
      'A driver app in ten languages: arrivals, photos and consignment notes, no paper.',
      'Your own customers in the same place: €29.90 a month for each truck that was on the road, first month free.',
    ],
    button: 'Apply — your details are already filled in',
    note: (operator) =>
      `We check each application before sending a login. If you weren’t expecting this email, you can ignore it or write to ${operator}.`,
  },

  ownTrack: {
    subject: (carrier, ref) => `${carrier} · shipment ${ref}`,
    heading: (carrier) => `${carrier} is handling your shipment`,
    preheader: 'Shipment progress and consignment note in one link.',
    body: (carrier) => `${carrier} is handling your shipment. You can follow its progress in RAHTIS.`,
    route: (route) => `Route: ${route}`,
    button: 'Track shipment',
    note: (carrier) =>
      `The link works without an account. Questions about the shipment: ${carrier}. If you weren’t expecting this email, you can ignore it.`,
  },

  operatorInvite: {
    SHIPPER: {
      subject: 'RAHTIS — freight exchange and direct orders to your own carriers, first month free',
      heading: 'Trailer, container or load: post it once, follow every step',
      preheader: 'One posting to approved carriers in the area, or straight to a truck you know — offers, progress, photos and consignment note in one view.',
      body: 'RAHTIS is a transport management system and freight exchange covering the Nordics, the Baltics, Poland and Germany. You post a job once and it goes straight to approved carriers in the area — or you send it directly to a truck you know. Trailer swaps, containers, and van and truck loads.',
      points: [
        'Up to three offers in one view — you choose on price, equipment and ratings. No auctions driving the price down.',
        'If a truck cancels or doesn’t confirm, the job goes back on the load board automatically and reaches the next suitable trucks straight away.',
        'Changes go straight to the carrier and the driver; photos and the consignment note arrive when the delivery is done.',
        'A weekly report and a free API for your own ERP or TMS.',
        'First month free.',
      ],
      button: 'Apply',
    },
    CARRIER: {
      subject: 'RAHTIS — transport management and freight exchange for haulage companies, first month free',
      heading: 'Your fleet under control, idle trucks back on the road',
      preheader: 'Fleet, drivers and your own customers in one place — plus jobs from the load board when a truck is free.',
      body: 'RAHTIS is a transport management system and freight exchange covering the Nordics, the Baltics, Poland and Germany. You manage your fleet, drivers and customers in one place and pick up jobs from the load board when a truck is free: trailer swaps, containers, and van and truck loads.',
      points: [
        'Your own customers and your own jobs: the customer books your truck directly and gets a tracking link. €29.90 a month for each truck that was on the road, no percentage.',
        'A driver app in ten languages: arrivals, photos, working hours and the consignment note scanned to PDF.',
        'Jobs from the load board, from ports and across your whole operating area. Subcontracted jobs cost 3% of the job price, with no monthly fee.',
      ],
      button: 'Apply',
    },
    note: (operator) =>
      `We sent this email to your company’s public email address. If you don’t want to hear from us, reply to this email and we won’t write again. Questions: ${operator}.`,
  },

  onboarding: {
    subject: {
      ACTIVATE: (company) => `RAHTIS · ${company}: two minutes to get started`,
      SETUP: (company) => `RAHTIS · ${company}: add a truck to open the load board`,
      FIRST_ORDER: (company) => `RAHTIS · ${company}: your first transport order`,
    },
    heading: {
      ACTIVATE: 'Your company is approved — let’s finish the setup',
      SETUP: 'The load board is still closed',
      FIRST_ORDER: 'Ready for your first transport order',
    },
    body: {
      ACTIVATE:
        'We fill in your address from the trade register if it’s listed there. Add your bank account number, check the details and accept the terms — then you can upload your licences and add your trucks.',
      SETUP:
        'Open jobs become visible once your operator licence and insurance are uploaded, at least one truck is approved and that truck has a driver. The home page of your account shows which step is still missing.',
      FIRST_ORDER:
        'Post a transport on the load board or send it directly to a truck you know. You see the progress, photos and consignment note in one place.',
    },
    button: {
      ACTIVATE: 'Finish setup',
      SETUP: 'Open my account',
      FIRST_ORDER: 'New order',
    },
    help: (operator) => `If anything is unclear, reply to this email or write to ${operator} — we’re happy to help.`,
  },

  recovery: {
    heading: 'Password reset',
    subject: 'RAHTIS · password reset',
    preheader: 'Set a new password within 24 hours.',
    body: 'You asked for a new password for your RAHTIS account. Set it using the link below.',
    button: 'Set new password',
    note:
      'The link works once and is valid for 24 hours. ' +
      'If you didn’t ask for a new password, you can ignore this email — ' +
      'your password won’t change unless the link is used.',
  },

  application: {
    heading: 'We have received your application',
    subject: (company) => `RAHTIS · application received — ${company}`,
    preheader: 'Your application is logged and waiting for review.',
    thanks:
      'Thank you for your application. It has been logged and is waiting for review: ' +
      'we check your company details against the Finnish PRH and YTJ registers.',
    next:
      'Once the application is approved, we will send a link to this same address ' +
      'where you can set a password and sign in. Until then, you ' +
      'can’t sign in to the service.',
    note: (operator) =>
      'A person reviews every application, so we reply on business days. ' +
      `If any of the details are wrong, or you have a question about the application, reply to this email or write to ${operator}.`,
    fieldCompany: 'Company',
    fieldBusinessId: 'Business ID',
    fieldRole: 'Role',
    fieldEmail: 'Email',
  },

  rejected: {
    heading: 'Decision on your application',
    subject: (company) => `RAHTIS · decision on your application — ${company}`,
    preheader: 'Your application has been reviewed.',
    note: (operator) =>
      `If you have questions about the decision, reply to this email or write to ${operator}.`,
  },

  dispatch: {
    subject: (ref, from, to) => `RAHTIS · new job ${ref} · ${from} → ${to}`,
    heading: (from, to) => `New job: ${from} → ${to}`,
    preheader: (ref) => `Job ${ref} is open on the load board.`,
    lead: 'This job is open on the load board. The first three offers get through.',
    button: 'Open load board',
    note: 'You’re getting this email because your company has an approved truck on RAHTIS.',
    fieldOrder: 'Job',
    fieldPickup: 'Pickup',
    fieldRoute: 'Route',
    fieldUnit: 'Unit',
    fieldDistance: 'Distance',
    fieldRate: 'Price',
  },

  direct: {
    subject: (ref, plate) => `RAHTIS · direct order ${ref} for ${plate}`,
    heading: (plate) => `Direct order for ${plate}`,
    preheader: (shipper) => `${shipper} sent a job straight to your truck.`,
    lead: (shipper) =>
      `${shipper} sent this job straight to your truck, bypassing the load board. There is no deadline: it waits until you or the driver confirm it. If you decline, it goes to the load board.`,
    button: 'Confirm or decline',
    note: 'You’re getting this email because you allowed this shipper to send you direct orders. You can turn that off on the Customers page.',
  },

  certificate: {
    subject: (driver, type) => `${driver}: ${type} expires soon`,
    heading: (driver) => `A qualification of ${driver} is about to expire`,
    preheader: (type, date) => `${type} is valid until ${date}.`,
    lead: (driver, type, date) => `${driver}’s ${type} is valid until ${date}. Make sure it is renewed in time so the driver can keep driving.`,
    button: 'Open driver details',
    note: 'Once it is renewed, update the new expiry date in the driver’s details, or ask the driver to do it in the app.',
  },

  billing: {
    invoicedSubject: (ref) => `RAHTIS · invoice for order ${ref}`,
    invoicedHeading: (ref) => `Invoice for order ${ref}`,
    invoicedLead: (vat) =>
      vat
        ? `An invoice for this order has been sent. The seller is Aivomaa Oy (RAHTIS); VAT ${vat} is added to the amount.`
        : 'An invoice for this order has been sent. The seller is Aivomaa Oy (RAHTIS). Reverse charge: the buyer accounts for the VAT in their own country.',
    settledSubject: (ref) => `RAHTIS · payout for order ${ref}`,
    settledHeading: (ref) => `Payout for order ${ref}`,
    settledLead: (vat) =>
      vat
        ? `The payout for this order has been paid. The payer is Aivomaa Oy (RAHTIS); the amount includes VAT ${vat}.`
        : 'The payout for this order has been paid. The payer is Aivomaa Oy (RAHTIS). Reverse charge: the amount is at 0% VAT.',
    preheader: (amount) => `Amount ${amount}.`,
    fieldOrder: 'Order',
    fieldAmount: 'Net amount',
    fieldVat: (rate) => `VAT ${rate}`,
    fieldTotal: 'Total',
    fieldInvoice: 'Invoice number',
    fieldSeller: 'Seller',
    fieldPayer: 'Payer',
    fieldBusinessId: 'Business ID',
    fieldVatNumber: 'VAT number',
    fieldAddress: 'Address',
    fieldAccount: 'Account number',
    fieldReference: 'Reference number',
    questions: (operator) => `Questions: ${operator}`,
  },
};

const TEXTS: Record<EmailLocale, Texts> = { fi, en };

/** Тексты письма на языке переписки. */
export function emailText(locale: EmailLocale): Texts {
  return TEXTS[locale];
}

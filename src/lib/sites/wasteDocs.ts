/**
 * Документ на перевозку грунта — по стране объекта (26.10.2026).
 *
 * Сводка требований: docs/outreach/waste-integrations/README.md.
 *
 *   FI — siirtoasiakirja (jätelaki 121 §), печатаем сами;
 *   DK — følgeseddel на каждый рейс (BEK 1452/2015 §§ 9, 12), печатаем сами;
 *   DE — обычный грунт: Wiegeschein / Liefernachweis (GewAbfV § 8 Abs. 3),
 *        печатаем сами; опасный (17 05 03*) — только eANV;
 *   SE — transportdokument: обязателен для опасного (AF 2020:614 6 kap.
 *        19 §), для обычного — по желанию; опасный ещё и в Avfallsregistret;
 *   NO — обычный: документа закон не требует, печатаем накладную по
 *        желанию; опасный — только Avfallsdeklarering;
 *   PL, LT, LV — любой вывезенный грунт только в госсистеме (BDO, GPAIS,
 *        APUS); EE — опасный сейчас, с 01.01.2027 любой — PISTRIK.
 *
 * Где нужна госсистема, RAHTIS пока туда не подаёт: страница показывает
 * это прямо и даёт данные рейса для ввода — не выдаёт свою бумагу за
 * законный документ.
 */

export type SiteCountry = 'FI' | 'SE' | 'NO' | 'DK' | 'EE' | 'LV' | 'LT' | 'PL' | 'DE';
export const SITE_COUNTRIES: readonly SiteCountry[] = ['FI', 'SE', 'NO', 'DK', 'EE', 'LV', 'LT', 'PL', 'DE'];

export function isSiteCountry(value: unknown): value is SiteCountry {
  return typeof value === 'string' && (SITE_COUNTRIES as readonly string[]).includes(value);
}

type Labels = {
  holder: string;
  carrier: string;
  receiver: string;
  time: string;
  from: string;
  to: string;
  waste: string;
  quantity: string;
  holderOk: string;
  carrierOk: string;
  receiverOk: string;
  ticket: string;
  pending: string;
};

/* Английская строка под каждой подписью — как на финском документе. */
export const LABELS_EN: Labels = {
  holder: 'Waste holder',
  carrier: 'Carrier',
  receiver: 'Receiver',
  time: 'Date and time of transport',
  from: 'Place of departure',
  to: 'Place of destination',
  waste: 'Waste code and name',
  quantity: 'Quantity',
  holderOk: 'Holder confirmation',
  carrierOk: 'Carrier confirmation',
  receiverOk: 'Receiver confirmation',
  ticket: 'Weigh ticket',
  pending: 'Awaiting the foreman’s confirmation',
};

const LABELS: Record<SiteCountry, Labels> = {
  FI: {
    holder: 'Jätteen haltija (tuottaja)', carrier: 'Kuljettaja', receiver: 'Vastaanottaja', time: 'Siirron ajankohta',
    from: 'Siirron alkamispaikka', to: 'Siirron päättymispaikka', waste: 'Jätteen nimike (jäteluettelo)', quantity: 'Määrä',
    holderOk: 'Haltijan vahvistus', carrierOk: 'Kuljettajan vahvistus', receiverOk: 'Vastaanottajan vahvistus',
    ticket: 'Punnituslippu', pending: 'Odottaa työnjohtajan vahvistusta',
  },
  SE: {
    holder: 'Avlämnare (avfallsinnehavare)', carrier: 'Transportör', receiver: 'Mottagare', time: 'Datum och tid för transporten',
    from: 'Varifrån', to: 'Vart (slutlig mottagare)', waste: 'Avfallstyp (avfallskod)', quantity: 'Vikt',
    holderOk: 'Avlämnarens bekräftelse', carrierOk: 'Transportörens bekräftelse', receiverOk: 'Mottagarens bekräftelse',
    ticket: 'Vågsedel', pending: 'Väntar på arbetsledarens bekräftelse',
  },
  NO: {
    holder: 'Avfallsbesitter', carrier: 'Transportør', receiver: 'Mottaker', time: 'Dato og tid for transporten',
    from: 'Hentested', to: 'Leveringssted', waste: 'Avfallstype (EAL-kode)', quantity: 'Mengde',
    holderOk: 'Bekreftelse fra avfallsbesitter', carrierOk: 'Bekreftelse fra transportør', receiverOk: 'Bekreftelse fra mottaker',
    ticket: 'Veieseddel', pending: 'Venter på bekreftelse fra arbeidsleder',
  },
  DK: {
    holder: 'Anmelder (bygherre)', carrier: 'Transportør (navn, adresse, CVR)', receiver: 'Modtageanlæg', time: 'Dato og tid for læsset',
    from: 'Jorden flyttes fra', to: 'Jorden flyttes til', waste: 'Jord/affald (affaldskode)', quantity: 'Mængde',
    holderOk: 'Anmelders bekræftelse', carrierOk: 'Transportørens bekræftelse', receiverOk: 'Modtagerens kvittering',
    ticket: 'Vejeseddel', pending: 'Afventer byggelederens bekræftelse',
  },
  EE: {
    holder: 'Jäätmevaldaja (üleandja)', carrier: 'Vedaja', receiver: 'Vastuvõtja', time: 'Veo kuupäev ja kellaaeg',
    from: 'Laadimiskoht', to: 'Mahalaadimiskoht', waste: 'Jäätmekood ja nimetus', quantity: 'Kogus',
    holderOk: 'Üleandja kinnitus', carrierOk: 'Vedaja kinnitus', receiverOk: 'Vastuvõtja kinnitus',
    ticket: 'Kaalukviitung', pending: 'Ootab töödejuhataja kinnitust',
  },
  LV: {
    holder: 'Atkritumu radītājs (nodevējs)', carrier: 'Pārvadātājs', receiver: 'Saņēmējs', time: 'Pārvadājuma datums un laiks',
    from: 'Iekraušanas vieta', to: 'Izkraušanas vieta', waste: 'Atkritumu klase un nosaukums', quantity: 'Daudzums',
    holderOk: 'Nodevēja apstiprinājums', carrierOk: 'Pārvadātāja apstiprinājums', receiverOk: 'Saņēmēja apstiprinājums',
    ticket: 'Svēršanas kvīts', pending: 'Gaida darbu vadītāja apstiprinājumu',
  },
  LT: {
    holder: 'Atliekų turėtojas (siuntėjas)', carrier: 'Vežėjas', receiver: 'Gavėjas (atliekų tvarkytojas)', time: 'Vežimo data ir laikas',
    from: 'Pakrovimo vieta', to: 'Iškrovimo vieta', waste: 'Atliekų kodas ir pavadinimas', quantity: 'Kiekis',
    holderOk: 'Siuntėjo patvirtinimas', carrierOk: 'Vežėjo patvirtinimas', receiverOk: 'Gavėjo patvirtinimas',
    ticket: 'Svėrimo kvitas', pending: 'Laukia darbų vadovo patvirtinimo',
  },
  PL: {
    holder: 'Przekazujący odpady (wytwórca)', carrier: 'Transportujący', receiver: 'Przejmujący odpady', time: 'Data i godzina transportu',
    from: 'Miejsce wytworzenia (budowa)', to: 'Miejsce przekazania', waste: 'Kod i rodzaj odpadu', quantity: 'Masa',
    holderOk: 'Potwierdzenie przekazującego', carrierOk: 'Potwierdzenie transportującego', receiverOk: 'Potwierdzenie przejmującego',
    ticket: 'Kwit wagowy', pending: 'Czeka na potwierdzenie kierownika budowy',
  },
  DE: {
    holder: 'Abfallerzeuger / Besitzer', carrier: 'Beförderer', receiver: 'Annahmestelle', time: 'Datum und Uhrzeit der Fuhre',
    from: 'Anfallstelle (Baustelle)', to: 'Verbleib (Annahmestelle)', waste: 'Abfallschlüssel und Bezeichnung', quantity: 'Menge',
    holderOk: 'Bestätigung Erzeuger', carrierOk: 'Bestätigung Beförderer', receiverOk: 'Bestätigung Annahmestelle',
    ticket: 'Wiegeschein', pending: 'Wartet auf Bestätigung des Bauleiters',
  },
};

/** Госсистема, без которой рейс по закону не оформить. */
type StateSystem = { name: string; url: string; local: string; en: string };

export type WasteDoc = {
  country: SiteCountry;
  /** PRINT — наш документ имеет силу; STATE — нужна госсистема, у нас только данные для ввода. */
  mode: 'PRINT' | 'STATE';
  title: string;
  titleEn: string;
  law: string;
  labels: Labels;
  /** Замечание под таблицей: на языке страны и по-английски. */
  note: { local: string; en: string } | null;
  state: StateSystem | null;
};

const SYSTEMS = {
  PL: { name: 'BDO', url: 'https://bdo.mos.gov.pl' },
  LT: { name: 'GPAIS', url: 'https://www.gpais.eu' },
  LV: { name: 'APUS', url: 'https://apus.vvd.gov.lv' },
  EE: { name: 'PISTRIK (KOTKAS)', url: 'https://kotkas.envir.ee' },
  DE: { name: 'eANV (ZKS-Abfall)', url: 'https://www.gadsys.de' },
  NO: { name: 'Avfallsdeklarering', url: 'https://avfallsdeklarering.miljodirektoratet.no' },
} as const;

/** EE: с этого дня saatekiri в PISTRIK нужен на любой отход, не только опасный. */
const EE_ALL_WASTE_FROM = '2027-01-01';

/**
 * Какой документ на рейс. day — дата рейса (YYYY-MM-DD): в Эстонии
 * требование меняется 01.01.2027.
 */
export function wasteDocFor(country: SiteCountry, hazardous: boolean, day: string): WasteDoc {
  const labels = LABELS[country];
  const print = (title: string, titleEn: string, law: string, note: WasteDoc['note'] = null): WasteDoc => ({
    country, mode: 'PRINT', title, titleEn, law, labels, note, state: null,
  });
  const state = (title: string, titleEn: string, law: string, sys: { name: string; url: string }, local: string, en: string): WasteDoc => ({
    country, mode: 'STATE', title, titleEn, law, labels, note: null, state: { ...sys, local, en },
  });

  switch (country) {
    case 'FI':
      return print('Siirtoasiakirja', 'Waste transfer document', 'Jätelaki 646/2011, 121 §');
    case 'DK':
      return print('Følgeseddel', 'Soil transport delivery note', 'Jordflytningsbekendtgørelsen (BEK nr. 1452 af 07/12/2015), §§ 9 og 12', {
        local: 'Følgesedlen er en kopi af anmeldelsen til kommunen. Transportøren påfører navn, adresse og CVR-nr. og medbringer den ved hvert læs. Anmeldelsen foretages i JordWeb eller kommunens system.',
        en: 'The delivery note is a copy of the notification to the municipality. The carrier adds its name, address and CVR number and carries it on every load.',
      });
    case 'SE':
      return print('Transportdokument för avfall', 'Waste transport document', 'Avfallsförordningen (2020:614) 6 kap. 19 §', hazardous
        ? {
            local: 'Farligt avfall: transporten ska också rapporteras till Naturvårdsverkets avfallsregister inom två arbetsdagar. RAHTIS rapporterar inte ännu – gör det i e-tjänsten.',
            en: 'Hazardous waste: the transport must also be reported to the Swedish EPA waste register within two working days. RAHTIS does not report it yet.',
          }
        : {
            local: 'Icke-farligt avfall: transportdokument krävs inte enligt lag, men dokumentet visar lass, vikt och mottagare.',
            en: 'Non-hazardous waste: not required by law; the document records load, weight and receiver.',
          });
    case 'NO':
      return hazardous
        ? state('Deklarasjon av farlig avfall', 'Hazardous waste declaration', 'Avfallsforskriften kap. 11, §§ 11-12 og 11-14', SYSTEMS.NO,
            'Farlig avfall kan ikke transporteres uten utfylt deklarasjon i Avfallsdeklarering. RAHTIS sender den ikke ennå – fyll ut deklarasjonen der med opplysningene nedenfor.',
            'Hazardous waste may not be transported without a completed declaration in Avfallsdeklarering. RAHTIS does not submit it yet – use the data below.')
        : print('Leveringsseddel for masser', 'Delivery note for excavated material', 'Avfallsforskriften / forurensningsloven § 32', {
            local: 'Rene masser: loven krever ingen egen transportdokumentasjon. Seddelen dokumenterer lass, vekt og mottak (nyttig for sluttrapport etter TEK17 § 9-9).',
            en: 'Clean material: no transport document is required by law. The note records load, weight and receiver.',
          });
    case 'DE':
      return hazardous
        ? state('Begleitschein (gefährliche Abfälle)', 'Consignment note (hazardous waste)', 'KrWG § 50, NachwV §§ 10, 17–19', SYSTEMS.DE,
            'Gefährlicher Abfall: Begleitschein nur elektronisch im eANV mit qualifizierter Signatur. RAHTIS übermittelt noch nicht – Daten unten ins eANV übernehmen.',
            'Hazardous waste: consignment note only electronically in eANV with qualified signatures. RAHTIS does not submit it yet – use the data below.')
        : print('Wiegeschein / Liefernachweis', 'Weigh ticket / delivery record', 'GewAbfV § 8 Abs. 3 (Liefer- oder Wiegescheine)', {
            local: 'Nicht gefährlicher Abfall: Nachweis der Verwertung für den Erzeuger. Wird Bodenmaterial als Ersatzbaustoff eingebaut, ist zusätzlich ein Lieferschein nach ErsatzbaustoffV § 25 (Anlage 7) mit Materialklasse nötig.',
            en: 'Non-hazardous waste: record for the producer. If soil is installed as a substitute building material, a delivery note under ErsatzbaustoffV § 25 with material class is also needed.',
          });
    case 'PL':
      return state('Karta przekazania odpadów (KPO)', 'Waste transfer card (KPO)', 'Ustawa o odpadach, art. 67 i 69', SYSTEMS.PL,
        'KPO tworzy się wyłącznie w BDO przed rozpoczęciem transportu; wydruk z RAHTIS nie zastępuje karty. RAHTIS nie łączy się jeszcze z BDO – wpisz dane poniżej w BDO.',
        'A KPO is created only in BDO before transport starts; this printout does not replace it. RAHTIS is not connected to BDO yet – enter the data below in BDO.');
    case 'LT':
      return state('Atliekų vežimo lydraštis', 'Waste transport note', 'Atliekų tvarkymo taisyklės; GPAIS', SYSTEMS.LT,
        'Lydraštis pildomas tik GPAIS (ne vėliau kaip prieš vežimą); šis spaudinys jo nepakeičia. RAHTIS dar nesujungta su GPAIS – įveskite toliau pateiktus duomenis.',
        'The transport note is made only in GPAIS before transport; this printout does not replace it. RAHTIS is not connected to GPAIS yet.');
    case 'LV':
      return state('Atkritumu pārvadājuma pavadzīme', 'Waste transport note', 'MK noteikumi Nr. 113 (18.02.2021)', SYSTEMS.LV,
        'Pavadzīmi atver APUS ne vēlāk kā pārvadājuma sākumā; šī izdruka to neaizstāj. RAHTIS vēl nav savienots ar APUS – ievadiet tālāk norādītos datus.',
        'The transport note is opened in APUS at the latest when transport starts; this printout does not replace it. RAHTIS is not connected to APUS yet.');
    case 'EE': {
      const all = day >= EE_ALL_WASTE_FROM;
      if (!hazardous && !all) {
        return print('Veoleht (koormaleht)', 'Load record', 'Jäätmeseadus', {
          local: 'Tavajäätmetele ei ole kuni 31.12.2026 jäätmeveo saatekirja nõutud. Alates 01.01.2027 tuleb iga veo kohta koostada digitaalne saatekiri PISTRIKus.',
          en: 'Until 31.12.2026 non-hazardous waste needs no transport note. From 1.1.2027 every waste transport needs a digital note in PISTRIK.',
        });
      }
      return state('Jäätmeveo saatekiri', 'Waste transport note', all ? 'Jäätmeseadus § 117¹' : 'Jäätmeseadus § 64; määrus nr 4 (15.01.2021)', SYSTEMS.EE,
        'Saatekiri koostatakse ainult PISTRIKus enne veo algust; see väljatrükk seda ei asenda. RAHTIS ei ole veel PISTRIKuga ühendatud – sisestage allolevad andmed.',
        'The transport note is made only in PISTRIK before transport starts; this printout does not replace it. RAHTIS is not connected to PISTRIK yet.');
    }
  }
}

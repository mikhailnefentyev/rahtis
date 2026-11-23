/**
 * Письма покупателю о шагах после порога просрочки (24.11.2026): о
 * дополнительном сроке (у Латвии — предупреждение со сроком) и об отказе от
 * договора (расторжении; у Финляндии, Швеции и Дании — уведомление об
 * изъятии). Язык — язык договора сделки; печатает тот же компонент, что и
 * договоры стран (CountryContractPdf.tsx): тот же шрифт, поля и подвал.
 *
 * Что в письме (docs/equipment-sale/countries/<cc>.md, п. 9 договоров):
 * кто и кому (стороны с кодами), по какому договору (номер, дата, машина),
 * просроченные взносы и их сумма, последний день оплаты (у срока), что будет
 * дальше и на каком пункте договора и законе это основано. Письмо от имени
 * продавца: подписывает и отправляет он (п. 11.2 договора), RAHTIS — нет.
 * Пункты и формулировки — из текстов договоров версии 2026-11-23.
 *
 * Без зависимостей от сервера: его проверяют тесты.
 */
import type { InstallmentRulesId } from '../countries.ts';
import type { DefaultStep } from '../defaultSteps.ts';
import { BLANK, kv, p, type ContractBlock, type ContractDocument } from './blocks.ts';

export type LetterParty = { name: string; businessId: string; address: string; email: string };

export type NoticeLetterInput = {
  step: DefaultStep;
  rules: InstallmentRulesId;
  /** Дата письма, уже в виде страны. */
  date: string;
  contract: { number: string; date: string };
  vehicle: string;
  seller: LetterParty;
  buyer: LetterParty;
  /** Просроченные взносы на дату письма. */
  overdue: { n: number; due: string; amount: string }[];
  total: string;
  /** Последний день оплаты — у письма о сроке. */
  deadline: string | null;
  /** Письмо о сроке, на которое ссылается отказ: дата и последний день. */
  grace: { date: string; deadline: string } | null;
  /** IBAN продавца для оплаты — у письма о сроке. */
  iban: string | null;
};

type Args = { c: string; date: string; total: string; deadline: string; graceOn: string; graceDeadline: string };

type LetterTexts = {
  idLabel: string;
  seller: string;
  buyer: string;
  contract: string;
  vehicle: string;
  /** Подписи строки просрочки: взнос, срок, сумма. */
  head: [string, string, string];
  total: string;
  pay: (iban: string) => string;
  sign: string;
  footer: (c: string) => string;
  grace?: { title: string; body: (a: Args) => string[] };
  final: { title: string; body: (a: Args) => string[] };
  /** Начало отказа со ссылкой на письмо о сроке — где срок есть. */
  graceRef?: (a: Args) => string;
};

const TEXTS: Record<InstallmentRulesId, LetterTexts> = {
  FI_OSKL: {
    idLabel: 'Y-tunnus',
    seller: 'Myyjä',
    buyer: 'Ostaja',
    contract: 'Osamaksusopimus',
    vehicle: 'Ajoneuvo',
    head: ['Erä', 'Eräpäivä', 'Maksamatta'],
    total: 'Erääntynyt ja maksamatta yhteensä',
    pay: (iban) => `Maksu myyjän tilille ${iban}.`,
    sign: 'Myyjän allekirjoitus ja nimenselvennys',
    footer: (c) => `Ilmoitus osamaksusopimukseen ${c} · laadittu RAHTIS-palvelussa myyjän puolesta; Aivomaa Oy ei ole sopimuksen osapuoli`,
    final: {
      title: 'ILMOITUS MAKSUVIIVÄSTYKSESTÄ JA TAKAISINOTOSTA',
      body: (a) => [
        `Ostaja on laiminlyönyt osamaksusopimuksen ${a.c} mukaiset maksut. ${a.date} erääntyneet ja maksamatta olevat erät ovat seuraavat, yhteensä ${a.total}.`,
        'Maksamatta oleva määrä täyttää sopimuksen kohdan 9.1 ja osamaksukaupasta annetun lain 2 §:n edellytykset. Myyjä ilmoittaa käyttävänsä sopimuksen kohdan 9 mukaisia oikeuksiaan: myyjä vaatii koko maksamatta olevan kauppahinnan maksettavaksi heti (kohta 9.2) tai ottaa ajoneuvon takaisin osamaksutilityksin (kohdat 9.4–9.7).',
        'Kun myyjä on vaatinut ajoneuvoa takaisin, ostaja voi pitää ajoneuvon maksamalla kerralla sen määrän, joka osamaksukaupasta annetun lain 3 §:n mukaan on luettava myyjän hyväksi (kohta 9.6). Takaisinotto tehdään sopimalla tai ulosottomiehen kautta; myyjä ei ota ajoneuvoa ostajan tahtoa vastaan omin toimin. Osamaksutilitys tehdään kohdan 9.4 mukaisesti.',
      ],
    },
  },
  SE_AVBL: {
    idLabel: 'Organisationsnummer',
    seller: 'Säljare',
    buyer: 'Köpare',
    contract: 'Avtal om avbetalningsköp',
    vehicle: 'Fordon',
    head: ['Post', 'Förfallodag', 'Obetalt'],
    total: 'Förfallet och obetalt sammanlagt',
    pay: (iban) => `Betalning till säljarens konto ${iban}.`,
    sign: 'Säljarens underskrift och namnförtydligande',
    footer: (c) => `Meddelande enligt avtal ${c} · upprättat i tjänsten RAHTIS för säljarens räkning; Aivomaa Oy är inte part i avtalet`,
    final: {
      title: 'MEDDELANDE OM DRÖJSMÅL OCH ÅTERTAGANDE',
      body: (a) => [
        `Köparen har inte betalat förfallna belopp enligt avtal om avbetalningsköp ${a.c}. Per ${a.date} är följande poster förfallna och obetalda, sammanlagt ${a.total}.`,
        'Dröjsmålet uppfyller villkoren i avtalets punkt 9.1 (7 § avbetalningsköplagen). Säljaren meddelar härmed att säljaren gör gällande förbehållet om återtaganderätt (punkt 9.5) eller kräver betalning i förtid av hela den obetalda kreditfordran (punkt 9.2).',
        'Om köparen innan fordonet återtas betalar det förfallna beloppet jämte dröjsmålsränta och säljarens kostnader, får säljaren varken återta fordonet eller kräva betalning i förtid på grund av dröjsmålet (punkt 9.3, 8 § avbetalningsköplagen). Säljaren tar inte fordonet i besittning mot köparens vilja; lämnas det inte ut frivilligt ansöker säljaren om handräckning hos Kronofogdemyndigheten (punkt 9.7). Avräkning görs enligt punkt 9.5.',
      ],
    },
  },
  DK_KAL: {
    idLabel: 'CVR-nr.',
    seller: 'Sælger',
    buyer: 'Køber',
    contract: 'Købekontrakt',
    vehicle: 'Køretøj',
    head: ['Afdrag', 'Forfaldsdato', 'Ubetalt'],
    total: 'Forfaldent og ubetalt i alt',
    pay: (iban) => `Betaling til sælgers konto ${iban}.`,
    sign: 'Sælgers underskrift og navn med blokbogstaver',
    footer: (c) => `Meddelelse efter kontrakt ${c} · udarbejdet i tjenesten RAHTIS på sælgers vegne; Aivomaa Oy er ikke part i kontrakten`,
    final: {
      title: 'MEDDELELSE OM MISLIGHOLDELSE OG TILBAGETAGELSE',
      body: (a) => [
        `Køber har ikke betalt forfaldne beløb efter købekontrakt ${a.c}. Pr. ${a.date} er følgende afdrag forfaldne og ubetalte, i alt ${a.total}.`,
        'Misligholdelsen opfylder betingelserne i kontraktens punkt 9.1 (kreditaftalelovens § 29). Sælger meddeler hermed, at sælger forlanger hele restgælden betalt straks (punkt 9.2) eller tager køretøjet tilbage (punkt 9.5).',
        'Betaler køber, inden køretøjet er taget tilbage, det forfaldne beløb med renter og sælgers omkostninger, kan sælger ikke tage køretøjet tilbage eller forlange restgælden betalt straks på grund af denne misligholdelse (punkt 9.3). Tilbagetagelse sker ved fogedrettens hjælp, medmindre køber frivilligt udleverer køretøjet (punkt 9.5); parternes mellemværende opgøres efter punkt 9.6.',
      ],
    },
  },
  EE_VOS: {
    idLabel: 'Registrikood',
    seller: 'Müüja',
    buyer: 'Ostja',
    contract: 'Järelmaksuga müügi leping',
    vehicle: 'Sõiduk',
    head: ['Osamakse', 'Maksetähtpäev', 'Tasumata'],
    total: 'Sissenõutav ja tasumata kokku',
    pay: (iban) => `Tasuda müüja arveldusarvele ${iban}.`,
    sign: 'Müüja allkiri ja nimi',
    footer: (c) => `Teade lepingu ${c} kohta · koostatud RAHTIS-teenuses müüja nimel; Aivomaa Oy ei ole lepingu pool`,
    grace: {
      title: 'TEADE TÄIENDAVA TÄHTAJA ANDMISE KOHTA',
      body: (a) => [
        `Ostja ei ole tasunud järelmaksuga müügi lepingu ${a.c} kohaseid makseid. Seisuga ${a.date} on tasumata järgmised sissenõutavad osamaksed, kokku ${a.total}.`,
        `Võlgnevus vastab lepingu punkti 9.1 eeldustele. Müüja annab ostjale võlgnevuse tasumiseks täiendava tähtaja kuni ${a.deadline} (lepingu punkt 9.2, VÕS § 114).`,
        'Kui ostja tasub täiendava tähtaja jooksul kogu sissenõutava võlgnevuse koos viivise ja punkti 4.7 kohaste kuludega, jääb leping kehtima. Kui võlgnevus jääb tähtaja jooksul tasumata, võib müüja nõuda kogu ostuhinna jäägi kohest tasumist või lepingust taganeda ja nõuda sõiduki tagastamist (punkt 9.3).',
      ],
    },
    graceRef: (a) => `Müüja andis ostjale ${a.graceOn} saadetud teatega täiendava tähtaja kuni ${a.graceDeadline}; võlgnevus on tasumata.`,
    final: {
      title: 'LEPINGUST TAGANEMISE AVALDUS',
      body: (a) => [
        `Ostja ei ole tasunud järelmaksuga müügi lepingu ${a.c} kohaseid makseid. Seisuga ${a.date} on tasumata järgmised sissenõutavad osamaksed, kokku ${a.total}.`,
        `Müüja taganeb järelmaksuga müügi lepingust ${a.c} (lepingu punkt 9.3, VÕS § 116, § 233 lg 2) ja nõuab sõiduki tagastamist.`,
        'Ostja tagastab sõiduki koos dokumentide, võtmete ja lisavarustusega müüja teatatud kohas 7 päeva jooksul käesoleva avalduse kättesaamisest (punkt 9.5). Müüja ei võta sõidukit ostja nõusolekuta; kui ostja sõidukit vabatahtlikult ei tagasta, nõuab müüja selle välja kohtu kaudu. Lõpparveldus tehakse punkti 9.6 kohaselt.',
      ],
    },
  },
  LV_CL2070: {
    idLabel: 'Reģistrācijas Nr.',
    seller: 'Pārdevējs',
    buyer: 'Pircējs',
    contract: 'Nomaksas pirkuma līgums',
    vehicle: 'Transportlīdzeklis',
    head: ['Maksājums', 'Termiņš', 'Nesamaksāts'],
    total: 'Kavēts un nesamaksāts kopā',
    pay: (iban) => `Samaksa uz pārdevēja kontu ${iban}.`,
    sign: 'Pārdevēja paraksts un vārds, uzvārds',
    footer: (c) => `Paziņojums par līgumu ${c} · sagatavots pakalpojumā RAHTIS pārdevēja vārdā; Aivomaa Oy nav līguma puse`,
    grace: {
      title: 'RAKSTVEIDA BRĪDINĀJUMS PAR MAKSĀJUMU KAVĒJUMU',
      body: (a) => [
        `Pircējs nav veicis nomaksas pirkuma līgumā ${a.c} noteiktos maksājumus. Uz ${a.date} nav samaksāti šādi maksājumi, kopā ${a.total}.`,
        `Pircējs ir palaidis garām divus maksājumu termiņus (līguma 9.1. punkta 1. apakšpunkts, Civillikuma 2070. pants). Pārdevējs brīdina pircēju un nosaka parāda samaksas termiņu līdz ${a.deadline}.`,
        'Ja parāds šajā termiņā tiek samaksāts pilnībā kopā ar nokavējuma procentiem un 4.7. punktā minētajām izmaksām, tiesības atcelt līgumu šā kavējuma dēļ izbeidzas. Ja parāds netiek samaksāts, pārdevējs ir tiesīgs prasīt līguma atcelšanu un transportlīdzekļa atdošanu (9.1. punkts).',
      ],
    },
    graceRef: (a) => `Ar ${a.graceOn} nosūtīto brīdinājumu pārdevējs noteica parāda samaksas termiņu līdz ${a.graceDeadline}; parāds nav samaksāts.`,
    final: {
      title: 'PAZIŅOJUMS PAR LĪGUMA ATCELŠANU',
      body: (a) => [
        `Pircējs nav veicis nomaksas pirkuma līgumā ${a.c} noteiktos maksājumus. Uz ${a.date} nav samaksāti šādi maksājumi, kopā ${a.total}.`,
        `Pārdevējs paziņo par nomaksas pirkuma līguma ${a.c} atcelšanu (līguma 9.1. punkts, Civillikuma 2070. pants) un prasa transportlīdzekļa atdošanu.`,
        'Pircējs 5 darbdienu laikā pēc šā paziņojuma saņemšanas nodod transportlīdzekli pārdevējam, par ko Puses sastāda pieņemšanas–nodošanas aktu (9.4. punkts). Pārdevējs nepārņem transportlīdzekli patvaļīgi; ja pircējs to labprātīgi nenodod, pārdevējs ceļ prasību tiesā. Savstarpējo norēķinu Puses veic saskaņā ar 9.5. punktu.',
      ],
    },
  },
  LT_CK6414: {
    idLabel: 'Juridinio asmens kodas',
    seller: 'Pardavėjas',
    buyer: 'Pirkėjas',
    contract: 'Pirkimo–pardavimo išsimokėtinai sutartis',
    vehicle: 'Transporto priemonė',
    head: ['Įmoka', 'Mokėjimo terminas', 'Nesumokėta'],
    total: 'Pradelsta ir nesumokėta iš viso',
    pay: (iban) => `Mokėti į Pardavėjo sąskaitą ${iban}.`,
    sign: 'Pardavėjo parašas, vardas ir pavardė',
    footer: (c) => `Pranešimas dėl sutarties ${c} · parengta RAHTIS paslaugoje Pardavėjo vardu; Aivomaa Oy nėra sutarties šalis`,
    grace: {
      title: 'REIKALAVIMAS SUMOKĖTI PRADELSTĄ SUMĄ PER PAPILDOMĄ TERMINĄ',
      body: (a) => [
        `Pirkėjas nesumokėjo pagal pirkimo–pardavimo išsimokėtinai sutartį ${a.c} mokėtinų įmokų. ${a.date} dienai nesumokėtos šios įmokos, iš viso ${a.total}.`,
        `Pradelsta suma atitinka sutarties 9.1 punkto sąlygas. Pardavėjas reikalauja, kad Pirkėjas sumokėtų pradelstą sumą per papildomą terminą iki ${a.deadline} (sutarties 9.2 punktas).`,
        'Jeigu Pirkėjas per šį terminą pradelstos sumos nesumoka, Pardavėjas turi teisę rašytiniu pranešimu pareikalauti sumokėti visą likusią Kainos dalį iš karto arba nutraukti sutartį ir pareikalauti grąžinti Transporto priemonę (9.2 punktas).',
      ],
    },
    graceRef: (a) => `${a.graceOn} išsiųstu reikalavimu Pardavėjas nustatė papildomą terminą iki ${a.graceDeadline}; pradelsta suma nesumokėta.`,
    final: {
      title: 'PRANEŠIMAS APIE SUTARTIES NUTRAUKIMĄ',
      body: (a) => [
        `Pirkėjas nesumokėjo pagal pirkimo–pardavimo išsimokėtinai sutartį ${a.c} mokėtinų įmokų. ${a.date} dienai nesumokėtos šios įmokos, iš viso ${a.total}.`,
        `Pardavėjas vienašališkai nutraukia sutartį ${a.c} ir reikalauja grąžinti Transporto priemonę (sutarties 9.2 punkto 2 papunktis, Civilinio kodekso 6.217 straipsnio 5 dalis ir 6.218 straipsnio 1 dalis). Sutartis laikoma nutraukta ne anksčiau kaip po 7 dienų nuo šio pranešimo įteikimo.`,
        'Nutraukus sutartį, Pirkėjas per 5 dienas grąžina Transporto priemonę Pardavėjui jo nurodytoje vietoje; grąžinimas įforminamas perdavimo–priėmimo aktu (9.5 punktas). Pardavėjas neturi teisės paimti Transporto priemonės be Pirkėjo sutikimo savo veiksmais (9.8 punktas). Šalys atsiskaito 9.5 punkte nustatyta tvarka.',
      ],
    },
  },
  DE_BGB449: {
    idLabel: 'USt-IdNr. / Steuernummer',
    seller: 'Verkäufer',
    buyer: 'Käufer',
    contract: 'Kaufvertrag mit Ratenzahlung',
    vehicle: 'Fahrzeug',
    head: ['Rate', 'Fällig am', 'Offen'],
    total: 'Rückstand insgesamt',
    pay: (iban) => `Zahlung auf das Konto des Verkäufers ${iban}.`,
    sign: 'Unterschrift und Name des Verkäufers',
    footer: (c) => `Schreiben zum Kaufvertrag ${c} · erstellt im Dienst RAHTIS im Namen des Verkäufers; die Aivomaa Oy ist nicht Vertragspartei`,
    grace: {
      title: 'ZAHLUNGSAUFFORDERUNG MIT FRISTSETZUNG',
      body: (a) => [
        `Der Käufer ist mit Zahlungen aus dem Kaufvertrag ${a.c} in Verzug. Zum ${a.date} sind folgende Raten fällig und unbezahlt, insgesamt ${a.total}.`,
        `Der Rückstand erfüllt die Voraussetzungen der Ziffer 9.1 Nr. 1 des Vertrags. Der Verkäufer setzt dem Käufer eine Frist zur Zahlung des rückständigen Betrags bis zum ${a.deadline} (Ziffer 9.1 Nr. 2, § 323 Abs. 1 BGB).`,
        'Nach fruchtlosem Ablauf der Frist wird der Verkäufer nach seiner Wahl den gesamten noch offenen Restkaufpreis sofort fällig stellen oder vom Vertrag zurücktreten und die Herausgabe des Fahrzeugs verlangen (Ziffer 9.2). Der Käufer kann dies abwenden, indem er innerhalb der Frist den rückständigen Betrag samt Verzugszinsen und Kosten zahlt (Ziffer 9.7).',
      ],
    },
    graceRef: (a) => `Mit Schreiben vom ${a.graceOn} hat der Verkäufer eine Zahlungsfrist bis zum ${a.graceDeadline} gesetzt; der Rückstand wurde nicht bezahlt.`,
    final: {
      title: 'RÜCKTRITTSERKLÄRUNG',
      body: (a) => [
        `Der Käufer ist mit Zahlungen aus dem Kaufvertrag ${a.c} in Verzug. Zum ${a.date} sind folgende Raten fällig und unbezahlt, insgesamt ${a.total}.`,
        `Der Verkäufer erklärt hiermit den Rücktritt vom Kaufvertrag ${a.c} (Ziffer 9.2 Nr. 2, § 323, § 449 Abs. 2 BGB) und verlangt die Herausgabe des Fahrzeugs.`,
        'Der Käufer hat das Fahrzeug samt Zubehör, Schlüsseln, Zulassungsbescheinigung Teil I und Wartungsunterlagen unverzüglich herauszugeben (Ziffer 9.4). Der Verkäufer nimmt das Fahrzeug nicht ohne oder gegen den Willen des Käufers an sich; gibt der Käufer es nicht freiwillig heraus, wird der Anspruch gerichtlich durchgesetzt. Die Abrechnung erfolgt nach Ziffer 9.5.',
      ],
    },
  },
  PL_KC589: {
    idLabel: 'NIP',
    seller: 'Sprzedawca',
    buyer: 'Kupujący',
    contract: 'Umowa sprzedaży na raty',
    vehicle: 'Pojazd',
    head: ['Rata', 'Termin płatności', 'Do zapłaty'],
    total: 'Zaległość łącznie',
    pay: (iban) => `Zapłata na rachunek Sprzedawcy ${iban}.`,
    sign: 'Podpis i imię i nazwisko Sprzedawcy',
    footer: (c) => `Pismo dotyczące umowy ${c} · przygotowane w serwisie RAHTIS w imieniu Sprzedawcy; Aivomaa Oy nie jest stroną umowy`,
    grace: {
      title: 'WEZWANIE DO ZAPŁATY Z WYZNACZENIEM DODATKOWEGO TERMINU',
      body: (a) => [
        `Kupujący nie zapłacił rat wynikających z umowy sprzedaży na raty ${a.c}. Na dzień ${a.date} zaległe są następujące raty, łącznie ${a.total}.`,
        `Zaległość spełnia warunki pkt 9.1 umowy. Sprzedawca wzywa Kupującego do zapłaty zaległości w dodatkowym terminie do dnia ${a.deadline} (pkt 9.1 umowy, art. 491 § 1 Kodeksu cywilnego).`,
        'Po bezskutecznym upływie tego terminu Sprzedawca będzie uprawniony, według swojego wyboru, zażądać natychmiastowej zapłaty całej pozostałej części ceny albo odstąpić od umowy (pkt 9.1). Do chwili złożenia oświadczenia o odstąpieniu Kupujący może zachować pojazd, płacąc wszystkie zaległe raty wraz z odsetkami za opóźnienie i należnymi kosztami (pkt 9.6).',
      ],
    },
    graceRef: (a) => `Pismem z dnia ${a.graceOn} Sprzedawca wyznaczył dodatkowy termin zapłaty do dnia ${a.graceDeadline}; zaległość nie została zapłacona.`,
    final: {
      title: 'OŚWIADCZENIE O ODSTĄPIENIU OD UMOWY',
      body: (a) => [
        `Kupujący nie zapłacił rat wynikających z umowy sprzedaży na raty ${a.c}. Na dzień ${a.date} zaległe są następujące raty, łącznie ${a.total}.`,
        `Sprzedawca oświadcza, że odstępuje od umowy sprzedaży na raty ${a.c} (pkt 9.1 i 9.3 umowy, art. 491 § 1 Kodeksu cywilnego).`,
        'W terminie 7 dni od otrzymania niniejszego oświadczenia Kupujący wydaje Sprzedawcy pojazd wraz z wyposażeniem dodatkowym, dowodem rejestracyjnym, kluczykami i dokumentacją, a Strony sporządzają protokół zwrotu (pkt 9.3). Sprzedawca nie odbiera pojazdu samowolnie; jeżeli Kupujący nie wyda go dobrowolnie, Sprzedawca dochodzi wydania na drodze sądowej. Rozliczenie następuje zgodnie z pkt 9.4.',
      ],
    },
  },
  RO_CC1755: {
    idLabel: 'CUI',
    seller: 'Vânzător',
    buyer: 'Cumpărător',
    contract: 'Contract de vânzare cu plata prețului în rate',
    vehicle: 'Vehicul',
    head: ['Rata', 'Scadența', 'Restant'],
    total: 'Total restant',
    pay: (iban) => `Plata în contul vânzătorului ${iban}.`,
    sign: 'Semnătura și numele vânzătorului',
    footer: (c) => `Notificare privind contractul ${c} · întocmită în serviciul RAHTIS în numele vânzătorului; Aivomaa Oy nu este parte la contract`,
    grace: {
      title: 'NOTIFICARE DE PLATĂ CU TERMEN',
      body: (a) => [
        `Cumpărătorul nu a plătit ratele datorate potrivit contractului de vânzare în rate ${a.c}. La data de ${a.date} sunt restante următoarele rate, în total ${a.total}.`,
        `Restanța îndeplinește condițiile de la pct. 9.2 din contract. Vânzătorul îi acordă cumpărătorului un termen pentru plata sumelor restante până la ${a.deadline} (pct. 9.3 din contract, art. 1.522 din Codul civil).`,
        'În lipsa plății în acest termen, vânzătorul poate declara exigibil întregul rest de plată ori poate declara rezoluțiunea contractului și cere restituirea vehiculului (pct. 9.3).',
      ],
    },
    graceRef: (a) => `Prin notificarea din ${a.graceOn}, vânzătorul a acordat un termen de plată până la ${a.graceDeadline}; sumele restante nu au fost plătite.`,
    final: {
      title: 'DECLARAȚIE DE REZOLUȚIUNE',
      body: (a) => [
        `Cumpărătorul nu a plătit ratele datorate potrivit contractului de vânzare în rate ${a.c}. La data de ${a.date} sunt restante următoarele rate, în total ${a.total}.`,
        `Vânzătorul declară rezoluțiunea contractului de vânzare în rate ${a.c} (pct. 9.3 din contract, art. 1.552 din Codul civil) și cere restituirea vehiculului.`,
        'Cumpărătorul predă vânzătorului vehiculul, cu toate documentele și cheile, în termen de 5 zile de la primirea prezentei declarații, pe bază de proces-verbal (pct. 9.5). Vânzătorul nu recurge la constrângere; dacă vehiculul nu este predat de bunăvoie, îl preia numai cu concursul executorului judecătoresc ori în temeiul unei hotărâri judecătorești. Decontul se face potrivit pct. 9.6.',
      ],
    },
  },
};

/** Есть ли письмо такого шага у страны: у Финляндии, Швеции и Дании — только последний шаг. */
export function noticeLetterExists(rules: InstallmentRulesId, step: DefaultStep): boolean {
  return step === 'WITHDRAWAL' || Boolean(TEXTS[rules].grace);
}

function party(label: string, idLabel: string, x: LetterParty): string[] {
  return [label, x.name, `${idLabel}: ${x.businessId}`, x.address || BLANK, x.email].filter(Boolean);
}

/** Письмо шага; null — у страны нет такого шага. */
export function noticeLetter(d: NoticeLetterInput): ContractDocument | null {
  const t = TEXTS[d.rules];
  const kind = d.step === 'GRACE' ? t.grace : t.final;
  if (!kind) return null;
  const args: Args = {
    c: d.contract.number,
    date: d.date,
    total: d.total,
    deadline: d.deadline ?? BLANK,
    graceOn: d.grace?.date ?? BLANK,
    graceDeadline: d.grace?.deadline ?? BLANK,
  };
  const [intro, ...rest] = kind.body(args);
  /* Отказ ссылается на письмо о сроке — если оно записано. */
  const graceRef = d.step === 'WITHDRAWAL' && d.grace && t.graceRef ? [p(t.graceRef(args))] : [];
  const blocks: ContractBlock[] = [
    { kind: 'parties', left: party(t.seller, t.idLabel, d.seller), right: party(t.buyer, t.idLabel, d.buyer) },
    { kind: 'title', text: kind.title },
    { kind: 'meta', text: d.date },
    kv(t.contract, `${d.contract.number} · ${d.contract.date}`),
    kv(t.vehicle, d.vehicle),
    p(''),
    p(intro),
    /* Просрочка — строками «взнос · срок — сумма» и жирной суммой: таблица графика договора для трёх столбцов слишком узкая. */
    ...d.overdue.map((o) => kv(`${t.head[0]} ${o.n} · ${t.head[1]} ${o.due}`, o.amount)),
    kv(t.total, d.total, true),
    p(''),
    ...graceRef,
    ...rest.map(p),
    ...(d.step === 'GRACE' && d.iban ? [p(t.pay(d.iban))] : []),
    { kind: 'sign', left: [t.sign, d.seller.name], right: [] },
  ];
  return {
    title: `${kind.title} · ${d.contract.number}`,
    author: d.seller.name,
    footer: t.footer(d.contract.number),
    pages: [blocks],
  };
}

/** Язык чисел и вид дат письма — как у договора страны. */
export const LETTER_PRINT: Record<InstallmentRulesId, { intl: string; isoDates?: boolean; filePrefix: string }> = {
  FI_OSKL: { intl: 'fi-FI', filePrefix: 'Ilmoitus' },
  EE_VOS: { intl: 'et-EE', filePrefix: 'Teade' },
  LV_CL2070: { intl: 'lv-LV', filePrefix: 'Pazinojums' },
  SE_AVBL: { intl: 'sv-SE', isoDates: true, filePrefix: 'Meddelande' },
  DK_KAL: { intl: 'da-DK', filePrefix: 'Meddelelse' },
  LT_CK6414: { intl: 'lt-LT', isoDates: true, filePrefix: 'Pranesimas' },
  DE_BGB449: { intl: 'de-DE', filePrefix: 'Schreiben' },
  PL_KC589: { intl: 'pl-PL', filePrefix: 'Pismo' },
  RO_CC1755: { intl: 'ro-RO', filePrefix: 'Notificare' },
};

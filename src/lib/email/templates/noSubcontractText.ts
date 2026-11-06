import type { Locale } from '../../i18n/config';
import type { EmailBlock } from '../layout';

/**
 * Письмо перевозчикам о конце режима подряда (решение 6.11.2026).
 *
 * Разовое письмо, поэтому тексты здесь, а не в text.ts: там два языка
 * (fi, en), а это письмо уходит на всех девяти языках интерфейса —
 * деньги и условия человек должен прочитать на своём языке.
 *
 * Модуль без импортов значений: его читает node --test напрямую
 * (noSubcontract.test.mjs), а голый Node не знает ни «@/», ни импорта
 * без расширения. Вёрстку собирает noSubcontract.ts.
 *
 * Термины — те же, что в словарях кабинета: tarjouspöytä / Load board,
 * Tilaus / Subscription, maksutiedot / Payment info, kuljetusliikkeen
 * sopimus / Carrier agreement.
 */

export type NoticeLocale = Locale;

export const NOTICE_LOCALES: readonly NoticeLocale[] = [
  'fi',
  'en',
  'sv',
  'ru',
  'pl',
  'de',
  'et',
  'lv',
  'lt',
];

/** Язык страны — для компаний, у которых в language осталось свёрнутое 'en'. */
const COUNTRY_LOCALE: Record<string, NoticeLocale> = {
  FI: 'fi',
  SE: 'sv',
  EE: 'et',
  LV: 'lv',
  LT: 'lt',
  PL: 'pl',
  DE: 'de',
  AT: 'de',
};

/**
 * Язык письма для компании.
 *
 * companies.language пишется через emailLocaleOf и почти всегда 'fi' или
 * 'en': 'en' значит «не финский», а не «английский». Поэтому:
 *   - явный язык из девяти, кроме 'en', — он;
 *   - 'en' у нефинской компании — язык страны, если он у нас есть
 *     (byCountry = false оставляет английский);
 *   - 'en' у финской — английский: человек сам выбрал не финский;
 *   - пусто или чужой код — fi для FI, иначе язык страны или en.
 */
export function noticeLocaleOf(
  language: string | null | undefined,
  country: string | null | undefined,
  byCountry = true,
): NoticeLocale {
  const code = (country ?? '').trim().toUpperCase();
  const lang = (language ?? '').trim().toLowerCase();
  const known = (NOTICE_LOCALES as readonly string[]).includes(lang);

  if (known && lang !== 'en') return lang as NoticeLocale;
  if (lang === 'en') return byCountry && code !== 'FI' ? (COUNTRY_LOCALE[code] ?? 'en') : 'en';
  if (code === 'FI') return 'fi';
  return byCountry ? (COUNTRY_LOCALE[code] ?? 'en') : 'en';
}

type NoticeTexts = {
  signature: string;
  neverAsk: string;
  tagline: string;
  greeting: string;
  subject: string;
  heading: string;
  preheader: string;
  intro: string;
  moved: string;
  factFirst: [string, string];
  factNext: [string, string];
  factFrom: [string, string];
  feesFrom: string;
  desk: string;
  oldTrips: string;
  terms: string;
  button: string;
  questions: string;
};

const fi: NoticeTexts = {
  signature: 'RAHTIS-tiimi',
  neverAsk: 'Emme koskaan kysy salasanaanne sähköpostitse emmekä puhelimitse.',
  tagline: 'Kuljetusten hallinta ja rahtipörssi · Pohjois-Eurooppa',
  greeting: 'Hei,',
  subject: 'RAHTIS · Alihankintamalli päättyy – keikoista ei enää peritä prosenttia',
  heading: 'Keikoista ei enää peritä prosenttia: alihankintamalli päättyy',
  preheader: 'Ensimmäinen aktiivinen ajoneuvo on maksuton. Kuukausimaksut alkavat teillä 1.1.2027.',
  intro:
    'Lopetamme RAHTIS-palvelun alihankintamallin, jossa sopimuskumppanina oli Aivomaa Oy, keikan hinnasta pidätettiin 3 % ja tilitykset maksoi Aivomaa Oy. ' +
    'Olemme vasta tulossa markkinoille ja haluamme pitää asiat yksinkertaisina: keikoista ei peritä prosenttia keneltäkään.',
  moved:
    'Kuljetusliikkeenne on nyt siirretty kuukausimaksulliseen tilaukseen. Aktiivinen ajoneuvo on ajoneuvo, jolla on kalenterikuukauden aikana vähintään yksi valmistunut keikka.',
  factFirst: ['Ensimmäinen aktiivinen ajoneuvo', 'Maksuton, pysyvästi'],
  factNext: ['Jokainen seuraava aktiivinen ajoneuvo', '14,90 €/kk + ALV'],
  factFrom: ['Kuukausimaksut alkaen', '1.1.2027'],
  feesFrom:
    'Teiltä kuukausimaksuja peritään vasta 1.1.2027 alkaen. Siihen asti kuukausimaksuja ei laskuteta, eikä keikoista pidätetä prosenttia.',
  desk:
    'Tarjouspöydän kuljetukset ovat nyt suoria sopimuksia teidän ja tilaajan välillä: laskutatte tilaajaa itse sovitulla hinnalla ja sovituin ehdoin. ' +
    'Ennen kuin otatte kuljetuksen vastaan, näette tilaajan maksutiedot: yrityksen iän, rekisteritiedot, kuljetusliikkeiden ilmoitukset maksuista, tarkistetut yritysasiakirjat sekä huolitsijalta sen, onko huolitsijan vastuuvakuutus tarkistettu. ' +
    'Tilaaja näkee laskutusta varten yrityksenne nimen.',
  oldTrips:
    'Kuljetukset, jotka on jo sovittu Aivomaa Oy:n kanssa sopimuskumppanina, ajetaan ja tilitetään loppuun vanhoilla ehdoilla – tilitykset maksetaan kuten ennenkin.',
  terms:
    'Päivitetyt käyttöehdot ja kuljetusliikkeen sopimus julkaistaan palvelussa. Tilauksenne tiedot näette palvelussa:',
  button: 'Avaa tilaussivu',
  questions: 'Kysyttävää? Vastatkaa suoraan tähän viestiin.',
};

const en: NoticeTexts = {
  signature: 'The RAHTIS team',
  neverAsk: 'We never ask for your password by email or over the phone.',
  tagline: 'Transport management and freight exchange · Northern Europe',
  greeting: 'Hello,',
  subject: 'RAHTIS · The subcontract model is ending – no more commission on jobs',
  heading: 'No more commission on jobs: the subcontract model is ending',
  preheader: 'Your first active vehicle is free. Subscription fees apply to you from 1 January 2027.',
  intro:
    'We are discontinuing the RAHTIS subcontract model, in which Aivomaa Oy was the contracting party, 3 % of each job’s price was withheld and payouts were made by Aivomaa Oy. ' +
    'We are just entering the market and want to keep things simple: no commission on jobs, for anyone.',
  moved:
    'Your company has been moved to the subscription. An active vehicle is a vehicle that completed at least one job during the calendar month.',
  factFirst: ['First active vehicle', 'Free, permanently'],
  factNext: ['Each additional active vehicle', '€14.90 / month excl. VAT'],
  factFrom: ['Subscription fees from', '1 January 2027'],
  feesFrom:
    'For you, subscription fees are charged only from 1 January 2027. Until then, no subscription fees are invoiced and no commission is withheld from jobs.',
  desk:
    'Load board orders are now direct contracts between you and the shipper: you invoice the shipper yourself at the agreed price and on the agreed terms. ' +
    'Before accepting an order, you can see the shipper’s payment info: company age, register status, carriers’ payment reports, checked company documents and, for freight forwarders, whether their freight forwarder’s liability insurance has been checked. ' +
    'The shipper sees your company name for invoicing.',
  oldTrips:
    'Jobs already agreed with Aivomaa Oy as the contracting party will be completed and settled under the old terms – payouts are made as before.',
  terms:
    'The updated terms of use and carrier agreement will be published in the service. You can find your subscription details in your account:',
  button: 'Open subscription',
  questions: 'Questions? Just reply to this email.',
};

const sv: NoticeTexts = {
  signature: 'RAHTIS-teamet',
  neverAsk: 'Vi frågar aldrig efter ert lösenord via e-post eller telefon.',
  tagline: 'Transportledning och lastbörs · Nordeuropa',
  greeting: 'Hej,',
  subject: 'RAHTIS · Underleverantörsmodellen upphör – ingen procentavgift på körningar',
  heading: 'Ingen procentavgift på körningar: underleverantörsmodellen upphör',
  preheader: 'Ert första aktiva fordon är gratis. Abonnemangsavgifter tas ut från och med 1 januari 2027.',
  intro:
    'Vi avslutar underleverantörsmodellen i RAHTIS, där Aivomaa Oy var avtalspart, 3 % av varje körnings pris drogs av och utbetalningarna gjordes av Aivomaa Oy. ' +
    'Vi är på väg in på marknaden och vill hålla det enkelt: ingen procentavgift på körningar, för någon.',
  moved:
    'Ert åkeri har nu flyttats över till abonnemang. Ett aktivt fordon är ett fordon som har slutfört minst en körning under kalendermånaden.',
  factFirst: ['Första aktiva fordonet', 'Gratis, permanent'],
  factNext: ['Varje ytterligare aktivt fordon', '14,90 €/mån exkl. moms'],
  factFrom: ['Abonnemangsavgifter från', '1 januari 2027'],
  feesFrom:
    'För er tas abonnemangsavgifter ut först från och med 1 januari 2027. Fram till dess faktureras inga abonnemangsavgifter och ingen procentavgift dras av på körningarna.',
  desk:
    'Uppdrag från lastbörsen är nu direkta avtal mellan er och uppdragsgivaren: ni fakturerar uppdragsgivaren själva enligt överenskommet pris och villkor. ' +
    'Innan ni tar ett uppdrag ser ni uppdragsgivarens betalningsinfo: företagets ålder, registeruppgifter, åkeriernas betalningsrapporter, kontrollerade företagsdokument och, för speditörer, om speditörens ansvarsförsäkring har kontrollerats. ' +
    'Uppdragsgivaren ser ert företagsnamn för faktureringen.',
  oldTrips:
    'Körningar som redan har avtalats med Aivomaa Oy som avtalspart slutförs och avräknas enligt de gamla villkoren – utbetalningarna sker som tidigare.',
  terms:
    'De uppdaterade användarvillkoren och åkeriavtalet publiceras i tjänsten. Uppgifterna om ert abonnemang finns i ert konto:',
  button: 'Öppna abonnemanget',
  questions: 'Frågor? Svara bara på det här mejlet.',
};

const ru: NoticeTexts = {
  signature: 'Команда RAHTIS',
  neverAsk: 'Мы никогда не спрашиваем ваш пароль по электронной почте или по телефону.',
  tagline: 'Управление перевозками и биржа грузов · Северная Европа',
  greeting: 'Здравствуйте!',
  subject: 'RAHTIS · Режим подряда прекращается – без процентов с рейсов',
  heading: 'Без процентов с рейсов: режим подряда прекращается',
  preheader: 'Первая активная машина бесплатно. Абонентская плата для вас – с 1 января 2027 года.',
  intro:
    'Мы прекращаем режим подряда в RAHTIS, при котором стороной договора выступала Aivomaa Oy, с цены каждого рейса удерживалось 3 %, а выплаты производила Aivomaa Oy. ' +
    'Мы только выходим на рынок и хотим, чтобы всё было просто: никаких процентов с рейсов – ни для кого.',
  moved:
    'Ваша компания переведена на абонемент. Активная машина – машина, у которой за календарный месяц завершён хотя бы один рейс.',
  factFirst: ['Первая активная машина', 'Бесплатно, бессрочно'],
  factNext: ['Каждая следующая активная машина', '14,90 € в месяц без НДС'],
  factFrom: ['Абонентская плата с', '1 января 2027 г.'],
  feesFrom:
    'Для вас абонентская плата начисляется только с 1 января 2027 года. До этого счета за абонемент не выставляются, и проценты с рейсов не удерживаются.',
  desk:
    'Заказы с биржи грузов теперь – прямые договоры между вами и заказчиком: счёт заказчику вы выставляете сами, по согласованной цене и на согласованных условиях. ' +
    'Прежде чем взять заказ, вы видите сведения об оплате заказчика: возраст компании, данные реестров, отметки перевозчиков об оплате, проверенные документы компании, а у экспедитора – проверено ли страхование ответственности экспедитора. ' +
    'Заказчик видит название вашей компании для выставления счёта.',
  oldTrips:
    'Рейсы, уже согласованные с Aivomaa Oy как стороной договора, выполняются и рассчитываются на прежних условиях – выплаты производятся как раньше.',
  terms:
    'Обновлённые условия использования и договор с перевозчиком будут опубликованы в сервисе. Сведения об абонементе – в личном кабинете:',
  button: 'Открыть абонемент',
  questions: 'Есть вопросы? Просто ответьте на это письмо.',
};

const pl: NoticeTexts = {
  signature: 'Zespół RAHTIS',
  neverAsk: 'Nigdy nie prosimy o hasło e-mailem ani telefonicznie.',
  tagline: 'Zarządzanie transportem i giełda ładunków · Europa Północna',
  greeting: 'Dzień dobry,',
  subject: 'RAHTIS · Koniec modelu podwykonawstwa – bez prowizji od kursów',
  heading: 'Bez prowizji od kursów: wycofujemy model podwykonawstwa',
  preheader: 'Pierwszy aktywny pojazd jest bezpłatny. Opłaty abonamentowe naliczamy od 1 stycznia 2027 r.',
  intro:
    'Wycofujemy model podwykonawstwa w RAHTIS, w którym stroną umowy była Aivomaa Oy, od ceny każdego kursu potrącano 3 %, a wypłaty realizowała Aivomaa Oy. ' +
    'Dopiero wchodzimy na rynek i chcemy, żeby było prosto: żadnych prowizji od kursów – dla nikogo.',
  moved:
    'Państwa firma została przeniesiona na abonament. Aktywny pojazd to pojazd, który w danym miesiącu kalendarzowym zakończył co najmniej jeden kurs.',
  factFirst: ['Pierwszy aktywny pojazd', 'Bezpłatnie, na stałe'],
  factNext: ['Każdy kolejny aktywny pojazd', '14,90 € netto / mies.'],
  factFrom: ['Opłaty abonamentowe od', '1 stycznia 2027 r.'],
  feesFrom:
    'W Państwa przypadku opłaty abonamentowe naliczamy dopiero od 1 stycznia 2027 r. Do tego czasu nie wystawiamy faktur za abonament ani nie potrącamy prowizji od kursów.',
  desk:
    'Zlecenia z giełdy ładunków są teraz bezpośrednimi umowami między Państwem a zleceniodawcą: fakturę wystawiają Państwo zleceniodawcy sami, według uzgodnionej ceny i warunków. ' +
    'Przed przyjęciem zlecenia widzą Państwo informacje o płatnościach zleceniodawcy: wiek firmy, status w rejestrach, zgłoszenia przewoźników o płatnościach, sprawdzone dokumenty firmy, a w przypadku spedytora – czy jego OC spedytora zostało sprawdzone. ' +
    'Zleceniodawca widzi nazwę Państwa firmy na potrzeby fakturowania.',
  oldTrips:
    'Kursy już uzgodnione z Aivomaa Oy jako stroną umowy zostaną zrealizowane i rozliczone na dotychczasowych zasadach – wypłaty bez zmian.',
  terms:
    'Zaktualizowany regulamin i umowa z przewoźnikiem zostaną opublikowane w serwisie. Szczegóły abonamentu znajdą Państwo na swoim koncie:',
  button: 'Otwórz abonament',
  questions: 'Pytania? Wystarczy odpowiedzieć na tę wiadomość.',
};

const de: NoticeTexts = {
  signature: 'Ihr RAHTIS-Team',
  neverAsk: 'Wir fragen Sie niemals per E-Mail oder Telefon nach Ihrem Passwort.',
  tagline: 'Transportmanagement und Frachtenbörse · Nordeuropa',
  greeting: 'Guten Tag,',
  subject: 'RAHTIS · Das Subunternehmer-Modell endet – keine Provision mehr auf Aufträge',
  heading: 'Keine Provision mehr auf Aufträge: Das Subunternehmer-Modell endet',
  preheader: 'Ihr erstes aktives Fahrzeug ist kostenlos. Abonnementgebühren fallen für Sie ab dem 1. Januar 2027 an.',
  intro:
    'Wir stellen das Subunternehmer-Modell von RAHTIS ein, bei dem die Aivomaa Oy Vertragspartner war, 3 % des Auftragspreises einbehalten wurden und die Auszahlungen über die Aivomaa Oy liefen. ' +
    'Wir treten gerade erst in den Markt ein und wollen es einfach halten: keine Provision auf Aufträge – für niemanden.',
  moved:
    'Ihr Unternehmen wurde auf das Abonnement umgestellt. Als aktiv gilt ein Fahrzeug, das im Kalendermonat mindestens einen Auftrag abgeschlossen hat.',
  factFirst: ['Erstes aktives Fahrzeug', 'Kostenlos, dauerhaft'],
  factNext: ['Jedes weitere aktive Fahrzeug', '14,90 € / Monat zzgl. MwSt.'],
  factFrom: ['Abonnementgebühren ab', '1. Januar 2027'],
  feesFrom:
    'Für Sie werden Abonnementgebühren erst ab dem 1. Januar 2027 berechnet. Bis dahin stellen wir keine Abonnementgebühren in Rechnung und behalten keine Provision auf Aufträge ein.',
  desk:
    'Aufträge aus der Frachtenbörse sind jetzt direkte Verträge zwischen Ihnen und dem Auftraggeber: Sie stellen dem Auftraggeber selbst zum vereinbarten Preis und zu den vereinbarten Bedingungen eine Rechnung. ' +
    'Bevor Sie einen Auftrag annehmen, sehen Sie die Zahlungsinfo des Auftraggebers: Alter des Unternehmens, Registerstatus, Zahlungsmeldungen anderer Transportunternehmen, geprüfte Unternehmensdokumente und bei Spediteuren, ob die Verkehrshaftungsversicherung des Spediteurs geprüft wurde. ' +
    'Der Auftraggeber sieht Ihren Firmennamen für die Rechnungsstellung.',
  oldTrips:
    'Aufträge, die bereits mit der Aivomaa Oy als Vertragspartner vereinbart wurden, werden zu den bisherigen Bedingungen ausgeführt und abgerechnet – die Auszahlungen erfolgen wie bisher.',
  terms:
    'Die aktualisierten Nutzungsbedingungen und der Vertrag für Transportunternehmen werden im Dienst veröffentlicht. Die Details zu Ihrem Abonnement finden Sie in Ihrem Konto:',
  button: 'Abonnement öffnen',
  questions: 'Fragen? Antworten Sie einfach auf diese E-Mail.',
};

const et: NoticeTexts = {
  signature: 'RAHTIS meeskond',
  neverAsk: 'Me ei küsi kunagi teie parooli e-posti ega telefoni teel.',
  tagline: 'Veokorraldus ja veobörs · Põhja-Euroopa',
  greeting: 'Tere!',
  subject: 'RAHTIS · Alltöövõtumudel lõpeb – vedudelt enam protsenti ei võeta',
  heading: 'Vedudelt enam protsenti ei võeta: alltöövõtumudel lõpeb',
  preheader: 'Esimene aktiivne auto on tasuta. Kuutasu hakatakse teilt võtma alates 1. jaanuarist 2027.',
  intro:
    'Lõpetame teenuses RAHTIS alltöövõtumudeli, mille puhul oli lepingupooleks Aivomaa Oy, iga veo hinnast peeti kinni 3 % ja väljamakseid tegi Aivomaa Oy. ' +
    'Me alles tuleme turule ja tahame hoida asjad lihtsana: vedudelt ei võeta protsenti mitte kelleltki.',
  moved:
    'Teie ettevõte on nüüd viidud üle kuutasuga tellimusele. Aktiivne auto on auto, millel on kalendrikuu jooksul vähemalt üks lõpetatud vedu.',
  factFirst: ['Esimene aktiivne auto', 'Tasuta, jäädavalt'],
  factNext: ['Iga järgmine aktiivne auto', '14,90 € kuus + km'],
  factFrom: ['Kuutasu alates', '1. jaanuar 2027'],
  feesFrom:
    'Teilt hakatakse kuutasu võtma alles alates 1. jaanuarist 2027. Seni kuutasu arveid ei esitata ja vedudelt protsenti kinni ei peeta.',
  desk:
    'Veobörsi veod on nüüd otselepingud teie ja tellija vahel: esitate tellijale arve ise kokkulepitud hinna ja tingimuste alusel. ' +
    'Enne veo vastuvõtmist näete tellija makseteavet: ettevõtte vanust, registriandmeid, vedajate teateid maksete kohta, kontrollitud ettevõtte dokumente ning ekspediitori puhul seda, kas ekspediitori vastutuskindlustus on kontrollitud. ' +
    'Tellija näeb arve esitamiseks teie ettevõtte nime.',
  oldTrips:
    'Veod, mis on juba kokku lepitud Aivomaa Oy-ga kui lepingupoolega, viiakse lõpule ja arveldatakse vanadel tingimustel – väljamaksed tehakse nagu varem.',
  terms:
    'Uuendatud kasutustingimused ja vedaja leping avaldatakse teenuses. Tellimuse andmed leiate oma kontolt:',
  button: 'Ava tellimus',
  questions: 'Küsimusi? Vastake lihtsalt sellele kirjale.',
};

const lv: NoticeTexts = {
  signature: 'RAHTIS komanda',
  neverAsk: 'Mēs nekad neprasām Jūsu paroli e-pastā vai pa tālruni.',
  tagline: 'Transporta vadība un kravu birža · Ziemeļeiropa',
  greeting: 'Labdien!',
  subject: 'RAHTIS · Apakšuzņēmēja režīms beidzas – bez procentiem no pārvadājumiem',
  heading: 'Bez procentiem no pārvadājumiem: apakšuzņēmēja režīms beidzas',
  preheader: 'Pirmā aktīvā automašīna ir bez maksas. Abonementa maksu Jums sāksim iekasēt no 2027. gada 1. janvāra.',
  intro:
    'Mēs pārtraucam RAHTIS apakšuzņēmēja režīmu, kurā līgumslēdzēja puse bija Aivomaa Oy, no katra pārvadājuma cenas tika ieturēti 3 % un izmaksas veica Aivomaa Oy. ' +
    'Mēs tikai ienākam tirgū un vēlamies, lai viss būtu vienkārši: nekādu procentu no pārvadājumiem – nevienam.',
  moved:
    'Jūsu uzņēmums ir pārcelts uz abonementu. Aktīva automašīna ir automašīna, kurai kalendārajā mēnesī ir pabeigts vismaz viens pārvadājums.',
  factFirst: ['Pirmā aktīvā automašīna', 'Bez maksas, pastāvīgi'],
  factNext: ['Katra nākamā aktīvā automašīna', '14,90 € mēnesī bez PVN'],
  factFrom: ['Abonementa maksa no', '2027. gada 1. janvāra'],
  feesFrom:
    'Jums abonementa maksa tiks iekasēta tikai no 2027. gada 1. janvāra. Līdz tam rēķini par abonementu netiks izrakstīti un procenti no pārvadājumiem netiks ieturēti.',
  desk:
    'Pasūtījumi no kravu biržas tagad ir tieši līgumi starp Jums un pasūtītāju: rēķinu pasūtītājam izrakstāt paši – par saskaņoto cenu un ar saskaņotajiem noteikumiem. ' +
    'Pirms pasūtījuma pieņemšanas Jūs redzat pasūtītāja maksājumu informāciju: uzņēmuma vecumu, reģistra datus, pārvadātāju ziņojumus par maksājumiem, pārbaudītos uzņēmuma dokumentus un ekspeditoram – vai ir pārbaudīta ekspeditora civiltiesiskās atbildības apdrošināšana. ' +
    'Pasūtītājs redz Jūsu uzņēmuma nosaukumu rēķina izrakstīšanai.',
  oldTrips:
    'Pārvadājumi, kas jau saskaņoti ar Aivomaa Oy kā līgumslēdzēju pusi, tiks pabeigti un norēķināti saskaņā ar iepriekšējiem noteikumiem – izmaksas notiks kā līdz šim.',
  terms:
    'Atjauninātie lietošanas noteikumi un pārvadātāja līgums tiks publicēti pakalpojumā. Informāciju par abonementu atradīsiet savā kontā:',
  button: 'Atvērt abonementu',
  questions: 'Jautājumi? Vienkārši atbildiet uz šo e-pastu.',
};

const lt: NoticeTexts = {
  signature: 'RAHTIS komanda',
  neverAsk: 'Niekada neprašome Jūsų slaptažodžio el. paštu ar telefonu.',
  tagline: 'Transporto valdymas ir krovinių birža · Šiaurės Europa',
  greeting: 'Laba diena,',
  subject: 'RAHTIS · Subrangos režimas baigiasi – jokių procentų nuo pervežimų',
  heading: 'Jokių procentų nuo pervežimų: subrangos režimas baigiasi',
  preheader: 'Pirma aktyvi transporto priemonė – nemokamai. Prenumeratos mokestis Jums taikomas nuo 2027 m. sausio 1 d.',
  intro:
    'Nutraukiame RAHTIS subrangos režimą, kai sutarties šalis buvo Aivomaa Oy, iš kiekvieno pervežimo kainos buvo išskaičiuojama 3 %, o išmokas mokėjo Aivomaa Oy. ' +
    'Tik ateiname į rinką ir norime, kad viskas būtų paprasta: jokių procentų nuo pervežimų – niekam.',
  moved:
    'Jūsų įmonė perkelta į prenumeratą. Aktyvi transporto priemonė – tai transporto priemonė, kuri per kalendorinį mėnesį užbaigė bent vieną pervežimą.',
  factFirst: ['Pirma aktyvi transporto priemonė', 'Nemokamai, visam laikui'],
  factNext: ['Kiekviena kita aktyvi transporto priemonė', '14,90 € per mėnesį be PVM'],
  factFrom: ['Prenumeratos mokestis nuo', '2027 m. sausio 1 d.'],
  feesFrom:
    'Jums prenumeratos mokestis bus skaičiuojamas tik nuo 2027 m. sausio 1 d. Iki tol sąskaitos už prenumeratą nebus išrašomos ir procentai nuo pervežimų nebus išskaičiuojami.',
  desk:
    'Užsakymai iš krovinių biržos dabar yra tiesioginės sutartys tarp Jūsų ir užsakovo: sąskaitą užsakovui išrašote patys – pagal suderintą kainą ir sąlygas. ' +
    'Prieš priimdami užsakymą matote užsakovo mokėjimų informaciją: įmonės amžių, registrų duomenis, vežėjų pranešimus apie mokėjimus, patikrintus įmonės dokumentus, o ekspeditoriaus atveju – ar patikrintas ekspeditoriaus civilinės atsakomybės draudimas. ' +
    'Užsakovas mato Jūsų įmonės pavadinimą sąskaitai išrašyti.',
  oldTrips:
    'Pervežimai, jau suderinti su Aivomaa Oy kaip sutarties šalimi, bus atlikti ir atsiskaityti senomis sąlygomis – išmokos mokamos kaip anksčiau.',
  terms:
    'Atnaujintos naudojimo sąlygos ir vežėjo sutartis bus paskelbtos paslaugoje. Prenumeratos informaciją rasite savo paskyroje:',
  button: 'Atidaryti prenumeratą',
  questions: 'Klausimų? Tiesiog atsakykite į šį laišką.',
};

const TEXTS: Record<NoticeLocale, NoticeTexts> = { fi, en, sv, ru, pl, de, et, lv, lt };

/** Всё, из чего layout собирает письмо: тема, шапка, блоки, подвал. */
export type NoticeContent = {
  subject: string;
  heading: string;
  preheader: string;
  blocks: EmailBlock[];
  signature: string;
  neverAsk: string;
  tagline: string;
};

/**
 * Содержание письма на языке получателя.
 *
 * Цены и даты — таблицей фактов: человек ищет в письме «сколько и с
 * какого числа», а не читает абзацы. Ссылка на страницу абонемента —
 * кнопкой, вопросы — ответом на письмо (Reply-To ставит шаблон).
 */
export function noticeContent(locale: NoticeLocale, link: string): NoticeContent {
  const t = TEXTS[locale] ?? TEXTS.en;

  return {
    subject: t.subject,
    heading: t.heading,
    preheader: t.preheader,
    blocks: [
      { kind: 'text', value: t.greeting },
      { kind: 'text', value: t.intro },
      { kind: 'text', value: t.moved },
      { kind: 'facts', rows: [t.factFirst, t.factNext, t.factFrom] },
      { kind: 'text', value: t.feesFrom },
      { kind: 'text', value: t.desk },
      { kind: 'text', value: t.oldTrips },
      { kind: 'text', value: t.terms },
      { kind: 'button', label: t.button, href: link },
      { kind: 'note', value: t.questions },
    ],
    signature: t.signature,
    neverAsk: t.neverAsk,
    tagline: t.tagline,
  };
}

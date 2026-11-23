import type { Locale } from '../../i18n/config.ts';
import type { FinalKind, GraceKind } from '../defaultSteps.ts';

/**
 * Шаги после порога просрочки — тексты страницы сделки и уведомлений на
 * десяти языках кабинета (24.11.2026). Названия шагов общие, а термин права
 * страны, закон и пункт договора подставляются из плана страны
 * (defaultSteps.ts) на языке страны, в скобках — как в остальных текстах
 * страны (countryTexts/<cc>.ts): по ним сторона ищет то же в договоре.
 *
 * Подстановки: {date}, {deadline}, {days}, {term}, {law}, {clause}, {plate},
 * {amount}, {step}.
 * Тексты носителем языка не вычитаны — вычитать до рекламы раздела.
 */
export type DefaultStepsCopy = {
  title: string;
  intro: string;
  sendHint: string;
  holidayHint: string;
  grace: Record<GraceKind, string>;
  final: Record<FinalKind, string>;
  graceRule: string;
  finalRule: string;
  noGrace: string;
  graceDone: string;
  finalDone: string;
  notYet: string;
  sentOn: string;
  deadline: string;
  record: string;
  letter: string;
  warnGraceRunning: string;
  warnDeadline: string;
  warnNoThreshold: string;
  confirm: string;
  needGrace: string;
  stopped: string;
  buyerHint: string;
  notifyGraceBody: string;
  notifyFinalBody: string;
  error: string;
  confirmNeeded: string;
};

export const DEFAULT_STEPS_TEXTS: Record<Locale, DefaultStepsCopy> = {
  fi: {
    title: 'Toimet maksurajan täyttymisen jälkeen',
    intro:
      'Nämä ovat vain merkintöjä ja muistutuksia: ne eivät siirrä rahaa eivätkä ajoneuvoa. Myyjä kirjaa kunkin vaiheen lähetettyään kirjeen ostajalle, ja ostaja saa ilmoituksen RAHTIKSESSA. Kaupan päättyminen kirjataan alla, kun ajoneuvo on palautettu tai olette sopineet asiasta.',
    sendHint:
      'RAHTIS laatii kirjeen sopimuksen kielellä; myyjä allekirjoittaa sen ja lähettää sen sopimuksen kohdan 11.2 mukaisesti. Kirje katsotaan vastaanotetuksi lähettämistä seuraavana arkipäivänä.',
    holidayHint: 'Viikonloput on otettu huomioon, arkipyhät eivät – tarkista päivämäärä.',
    grace: { PERIOD: 'Lisäaika maksulle', WARNING: 'Kirjallinen varoitus ja maksun määräaika' },
    final: { WITHDRAWAL: 'Sopimuksesta vetäytyminen', TERMINATION: 'Sopimuksen purkaminen', REPOSSESSION: 'Ilmoitus takaisinotosta' },
    graceRule: 'Vähintään {days} päivää kirjeen vastaanottamisesta ({term}, {law}; sopimuksen kohta {clause}).',
    finalRule: '{term}, {law}; sopimuksen kohta {clause}.',
    noGrace:
      'Maan laki ei edellytä lisäaikaa: rajan täytyttyä myyjä voi antaa kirjallisen ilmoituksen heti. Ostaja voi silti pitää ajoneuvon maksamalla erääntyneen määrän ennen takaisinottoa.',
    graceDone: 'Kirje {date}; viimeinen maksupäivä {deadline}.',
    finalDone: 'Ilmoitettu {date}.',
    notYet: 'Ei kirjattu.',
    sentOn: 'Kirjeen lähetyspäivä',
    deadline: 'Viimeinen maksupäivä: {deadline}',
    record: 'Kirjaa',
    letter: 'Kirje (PDF)',
    warnGraceRunning: 'Edellinen lisäaika on voimassa {deadline} asti.',
    warnDeadline:
      'Lisäaika on voimassa {deadline} asti. Joissakin maissa vetäytymisestä voi ilmoittaa etukäteen, mutta varmista asia juristilta ennen kuin teet niin.',
    warnNoThreshold: 'RAHTIKSEEN kirjattujen maksujen mukaan sopimuksen raja ei ole täyttynyt. RAHTIKSEN ulkopuolella maksettuja suorituksia ei näy tässä.',
    confirm: 'Ymmärrän ja haluan kirjata vaiheen nyt',
    needGrace: 'Kirjaa ensin lisäaika.',
    stopped: 'Vaihe on kirjattu: RAHTIS ei enää lähetä tästä kaupasta maksumuistutuksia eikä uusia maksuerien asiakirjoja.',
    buyerHint: 'Myyjä on kirjannut seuraavat vaiheet. Maksa erääntynyt määrä viimeiseen maksupäivään mennessä tai ota yhteyttä myyjään.',
    notifyGraceBody:
      'Myyjä on asettanut erääntyneen määrän {amount} maksulle määräajan {deadline} ({term}). Jos määrää ei makseta, myyjä voi siirtyä sopimuksen seuraavaan vaiheeseen. Tiedot ovat kaupan sivulla.',
    notifyFinalBody:
      'Myyjä on kirjannut: {step} ({term}) {date}. Ajoneuvon palautus ja tilitys tehdään sopimuksen mukaan; myyjä ei saa ottaa ajoneuvoa ilman suostumustasi tai viranomaisen päätöstä. Tiedot ovat kaupan sivulla.',
    error: 'Vaihetta ei voitu kirjata. Päivitä sivu ja yritä uudelleen.',
    confirmNeeded: 'Vahvista, että haluat kirjata vaiheen nyt.',
  },
  en: {
    title: 'Steps after the payment threshold',
    intro:
      'These are records and reminders only: they do not move money or the vehicle. The seller records each step after sending the letter to the buyer, and the buyer is notified in RAHTIS. The end of the sale is recorded below once the vehicle has been returned or you have agreed.',
    sendHint:
      'RAHTIS prepares the letter in the language of the contract; the seller signs it and sends it as clause 11.2 of the contract requires. A letter counts as received on the next working day after sending.',
    holidayHint: 'Weekends are taken into account, public holidays are not – check the date.',
    grace: { PERIOD: 'Additional period for payment', WARNING: 'Written warning with a payment deadline' },
    final: { WITHDRAWAL: 'Withdrawal from the contract', TERMINATION: 'Termination of the contract', REPOSSESSION: 'Notice of repossession' },
    graceRule: 'At least {days} days from receipt of the letter ({term}, {law}; contract clause {clause}).',
    finalRule: '{term}, {law}; contract clause {clause}.',
    noGrace:
      'The law of the country requires no additional period: once the threshold is reached, the seller may give the written notice straight away. The buyer can still keep the vehicle by paying the overdue amount before it is taken back.',
    graceDone: 'Letter of {date}; last day for payment {deadline}.',
    finalDone: 'Declared on {date}.',
    notYet: 'Not recorded.',
    sentOn: 'Date the letter was sent',
    deadline: 'Last day for payment: {deadline}',
    record: 'Record',
    letter: 'Letter (PDF)',
    warnGraceRunning: 'The previous period runs until {deadline}.',
    warnDeadline:
      'The additional period runs until {deadline}. In some countries the withdrawal may be declared in advance, but check with your lawyer before doing so.',
    warnNoThreshold: 'According to the payments recorded in RAHTIS the threshold of the contract has not been reached. Payments made outside RAHTIS are not shown here.',
    confirm: 'I understand and want to record the step now',
    needGrace: 'Record the additional period first.',
    stopped: 'Step recorded: RAHTIS no longer sends payment reminders or new instalment documents for this deal.',
    buyerHint: 'The seller has recorded the steps below. Pay the overdue amount by the last day for payment, or contact the seller.',
    notifyGraceBody:
      'The seller has set a deadline for paying the overdue amount {amount}: {deadline} ({term}). If it is not paid, the seller may take the next step under the contract. Details are on the deal page.',
    notifyFinalBody:
      'The seller has recorded: {step} ({term}) on {date}. The return of the vehicle and the settlement follow the contract; the seller may not take the vehicle without your consent or a decision of the authorities. Details are on the deal page.',
    error: 'The step could not be recorded. Refresh the page and try again.',
    confirmNeeded: 'Confirm that you want to record the step now.',
  },
  sv: {
    title: 'Åtgärder efter betalningsgränsen',
    intro:
      'Detta är bara anteckningar och påminnelser: de flyttar varken pengar eller fordonet. Säljaren registrerar varje steg efter att ha skickat brevet till köparen, och köparen får ett meddelande i RAHTIS. Att köpet har upphört registreras nedan när fordonet har lämnats tillbaka eller ni har kommit överens.',
    sendHint:
      'RAHTIS upprättar brevet på avtalets språk; säljaren undertecknar det och skickar det enligt avtalets punkt 11.2. Ett brev anses ha kommit fram vardagen efter avsändandet.',
    holidayHint: 'Helger (lördag och söndag) är beaktade, helgdagar inte – kontrollera datumet.',
    grace: { PERIOD: 'Tilläggstid för betalning', WARNING: 'Skriftlig varning med sista betalningsdag' },
    final: { WITHDRAWAL: 'Frånträdande av avtalet', TERMINATION: 'Hävning av avtalet', REPOSSESSION: 'Meddelande om återtagande' },
    graceRule: 'Minst {days} dagar från mottagandet av brevet ({term}, {law}; avtalets punkt {clause}).',
    finalRule: '{term}, {law}; avtalets punkt {clause}.',
    noGrace:
      'Landets lag kräver ingen tilläggstid: när gränsen är nådd får säljaren genast lämna det skriftliga meddelandet. Köparen kan ändå behålla fordonet genom att betala det förfallna beloppet innan det återtas.',
    graceDone: 'Brev {date}; sista betalningsdag {deadline}.',
    finalDone: 'Meddelat {date}.',
    notYet: 'Inte registrerat.',
    sentOn: 'Dag då brevet skickades',
    deadline: 'Sista betalningsdag: {deadline}',
    record: 'Registrera',
    letter: 'Brev (PDF)',
    warnGraceRunning: 'Den tidigare tilläggstiden löper till {deadline}.',
    warnDeadline:
      'Tilläggstiden löper till {deadline}. I vissa länder får frånträdandet meddelas i förväg, men kontrollera med er jurist innan ni gör det.',
    warnNoThreshold: 'Enligt de betalningar som registrerats i RAHTIS är avtalets gräns inte nådd. Betalningar utanför RAHTIS syns inte här.',
    confirm: 'Jag förstår och vill registrera steget nu',
    needGrace: 'Registrera tilläggstiden först.',
    stopped: 'Steget är registrerat: RAHTIS skickar inte längre betalningspåminnelser eller nya dokument för delbetalningar i detta köp.',
    buyerHint: 'Säljaren har registrerat stegen nedan. Betala det förfallna beloppet senast sista betalningsdagen eller kontakta säljaren.',
    notifyGraceBody:
      'Säljaren har satt en sista dag för betalning av det förfallna beloppet {amount}: {deadline} ({term}). Om beloppet inte betalas får säljaren gå vidare enligt avtalet. Detaljer finns på köpets sida.',
    notifyFinalBody:
      'Säljaren har registrerat: {step} ({term}) {date}. Återlämnandet av fordonet och avräkningen sker enligt avtalet; säljaren får inte ta fordonet utan ert samtycke eller myndighetsbeslut. Detaljer finns på köpets sida.',
    error: 'Steget kunde inte registreras. Uppdatera sidan och försök igen.',
    confirmNeeded: 'Bekräfta att du vill registrera steget nu.',
  },
  et: {
    title: 'Sammud pärast makseviivituse künnist',
    intro:
      'Need on üksnes märked ja meeldetuletused: need ei liiguta raha ega sõidukit. Müüja märgib iga sammu pärast seda, kui on saatnud ostjale kirja, ja ostja saab RAHTISes teate. Tehingu lõppemine märgitakse allpool, kui sõiduk on tagastatud või olete kokku leppinud.',
    sendHint:
      'RAHTIS koostab kirja lepingu keeles; müüja allkirjastab selle ja saadab lepingu punkti 11.2 kohaselt. Kiri loetakse kättesaaduks saatmisele järgneval tööpäeval.',
    holidayHint: 'Nädalavahetused on arvesse võetud, riigipühad mitte – kontrollige kuupäeva.',
    grace: { PERIOD: 'Täiendav tähtaeg tasumiseks', WARNING: 'Kirjalik hoiatus maksetähtajaga' },
    final: { WITHDRAWAL: 'Lepingust taganemine', TERMINATION: 'Lepingu lõpetamine', REPOSSESSION: 'Teade sõiduki tagasivõtmise kohta' },
    graceRule: 'Vähemalt {days} päeva kirja kättesaamisest ({term}, {law}; lepingu punkt {clause}).',
    finalRule: '{term}, {law}; lepingu punkt {clause}.',
    noGrace:
      'Riigi seadus täiendavat tähtaega ei nõua: künnise täitumisel võib müüja kirjaliku teate anda kohe. Ostja võib sõiduki siiski endale jätta, kui tasub võlgnevuse enne sõiduki tagasivõtmist.',
    graceDone: 'Kiri {date}; viimane maksepäev {deadline}.',
    finalDone: 'Teatatud {date}.',
    notYet: 'Märkimata.',
    sentOn: 'Kirja saatmise kuupäev',
    deadline: 'Viimane maksepäev: {deadline}',
    record: 'Märgi',
    letter: 'Kiri (PDF)',
    warnGraceRunning: 'Eelmine täiendav tähtaeg kestab kuni {deadline}.',
    warnDeadline:
      'Täiendav tähtaeg kestab kuni {deadline}. Mõnes riigis võib taganemisest teatada ette, kuid enne seda pidage nõu oma juristiga.',
    warnNoThreshold: 'RAHTISesse märgitud maksete järgi lepingu künnis ei ole täitunud. Väljaspool RAHTISt tehtud makseid siin ei näe.',
    confirm: 'Saan aru ja soovin sammu kohe märkida',
    needGrace: 'Märkige kõigepealt täiendav tähtaeg.',
    stopped: 'Samm on märgitud: RAHTIS ei saada selle tehingu kohta enam maksemeeldetuletusi ega uusi osamaksete dokumente.',
    buyerHint: 'Müüja on märkinud allolevad sammud. Tasuge võlgnevus viimaseks maksepäevaks või võtke ühendust müüjaga.',
    notifyGraceBody:
      'Müüja on määranud võlgnevuse {amount} tasumiseks tähtaja {deadline} ({term}). Kui seda ei tasuta, võib müüja astuda lepingu järgmise sammu. Üksikasjad on tehingu lehel.',
    notifyFinalBody:
      'Müüja on märkinud: {step} ({term}) {date}. Sõiduki tagastamine ja lõpparveldus toimuvad lepingu kohaselt; müüja ei või sõidukit ära võtta ilma teie nõusoleku või kohtu otsuseta. Üksikasjad on tehingu lehel.',
    error: 'Sammu ei õnnestunud märkida. Värskendage lehte ja proovige uuesti.',
    confirmNeeded: 'Kinnitage, et soovite sammu kohe märkida.',
  },
  lv: {
    title: 'Darbības pēc maksājumu kavējuma sliekšņa',
    intro:
      'Tās ir tikai atzīmes un atgādinājumi: tās nepārvieto ne naudu, ne transportlīdzekli. Pārdevējs atzīmē katru soli pēc vēstules nosūtīšanas pircējam, un pircējs saņem paziņojumu RAHTIS. Pirkuma izbeigšanos atzīmē zemāk, kad transportlīdzeklis ir atdots vai esat vienojušies.',
    sendHint:
      'RAHTIS sagatavo vēstuli līguma valodā; pārdevējs to paraksta un nosūta, kā noteikts līguma 11.2. punktā. Vēstule uzskatāma par saņemtu nākamajā darbdienā pēc nosūtīšanas.',
    holidayHint: 'Brīvdienas ir ņemtas vērā, svētku dienas nav – pārbaudiet datumu.',
    grace: { PERIOD: 'Papildu termiņš samaksai', WARNING: 'Rakstveida brīdinājums ar samaksas termiņu' },
    final: { WITHDRAWAL: 'Atkāpšanās no līguma', TERMINATION: 'Līguma atcelšana', REPOSSESSION: 'Paziņojums par transportlīdzekļa atņemšanu' },
    graceRule: 'Vismaz {days} dienas no vēstules saņemšanas ({term}, {law}; līguma {clause}. punkts).',
    finalRule: '{term}, {law}; līguma {clause}. punkts.',
    noGrace:
      'Valsts likums papildu termiņu neprasa: kad slieksnis sasniegts, pārdevējs var uzreiz sniegt rakstveida paziņojumu. Pircējs tomēr var paturēt transportlīdzekli, samaksājot kavēto summu, pirms tas atņemts.',
    graceDone: 'Vēstule {date}; pēdējā samaksas diena {deadline}.',
    finalDone: 'Paziņots {date}.',
    notYet: 'Nav atzīmēts.',
    sentOn: 'Vēstules nosūtīšanas datums',
    deadline: 'Pēdējā samaksas diena: {deadline}',
    record: 'Atzīmēt',
    letter: 'Vēstule (PDF)',
    warnGraceRunning: 'Iepriekšējais termiņš ir spēkā līdz {deadline}.',
    warnDeadline:
      'Termiņš ir spēkā līdz {deadline}. Dažās valstīs par atcelšanu var paziņot iepriekš, taču pirms tam konsultējieties ar savu juristu.',
    warnNoThreshold: 'Saskaņā ar RAHTIS reģistrētajiem maksājumiem līguma slieksnis nav sasniegts. Maksājumi ārpus RAHTIS šeit nav redzami.',
    confirm: 'Saprotu un vēlos atzīmēt soli tagad',
    needGrace: 'Vispirms atzīmējiet termiņu.',
    stopped: 'Solis atzīmēts: RAHTIS par šo darījumu vairs nesūta maksājumu atgādinājumus un jaunus maksājumu dokumentus.',
    buyerHint: 'Pārdevējs ir atzīmējis tālāk norādītos soļus. Samaksājiet kavēto summu līdz pēdējai samaksas dienai vai sazinieties ar pārdevēju.',
    notifyGraceBody:
      'Pārdevējs ir noteicis kavētās summas {amount} samaksas termiņu: {deadline} ({term}). Ja summa netiek samaksāta, pārdevējs var spert nākamo soli saskaņā ar līgumu. Sīkāk – darījuma lapā.',
    notifyFinalBody:
      'Pārdevējs ir atzīmējis: {step} ({term}) {date}. Transportlīdzekļa atdošana un norēķins notiek saskaņā ar līgumu; pārdevējs nedrīkst paņemt transportlīdzekli bez jūsu piekrišanas vai tiesas nolēmuma. Sīkāk – darījuma lapā.',
    error: 'Soli neizdevās atzīmēt. Atsvaidziniet lapu un mēģiniet vēlreiz.',
    confirmNeeded: 'Apstipriniet, ka vēlaties atzīmēt soli tagad.',
  },
  lt: {
    title: 'Veiksmai pasiekus pradelstų mokėjimų ribą',
    intro:
      'Tai tik žymos ir priminimai: jie neperkelia nei pinigų, nei transporto priemonės. Pardavėjas pažymi kiekvieną žingsnį išsiuntęs pirkėjui laišką, o pirkėjas gauna pranešimą RAHTIS. Sandorio pabaiga pažymima žemiau, kai transporto priemonė grąžinta arba susitarėte.',
    sendHint:
      'RAHTIS parengia laišką sutarties kalba; pardavėjas jį pasirašo ir išsiunčia, kaip nustatyta sutarties 11.2 punkte. Laikoma, kad laiškas gautas kitą darbo dieną po išsiuntimo.',
    holidayHint: 'Savaitgaliai įvertinti, šventinės dienos – ne; patikrinkite datą.',
    grace: { PERIOD: 'Papildomas terminas sumokėti', WARNING: 'Rašytinis įspėjimas su mokėjimo terminu' },
    final: { WITHDRAWAL: 'Atsisakymas sutarties', TERMINATION: 'Sutarties nutraukimas', REPOSSESSION: 'Pranešimas apie transporto priemonės atsiėmimą' },
    graceRule: 'Ne trumpiau kaip {days} dienų nuo laiško gavimo ({term}, {law}; sutarties {clause} punktas).',
    finalRule: '{term}, {law}; sutarties {clause} punktas.',
    noGrace:
      'Šalies įstatymas papildomo termino nereikalauja: pasiekus ribą pardavėjas gali iš karto pateikti rašytinį pranešimą. Pirkėjas vis tiek gali pasilikti transporto priemonę, sumokėjęs pradelstą sumą iki jos atsiėmimo.',
    graceDone: 'Laiškas {date}; paskutinė mokėjimo diena {deadline}.',
    finalDone: 'Pranešta {date}.',
    notYet: 'Nepažymėta.',
    sentOn: 'Laiško išsiuntimo data',
    deadline: 'Paskutinė mokėjimo diena: {deadline}',
    record: 'Pažymėti',
    letter: 'Laiškas (PDF)',
    warnGraceRunning: 'Ankstesnis terminas galioja iki {deadline}.',
    warnDeadline:
      'Papildomas terminas galioja iki {deadline}. Kai kuriose šalyse apie nutraukimą galima pranešti iš anksto, tačiau prieš tai pasitarkite su savo teisininku.',
    warnNoThreshold: 'Pagal RAHTIS pažymėtus mokėjimus sutarties riba nepasiekta. Mokėjimai ne per RAHTIS čia nematomi.',
    confirm: 'Suprantu ir noriu pažymėti žingsnį dabar',
    needGrace: 'Pirmiausia pažymėkite papildomą terminą.',
    stopped: 'Žingsnis pažymėtas: RAHTIS dėl šio sandorio nebesiunčia mokėjimo priminimų ir naujų įmokų dokumentų.',
    buyerHint: 'Pardavėjas pažymėjo toliau nurodytus žingsnius. Sumokėkite pradelstą sumą iki paskutinės mokėjimo dienos arba susisiekite su pardavėju.',
    notifyGraceBody:
      'Pardavėjas nustatė pradelstos sumos {amount} sumokėjimo terminą: {deadline} ({term}). Jei suma nesumokama, pardavėjas gali imtis kito sutartyje numatyto žingsnio. Išsamiau – sandorio puslapyje.',
    notifyFinalBody:
      'Pardavėjas pažymėjo: {step} ({term}) {date}. Transporto priemonės grąžinimas ir atsiskaitymas vyksta pagal sutartį; pardavėjas negali paimti transporto priemonės be jūsų sutikimo ar teismo sprendimo. Išsamiau – sandorio puslapyje.',
    error: 'Žingsnio pažymėti nepavyko. Atnaujinkite puslapį ir bandykite dar kartą.',
    confirmNeeded: 'Patvirtinkite, kad norite pažymėti žingsnį dabar.',
  },
  pl: {
    title: 'Kroki po przekroczeniu progu zaległości',
    intro:
      'To wyłącznie zapisy i przypomnienia: nie przenoszą pieniędzy ani pojazdu. Sprzedawca zapisuje każdy krok po wysłaniu pisma do Kupującego, a Kupujący dostaje powiadomienie w RAHTIS. Zakończenie sprzedaży zapisuje się poniżej, gdy pojazd został zwrócony albo strony się porozumiały.',
    sendHint:
      'RAHTIS przygotowuje pismo w języku umowy; Sprzedawca je podpisuje i wysyła zgodnie z pkt 11.2 umowy. Pismo uważa się za doręczone w następnym dniu roboczym po wysłaniu.',
    holidayHint: 'Weekendy są uwzględnione, święta – nie; sprawdź datę.',
    grace: { PERIOD: 'Dodatkowy termin zapłaty', WARNING: 'Pisemne ostrzeżenie z terminem zapłaty' },
    final: { WITHDRAWAL: 'Odstąpienie od umowy', TERMINATION: 'Rozwiązanie umowy', REPOSSESSION: 'Zawiadomienie o odebraniu pojazdu' },
    graceRule: 'Co najmniej {days} dni od doręczenia pisma ({term}, {law}; pkt {clause} umowy).',
    finalRule: '{term}, {law}; pkt {clause} umowy.',
    noGrace:
      'Prawo kraju nie wymaga dodatkowego terminu: po przekroczeniu progu Sprzedawca może od razu złożyć pisemne zawiadomienie. Kupujący nadal może zachować pojazd, płacąc zaległość przed jego odebraniem.',
    graceDone: 'Pismo z {date}; ostatni dzień zapłaty {deadline}.',
    finalDone: 'Złożono {date}.',
    notYet: 'Nie zapisano.',
    sentOn: 'Data wysłania pisma',
    deadline: 'Ostatni dzień zapłaty: {deadline}',
    record: 'Zapisz',
    letter: 'Pismo (PDF)',
    warnGraceRunning: 'Poprzedni termin biegnie do {deadline}.',
    warnDeadline:
      'Dodatkowy termin biegnie do {deadline}. W niektórych krajach odstąpienie można zapowiedzieć z góry, ale przed takim krokiem skonsultuj się z prawnikiem.',
    warnNoThreshold: 'Według płatności zapisanych w RAHTIS próg z umowy nie został przekroczony. Płatności poza RAHTIS nie są tu widoczne.',
    confirm: 'Rozumiem i chcę zapisać krok teraz',
    needGrace: 'Najpierw zapisz dodatkowy termin.',
    stopped: 'Krok zapisany: RAHTIS nie wysyła już dla tej sprzedaży przypomnień o płatnościach ani nowych dokumentów rat.',
    buyerHint: 'Sprzedawca zapisał poniższe kroki. Zapłać zaległość do ostatniego dnia terminu albo skontaktuj się ze Sprzedawcą.',
    notifyGraceBody:
      'Sprzedawca wyznaczył termin zapłaty zaległości {amount}: {deadline} ({term}). Jeżeli nie zostanie zapłacona, Sprzedawca może podjąć kolejny krok przewidziany w umowie. Szczegóły na stronie transakcji.',
    notifyFinalBody:
      'Sprzedawca zapisał: {step} ({term}) {date}. Zwrot pojazdu i rozliczenie następują zgodnie z umową; Sprzedawca nie może odebrać pojazdu bez Twojej zgody lub orzeczenia sądu. Szczegóły na stronie transakcji.',
    error: 'Nie udało się zapisać kroku. Odśwież stronę i spróbuj ponownie.',
    confirmNeeded: 'Potwierdź, że chcesz zapisać krok teraz.',
  },
  de: {
    title: 'Schritte nach Erreichen der Verzugsschwelle',
    intro:
      'Dies sind nur Vermerke und Erinnerungen: Sie bewegen weder Geld noch das Fahrzeug. Der Verkäufer vermerkt jeden Schritt, nachdem er das Schreiben an den Käufer versandt hat; der Käufer wird in RAHTIS benachrichtigt. Das Ende des Kaufs wird unten vermerkt, wenn das Fahrzeug zurückgegeben wurde oder Sie sich geeinigt haben.',
    sendHint:
      'RAHTIS erstellt das Schreiben in der Vertragssprache; der Verkäufer unterzeichnet es und versendet es gemäß Ziffer 11.2 des Vertrags. Ein Schreiben gilt am nächsten Werktag nach dem Versand als zugegangen.',
    holidayHint: 'Wochenenden sind berücksichtigt, Feiertage nicht – prüfen Sie das Datum.',
    grace: { PERIOD: 'Nachfrist zur Zahlung', WARNING: 'Schriftliche Abmahnung mit Zahlungsfrist' },
    final: { WITHDRAWAL: 'Rücktritt vom Vertrag', TERMINATION: 'Aufhebung des Vertrags', REPOSSESSION: 'Mitteilung über die Rücknahme' },
    graceRule: 'Mindestens {days} Tage ab Zugang des Schreibens ({term}, {law}; Ziffer {clause} des Vertrags).',
    finalRule: '{term}, {law}; Ziffer {clause} des Vertrags.',
    noGrace:
      'Das Recht des Landes verlangt keine Nachfrist: Ist die Schwelle erreicht, kann der Verkäufer die schriftliche Mitteilung sofort abgeben. Der Käufer kann das Fahrzeug dennoch behalten, wenn er den Rückstand vor der Rücknahme zahlt.',
    graceDone: 'Schreiben vom {date}; letzter Zahlungstag {deadline}.',
    finalDone: 'Erklärt am {date}.',
    notYet: 'Nicht vermerkt.',
    sentOn: 'Versanddatum des Schreibens',
    deadline: 'Letzter Zahlungstag: {deadline}',
    record: 'Vermerken',
    letter: 'Schreiben (PDF)',
    warnGraceRunning: 'Die vorherige Frist läuft bis {deadline}.',
    warnDeadline:
      'Die Nachfrist läuft bis {deadline}. In einigen Ländern kann der Rücktritt vorab erklärt werden; klären Sie dies vorher mit Ihrem Anwalt.',
    warnNoThreshold: 'Nach den in RAHTIS vermerkten Zahlungen ist die vertragliche Schwelle nicht erreicht. Zahlungen außerhalb von RAHTIS sind hier nicht sichtbar.',
    confirm: 'Ich habe verstanden und möchte den Schritt jetzt vermerken',
    needGrace: 'Vermerken Sie zuerst die Nachfrist.',
    stopped: 'Schritt vermerkt: RAHTIS versendet für diesen Kauf keine Zahlungserinnerungen und keine neuen Ratendokumente mehr.',
    buyerHint: 'Der Verkäufer hat die folgenden Schritte vermerkt. Zahlen Sie den Rückstand bis zum letzten Zahlungstag oder wenden Sie sich an den Verkäufer.',
    notifyGraceBody:
      'Der Verkäufer hat für den Rückstand von {amount} eine Zahlungsfrist bis {deadline} gesetzt ({term}). Wird nicht gezahlt, kann der Verkäufer den nächsten vertraglichen Schritt gehen. Einzelheiten auf der Seite des Kaufs.',
    notifyFinalBody:
      'Der Verkäufer hat vermerkt: {step} ({term}) am {date}. Rückgabe des Fahrzeugs und Abrechnung richten sich nach dem Vertrag; der Verkäufer darf das Fahrzeug nicht ohne Ihre Zustimmung oder eine gerichtliche Entscheidung an sich nehmen. Einzelheiten auf der Seite des Kaufs.',
    error: 'Der Schritt konnte nicht vermerkt werden. Laden Sie die Seite neu und versuchen Sie es erneut.',
    confirmNeeded: 'Bestätigen Sie, dass Sie den Schritt jetzt vermerken möchten.',
  },
  ru: {
    title: 'Шаги после порога просрочки',
    intro:
      'Это только записи и напоминания: они не двигают ни денег, ни машины. Продавец записывает каждый шаг после того, как отправил письмо покупателю, а покупатель получает уведомление в RAHTIS. Прекращение сделки записывается ниже, когда машина возвращена или стороны договорились.',
    sendHint:
      'RAHTIS готовит письмо на языке договора; продавец подписывает его и отправляет так, как требует п. 11.2 договора. Письмо считается полученным на следующий рабочий день после отправки.',
    holidayHint: 'Выходные учтены, праздники страны — нет: проверьте дату.',
    grace: { PERIOD: 'Дополнительный срок для оплаты', WARNING: 'Письменное предупреждение со сроком оплаты' },
    final: { WITHDRAWAL: 'Отказ от договора', TERMINATION: 'Расторжение договора', REPOSSESSION: 'Уведомление об изъятии машины' },
    graceRule: 'Не меньше {days} дней с получения письма ({term}, {law}; п. {clause} договора).',
    finalRule: '{term}, {law}; п. {clause} договора.',
    noGrace:
      'Закон страны дополнительного срока не требует: после порога продавец может сразу дать письменное уведомление. Покупатель всё равно может сохранить машину, погасив просрочку до изъятия.',
    graceDone: 'Письмо от {date}; последний день оплаты {deadline}.',
    finalDone: 'Заявлено {date}.',
    notYet: 'Не записано.',
    sentOn: 'Дата отправки письма',
    deadline: 'Последний день оплаты: {deadline}',
    record: 'Записать',
    letter: 'Письмо (PDF)',
    warnGraceRunning: 'Прежний срок идёт до {deadline}.',
    warnDeadline:
      'Дополнительный срок идёт до {deadline}. В некоторых странах отказ можно заявить заранее, но до этого посоветуйтесь со своим юристом.',
    warnNoThreshold: 'По платежам, отмеченным в RAHTIS, порог договора не достигнут. Платежи вне RAHTIS здесь не видны.',
    confirm: 'Понимаю и хочу записать шаг сейчас',
    needGrace: 'Сначала запишите дополнительный срок.',
    stopped: 'Шаг записан: RAHTIS больше не шлёт по этой сделке напоминаний об оплате и новых документов на взносы.',
    buyerHint: 'Продавец записал шаги ниже. Погасите просрочку до последнего дня срока или свяжитесь с продавцом.',
    notifyGraceBody:
      'Продавец назначил срок оплаты просрочки {amount}: до {deadline} ({term}). Если она не будет погашена, продавец вправе перейти к следующему шагу по договору. Подробности — на странице сделки.',
    notifyFinalBody:
      'Продавец записал: {step} ({term}) {date}. Возврат машины и взаиморасчёт — по договору; продавец не вправе забрать машину без вашего согласия или решения суда. Подробности — на странице сделки.',
    error: 'Шаг не записан. Обновите страницу и попробуйте ещё раз.',
    confirmNeeded: 'Подтвердите, что хотите записать шаг сейчас.',
  },
  ro: {
    title: 'Pașii după atingerea pragului de întârziere',
    intro:
      'Acestea sunt doar înregistrări și mementouri: nu mută bani și nici vehiculul. Vânzătorul înregistrează fiecare pas după ce a trimis scrisoarea cumpărătorului, iar cumpărătorul primește o notificare în RAHTIS. Încetarea vânzării se înregistrează mai jos, după ce vehiculul a fost restituit sau părțile s-au înțeles.',
    sendHint:
      'RAHTIS întocmește scrisoarea în limba contractului; vânzătorul o semnează și o trimite potrivit pct. 11.2 din contract. Scrisoarea se consideră primită în ziua lucrătoare următoare trimiterii.',
    holidayHint: 'Weekendurile sunt luate în calcul, sărbătorile legale nu – verificați data.',
    grace: { PERIOD: 'Termen suplimentar de plată', WARNING: 'Avertisment scris cu termen de plată' },
    final: { WITHDRAWAL: 'Retragerea din contract', TERMINATION: 'Rezoluțiunea contractului', REPOSSESSION: 'Notificarea preluării vehiculului' },
    graceRule: 'Cel puțin {days} zile de la primirea scrisorii ({term}, {law}; pct. {clause} din contract).',
    finalRule: '{term}, {law}; pct. {clause} din contract.',
    noGrace:
      'Legea țării nu cere un termen suplimentar: după atingerea pragului, vânzătorul poate trimite imediat notificarea scrisă. Cumpărătorul poate totuși păstra vehiculul plătind restanța înainte de preluare.',
    graceDone: 'Scrisoarea din {date}; ultima zi de plată {deadline}.',
    finalDone: 'Declarat la {date}.',
    notYet: 'Neînregistrat.',
    sentOn: 'Data trimiterii scrisorii',
    deadline: 'Ultima zi de plată: {deadline}',
    record: 'Înregistrează',
    letter: 'Scrisoare (PDF)',
    warnGraceRunning: 'Termenul anterior curge până la {deadline}.',
    warnDeadline:
      'Termenul curge până la {deadline}. În unele țări rezoluțiunea poate fi declarată în avans, dar consultați-vă înainte cu avocatul dumneavoastră.',
    warnNoThreshold: 'Potrivit plăților înregistrate în RAHTIS, pragul din contract nu este atins. Plățile din afara RAHTIS nu apar aici.',
    confirm: 'Înțeleg și vreau să înregistrez pasul acum',
    needGrace: 'Înregistrați mai întâi termenul.',
    stopped: 'Pas înregistrat: RAHTIS nu mai trimite pentru această vânzare mementouri de plată și nici înștiințări noi pentru rate.',
    buyerHint: 'Vânzătorul a înregistrat pașii de mai jos. Plătiți restanța până în ultima zi a termenului sau contactați vânzătorul.',
    notifyGraceBody:
      'Vânzătorul a stabilit un termen de plată pentru restanța de {amount}: {deadline} ({term}). Dacă nu este plătită, vânzătorul poate trece la pasul următor prevăzut în contract. Detalii pe pagina vânzării.',
    notifyFinalBody:
      'Vânzătorul a înregistrat: {step} ({term}) la {date}. Restituirea vehiculului și decontul se fac potrivit contractului; vânzătorul nu poate prelua vehiculul fără acordul dumneavoastră sau o hotărâre judecătorească. Detalii pe pagina vânzării.',
    error: 'Pasul nu a putut fi înregistrat. Reîncărcați pagina și încercați din nou.',
    confirmNeeded: 'Confirmați că doriți să înregistrați pasul acum.',
  },
};

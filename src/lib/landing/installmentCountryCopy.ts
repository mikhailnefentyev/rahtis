import type { Locale } from '../i18n/config.ts';

/**
 * Открытая страница калькулятора рассрочки — слова для страны расчёта не
 * Финляндии (24.11.2026). Решение: страница считает по стране сделки
 * (installmentCountry.ts), и всё, что в основном тексте (installment.ts,
 * installmentI18n/*) сказано о финском праве, для другой страны заменяется:
 *   · нейтральной фразой отсюда — без фактов права конкретной страны;
 *   · или текстом страны из кабинета (countryTexts/<cc>.ts): вступление,
 *     пороги, что сделать до передачи, счета, что после оплаты, подсказка
 *     у процентов. Их здесь не переводим заново — берём как есть.
 * У Финляндии страница остаётся как была.
 *
 * Слова — те же, что в калькуляторе и в кабинете: käsiraha, kontantinsats,
 * sissemakse, pirmā iemaksa, pradinė įmoka, wpłata własna, Anzahlung,
 * первоначальный взнос, avans. {country} — название страны в именительном
 * падеже, в скобках (как в LEGAL_NOTICE), чтобы не склонять.
 *
 * Без зависимостей от приложения: модуль читают страница и тесты.
 */
export type InstallmentCountryLandingCopy = {
  /** Подпись выбора страны и кнопка «показать» (форма GET без JavaScript). */
  countryLabel: string;
  countryApply: string;
  /** Вступление страницы без финского закона. */
  lede: string;
  /** Заголовок порогов: {country}. */
  thresholdsTitle: string;
  /** Подсказка суммы до передачи: {down}, {vat}. */
  firstInvoiceHint: string;
  /** Вступление таблицы «если платежи прекратятся». */
  scenarioText: string;
  /** Вместо блока налога продавца (он считает только по Финляндии). */
  taxNote: string;
  /** Ошибка ставки выше предела страны: {max}. */
  rateMax: string;
  /** Шаги «как это работает» без финского права (четвёртый шаг — общий, из основного текста). */
  how: { contract: string; first: string; register: string; final: string };
  faq: {
    lawQ: string;
    thresholdQ: string;
    thresholdA: string;
    beforeQ: string;
    invoicesQ: string;
    afterQ: string;
    taxQ: string;
    taxA: string;
  };
  /** Первая фраза оговорки; за ней — оговорка «договор подготовлен платформой» (LEGAL_NOTICE). */
  disclaimer: string;
};

const fi: InstallmentCountryLandingCopy = {
  countryLabel: 'Kaupan maa',
  countryApply: 'Näytä',
  lede:
    'Eläkkeelle jäävä yrittäjä saa autostaan hyvän hinnan, ja uusi kuljetusliike pääsee alkuun ilman pankkia. Laskuri näyttää maksuerät, ennen luovutusta maksettavan summan arvonlisäveroineen, myyjän maan viivästysrajat ja sen, mitä tapahtuu, jos maksut loppuvat.',
  thresholdsTitle: 'Viivästysrajat ({country})',
  firstInvoiceHint: 'Käsiraha {down} + koko kauppahinnan arvonlisäveron suuruinen summa {vat}. Auto luovutetaan, kun summa on maksettu.',
  scenarioText:
    'Ostaja maksaa ensimmäiset kuukaudet ja lopettaa. Taulukko on esimerkki: myyjä ottaa auton takaisin, kun raja täyttyy, ja auton arvo luetaan ostajan hyväksi. Milloin myyjä saa toimia – lain tai sopimuksen rajan täytyttyä ja, jos maa sitä edellyttää, kirjallisen lisäajan jälkeen – ja miten tilitys tehdään, määräytyy myyjän maan lain ja sopimuksen mukaan.',
  taxNote:
    'Myyjän vero kaupasta riippuu maasta ja yhtiömuodosta, eikä laskuri laske sitä. Varmista vero kirjanpitäjältäsi ennen kuin sovit kaupasta.',
  rateMax: 'Korko 0–{max} vuodessa.',
  how: {
    contract:
      'Sopimus tehdään kirjallisesti myyjän maan lain mukaan ja allekirjoitetaan ennen kuin auto luovutetaan. Myyjä pysyy omistajana, kunnes koko hinta on maksettu.',
    first:
      'Käsiraha ja koko kauppahinnan arvonlisäveron suuruinen summa maksetaan ennen luovutusta. Se, millaisen asiakirjan myyjä siitä laatii, riippuu maasta – katso kysymykset alla.',
    register: 'Rekisteröinti, vakuutus ja liikennelupa hoidetaan myyjän maan sääntöjen mukaan – katso kysymykset alla.',
    final: 'Kun kaikki on maksettu, omistusoikeus siirtyy ostajalle ja rekisteri päivitetään maan sääntöjen mukaan – katso kysymykset alla.',
  },
  faq: {
    lawQ: 'Minkä maan laki koskee kauppaa, ja mitä RAHTIS laatii?',
    thresholdQ: 'Milloin myyjä saa purkaa kaupan tai ottaa auton takaisin?',
    thresholdA:
      'Vasta kun lain tai sopimuksen viivästysraja täyttyy – laskuri yllä näyttää sen tälle kaupalle – ja, jos maa sitä edellyttää, kirjallisen lisäajan jälkeen. Tilitys tehdään osapuolten kesken maan lain ja sopimuksen mukaan; RAHTIS ei tee sitä.',
    beforeQ: 'Mitä on tehtävä ennen luovutusta?',
    invoicesQ: 'Miten laskut laaditaan?',
    afterQ: 'Mitä tapahtuu, kun kaikki on maksettu?',
    taxQ: 'Lykkääkö osamaksu myyjän veroa?',
    taxA: 'Se riippuu maasta ja yhtiömuodosta. Varmista kirjanpitäjältäsi, minä vuonna kauppahinta verotetaan ja miten auton poistot käsitellään.',
  },
  disclaimer: 'Laskuri on suuntaa-antava eikä korvaa veroneuvontaa tai oikeudellista neuvontaa.',
};

const en: InstallmentCountryLandingCopy = {
  countryLabel: 'Country of the sale',
  countryApply: 'Show',
  lede:
    'A retiring owner-operator gets a fair price for the truck, and a new transport company can start without a bank. The calculator shows the payments, the amount due before handover with VAT, the late-payment thresholds of the seller’s country and what happens if payments stop.',
  thresholdsTitle: 'Late-payment thresholds ({country})',
  firstInvoiceHint: 'Down payment {down} + an amount equal to the VAT on the whole price {vat}. The truck is handed over once it is paid.',
  scenarioText:
    'The buyer pays the first months and stops. The table is an illustration: the seller takes the truck back once the threshold is met, and the truck’s value is credited to the buyer. When the seller may act – after the threshold of the law or the contract and, where the country requires it, a written additional period – and how the settlement is made follow the law of the seller’s country and the contract.',
  taxNote:
    'The seller’s tax on the sale depends on the country and the form of the company, and the calculator does not compute it. Have your accountant confirm the tax before you agree.',
  rateMax: 'Interest 0–{max} a year.',
  how: {
    contract:
      'The contract is made in writing under the law of the seller’s country and signed before the truck is handed over. The seller keeps ownership until the whole price is paid.',
    first:
      'The down payment and an amount equal to the VAT on the whole price are paid before handover. Which document the seller issues for it depends on the country – see the questions below.',
    register: 'Registration, insurance and the operating licence follow the rules of the seller’s country – see the questions below.',
    final: 'Once everything is paid, ownership passes to the buyer and the register is updated as the country’s rules require – see the questions below.',
  },
  faq: {
    lawQ: 'Which country’s law applies, and what does RAHTIS prepare?',
    thresholdQ: 'When may the seller end the sale or take the truck back?',
    thresholdA:
      'Only when the late-payment threshold of the law or the contract is met – the calculator above shows it for this deal – and, where the country requires it, after a written additional period. The settlement is made between the parties under the law of the country and the contract; RAHTIS does not carry it out.',
    beforeQ: 'What must be done before handover?',
    invoicesQ: 'How are the invoices issued?',
    afterQ: 'What happens when everything is paid?',
    taxQ: 'Do instalments defer the seller’s tax?',
    taxA: 'It depends on the country and the form of the company. Ask your accountant in which year the price is taxed and how the truck’s depreciation is treated.',
  },
  disclaimer: 'The calculator is indicative and does not replace tax or legal advice.',
};

const sv: InstallmentCountryLandingCopy = {
  countryLabel: 'Land för köpet',
  countryApply: 'Visa',
  lede:
    'En åkare som går i pension får ett bra pris för sin bil, och ett nytt åkeri kommer i gång utan bank. Kalkylatorn visar delbetalningarna, beloppet före överlämnandet med moms, dröjsmålsgränserna i säljarens land och vad som händer om betalningarna upphör.',
  thresholdsTitle: 'Gränser vid dröjsmål ({country})',
  firstInvoiceHint: 'Kontantinsats {down} + ett belopp lika med momsen på hela priset {vat}. Bilen överlämnas när beloppet är betalt.',
  scenarioText:
    'Köparen betalar de första månaderna och slutar sedan. Tabellen är ett exempel: säljaren återtar bilen när gränsen är nådd, och bilens värde tillgodoräknas köparen. När säljaren får agera – efter lagens eller avtalets gräns och, om landet kräver det, en skriftlig tilläggsfrist – och hur avräkningen görs följer lagen i säljarens land och avtalet.',
  taxNote:
    'Säljarens skatt på försäljningen beror på landet och företagsformen, och kalkylatorn räknar inte ut den. Kontrollera skatten med din redovisare innan ni kommer överens.',
  rateMax: 'Ränta 0–{max} per år.',
  how: {
    contract:
      'Avtalet görs skriftligt enligt lagen i säljarens land och undertecknas innan bilen överlämnas. Säljaren behåller äganderätten tills hela priset är betalt.',
    first:
      'Kontantinsatsen och ett belopp lika med momsen på hela priset betalas före överlämnandet. Vilket dokument säljaren upprättar för det beror på landet – se frågorna nedan.',
    register: 'Registrering, försäkring och trafiktillstånd sköts enligt reglerna i säljarens land – se frågorna nedan.',
    final: 'När allt är betalt övergår äganderätten till köparen och registret uppdateras enligt landets regler – se frågorna nedan.',
  },
  faq: {
    lawQ: 'Vilket lands lag gäller, och vad tar RAHTIS fram?',
    thresholdQ: 'När får säljaren häva köpet eller återta bilen?',
    thresholdA:
      'Först när lagens eller avtalets gräns för dröjsmål är nådd – kalkylatorn ovan visar den för det här köpet – och, om landet kräver det, efter en skriftlig tilläggsfrist. Avräkningen görs mellan parterna enligt landets lag och avtalet; RAHTIS gör den inte.',
    beforeQ: 'Vad ska göras före överlämnandet?',
    invoicesQ: 'Hur upprättas fakturorna?',
    afterQ: 'Vad händer när allt är betalt?',
    taxQ: 'Skjuter avbetalning upp säljarens skatt?',
    taxA: 'Det beror på landet och företagsformen. Fråga din redovisare vilket år priset beskattas och hur avskrivningarna på bilen behandlas.',
  },
  disclaimer: 'Kalkylatorn är vägledande och ersätter inte skatterådgivning eller juridisk rådgivning.',
};

const et: InstallmentCountryLandingCopy = {
  countryLabel: 'Tehingu riik',
  countryApply: 'Näita',
  lede:
    'Pensionile minev ettevõtja saab veoki eest hea hinna ja uus vedaja saab alustada ilma pangata. Kalkulaator näitab osamakseid, enne üleandmist tasutavat summat koos käibemaksuga, müüja riigi viivituse piire ja seda, mis juhtub, kui maksed lakkavad.',
  thresholdsTitle: 'Viivituse piirid ({country})',
  firstInvoiceHint: 'Sissemakse {down} + kogu hinna käibemaksuga võrdne summa {vat}. Veok antakse üle, kui summa on tasutud.',
  scenarioText:
    'Ostja tasub esimesed kuud ja lõpetab siis maksmise. Tabel on näide: müüja võtab veoki tagasi, kui piir on täis, ja veoki väärtus arvestatakse ostja kasuks. Millal müüja võib tegutseda – pärast seaduse või lepingu piiri ja, kui riik seda nõuab, kirjalikku täiendavat tähtaega – ja kuidas lõpparveldus tehakse, sõltub müüja riigi õigusest ja lepingust.',
  taxNote:
    'Müüja maks tehingult sõltub riigist ja ettevõtte vormist ning kalkulaator seda ei arvuta. Laske maks enne kokkuleppimist oma raamatupidajal üle kontrollida.',
  rateMax: 'Intress 0–{max} aastas.',
  how: {
    contract:
      'Leping sõlmitakse kirjalikult müüja riigi õiguse järgi ja allkirjastatakse enne veoki üleandmist. Müüja jääb omanikuks, kuni kogu hind on tasutud.',
    first:
      'Sissemakse ja kogu hinna käibemaksuga võrdne summa tasutakse enne üleandmist. Millise dokumendi müüja selle kohta koostab, sõltub riigist – vaadake allpool olevaid küsimusi.',
    register: 'Registreerimine, kindlustus ja tegevusluba käivad müüja riigi reeglite järgi – vaadake allpool olevaid küsimusi.',
    final: 'Kui kõik on tasutud, läheb omand ostjale üle ja registrisse tehakse muudatus riigi reeglite järgi – vaadake allpool olevaid küsimusi.',
  },
  faq: {
    lawQ: 'Millise riigi õigus kehtib ja mida RAHTIS koostab?',
    thresholdQ: 'Millal võib müüja tehingu lõpetada või veoki tagasi võtta?',
    thresholdA:
      'Alles siis, kui seaduse või lepingu viivituse piir on täis – kalkulaator ülal näitab seda selle tehingu kohta – ja, kui riik seda nõuab, pärast kirjalikku täiendavat tähtaega. Lõpparveldus tehakse poolte vahel riigi õiguse ja lepingu järgi; RAHTIS seda ei tee.',
    beforeQ: 'Mida tuleb teha enne üleandmist?',
    invoicesQ: 'Kuidas arved koostatakse?',
    afterQ: 'Mis juhtub, kui kõik on tasutud?',
    taxQ: 'Kas järelmaks lükkab müüja maksu edasi?',
    taxA: 'See sõltub riigist ja ettevõtte vormist. Küsige oma raamatupidajalt, millisel aastal hind maksustatakse ja kuidas veoki amortisatsiooni käsitletakse.',
  },
  disclaimer: 'Kalkulaator on suuniseks ega asenda maksu- ega õigusnõu.',
};

const lv: InstallmentCountryLandingCopy = {
  countryLabel: 'Darījuma valsts',
  countryApply: 'Rādīt',
  lede:
    'Uzņēmējs, kas dodas pensijā, saņem par automašīnu labu cenu, un jauns pārvadātājs var sākt darbu bez bankas. Kalkulators parāda maksājumus, pirms nodošanas maksājamo summu ar PVN, pārdevēja valsts kavējuma robežas un to, kas notiek, ja maksājumi apstājas.',
  thresholdsTitle: 'Kavējuma robežas ({country})',
  firstInvoiceHint: 'Pirmā iemaksa {down} + summa, kas vienāda ar PVN no visas cenas, {vat}. Automašīnu nodod, kad summa ir samaksāta.',
  scenarioText:
    'Pircējs samaksā pirmos mēnešus un pārstāj maksāt. Tabula ir piemērs: pārdevējs atgūst automašīnu, kad robeža ir sasniegta, un automašīnas vērtību ieskaita pircēja labā. Kad pārdevējs drīkst rīkoties – pēc likuma vai līguma robežas un, ja valsts to prasa, pēc rakstiska papildu termiņa – un kā veic norēķinu, nosaka pārdevēja valsts tiesības un līgums.',
  taxNote:
    'Pārdevēja nodoklis no darījuma ir atkarīgs no valsts un uzņēmuma formas, un kalkulators to neaprēķina. Pirms vienošanās pārbaudiet nodokli pie sava grāmatveža.',
  rateMax: 'Procentu likme 0–{max} gadā.',
  how: {
    contract:
      'Līgumu slēdz rakstveidā saskaņā ar pārdevēja valsts tiesībām un paraksta pirms automašīnas nodošanas. Pārdevējs paliek īpašnieks, līdz visa cena ir samaksāta.',
    first:
      'Pirmo iemaksu un summu, kas vienāda ar PVN no visas cenas, samaksā pirms nodošanas. Kādu dokumentu pārdevējs par to sagatavo, ir atkarīgs no valsts – skatiet jautājumus zemāk.',
    register: 'Reģistrācija, apdrošināšana un pārvadājumu licence notiek saskaņā ar pārdevēja valsts noteikumiem – skatiet jautājumus zemāk.',
    final: 'Kad viss ir samaksāts, īpašuma tiesības pāriet pircējam un reģistru atjaunina saskaņā ar valsts noteikumiem – skatiet jautājumus zemāk.',
  },
  faq: {
    lawQ: 'Kuras valsts tiesības piemēro un ko sagatavo RAHTIS?',
    thresholdQ: 'Kad pārdevējs drīkst izbeigt darījumu vai atgūt automašīnu?',
    thresholdA:
      'Tikai tad, kad ir sasniegta likuma vai līguma kavējuma robeža – kalkulators augstāk to parāda šim darījumam – un, ja valsts to prasa, pēc rakstiska papildu termiņa. Norēķinu veic puses savā starpā saskaņā ar valsts tiesībām un līgumu; RAHTIS to neveic.',
    beforeQ: 'Kas jāizdara pirms nodošanas?',
    invoicesQ: 'Kā tiek sagatavoti rēķini?',
    afterQ: 'Kas notiek, kad viss ir samaksāts?',
    taxQ: 'Vai nomaksa atliek pārdevēja nodokli?',
    taxA: 'Tas ir atkarīgs no valsts un uzņēmuma formas. Jautājiet savam grāmatvedim, kurā gadā cenu apliek ar nodokli un kā tiek uzskaitīts automašīnas nolietojums.',
  },
  disclaimer: 'Kalkulators ir orientējošs un neaizstāj nodokļu vai juridisku konsultāciju.',
};

const lt: InstallmentCountryLandingCopy = {
  countryLabel: 'Sandorio šalis',
  countryApply: 'Rodyti',
  lede:
    'Į pensiją išeinantis verslininkas gauna gerą kainą už sunkvežimį, o naujas vežėjas gali pradėti be banko. Skaičiuoklė parodo įmokas, prieš perdavimą mokamą sumą su PVM, pardavėjo šalies vėlavimo ribas ir tai, kas nutinka, jei mokėjimai nutrūksta.',
  thresholdsTitle: 'Vėlavimo ribos ({country})',
  firstInvoiceHint: 'Pradinė įmoka {down} + suma, lygi visos kainos PVM, {vat}. Sunkvežimis perduodamas, kai suma sumokėta.',
  scenarioText:
    'Pirkėjas sumoka už pirmus mėnesius ir nustoja mokėti. Lentelė yra pavyzdys: pardavėjas susigrąžina sunkvežimį, kai pasiekiama riba, o sunkvežimio vertė įskaitoma pirkėjo naudai. Kada pardavėjas gali veikti – pasiekus įstatymo ar sutarties ribą ir, jei šalis to reikalauja, praėjus raštu nustatytam papildomam terminui – ir kaip atsiskaitoma, lemia pardavėjo šalies teisė ir sutartis.',
  taxNote:
    'Pardavėjo mokestis nuo sandorio priklauso nuo šalies ir įmonės formos, o skaičiuoklė jo neskaičiuoja. Prieš susitardami mokestį pasitikrinkite su savo buhalteriu.',
  rateMax: 'Palūkanos 0–{max} per metus.',
  how: {
    contract:
      'Sutartis sudaroma raštu pagal pardavėjo šalies teisę ir pasirašoma prieš perduodant sunkvežimį. Pardavėjas lieka savininku, kol sumokama visa kaina.',
    first:
      'Pradinė įmoka ir suma, lygi visos kainos PVM, sumokamos prieš perdavimą. Kokį dokumentą pardavėjas už tai išrašo, priklauso nuo šalies – žr. klausimus žemiau.',
    register: 'Registracija, draudimas ir licencija tvarkomi pagal pardavėjo šalies taisykles – žr. klausimus žemiau.',
    final: 'Kai viskas sumokėta, nuosavybės teisė pereina pirkėjui, o registras atnaujinamas pagal šalies taisykles – žr. klausimus žemiau.',
  },
  faq: {
    lawQ: 'Kurios šalies teisė taikoma ir ką parengia RAHTIS?',
    thresholdQ: 'Kada pardavėjas gali nutraukti sandorį arba susigrąžinti sunkvežimį?',
    thresholdA:
      'Tik tada, kai pasiekiama įstatymo arba sutarties vėlavimo riba – skaičiuoklė viršuje ją rodo šiam sandoriui – ir, jei šalis to reikalauja, praėjus raštu nustatytam papildomam terminui. Atsiskaitymą šalys atlieka tarpusavyje pagal šalies teisę ir sutartį; RAHTIS jo neatlieka.',
    beforeQ: 'Ką reikia padaryti prieš perdavimą?',
    invoicesQ: 'Kaip išrašomos sąskaitos?',
    afterQ: 'Kas vyksta, kai viskas sumokėta?',
    taxQ: 'Ar išsimokėtinai atidedamas pardavėjo mokestis?',
    taxA: 'Tai priklauso nuo šalies ir įmonės formos. Paklauskite savo buhalterio, kuriais metais kaina apmokestinama ir kaip apskaitomas sunkvežimio nusidėvėjimas.',
  },
  disclaimer: 'Skaičiuoklė yra orientacinė ir nepakeičia mokesčių ar teisinės konsultacijos.',
};

const pl: InstallmentCountryLandingCopy = {
  countryLabel: 'Kraj sprzedaży',
  countryApply: 'Pokaż',
  lede:
    'Przewoźnik przechodzący na emeryturę dostaje dobrą cenę za pojazd, a nowa firma transportowa rusza bez banku. Kalkulator pokazuje raty, kwotę płatną przed wydaniem razem z VAT, progi opóźnienia w kraju sprzedawcy i to, co się dzieje, gdy płatności ustają.',
  thresholdsTitle: 'Progi opóźnienia ({country})',
  firstInvoiceHint: 'Wpłata własna {down} + kwota równa VAT od całej ceny {vat}. Pojazd jest wydawany po jej zapłacie.',
  scenarioText:
    'Kupujący płaci przez pierwsze miesiące, a potem przestaje. Tabela jest przykładem: sprzedawca odbiera pojazd po spełnieniu progu, a wartość pojazdu zalicza się na korzyść kupującego. Kiedy sprzedawca może działać – po spełnieniu progu z ustawy lub umowy i, jeśli kraj tego wymaga, po dodatkowym terminie wyznaczonym na piśmie – oraz jak wygląda rozliczenie, zależy od prawa kraju sprzedawcy i umowy.',
  taxNote:
    'Podatek sprzedawcy od sprzedaży zależy od kraju i formy firmy, a kalkulator go nie liczy. Zanim się umówisz, sprawdź podatek u swojego księgowego.',
  rateMax: 'Oprocentowanie 0–{max} rocznie.',
  how: {
    contract:
      'Umowę zawiera się na piśmie według prawa kraju sprzedawcy i podpisuje przed wydaniem pojazdu. Sprzedawca pozostaje właścicielem do zapłaty całej ceny.',
    first:
      'Wpłatę własną i kwotę równą VAT od całej ceny płaci się przed wydaniem. Jaki dokument wystawia na nią sprzedawca, zależy od kraju – zobacz pytania poniżej.',
    register: 'Rejestracja, ubezpieczenie i licencja transportowa – według przepisów kraju sprzedawcy; zobacz pytania poniżej.',
    final: 'Po spłacie całości własność przechodzi na kupującego, a rejestr jest aktualizowany według przepisów kraju – zobacz pytania poniżej.',
  },
  faq: {
    lawQ: 'Prawo którego kraju obowiązuje i co przygotowuje RAHTIS?',
    thresholdQ: 'Kiedy sprzedawca może zakończyć sprzedaż albo odebrać pojazd?',
    thresholdA:
      'Dopiero po spełnieniu progu opóźnienia z ustawy lub umowy – kalkulator powyżej pokazuje go dla tej transakcji – i, jeśli kraj tego wymaga, po dodatkowym terminie wyznaczonym na piśmie. Rozliczenie strony przeprowadzają między sobą według prawa kraju i umowy; RAHTIS go nie przeprowadza.',
    beforeQ: 'Co trzeba zrobić przed wydaniem pojazdu?',
    invoicesQ: 'Kto i jak wystawia faktury?',
    afterQ: 'Co się dzieje po spłacie całości?',
    taxQ: 'Czy sprzedaż na raty odracza podatek sprzedawcy?',
    taxA: 'To zależy od kraju i formy firmy. Zapytaj swojego księgowego, w którym roku cena jest opodatkowana i jak ujmuje się amortyzację pojazdu.',
  },
  disclaimer: 'Kalkulator ma charakter orientacyjny i nie zastępuje porady podatkowej ani prawnej.',
};

const de: InstallmentCountryLandingCopy = {
  countryLabel: 'Land des Kaufs',
  countryApply: 'Anzeigen',
  lede:
    'Der Unternehmer, der in den Ruhestand geht, erzielt einen guten Preis für seinen Lkw, und ein neues Transportunternehmen startet ohne Bank. Der Rechner zeigt die Raten, den vor der Übergabe fälligen Betrag mit Umsatzsteuer, die Verzugsschwellen im Land des Verkäufers und was passiert, wenn die Zahlungen ausbleiben.',
  thresholdsTitle: 'Verzugsschwellen ({country})',
  firstInvoiceHint: 'Anzahlung {down} + ein Betrag in Höhe der Umsatzsteuer auf den gesamten Kaufpreis {vat}. Der Lkw wird übergeben, sobald er bezahlt ist.',
  scenarioText:
    'Der Käufer zahlt die ersten Monate und hört dann auf. Die Tabelle ist ein Beispiel: Der Verkäufer nimmt den Lkw zurück, sobald die Schwelle erreicht ist, und der Wert des Lkw wird dem Käufer gutgeschrieben. Wann der Verkäufer handeln darf – nach der Schwelle aus Gesetz oder Vertrag und, wo das Land es verlangt, nach einer schriftlichen Nachfrist – und wie abgerechnet wird, richtet sich nach dem Recht des Landes des Verkäufers und dem Vertrag.',
  taxNote:
    'Die Steuer des Verkäufers auf den Verkauf hängt vom Land und von der Rechtsform ab, und der Rechner berechnet sie nicht. Lassen Sie die Steuer vor der Vereinbarung von Ihrem Steuerberater prüfen.',
  rateMax: 'Zinssatz 0–{max} pro Jahr.',
  how: {
    contract:
      'Der Vertrag wird schriftlich nach dem Recht des Landes des Verkäufers geschlossen und vor der Übergabe des Lkw unterschrieben. Der Verkäufer bleibt Eigentümer, bis der gesamte Kaufpreis bezahlt ist.',
    first:
      'Die Anzahlung und ein Betrag in Höhe der Umsatzsteuer auf den gesamten Kaufpreis werden vor der Übergabe bezahlt. Welches Dokument der Verkäufer dafür ausstellt, hängt vom Land ab – siehe die Fragen unten.',
    register: 'Zulassung, Versicherung und Güterkraftverkehrserlaubnis richten sich nach den Regeln im Land des Verkäufers – siehe die Fragen unten.',
    final: 'Sobald alles bezahlt ist, geht das Eigentum auf den Käufer über, und das Register wird nach den Regeln des Landes angepasst – siehe die Fragen unten.',
  },
  faq: {
    lawQ: 'Welches Recht gilt, und was erstellt RAHTIS?',
    thresholdQ: 'Wann darf der Verkäufer vom Kauf zurücktreten oder den Lkw zurücknehmen?',
    thresholdA:
      'Erst wenn die Verzugsschwelle aus Gesetz oder Vertrag erreicht ist – der Rechner oben zeigt sie für diesen Kauf – und, wo das Land es verlangt, nach einer schriftlichen Nachfrist. Die Abrechnung nehmen die Parteien untereinander nach dem Recht des Landes und dem Vertrag vor; RAHTIS führt sie nicht durch.',
    beforeQ: 'Was muss vor der Übergabe erledigt sein?',
    invoicesQ: 'Wie werden die Rechnungen ausgestellt?',
    afterQ: 'Was passiert, wenn alles bezahlt ist?',
    taxQ: 'Schiebt der Ratenkauf die Steuer des Verkäufers hinaus?',
    taxA: 'Das hängt vom Land und von der Rechtsform ab. Fragen Sie Ihren Steuerberater, in welchem Jahr der Kaufpreis versteuert wird und wie die Abschreibung des Lkw behandelt wird.',
  },
  disclaimer: 'Der Rechner dient der Orientierung und ersetzt keine Steuer- oder Rechtsberatung.',
};

const ru: InstallmentCountryLandingCopy = {
  countryLabel: 'Страна сделки',
  countryApply: 'Показать',
  lede:
    'Перевозчик, который уходит на пенсию, получает за машину хорошую цену, а новая транспортная компания начинает работу без банка. Калькулятор показывает платежи, сумму к оплате до передачи с НДС, пороги просрочки в стране продавца и что будет, если платежи прекратятся.',
  thresholdsTitle: 'Пороги просрочки ({country})',
  firstInvoiceHint: 'Первоначальный взнос {down} + сумма, равная НДС со всей цены, {vat}. Машина передаётся после оплаты.',
  scenarioText:
    'Покупатель платит первые месяцы и перестаёт. Таблица — пример: продавец забирает машину, когда порог выполнен, а стоимость машины засчитывается в пользу покупателя. Когда продавец вправе действовать — после порога закона или договора и, если страна этого требует, после письменного дополнительного срока, — и как делается взаиморасчёт, определяют право страны продавца и договор.',
  taxNote:
    'Налог продавца с продажи зависит от страны и формы компании, калькулятор его не считает. До того как договоритесь, уточните налог у своего бухгалтера.',
  rateMax: 'Ставка 0–{max} годовых.',
  how: {
    contract:
      'Договор заключается письменно по праву страны продавца и подписывается до передачи машины. Продавец остаётся собственником, пока не оплачена вся цена.',
    first:
      'Первоначальный взнос и сумма, равная НДС со всей цены, оплачиваются до передачи. Какой документ продавец на них выставляет, зависит от страны — см. вопросы ниже.',
    register: 'Регистрация, страховка и лицензия на перевозки — по правилам страны продавца; см. вопросы ниже.',
    final: 'Когда всё выплачено, право собственности переходит к покупателю, а реестр обновляется по правилам страны — см. вопросы ниже.',
  },
  faq: {
    lawQ: 'Право какой страны действует и что готовит RAHTIS?',
    thresholdQ: 'Когда продавец может прекратить сделку или забрать машину?',
    thresholdA:
      'Только когда выполнен порог просрочки по закону или договору — калькулятор выше показывает его для этой сделки — и, если страна этого требует, после письменного дополнительного срока. Взаиморасчёт стороны делают между собой по праву страны и договору; RAHTIS его не проводит.',
    beforeQ: 'Что нужно сделать до передачи?',
    invoicesQ: 'Как выставляются счета?',
    afterQ: 'Что происходит, когда всё выплачено?',
    taxQ: 'Откладывает ли рассрочка налог продавца?',
    taxA: 'Это зависит от страны и формы компании. Уточните у своего бухгалтера, в каком году облагается цена и как учитывается амортизация машины.',
  },
  disclaimer: 'Расчёт ориентировочный и не заменяет налоговую или юридическую консультацию.',
};

const ro: InstallmentCountryLandingCopy = {
  countryLabel: 'Țara vânzării',
  countryApply: 'Afișează',
  lede:
    'Transportatorul care iese la pensie obține un preț bun pentru camion, iar o firmă de transport nouă pornește fără bancă. Calculatorul arată ratele, suma de plătit înainte de predare cu TVA, pragurile de întârziere din țara vânzătorului și ce se întâmplă dacă plățile se opresc.',
  thresholdsTitle: 'Pragurile de întârziere ({country})',
  firstInvoiceHint: 'Avans {down} + o sumă egală cu TVA aferentă întregului preț, {vat}. Camionul se predă după plata acesteia.',
  scenarioText:
    'Cumpărătorul plătește primele luni și apoi se oprește. Tabelul este un exemplu: vânzătorul recuperează camionul când pragul este atins, iar valoarea camionului se scade în favoarea cumpărătorului. Când poate acționa vânzătorul – după pragul din lege sau din contract și, dacă țara o cere, după un termen suplimentar acordat în scris – și cum se face regularizarea depind de legea țării vânzătorului și de contract.',
  taxNote:
    'Impozitul vânzătorului pe vânzare depinde de țară și de forma firmei, iar calculatorul nu îl calculează. Verificați impozitul cu contabilul dumneavoastră înainte să conveniți.',
  rateMax: 'Dobândă 0–{max} pe an.',
  how: {
    contract:
      'Contractul se încheie în scris potrivit legii țării vânzătorului și se semnează înainte de predarea camionului. Vânzătorul rămâne proprietar până la plata întregului preț.',
    first:
      'Avansul și o sumă egală cu TVA aferentă întregului preț se plătesc înainte de predare. Ce document emite vânzătorul pentru ele depinde de țară – vedeți întrebările de mai jos.',
    register: 'Înmatricularea, asigurarea și licența de transport urmează regulile țării vânzătorului – vedeți întrebările de mai jos.',
    final: 'După plata integrală, proprietatea trece la cumpărător, iar registrul se actualizează potrivit regulilor țării – vedeți întrebările de mai jos.',
  },
  faq: {
    lawQ: 'Legea cărei țări se aplică și ce pregătește RAHTIS?',
    thresholdQ: 'Când poate vânzătorul să încheie vânzarea sau să recupereze camionul?',
    thresholdA:
      'Numai când este atins pragul de întârziere din lege sau din contract – calculatorul de mai sus îl arată pentru această vânzare – și, dacă țara o cere, după un termen suplimentar acordat în scris. Regularizarea o fac părțile între ele, potrivit legii țării și contractului; RAHTIS nu o efectuează.',
    beforeQ: 'Ce trebuie făcut înainte de predare?',
    invoicesQ: 'Cum se emit facturile?',
    afterQ: 'Ce se întâmplă după plata integrală?',
    taxQ: 'Amână plata în rate impozitul vânzătorului?',
    taxA: 'Depinde de țară și de forma firmei. Întrebați-vă contabilul în ce an se impozitează prețul și cum se tratează amortizarea camionului.',
  },
  disclaimer: 'Calculatorul este orientativ și nu înlocuiește consultanța fiscală sau juridică.',
};

export const INSTALLMENT_COUNTRY_LANDING: Record<Locale, InstallmentCountryLandingCopy> = { fi, en, sv, et, lv, lt, pl, de, ru, ro };

export function installmentCountryLandingCopy(locale: string): InstallmentCountryLandingCopy {
  return INSTALLMENT_COUNTRY_LANDING[locale as Locale] ?? en;
}

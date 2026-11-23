/**
 * Открытая страница «Техника на продажу в рассрочку» (решение владельца
 * 23.11.2026): объявления видят все, без входа. Здесь адрес страницы, её
 * тексты на десяти языках и отбор объявлений по стране и классу машины.
 *
 * Слова — те же, что в калькуляторе (installmentI18n) и в разделе кабинета
 * (installments/i18n), их сверяли носители языка: «käsiraha», «kontantinsats»,
 * «sissemakse», «wpłata własna», «Anzahlung» и т. д. Кнопки «Hae mukaan» и
 * «Kirjaudu», строка «{months} kk · käsiraha {down}» и названия классов
 * машин берутся из уже существующих текстов, а не повторяются здесь.
 *
 * Обращение: немецкий — «Sie», шведский — «du», польский — «Ty». Финская
 * марка склоняется: RAHTIKSEEN, RAHTIKSEN, RAHTIKSESSA.
 *
 * Страница — для всех открытых стран (24.11.2026): о счетах сказано, что в
 * Польше и Румынии их выставляет сам продавец в KSeF / RO e-Factura, а
 * RAHTIS присылает уведомления о платеже (sellerInvoices.ts).
 *
 * Без зависимостей от приложения: модуль читают страницы и тесты.
 */
import type { Locale } from '../i18n/config.ts';

/** /fi/kalusto-osamaksulla; на остальных языках — /{язык}/equipment-for-sale. */
export function equipmentSalePath(locale: Locale | string): string {
  return locale === 'fi' ? '/kalusto-osamaksulla' : '/equipment-for-sale';
}

export type EquipmentSaleCopy = {
  metaTitle: string;
  metaDescription: string;
  eyebrow: string;
  title: string;
  lede: string;
  /** Кнопка входа с возвратом в каталог кабинета. */
  ctaOffer: string;
  listTitle: string;
  filterCountry: string;
  filterClass: string;
  filterAll: string;
  /** Подпись цены: без НДС. */
  priceNote: string;
  emptyTitle: string;
  emptyText: string;
  emptyFiltered: string;
  showAll: string;
  howTitle: string;
  how: { title: string; text: string }[];
  calcLink: string;
  /** RAHTIS — не сторона сделки. */
  notParty: string;
  /** Сделка внутри одной страны; цены в валюте объявления. */
  sameCountry: string;
  finalTitle: string;
  finalText: string;
  /** Ссылка на эту страницу из подвала главной и из калькулятора. */
  linkLabel: string;
};

const fi: EquipmentSaleCopy = {
  metaTitle: 'Kuorma-autot ja kalusto osamaksulla – myytävät autot',
  metaDescription:
    'Tarkastettujen yritysten myymät kuorma-autot, vetoautot ja pakettiautot osamaksulla: hinta, käsiraha ja maksuaika. Tee tarjous kirjautumalla RAHTIKSEEN.',
  eyebrow: 'Kalusto osamaksulla',
  title: 'Myytävät autot osamaksulla',
  lede: 'Tarkastettujen yritysten myymät kuorma-autot, vetoautot, pakettiautot ja kippiautot. Hinta, käsiraha ja maksuerien määrä näkyvät heti – tarjouksen teet kirjautuneena.',
  ctaOffer: 'Kirjaudu ja tee tarjous',
  listTitle: 'Myynnissä nyt',
  filterCountry: 'Maa',
  filterClass: 'Autotyyppi',
  filterAll: 'Kaikki',
  priceNote: 'alv 0 %',
  emptyTitle: 'Myynnissä ei ole autoja juuri nyt',
  emptyText: 'Onko sinulla kuorma-auto tai muuta kalustoa myytävänä? Rekisteröidy, lisää auto ja julkaise ilmoitus – se näkyy tällä sivulla ja tarkastetuille kuljetusliikkeille.',
  emptyFiltered: 'Näillä valinnoilla ei löytynyt autoja.',
  showAll: 'Näytä kaikki',
  howTitle: 'Näin kauppa etenee',
  how: [
    {
      title: 'Myyjä julkaisee ilmoituksen',
      text: 'Jokainen RAHTIKSEEN rekisteröitynyt ja tarkastettu yritys voi myydä autonsa osamaksulla. Auton tiedot tarkastetaan ennen julkaisua.',
    },
    {
      title: 'Ostaja tekee tarjouksen',
      text: 'Ostajana on tarkastettu kuljetusliike, jolla on voimassa oleva liikennelupa ja vakuutus. Hinnasta, käsirahasta ja maksuajasta sovitaan palvelussa.',
    },
    {
      title: 'Sopimus, asiakirjat ja muistutukset',
      text: 'RAHTIS laatii sopimuksen, maksusuunnitelman ja laskut myyjän nimissä ja muistuttaa maksueristä. Ostaja maksaa suoraan myyjän tilille. Puolassa ja Romaniassa myyjä laatii laskut itse KSeF- tai RO e-Factura -järjestelmässä, ja RAHTIS lähettää maksuilmoitukset.',
    },
  ],
  calcLink: 'Laske kauppa osamaksulaskurilla',
  notParty: 'RAHTIS ei ole kaupan osapuoli: kauppa tehdään myyjän ja ostajan välillä, eikä RAHTIS vastaanota maksuja.',
  sameCountry: 'Kauppa tehdään aina saman maan yritysten kesken. Hinnat ovat ilmoituksen valuutassa ilman arvonlisäveroa.',
  finalTitle: 'Onko sinulla auto myytävänä?',
  finalText: 'Rekisteröidy, lisää auto ja julkaise ilmoitus. Sopimus, asiakirjat ja muistutukset hoituvat RAHTIKSESSA.',
  linkLabel: 'Myytävät autot osamaksulla',
};

const en: EquipmentSaleCopy = {
  metaTitle: 'Trucks and equipment for sale in instalments',
  metaDescription:
    'Trucks, tractor units and vans sold by verified companies in instalments: price, down payment and term. Sign in to RAHTIS to make an offer.',
  eyebrow: 'Equipment in instalments',
  title: 'Trucks for sale in instalments',
  lede: 'Trucks, tractor units, vans and tippers sold by verified companies. The price, down payment and number of instalments are shown up front – you make an offer once signed in.',
  ctaOffer: 'Sign in to make an offer',
  listTitle: 'For sale now',
  filterCountry: 'Country',
  filterClass: 'Vehicle type',
  filterAll: 'All',
  priceNote: 'excl. VAT',
  emptyTitle: 'No vehicles for sale right now',
  emptyText: 'Do you have a truck or other equipment to sell? Register, add the vehicle and publish a listing – it appears on this page and is shown to verified carriers.',
  emptyFiltered: 'No vehicles match these filters.',
  showAll: 'Show all',
  howTitle: 'How a sale works',
  how: [
    {
      title: 'The seller publishes a listing',
      text: 'Any verified company registered in RAHTIS can sell its vehicle in instalments. The vehicle details are checked before the listing goes live.',
    },
    {
      title: 'The buyer makes an offer',
      text: 'The buyer is a verified carrier with a valid operating licence and insurance. The price, down payment and term are agreed in the service.',
    },
    {
      title: 'Contract, documents and reminders',
      text: 'RAHTIS prepares the contract, the payment plan and the invoices in the seller’s name and sends reminders of the instalments. The buyer pays straight to the seller’s account. In Poland and Romania the seller issues the invoices in KSeF or RO e-Factura, and RAHTIS sends payment notices.',
    },
  ],
  calcLink: 'Work out a sale with the instalment calculator',
  notParty: 'RAHTIS is not a party to the sale: the sale is made between the seller and the buyer, and RAHTIS does not receive the payments.',
  sameCountry: 'A sale is always made between companies of the same country. Prices are in the currency of the listing, excluding VAT.',
  finalTitle: 'Do you have a vehicle to sell?',
  finalText: 'Register, add the vehicle and publish a listing. The contract, documents and reminders are handled in RAHTIS.',
  linkLabel: 'Trucks for sale in instalments',
};

const sv: EquipmentSaleCopy = {
  metaTitle: 'Lastbilar och fordon till salu på avbetalning',
  metaDescription:
    'Lastbilar, dragbilar och skåpbilar som kontrollerade företag säljer på avbetalning: pris, kontantinsats och löptid. Logga in i RAHTIS och lämna bud.',
  eyebrow: 'Fordon på avbetalning',
  title: 'Fordon till salu på avbetalning',
  lede: 'Lastbilar, dragbilar, skåpbilar och tippbilar som säljs av kontrollerade företag. Pris, kontantinsats och antal delbetalningar syns direkt – du lämnar bud när du är inloggad.',
  ctaOffer: 'Logga in och lämna bud',
  listTitle: 'Till salu nu',
  filterCountry: 'Land',
  filterClass: 'Fordonstyp',
  filterAll: 'Alla',
  priceNote: 'exkl. moms',
  emptyTitle: 'Inga fordon till salu just nu',
  emptyText: 'Har du en lastbil eller annat fordon att sälja? Registrera dig, lägg till fordonet och publicera en annons – den visas på den här sidan och för kontrollerade åkerier.',
  emptyFiltered: 'Inga fordon matchar dina val.',
  showAll: 'Visa alla',
  howTitle: 'Så går köpet till',
  how: [
    {
      title: 'Säljaren publicerar en annons',
      text: 'Alla kontrollerade företag som är registrerade i RAHTIS kan sälja sitt fordon på avbetalning. Fordonets uppgifter kontrolleras innan annonsen publiceras.',
    },
    {
      title: 'Köparen lämnar bud',
      text: 'Köparen är ett kontrollerat åkeri med giltigt trafiktillstånd och giltig försäkring. Pris, kontantinsats och löptid avtalas i tjänsten.',
    },
    {
      title: 'Avtal, dokument och påminnelser',
      text: 'RAHTIS upprättar avtalet, betalningsplanen och fakturorna i säljarens namn och påminner om delbetalningarna. Köparen betalar direkt till säljarens konto. I Polen och Rumänien utfärdar säljaren fakturorna själv i KSeF eller RO e-Factura, och RAHTIS skickar betalningsavier.',
    },
  ],
  calcLink: 'Räkna på köpet med avbetalningskalkylatorn',
  notParty: 'RAHTIS är inte part i köpet: köpet görs mellan säljaren och köparen, och RAHTIS tar inte emot betalningarna.',
  sameCountry: 'Köpet görs alltid mellan företag i samma land. Priserna anges i annonsens valuta, exklusive moms.',
  finalTitle: 'Har du ett fordon att sälja?',
  finalText: 'Registrera dig, lägg till fordonet och publicera en annons. Avtal, dokument och påminnelser sköts i RAHTIS.',
  linkLabel: 'Fordon till salu på avbetalning',
};

const et: EquipmentSaleCopy = {
  metaTitle: 'Veokid ja sõidukid müügil järelmaksuga',
  metaDescription:
    'Kontrollitud ettevõtete müüdavad veokid, sadulveokid ja kaubikud järelmaksuga: hind, sissemakse ja periood. Pakkumise tegemiseks logige sisse RAHTIS-esse.',
  eyebrow: 'Sõidukid järelmaksuga',
  title: 'Järelmaksuga müügil olevad sõidukid',
  lede: 'Kontrollitud ettevõtete müüdavad veokid, sadulveokid, kaubikud ja kallurid. Hind, sissemakse ja osamaksete arv on kohe näha – pakkumise saate teha sisselogituna.',
  ctaOffer: 'Logi sisse ja tee pakkumine',
  listTitle: 'Praegu müügil',
  filterCountry: 'Riik',
  filterClass: 'Sõiduki tüüp',
  filterAll: 'Kõik',
  priceNote: 'käibemaksuta',
  emptyTitle: 'Praegu pole ühtegi autot müügil',
  emptyText: 'Kas teil on veok või muu sõiduk müüa? Liituge, lisage sõiduk ja avaldage kuulutus – see ilmub sellel lehel ja kontrollitud vedajatele.',
  emptyFiltered: 'Nende valikutega sõidukeid ei leitud.',
  showAll: 'Näita kõiki',
  howTitle: 'Kuidas tehing käib',
  how: [
    {
      title: 'Müüja avaldab kuulutuse',
      text: 'Iga teenuses RAHTIS registreeritud ja kontrollitud ettevõte saab oma sõiduki järelmaksuga müüa. Sõiduki andmed kontrollitakse enne avaldamist.',
    },
    {
      title: 'Ostja teeb pakkumise',
      text: 'Ostja on kontrollitud vedaja, kellel on kehtiv tegevusluba ja kindlustus. Hinnas, sissemakses ja perioodis lepitakse kokku teenuses.',
    },
    {
      title: 'Leping, dokumendid ja meeldetuletused',
      text: 'RAHTIS koostab lepingu, maksegraafiku ja arved müüja nimel ning tuletab osamakseid meelde. Ostja maksab otse müüja kontole. Poolas ja Rumeenias koostab müüja arved ise süsteemis KSeF või RO e-Factura ning RAHTIS saadab makseteatised.',
    },
  ],
  calcLink: 'Arvutage tehing järelmaksukalkulaatoriga',
  notParty: 'RAHTIS ei ole tehingu pool: tehing sõlmitakse müüja ja ostja vahel ning RAHTIS makseid vastu ei võta.',
  sameCountry: 'Tehing sõlmitakse alati sama riigi ettevõtete vahel. Hinnad on kuulutuse vääringus, käibemaksuta.',
  finalTitle: 'Kas teil on sõiduk müüa?',
  finalText: 'Liituge, lisage sõiduk ja avaldage kuulutus. Lepingu, dokumendid ja meeldetuletused korraldab RAHTIS.',
  linkLabel: 'Järelmaksuga müügil olevad sõidukid',
};

const lv: EquipmentSaleCopy = {
  metaTitle: 'Kravas automašīnas un tehnika pārdošanā uz nomaksu',
  metaDescription:
    'Pārbaudītu uzņēmumu kravas automašīnas, vilcēji un furgoni uz nomaksu: cena, pirmā iemaksa un termiņš. Piedāvājumu iesniedziet, pieslēdzoties RAHTIS.',
  eyebrow: 'Tehnika uz nomaksu',
  title: 'Tehnika pārdošanā uz nomaksu',
  lede: 'Pārbaudītu uzņēmumu pārdotas kravas automašīnas, vilcēji, furgoni un pašizgāzēji. Cena, pirmā iemaksa un maksājumu skaits ir redzami uzreiz – piedāvājumu iesniedzat pēc pieslēgšanās.',
  ctaOffer: 'Pieslēgties un iesniegt piedāvājumu',
  listTitle: 'Pašlaik pārdošanā',
  filterCountry: 'Valsts',
  filterClass: 'Transportlīdzekļa veids',
  filterAll: 'Visi',
  priceNote: 'bez PVN',
  emptyTitle: 'Pašlaik pārdošanā nav nevienas automašīnas',
  emptyText: 'Vai jums ir kravas automašīna vai cita tehnika, ko pārdot? Piesakieties, pievienojiet automašīnu un publicējiet sludinājumu – tas būs redzams šajā lapā un pārbaudītiem pārvadātājiem.',
  emptyFiltered: 'Ar šādu izvēli nekas nav atrasts.',
  showAll: 'Rādīt visus',
  howTitle: 'Kā notiek darījums',
  how: [
    {
      title: 'Pārdevējs publicē sludinājumu',
      text: 'Ikviens pakalpojumā RAHTIS reģistrēts un pārbaudīts uzņēmums var pārdot savu automašīnu uz nomaksu. Automašīnas dati tiek pārbaudīti pirms publicēšanas.',
    },
    {
      title: 'Pircējs iesniedz piedāvājumu',
      text: 'Pircējs ir pārbaudīts pārvadātājs ar derīgu pārvadājumu licenci un apdrošināšanu. Par cenu, pirmo iemaksu un termiņu vienojas pakalpojumā.',
    },
    {
      title: 'Līgums, dokumenti un atgādinājumi',
      text: 'RAHTIS sagatavo līgumu, maksājumu grafiku un rēķinus pārdevēja vārdā un atgādina par maksājumiem. Pircējs maksā tieši uz pārdevēja kontu. Polijā un Rumānijā rēķinus pārdevējs izraksta pats sistēmā KSeF vai RO e-Factura, un RAHTIS sūta maksājuma paziņojumus.',
    },
  ],
  calcLink: 'Aprēķiniet darījumu ar nomaksas kalkulatoru',
  notParty: 'RAHTIS nav darījuma puse: darījumu noslēdz pārdevējs un pircējs, un RAHTIS maksājumus nesaņem.',
  sameCountry: 'Darījumu vienmēr noslēdz vienas valsts uzņēmumi. Cenas norādītas sludinājuma valūtā, bez PVN.',
  finalTitle: 'Vai jums ir automašīna, ko pārdot?',
  finalText: 'Piesakieties, pievienojiet automašīnu un publicējiet sludinājumu. Līgumu, dokumentus un atgādinājumus sagatavo RAHTIS.',
  linkLabel: 'Tehnika pārdošanā uz nomaksu',
};

const lt: EquipmentSaleCopy = {
  metaTitle: 'Sunkvežimiai ir technika parduodami išsimokėtinai',
  metaDescription:
    'Patikrintų įmonių išsimokėtinai parduodami sunkvežimiai, vilkikai ir furgonai: kaina, pradinė įmoka, terminas. Pasiūlymą pateikite prisijungę prie RAHTIS.',
  eyebrow: 'Technika išsimokėtinai',
  title: 'Išsimokėtinai parduodama technika',
  lede: 'Patikrintų įmonių parduodami sunkvežimiai, vilkikai, furgonai ir savivarčiai. Kaina, pradinė įmoka ir įmokų skaičius matomi iš karto – pasiūlymą pateikiate prisijungę.',
  ctaOffer: 'Prisijungti ir pateikti pasiūlymą',
  listTitle: 'Šiuo metu parduodama',
  filterCountry: 'Šalis',
  filterClass: 'Transporto priemonės tipas',
  filterAll: 'Visi',
  priceNote: 'be PVM',
  emptyTitle: 'Šiuo metu parduodamų automobilių nėra',
  emptyText: 'Turite parduoti sunkvežimį ar kitą techniką? Pateikite paraišką, pridėkite automobilį ir paskelbkite skelbimą – jis bus rodomas šiame puslapyje ir patikrintiems vežėjams.',
  emptyFiltered: 'Pagal šiuos pasirinkimus nieko nerasta.',
  showAll: 'Rodyti visus',
  howTitle: 'Kaip vyksta sandoris',
  how: [
    {
      title: 'Pardavėjas paskelbia skelbimą',
      text: 'Kiekviena RAHTIS sistemoje užregistruota ir patikrinta įmonė gali parduoti savo automobilį išsimokėtinai. Automobilio duomenys patikrinami prieš paskelbiant.',
    },
    {
      title: 'Pirkėjas pateikia pasiūlymą',
      text: 'Pirkėjas – patikrintas vežėjas, turintis galiojančią transporto licenciją ir draudimą. Dėl kainos, pradinės įmokos ir termino susitariama sistemoje.',
    },
    {
      title: 'Sutartis, dokumentai ir priminimai',
      text: 'RAHTIS parengia sutartį, mokėjimų grafiką ir sąskaitas pardavėjo vardu bei primena apie įmokas. Pirkėjas moka tiesiai į pardavėjo sąskaitą. Lenkijoje ir Rumunijoje sąskaitas faktūras pardavėjas išrašo pats sistemoje KSeF arba RO e-Factura, o RAHTIS siunčia mokėjimo pranešimus.',
    },
  ],
  calcLink: 'Apskaičiuokite sandorį išsimokėtinai skaičiuokle',
  notParty: 'RAHTIS nėra sandorio šalis: sandorį sudaro pardavėjas ir pirkėjas, o RAHTIS mokėjimų nepriima.',
  sameCountry: 'Sandoris visada sudaromas tarp tos pačios šalies įmonių. Kainos nurodytos skelbimo valiuta, be PVM.',
  finalTitle: 'Turite parduoti automobilį?',
  finalText: 'Pateikite paraišką, pridėkite automobilį ir paskelbkite skelbimą. Sutartį, dokumentus ir priminimus parengia RAHTIS.',
  linkLabel: 'Išsimokėtinai parduodama technika',
};

const pl: EquipmentSaleCopy = {
  metaTitle: 'Ciężarówki i sprzęt na sprzedaż na raty',
  metaDescription:
    'Ciężarówki, ciągniki siodłowe i furgony na raty od zweryfikowanych firm: cena, wpłata własna i okres spłaty. Zaloguj się do RAHTIS i złóż ofertę.',
  eyebrow: 'Sprzęt na raty',
  title: 'Pojazdy na sprzedaż na raty',
  lede: 'Ciężarówki, ciągniki siodłowe, furgony i wywrotki sprzedawane przez zweryfikowane firmy. Cenę, wpłatę własną i liczbę rat widzisz od razu – ofertę składasz po zalogowaniu.',
  ctaOffer: 'Zaloguj się i złóż ofertę',
  listTitle: 'Obecnie na sprzedaż',
  filterCountry: 'Kraj',
  filterClass: 'Rodzaj pojazdu',
  filterAll: 'Wszystkie',
  priceNote: 'netto',
  emptyTitle: 'Obecnie nie ma pojazdów na sprzedaż',
  emptyText: 'Masz ciężarówkę lub inny sprzęt na sprzedaż? Złóż wniosek, dodaj pojazd i opublikuj ogłoszenie – pojawi się na tej stronie i zobaczą je zweryfikowani przewoźnicy.',
  emptyFiltered: 'Brak pojazdów dla wybranych filtrów.',
  showAll: 'Pokaż wszystkie',
  howTitle: 'Jak przebiega sprzedaż',
  how: [
    {
      title: 'Sprzedawca publikuje ogłoszenie',
      text: 'Każda zweryfikowana firma zarejestrowana w serwisie RAHTIS może sprzedać swój pojazd na raty. Dane pojazdu są sprawdzane przed publikacją.',
    },
    {
      title: 'Kupujący składa ofertę',
      text: 'Kupującym jest zweryfikowany przewoźnik z ważną licencją transportową i ważnym ubezpieczeniem. Cenę, wpłatę własną i okres spłaty strony uzgadniają w serwisie.',
    },
    {
      title: 'Umowa, dokumenty i przypomnienia',
      text: 'RAHTIS przygotowuje umowę, harmonogram spłat i faktury w imieniu sprzedawcy oraz przypomina o ratach. Kupujący płaci bezpośrednio na konto sprzedawcy. W Polsce i Rumunii faktury wystawia sam sprzedawca w KSeF lub RO e-Factura, a RAHTIS wysyła informacje o płatności.',
    },
  ],
  calcLink: 'Policz sprzedaż w kalkulatorze rat',
  notParty: 'RAHTIS nie jest stroną sprzedaży: umowę zawierają sprzedawca i kupujący, a RAHTIS nie przyjmuje płatności.',
  sameCountry: 'Sprzedaż jest zawsze zawierana między firmami z tego samego kraju. Ceny podane są w walucie ogłoszenia, netto.',
  finalTitle: 'Masz pojazd na sprzedaż?',
  finalText: 'Złóż wniosek, dodaj pojazd i opublikuj ogłoszenie. Umowę, dokumenty i przypomnienia przygotuje RAHTIS.',
  linkLabel: 'Pojazdy na sprzedaż na raty',
};

const de: EquipmentSaleCopy = {
  metaTitle: 'Lkw und Fahrzeuge auf Raten kaufen – Angebote',
  metaDescription:
    'Lkw, Sattelzugmaschinen und Transporter von geprüften Unternehmen auf Raten: Preis, Anzahlung und Laufzeit. Bei RAHTIS anmelden und Angebot machen.',
  eyebrow: 'Fahrzeuge auf Raten',
  title: 'Fahrzeuge zum Verkauf auf Raten',
  lede: 'Lkw, Sattelzugmaschinen, Transporter und Kipper, die geprüfte Unternehmen verkaufen. Preis, Anzahlung und Anzahl der Raten sehen Sie sofort – ein Angebot machen Sie nach der Anmeldung.',
  ctaOffer: 'Anmelden und Angebot machen',
  listTitle: 'Aktuell zum Verkauf',
  filterCountry: 'Land',
  filterClass: 'Fahrzeugart',
  filterAll: 'Alle',
  priceNote: 'zzgl. USt.',
  emptyTitle: 'Derzeit stehen keine Fahrzeuge zum Verkauf',
  emptyText: 'Haben Sie einen Lkw oder ein anderes Fahrzeug zu verkaufen? Registrieren Sie sich, legen Sie das Fahrzeug an und veröffentlichen Sie ein Angebot – es erscheint auf dieser Seite und bei geprüften Transportunternehmen.',
  emptyFiltered: 'Für diese Auswahl wurden keine Fahrzeuge gefunden.',
  showAll: 'Alle anzeigen',
  howTitle: 'So läuft der Kauf ab',
  how: [
    {
      title: 'Der Verkäufer veröffentlicht ein Angebot',
      text: 'Jedes geprüfte Unternehmen, das bei RAHTIS registriert ist, kann sein Fahrzeug auf Raten verkaufen. Die Fahrzeugdaten werden vor der Veröffentlichung geprüft.',
    },
    {
      title: 'Der Käufer macht ein Angebot',
      text: 'Käufer ist ein geprüftes Transportunternehmen mit gültiger Güterkraftverkehrserlaubnis und gültiger Versicherung. Preis, Anzahlung und Laufzeit werden im Dienst vereinbart.',
    },
    {
      title: 'Vertrag, Dokumente und Erinnerungen',
      text: 'RAHTIS erstellt den Vertrag, den Zahlungsplan und die Rechnungen im Namen des Verkäufers und erinnert an die Raten. Der Käufer zahlt direkt auf das Konto des Verkäufers. In Polen und Rumänien stellt der Verkäufer die Rechnungen selbst in KSeF oder RO e-Factura aus, und RAHTIS versendet Zahlungsinformationen.',
    },
  ],
  calcLink: 'Kauf mit dem Ratenrechner durchrechnen',
  notParty: 'RAHTIS ist nicht Partei des Kaufvertrags: Der Kauf kommt zwischen Verkäufer und Käufer zustande, und RAHTIS nimmt keine Zahlungen entgegen.',
  sameCountry: 'Ein Kauf kommt immer zwischen Unternehmen desselben Landes zustande. Die Preise gelten in der Währung des Angebots, zzgl. Umsatzsteuer.',
  finalTitle: 'Haben Sie ein Fahrzeug zu verkaufen?',
  finalText: 'Registrieren Sie sich, legen Sie das Fahrzeug an und veröffentlichen Sie ein Angebot. Vertrag, Dokumente und Erinnerungen übernimmt RAHTIS.',
  linkLabel: 'Fahrzeuge zum Verkauf auf Raten',
};

const ru: EquipmentSaleCopy = {
  metaTitle: 'Грузовики и техника в рассрочку — объявления',
  metaDescription:
    'Грузовики, тягачи и фургоны, которые проверенные компании продают в рассрочку: цена, первоначальный взнос и срок. Войдите в RAHTIS и сделайте предложение.',
  eyebrow: 'Техника в рассрочку',
  title: 'Техника на продажу в рассрочку',
  lede: 'Грузовики, тягачи, фургоны и самосвалы, которые продают проверенные компании. Цена, первоначальный взнос и число платежей видны сразу — предложение вы делаете после входа.',
  ctaOffer: 'Войти и сделать предложение',
  listTitle: 'Сейчас в продаже',
  filterCountry: 'Страна',
  filterClass: 'Тип машины',
  filterAll: 'Все',
  priceNote: 'без НДС',
  emptyTitle: 'Сейчас машин в продаже нет',
  emptyText: 'Продаёте грузовик или другую технику? Подайте заявку, добавьте машину и опубликуйте объявление — оно появится на этой странице и у проверенных перевозчиков.',
  emptyFiltered: 'По этим условиям машин не нашлось.',
  showAll: 'Показать все',
  howTitle: 'Как проходит сделка',
  how: [
    {
      title: 'Продавец публикует объявление',
      text: 'Продать машину в рассрочку может любая проверенная компания, зарегистрированная в RAHTIS. Данные машины проверяются до публикации.',
    },
    {
      title: 'Покупатель делает предложение',
      text: 'Покупатель — проверенный перевозчик с действующими лицензией на перевозки и страховкой. О цене, первоначальном взносе и сроке стороны договариваются в сервисе.',
    },
    {
      title: 'Договор, документы и напоминания',
      text: 'RAHTIS готовит договор, график платежей и счета от имени продавца и напоминает о платежах. Покупатель платит напрямую на счёт продавца. В Польше и Румынии счета продавец выставляет сам в KSeF или RO e-Factura, а RAHTIS присылает уведомления о платеже.',
    },
  ],
  calcLink: 'Посчитать сделку в калькуляторе рассрочки',
  notParty: 'RAHTIS не является стороной сделки: её заключают продавец и покупатель, и RAHTIS не принимает платежи.',
  sameCountry: 'Сделка всегда заключается между компаниями одной страны. Цены указаны в валюте объявления, без НДС.',
  finalTitle: 'Есть машина на продажу?',
  finalText: 'Подайте заявку, добавьте машину и опубликуйте объявление. Договор, документы и напоминания — в RAHTIS.',
  linkLabel: 'Техника на продажу в рассрочку',
};

const ro: EquipmentSaleCopy = {
  metaTitle: 'Camioane și vehicule de vânzare cu plata în rate',
  metaDescription:
    'Camioane, capete tractor și furgonete vândute în rate de firme verificate: preț, avans și durată. Autentificați-vă în RAHTIS pentru a face o ofertă.',
  eyebrow: 'Vehicule în rate',
  title: 'Vehicule de vânzare cu plata în rate',
  lede: 'Camioane, capete tractor, furgonete și basculante vândute de firme verificate. Prețul, avansul și numărul de rate se văd de la început – oferta o faceți după autentificare.',
  ctaOffer: 'Autentificați-vă și faceți o ofertă',
  listTitle: 'De vânzare acum',
  filterCountry: 'Țara',
  filterClass: 'Tipul vehiculului',
  filterAll: 'Toate',
  priceNote: 'fără TVA',
  emptyTitle: 'Momentan nu sunt vehicule de vânzare',
  emptyText: 'Aveți un camion sau alt vehicul de vânzare? Înscrieți-vă, adăugați vehiculul și publicați un anunț – acesta apare pe această pagină și la transportatorii verificați.',
  emptyFiltered: 'Niciun vehicul nu corespunde filtrelor alese.',
  showAll: 'Afișați toate',
  howTitle: 'Cum decurge vânzarea',
  how: [
    {
      title: 'Vânzătorul publică un anunț',
      text: 'Orice firmă verificată și înregistrată în RAHTIS își poate vinde vehiculul cu plata în rate. Datele vehiculului sunt verificate înainte de publicare.',
    },
    {
      title: 'Cumpărătorul face o ofertă',
      text: 'Cumpărătorul este un transportator verificat, cu licență de transport și asigurare valabile. Prețul, avansul și durata se stabilesc în serviciu.',
    },
    {
      title: 'Contract, documente și notificări',
      text: 'RAHTIS întocmește contractul, graficul de plăți și facturile în numele vânzătorului și amintește de rate. Cumpărătorul plătește direct în contul vânzătorului. În Polonia și România facturile le emite vânzătorul în KSeF sau RO e-Factura, iar RAHTIS trimite notificări de plată.',
    },
  ],
  calcLink: 'Calculați vânzarea cu calculatorul de rate',
  notParty: 'RAHTIS nu este parte la vânzare: vânzarea se încheie între vânzător și cumpărător, iar RAHTIS nu încasează plățile.',
  sameCountry: 'Vânzarea se încheie întotdeauna între firme din aceeași țară. Prețurile sunt în moneda anunțului, fără TVA.',
  finalTitle: 'Aveți un vehicul de vânzare?',
  finalText: 'Înscrieți-vă, adăugați vehiculul și publicați un anunț. Contractul, documentele și notificările sunt gestionate în RAHTIS.',
  linkLabel: 'Vehicule de vânzare cu plata în rate',
};

export const EQUIPMENT_SALE: Record<Locale, EquipmentSaleCopy> = { fi, en, sv, et, lv, lt, pl, de, ru, ro };

export function equipmentSaleCopy(locale: Locale | string): EquipmentSaleCopy {
  return EQUIPMENT_SALE[locale as Locale] ?? en;
}

// ── Объявления и отбор ───────────────────────────────────────────────

/** Строка public.public_equipment_listings(): только безопасные поля, без продавца и номера машины. */
export type PublicListing = {
  make: string;
  vehicle_class: string;
  odometer_km: number | null;
  price_cents: number;
  currency: string;
  down_payment_cents: number;
  months: number;
  country: string;
  published_on: string | null;
};

export type PublicListingFilter = { country: string | null; vehicleClass: string | null };

/**
 * Отбор из строки запроса (?country=FI&class=TRACTOR). Значение принимается,
 * только если оно есть среди объявлений: чужая строка в адресе не попадает
 * ни в ссылки, ни в разметку страницы.
 */
export function parseListingFilter(
  rows: readonly PublicListing[],
  query: { country?: string | string[]; class?: string | string[] },
): PublicListingFilter {
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? '';
  const country = one(query.country).toUpperCase();
  const vehicleClass = one(query.class).toUpperCase();
  return {
    country: rows.some((r) => r.country === country) ? country : null,
    vehicleClass: rows.some((r) => r.vehicle_class === vehicleClass) ? vehicleClass : null,
  };
}

export function filterListings(rows: readonly PublicListing[], filter: PublicListingFilter): PublicListing[] {
  return rows.filter(
    (r) => (!filter.country || r.country === filter.country) && (!filter.vehicleClass || r.vehicle_class === filter.vehicleClass),
  );
}

/** Значения для ссылок отбора — те, что есть среди объявлений, по алфавиту. */
export function listingFacets(rows: readonly PublicListing[]): { countries: string[]; classes: string[] } {
  return {
    countries: [...new Set(rows.map((r) => r.country))].sort(),
    classes: [...new Set(rows.map((r) => r.vehicle_class))].sort(),
  };
}

/** Строка запроса для ссылки отбора; пустой отбор — без строки запроса. */
export function listingQuery(filter: PublicListingFilter): string {
  const params = new URLSearchParams();
  if (filter.country) params.set('country', filter.country);
  if (filter.vehicleClass) params.set('class', filter.vehicleClass);
  const query = params.toString();
  return query ? `?${query}` : '';
}

/**
 * Ответ базы → строки для страницы. Всё, что не похоже на объявление,
 * отбрасывается: страница не должна падать ни от пустого ответа, ни от
 * ответа другой формы (функции ещё нет — до миграции 20261128100000).
 */
export function cleanListings(data: unknown): PublicListing[] {
  if (!Array.isArray(data)) return [];
  const rows: PublicListing[] = [];
  for (const raw of data) {
    if (!raw || typeof raw !== 'object') continue;
    const r = raw as Record<string, unknown>;
    if (typeof r.make !== 'string' || typeof r.vehicle_class !== 'string') continue;
    if (typeof r.price_cents !== 'number' || !(r.price_cents > 0) || typeof r.months !== 'number') continue;
    if (typeof r.country !== 'string' || !/^[A-Z]{2}$/.test(r.country)) continue;
    rows.push({
      make: r.make.trim().slice(0, 80),
      vehicle_class: r.vehicle_class,
      odometer_km: typeof r.odometer_km === 'number' ? r.odometer_km : null,
      price_cents: r.price_cents,
      currency: typeof r.currency === 'string' && /^[A-Z]{3}$/.test(r.currency) ? r.currency : 'EUR',
      down_payment_cents: typeof r.down_payment_cents === 'number' ? r.down_payment_cents : 0,
      months: r.months,
      country: r.country,
      published_on: typeof r.published_on === 'string' ? r.published_on : null,
    });
  }
  return rows;
}

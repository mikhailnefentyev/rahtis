import type { Locale } from "@/lib/i18n/config";
import type { LandingCopy } from "./types";

/**
 * Витрина «Perävaunun vaihto satamissa» — для перевозчиков на смене
 * полуприцепов (irtoperät) между портами и клиентами (11.11.2026).
 *
 * Порты — ровно те, что есть в справочнике площадок (src/lib/routing/places.ts).
 * Убрали порт оттуда — уберите и здесь. Отдельного фильтра «рейсы в
 * портах» на бирже нет: биржа показывает рейсы там, где машины, с
 * сортировкой по порожнему пробегу, — так и написано.
 *
 * Цены — метками {price}, {from}, {discount} из config.ts (fillPrices).
 * Ссылка отслеживания — только для своих клиентов перевозчика: у рейсов
 * с биржи её нет.
 */
const fi: LandingCopy = {
  metaTitle: "Perävaunun vaihto satamissa: keikat, kuskit, kalusto",
  metaDescription:
    "Irtoperien vaihtoon: satamien keikat tarjouspöydältä, omat asiakkaat, kuljettajan sovellus 10 kielellä ja rahtikirjat. Ensimmäinen auto maksutta.",
  eyebrow: "Perävaunun vaihto satamissa",
  title: "Irtoperät satamasta asiakkaalle ilman paperisotaa",
  lede: "Ota vaihtokeikat tarjouspöydältä satamista kuten Vuosaari, Muuga, Kapellskär, Travemünde ja Gdynia, aja omien asiakkaiden keikat ja pidä autot, kuskit ja paperit samassa paikassa. Keikoista ei peritä prosenttia.",
  ctaApply: "Hae mukaan",
  ctaSignIn: "Kirjaudu",
  dayTitle: "Näin vaihto kulkee",
  day: [
    {
      title: "Keikka sisään",
      text: "Tarjouspöydältä autojesi läheltä, omalta asiakkaalta tai tilaussähköpostista. Sähköpostin tilaus menee luonnoksena sille autolle, jonka rekisterinumero tilauksessa mainitaan.",
    },
    {
      title: "Kuskille",
      text: "Pysähdykset järjestyksessä kuljettajan sovelluksessa, perävaunun rekisterinumero mukana. Keikan viestit käännetään kuskin kielelle.",
    },
    {
      title: "Nouto satamasta",
      text: "Kuski kuittaa saapumisen, kuvaa perävaunun ja skannaa rahtikirjan. Sovellus toimii myös ilman verkkoa satama-alueella.",
    },
    {
      title: "Toimitus",
      text: "Saapuminen, purku, allekirjoitus ja tarvittaessa vauriokuvat. Oma asiakkaasi seuraa keikkaa seurantalinkistä.",
    },
    {
      title: "Keikka kiinni",
      text: "Työaika ja arvioitu palkka kuskille, tulot ja kulut auton kannattavuuteen. Viikkoraportti keikoista, ansioista ja papereista.",
    },
  ],
  featuresTitle: "Mitä saat",
  features: [
    {
      title: "Keikat satamista",
      text: "Tarjouspöytä näyttää avoimet keikat siellä, missä autosi ovat, tyhjien kilometrien mukaan. Satamia on koko toiminta-alueella, esimerkiksi Vuosaari ja Turku, Muuga ja Paldiski, Riika, Klaipėda, Kapellskär ja Göteborg, Oslo, Kööpenhamina, Gdynia, Travemünde ja Rostock.",
    },
    {
      title: "Omat asiakkaat",
      text: "Lisää asiakkaan keikka omalle autolle tai anna asiakkaan tilata suoraan autollesi. Tilaussähköpostista tulee luonnos tilauksessa mainitulle autolle. Koko hinta on sinun.",
    },
    {
      title: "Kuljettajan sovellus 10 kielellä",
      text: "Suomi, englanti, ruotsi, norja, tanska, viro, latvia, liettua, puola ja venäjä. Pysähdykset, saapuminen, kuvat, allekirjoitus ja rahtikirjaskanneri – myös ilman verkkoa.",
    },
    {
      title: "Perävaunut ja yhdistelmät",
      text: "Vetoautot, puoliperävaunut ja konttialustat. Yhdistelmän suurin sallittu massa maittain ja kantavuus lasketaan omista autoistasi, ja keikka tarkistetaan yhdistelmää vasten.",
    },
    {
      title: "GPS ja polttoaine",
      text: "Sijainti omasta seurantajärjestelmästä: Wialon, Mapon, Navirec, Ruptela, Navixy, Samsara, Webfleet tai ABAX. Polttoaine tankkauskortin raportista, kuskin merkinnöistä ja GPS:stä.",
    },
    {
      title: "Työaika, palkka ja kannattavuus",
      text: "Vuorot ja tauot sovelluksesta, palkka kilometreiltä, tunneilta, TES:n mukaan tai sovittuna nettopalkkana. Auton kannattavuus: tulot miinus polttoaine, palkat ja kiinteät kulut.",
    },
  ],
  priceTitle: "Hinta",
  priceText:
    "Ensimmäinen auto maksutta, jokainen seuraava {price} (alv 0 %) kuukaudessa – vain niistä autoista, jotka ajoivat kuussa. Ei prosenttia tarjouspöydän eikä omien asiakkaiden keikoista. Ensimmäinen kuukausi ilmaiseksi.",
  faqTitle: "Kysyttyä",
  faq: [
    {
      q: "Mitkä satamat RAHTIS tuntee?",
      a: "Kaikissa yhdeksässä maassa. Esimerkiksi Suomessa Helsingin Vuosaari, Hanko, Turku ja HaminaKotka, Virossa Muuga ja Paldiski, Latviassa Riika ja Ventspils, Liettuassa Klaipėda, Ruotsissa Kapellskär, Tukholma ja Göteborg, Norjassa Oslo, Tanskassa Kööpenhamina ja Esbjerg, Puolassa Gdynia ja Świnoujście sekä Saksassa Travemünde, Rostock, Kiel ja Hampurin konttiterminaalit.",
    },
    {
      q: "Otetaanko keikoista prosenttia?",
      a: "Ei. Ei tarjouspöydän keikoista eikä omien asiakkaiden keikoista. Sopimus tehdään suoraan rahdinantajan kanssa, ja hän maksaa sinulle.",
    },
    {
      q: "Millä kielellä kuski käyttää sovellusta?",
      a: "Omallaan: sovellus toimii kymmenellä kielellä, ja keikan viestit käännetään automaattisesti kuskin kielelle.",
    },
    {
      q: "Toimiiko sovellus satamassa ilman verkkoa?",
      a: "Toimii. Saapuminen, pysähdykset, kuvat ja allekirjoitus tallentuvat puhelimeen ja lähtevät, kun yhteys palaa. Rahtikirjan skannaus muutetaan PDF:ksi puhelimessa.",
    },
    {
      q: "Voiko asiakas tilata suoraan autolleni?",
      a: "Voi. Yrityksellä on oma sähköpostiosoite tilauksille: asiakkaan tilausviestistä (teksti, PDF tai kuva) tulee luonnos tilauksessa mainitulle autolle. Myöhempi viesti samalla tilausnumerolla näkyy muutoksena, jonka hyväksyt tai hylkäät.",
    },
    {
      q: "Mitä se maksaa?",
      a: "Ensimmäinen auto on maksuton. Jokaisesta seuraavasta {price} (alv 0 %) kuukaudessa, vain ajaneista autoista. {from} autosta alkaen hinta tarjouksen mukaan. Vuoden etukäteen maksaen −{discount} %. Ensimmäinen kuukausi on ilmainen.",
    },
  ],
  finalTitle: "Ota ensimmäinen vaihtokeikka",
  finalText:
    "Lisää auto ja kuski ja katso satamien keikat. Ensimmäinen kuukausi on ilmainen.",
  teaserEyebrow: "Perävaunun vaihto",
  teaserTitle: "Irtoperät satamissa",
  teaserText:
    "Vaihtokeikat satamista tarjouspöydältä, omat asiakkaat, kuljettajan sovellus 10 kielellä rahtikirjaskannerilla, yhdistelmät ja työajat. Ei prosenttia keikoista.",
  teaserCta: "Lue lisää",
  footerLink: "Perävaunun vaihto satamissa",
  serviceType: "Kuljetusliikkeen työalusta perävaunujen vaihtoon",
  features_ld: [
    "Keikat satamista ja alueelta tarjouspöydältä",
    "Omien asiakkaiden keikat ja seurantalinkki asiakkaalle",
    "Tilausluonnos sähköpostista rekisterinumeron mukaiselle autolle",
    "Kuljettajan sovellus 10 kielellä: pysähdykset, kuvat, allekirjoitus, rahtikirjaskanneri, toimii ilman verkkoa",
    "Perävaunut, yhdistelmät ja suurimmat sallitut massat maittain",
    "GPS- ja polttoaineintegraatiot",
    "Työaika, palkka ja auton kannattavuus",
  ],
};

const en: LandingCopy = {
  metaTitle: "Trailer swaps in ports: jobs, drivers, fleet",
  metaDescription:
    "For trailer-swap carriers: port jobs from the load board, your own customers, a driver app in 10 languages, CMR notes and combinations. First truck free.",
  eyebrow: "Trailer swaps in ports",
  title: "Trailers from port to customer, without the paperwork",
  lede: "Take swap jobs from the load board in ports such as Vuosaari, Muuga, Kapellskär, Travemünde and Gdynia, run your own customers’ jobs and keep trucks, drivers and papers in one place. No percentage on any job.",
  ctaApply: "Join RAHTIS",
  ctaSignIn: "Sign in",
  dayTitle: "How a swap works",
  day: [
    {
      title: "Job in",
      text: "From the load board near your trucks, from your own customer or from an order e-mail. An e-mailed order becomes a draft for the truck whose registration plate is named in it.",
    },
    {
      title: "To the driver",
      text: "Stops in order in the driver app, with the trailer’s registration plate. Messages on the job are translated into the driver’s language.",
    },
    {
      title: "Pick-up in the port",
      text: "The driver marks arrival, photographs the trailer and scans the consignment note. The app also works without a connection in the port area.",
    },
    {
      title: "Delivery",
      text: "Arrival, unloading, signature and damage photos when needed. Your own customer follows the job from a tracking link.",
    },
    {
      title: "Job closed",
      text: "Working time and estimated pay for the driver, revenue and costs into the truck’s profitability. A weekly report of jobs, earnings and documents.",
    },
  ],
  featuresTitle: "What you get",
  features: [
    {
      title: "Jobs in the ports",
      text: "The load board shows open jobs where your trucks are, by empty kilometres. Ports across the whole operating area, for example Vuosaari and Turku, Muuga and Paldiski, Riga, Klaipėda, Kapellskär and Gothenburg, Oslo, Copenhagen, Gdynia, Travemünde and Rostock.",
    },
    {
      title: "Your own customers",
      text: "Add a customer’s job to your own truck, or let the customer order straight to it. An order e-mail becomes a draft for the truck named in the order. The whole price is yours.",
    },
    {
      title: "Driver app in 10 languages",
      text: "Finnish, English, Swedish, Norwegian, Danish, Estonian, Latvian, Lithuanian, Polish and Russian. Stops, arrival, photos, signature and a CMR scanner – also offline.",
    },
    {
      title: "Trailers and combinations",
      text: "Tractor units, semi-trailers and container chassis. The combination’s maximum weight by country and the payload are worked out from your own vehicles, and each job is checked against the combination.",
    },
    {
      title: "GPS and fuel",
      text: "Position from your own tracking system: Wialon, Mapon, Navirec, Ruptela, Navixy, Samsara, Webfleet or ABAX. Fuel from the fuel card report, driver entries and GPS.",
    },
    {
      title: "Working time, pay and profit",
      text: "Shifts and breaks from the app; pay per kilometre, per hour, under the Finnish collective agreement or as an agreed net pay. Profit per truck: revenue minus fuel, pay and fixed costs.",
    },
  ],
  priceTitle: "Price",
  priceText:
    "First truck free, each further truck {price} (excl. VAT) a month – only for trucks that drove that month. No percentage on load-board jobs or on your own customers’ jobs. First month free.",
  faqTitle: "FAQ",
  faq: [
    {
      q: "Which ports does RAHTIS know?",
      a: "In all nine countries. For example in Finland Helsinki Vuosaari, Hanko, Turku and HaminaKotka; in Estonia Muuga and Paldiski; in Latvia Riga and Ventspils; in Lithuania Klaipėda; in Sweden Kapellskär, Stockholm and Gothenburg; in Norway Oslo; in Denmark Copenhagen and Esbjerg; in Poland Gdynia and Świnoujście; and in Germany Travemünde, Rostock, Kiel and the Hamburg container terminals.",
    },
    {
      q: "Do you take a percentage of jobs?",
      a: "No. Neither on load-board jobs nor on your own customers’ jobs. The agreement is made directly with the shipper, who pays you.",
    },
    {
      q: "What language does the driver use?",
      a: "Their own: the app works in ten languages, and messages on the job are translated into the driver’s language automatically.",
    },
    {
      q: "Does the app work in the port without a connection?",
      a: "Yes. Arrival, stops, photos and signature are saved on the phone and sent when the connection returns. The consignment note scan is turned into a PDF on the phone.",
    },
    {
      q: "Can a customer order straight to my truck?",
      a: "Yes. Your company has its own e-mail address for orders: a customer’s order e-mail (text, PDF or photo) becomes a draft for the truck named in the order. A later e-mail with the same order number shows up as a change you accept or reject.",
    },
    {
      q: "What does it cost?",
      a: "The first truck is free. Each further truck costs {price} (excl. VAT) a month, only if it drove. From {from} trucks the price is on request. {discount}% off when you pay a year in advance. The first month is free.",
    },
  ],
  finalTitle: "Take your first swap",
  finalText:
    "Add a truck and a driver and see the jobs in the ports. The first month is free.",
  teaserEyebrow: "Trailer swaps",
  teaserTitle: "Trailer swaps in ports",
  teaserText:
    "Port swap jobs from the load board, your own customers, a driver app in 10 languages with a CMR scanner, combinations and working time. No percentage on jobs.",
  teaserCta: "Read more",
  footerLink: "Trailer swaps in ports",
  serviceType: "Carrier platform for trailer swaps",
  features_ld: [
    "Load-board jobs in ports and near your trucks",
    "Own customers’ jobs and a tracking link for the customer",
    "Order draft from e-mail for the truck named by its registration plate",
    "Driver app in 10 languages: stops, photos, signature, CMR scanner, works offline",
    "Trailers, combinations and maximum weights by country",
    "GPS and fuel integrations",
    "Working time, driver pay and profit per truck",
  ],
};

const sv: LandingCopy = {
  metaTitle: "Trailerbyten i hamnar: uppdrag, förare, fordon",
  metaDescription:
    "För trailerbyten: hamnuppdrag från lastbörsen, egna kunder, förarapp på 10 språk och fraktsedlar. Första bilen gratis.",
  eyebrow: "Trailerbyten i hamnar",
  title: "Trailrar från hamn till kund utan pappersexercis",
  lede: "Ta trailerbyten från lastbörsen i hamnar som Nordsjö (Vuosaari), Muuga, Kapellskär, Travemünde och Gdynia, kör dina egna kunders uppdrag och håll bilar, förare och papper på ett ställe. Ingen procentavgift på uppdragen.",
  ctaApply: "Ansök nu",
  ctaSignIn: "Logga in",
  dayTitle: "Så går ett trailerbyte till",
  day: [
    {
      title: "Uppdraget kommer in",
      text: "Från lastbörsen nära dina bilar, från din egen kund eller från ett ordermejl. En order via e-post blir ett utkast för den bil vars registreringsnummer nämns i ordern.",
    },
    {
      title: "Till föraren",
      text: "Stoppen i rätt ordning i förarappen, med trailerns registreringsnummer. Meddelanden i uppdraget översätts till förarens språk.",
    },
    {
      title: "Hämtning i hamnen",
      text: "Föraren kvitterar ankomsten, fotograferar trailern och skannar fraktsedeln. Appen fungerar även utan nät i hamnområdet.",
    },
    {
      title: "Leverans",
      text: "Ankomst, lossning, signatur och vid behov skadefoton. Din egen kund följer uppdraget via en spårningslänk.",
    },
    {
      title: "Uppdraget avslutat",
      text: "Arbetstid och beräknad lön för föraren, intäkter och kostnader till bilens lönsamhet. Veckorapport över uppdrag, förtjänst och dokument.",
    },
  ],
  featuresTitle: "Det här får du",
  features: [
    {
      title: "Uppdrag i hamnarna",
      text: "Lastbörsen visar öppna uppdrag där dina bilar finns, sorterade efter tomkörda kilometer. Hamnar i hela verksamhetsområdet, till exempel Nordsjö och Åbo, Muuga och Paldiski, Riga, Klaipėda, Kapellskär och Göteborg, Oslo, Köpenhamn, Gdynia, Travemünde och Rostock.",
    },
    {
      title: "Egna kunder",
      text: "Lägg in kundens uppdrag på din egen bil eller låt kunden beställa direkt till den. Ett ordermejl blir ett utkast för den bil som nämns i ordern. Hela priset är ditt.",
    },
    {
      title: "Förarapp på 10 språk",
      text: "Finska, engelska, svenska, norska, danska, estniska, lettiska, litauiska, polska och ryska. Stopp, ankomst, foton, signatur och fraktsedelsskanner – även utan nät.",
    },
    {
      title: "Trailrar och ekipage",
      text: "Dragbilar, semitrailrar och containerchassin. Ekipagets högsta tillåtna bruttovikt per land och lastförmågan räknas ut från dina egna fordon, och varje uppdrag kontrolleras mot ekipaget.",
    },
    {
      title: "GPS och bränsle",
      text: "Position från ditt eget spårningssystem: Wialon, Mapon, Navirec, Ruptela, Navixy, Samsara, Webfleet eller ABAX. Bränsle från tankkortsrapporten, förarens anteckningar och GPS.",
    },
    {
      title: "Arbetstid, lön och lönsamhet",
      text: "Pass och raster från appen, lön per kilometer, per timme, enligt finskt kollektivavtal eller som avtalad nettolön. Bilens lönsamhet: intäkter minus bränsle, löner och fasta kostnader.",
    },
  ],
  priceTitle: "Pris",
  priceText:
    "Första bilen gratis, varje ytterligare bil {price} (exkl. moms) i månaden – bara för bilar som har kört under månaden. Ingen procentavgift på uppdrag från lastbörsen eller från egna kunder. Första månaden gratis.",
  faqTitle: "Vanliga frågor",
  faq: [
    {
      q: "Vilka hamnar känner RAHTIS till?",
      a: "I alla nio länder. Till exempel i Finland Helsingfors Nordsjö (Vuosaari), Hangö, Åbo och HaminaKotka, i Estland Muuga och Paldiski, i Lettland Riga och Ventspils, i Litauen Klaipėda, i Sverige Kapellskär, Stockholm och Göteborg, i Norge Oslo, i Danmark Köpenhamn och Esbjerg, i Polen Gdynia och Świnoujście samt i Tyskland Travemünde, Rostock, Kiel och containerterminalerna i Hamburg.",
    },
    {
      q: "Tar ni procent på uppdragen?",
      a: "Nej. Varken på uppdrag från lastbörsen eller på egna kunders uppdrag. Avtalet sluts direkt med uppdragsgivaren, som betalar dig.",
    },
    {
      q: "Vilket språk använder föraren i appen?",
      a: "Sitt eget: appen finns på tio språk, och meddelanden i uppdraget översätts automatiskt till förarens språk.",
    },
    {
      q: "Fungerar appen i hamnen utan nät?",
      a: "Ja. Ankomst, stopp, foton och signatur sparas i mobilen och skickas när anslutningen är tillbaka. Den skannade fraktsedeln görs om till PDF i mobilen.",
    },
    {
      q: "Kan en kund beställa direkt till min bil?",
      a: "Ja. Företaget har en egen e-postadress för order: kundens ordermejl (text, PDF eller bild) blir ett utkast för den bil som nämns i ordern. Ett senare mejl med samma ordernummer visas som en ändring som du godkänner eller avvisar.",
    },
    {
      q: "Vad kostar det?",
      a: "Första bilen är gratis. Varje ytterligare bil kostar {price} (exkl. moms) i månaden, bara om den har kört. Från {from} bilar pris på begäran. Betala ett år i förväg: −{discount} %. Första månaden är gratis.",
    },
  ],
  finalTitle: "Ta ditt första trailerbyte",
  finalText:
    "Lägg till en bil och en förare och se uppdragen i hamnarna. Första månaden är gratis.",
  teaserEyebrow: "Trailerbyten",
  teaserTitle: "Trailerbyten i hamnar",
  teaserText:
    "Trailerbyten i hamnar från lastbörsen, egna kunder, förarapp på 10 språk med fraktsedelsskanner, ekipage och arbetstid. Ingen procentavgift på uppdragen.",
  teaserCta: "Läs mer",
  footerLink: "Trailerbyten i hamnar",
  serviceType: "Driftplattform för åkerier med trailerbyten",
  features_ld: [
    "Uppdrag i hamnar och i området från lastbörsen",
    "Egna kunders uppdrag och spårningslänk till kunden",
    "Orderutkast från e-post till bilen med angivet registreringsnummer",
    "Förarapp på 10 språk: stopp, foton, signatur, fraktsedelsskanner, fungerar utan nät",
    "Trailrar, ekipage och högsta tillåtna bruttovikt per land",
    "GPS- och bränsleintegrationer",
    "Arbetstid, lön och bilens lönsamhet",
  ],
};

const et: LandingCopy = {
  metaTitle: "Haagisevahetus sadamates: veod, juhid, autopark",
  metaDescription:
    "Haagisevahetuseks: sadamavedud veobörsilt, omad kliendid, juhi rakendus 10 keeles ja veoselehed. Esimene auto tasuta.",
  eyebrow: "Haagisevahetus sadamates",
  title: "Haagised sadamast kliendini ilma paberimajanduseta",
  lede: "Võta veobörsilt haagisevahetusi sellistest sadamatest nagu Vuosaari, Muuga, Kapellskär, Travemünde ja Gdynia, sõida oma klientide vedusid ning hoia autod, juhid ja paberid ühes kohas. Vedudelt protsenti ei võeta.",
  ctaApply: "Liitu",
  ctaSignIn: "Logi sisse",
  dayTitle: "Nii vahetus kulgeb",
  day: [
    {
      title: "Vedu sisse",
      text: "Veobörsilt sinu autode lähedalt, oma kliendilt või tellimuse e-kirjast. E-kirjaga tulnud tellimus läheb mustandina sellele autole, mille registreerimisnumber tellimuses on nimetatud.",
    },
    {
      title: "Juhile",
      text: "Peatused järjekorras juhi rakenduses, haagise registreerimisnumber kaasas. Veo sõnumid tõlgitakse juhi keelde.",
    },
    {
      title: "Pealevõtmine sadamast",
      text: "Juht märgib saabumise, pildistab haagise ja skannib veoselehe. Rakendus töötab sadama alal ka ilma võrguta.",
    },
    {
      title: "Kohaletoimetamine",
      text: "Saabumine, mahalaadimine, allkiri ja vajaduse korral kahjustuste fotod. Sinu oma klient jälgib vedu jälgimislingi kaudu.",
    },
    {
      title: "Vedu suletud",
      text: "Tööaeg ja hinnanguline palk juhile, tulud ja kulud auto tasuvusse. Nädalaaruanne vedudest, teenistusest ja paberitest.",
    },
  ],
  featuresTitle: "Mida sa saad",
  features: [
    {
      title: "Veod sadamatest",
      text: "Veobörs näitab avatud vedusid seal, kus sinu autod on, tühisõidu kilomeetrite järgi. Sadamaid on kogu tegevuspiirkonnas, näiteks Vuosaari ja Turu, Muuga ja Paldiski, Riia, Klaipėda, Kapellskär ja Göteborg, Oslo, Kopenhaagen, Gdynia, Travemünde ja Rostock.",
    },
    {
      title: "Omad kliendid",
      text: "Lisa kliendi vedu oma autole või lase kliendil tellida otse sinu autole. Tellimuse e-kirjast saab mustand tellimuses nimetatud autole. Kogu hind jääb sulle.",
    },
    {
      title: "Juhi rakendus 10 keeles",
      text: "Soome, inglise, rootsi, norra, taani, eesti, läti, leedu, poola ja vene keel. Peatused, saabumine, fotod, allkiri ja veoselehe skanner – ka ilma võrguta.",
    },
    {
      title: "Haagised ja autorongid",
      text: "Sadulveokid, poolhaagised ja konteinerišassiid. Autorongi suurim lubatud täismass riigiti ja kandevõime arvutatakse sinu oma autode põhjal ning vedu kontrollitakse autorongi järgi.",
    },
    {
      title: "GPS ja kütus",
      text: "Asukoht sinu oma jälgimissüsteemist: Wialon, Mapon, Navirec, Ruptela, Navixy, Samsara, Webfleet või ABAX. Kütus kütusekaardi aruandest, juhi märgetest ja GPS-ist.",
    },
    {
      title: "Tööaeg, palk ja tasuvus",
      text: "Vahetused ja pausid rakendusest, palk kilomeetrite või tundide järgi, kollektiivlepingu (TES) järgi või kokkulepitud netopalgana. Auto tasuvus: tulud miinus kütus, palgad ja püsikulud.",
    },
  ],
  priceTitle: "Hind",
  priceText:
    "Esimene auto tasuta, iga järgmine {price} (km-ta) kuus – ainult nende autode eest, mis kuu jooksul sõitsid. Veobörsi ega oma klientide vedudelt protsenti ei võeta. Esimene kuu tasuta.",
  faqTitle: "Korduma kippuvad küsimused",
  faq: [
    {
      q: "Milliseid sadamaid RAHTIS tunneb?",
      a: "Kõigis üheksas riigis. Näiteks Soomes Helsingi Vuosaari, Hanko, Turu ja HaminaKotka, Eestis Muuga ja Paldiski, Lätis Riia ja Ventspils, Leedus Klaipėda, Rootsis Kapellskär, Stockholm ja Göteborg, Norras Oslo, Taanis Kopenhaagen ja Esbjerg, Poolas Gdynia ja Świnoujście ning Saksamaal Travemünde, Rostock, Kiel ja Hamburgi konteinerterminalid.",
    },
    {
      q: "Kas vedudelt võetakse protsenti?",
      a: "Ei. Ei veobörsi ega oma klientide vedudelt. Leping sõlmitakse otse tellijaga ja tema maksab sulle.",
    },
    {
      q: "Mis keeles juht rakendust kasutab?",
      a: "Oma keeles: rakendus töötab kümnes keeles ja veo sõnumid tõlgitakse automaatselt juhi keelde.",
    },
    {
      q: "Kas rakendus töötab sadamas ilma võrguta?",
      a: "Töötab. Saabumine, peatused, fotod ja allkiri salvestuvad telefoni ja lähevad teele, kui ühendus taastub. Veoselehe skann muudetakse telefonis PDF-iks.",
    },
    {
      q: "Kas klient saab tellida otse minu autole?",
      a: "Saab. Ettevõttel on tellimuste jaoks oma e-posti aadress: kliendi tellimuskirjast (tekst, PDF või foto) saab mustand tellimuses nimetatud autole. Hilisem kiri sama tellimuse numbriga kuvatakse muudatusena, mille kinnitad või lükkad tagasi.",
    },
    {
      q: "Mis see maksab?",
      a: "Esimene auto on tasuta. Iga järgmine maksab {price} (km-ta) kuus, ainult sõitnud autode eest. Alates {from} autost hind päringu alusel. Aasta ette makstes −{discount} %. Esimene kuu on tasuta.",
    },
  ],
  finalTitle: "Võta esimene haagisevahetus",
  finalText:
    "Lisa auto ja juht ning vaata sadamate vedusid. Esimene kuu on tasuta.",
  teaserEyebrow: "Haagisevahetus",
  teaserTitle: "Haagised sadamates",
  teaserText:
    "Haagisevahetused sadamatest veobörsilt, omad kliendid, juhi rakendus 10 keeles koos veoselehe skanneriga, autorongid ja tööajad. Vedudelt protsenti ei võeta.",
  teaserCta: "Loe edasi",
  footerLink: "Haagisevahetus sadamates",
  serviceType: "Vedaja tööplatvorm haagisevahetuseks",
  features_ld: [
    "Veod sadamatest ja piirkonnast veobörsilt",
    "Oma klientide veod ja jälgimislink kliendile",
    "Tellimuse mustand e-kirjast registreerimisnumbri järgi valitud autole",
    "Juhi rakendus 10 keeles: peatused, fotod, allkiri, veoselehe skanner, töötab ilma võrguta",
    "Haagised, autorongid ja suurimad lubatud täismassid riigiti",
    "GPS- ja kütuseliidesed",
    "Tööaeg, palk ja auto tasuvus",
  ],
};

const lv: LandingCopy = {
  metaTitle: "Piekabju maiņa ostās: reisi, vadītāji, autoparks",
  metaDescription:
    "Piekabju maiņai: ostu reisi no kravu biržas, savi klienti, vadītāja lietotne 10 valodās un CMR pavadzīmes. Pirmais auto bez maksas.",
  eyebrow: "Piekabju maiņa ostās",
  title: "Puspiekabes no ostas līdz klientam bez papīru kalniem",
  lede: "Ņemiet maiņas reisus no kravu biržas tādās ostās kā Vuosāri, Mūga, Kapelšēra, Travemünde un Gdiņa, veiciet savu klientu reisus un turiet auto, vadītājus un dokumentus vienuviet. Nekādu procentu no reisiem.",
  ctaApply: "Pieteikties",
  ctaSignIn: "Pieslēgties",
  dayTitle: "Kā notiek maiņa",
  day: [
    {
      title: "Reiss ienāk",
      text: "No kravu biržas jūsu auto tuvumā, no sava klienta vai no pasūtījuma e-pasta. E-pasta pasūtījums nonāk kā melnraksts tam auto, kura reģistrācijas numurs norādīts pasūtījumā.",
    },
    {
      title: "Vadītājam",
      text: "Pieturas secībā vadītāja lietotnē, līdzi puspiekabes reģistrācijas numurs. Reisa ziņas tiek tulkotas vadītāja valodā.",
    },
    {
      title: "Saņemšana ostā",
      text: "Vadītājs atzīmē ierašanos, nofotografē puspiekabi un ieskenē CMR pavadzīmi. Lietotne ostas teritorijā strādā arī bez interneta.",
    },
    {
      title: "Piegāde",
      text: "Ierašanās, izkraušana, paraksts un vajadzības gadījumā bojājumu foto. Jūsu klients seko reisam pa izsekošanas saiti.",
    },
    {
      title: "Reiss slēgts",
      text: "Darba laiks un aptuvenā alga vadītājam, ieņēmumi un izdevumi – auto rentabilitātē. Nedēļas atskaite par reisiem, ieņēmumiem un dokumentiem.",
    },
  ],
  featuresTitle: "Ko jūs iegūstat",
  features: [
    {
      title: "Reisi no ostām",
      text: "Kravu birža rāda atvērtos reisus tur, kur atrodas jūsu auto, pēc tukšbrauciena kilometriem. Ostas visā darbības teritorijā, piemēram, Vuosāri un Turku, Mūga un Paldiski, Rīga, Klaipēda, Kapelšēra un Gēteborga, Oslo, Kopenhāgena, Gdiņa, Travemünde un Rostoka.",
    },
    {
      title: "Savi klienti",
      text: "Pievienojiet klienta reisu savam auto vai ļaujiet klientam pasūtīt tieši jūsu auto. No pasūtījuma e-pasta top melnraksts pasūtījumā norādītajam auto. Visa cena ir jūsu.",
    },
    {
      title: "Vadītāja lietotne 10 valodās",
      text: "Somu, angļu, zviedru, norvēģu, dāņu, igauņu, latviešu, lietuviešu, poļu un krievu. Pieturas, ierašanās, foto, paraksts un CMR skeneris – arī bez interneta.",
    },
    {
      title: "Puspiekabes un sastāvi",
      text: "Vilcēji, puspiekabes un konteineru šasijas. Sastāva maksimālo pieļaujamo masu pa valstīm un kravnesību aprēķina no jūsu pašu auto, un katru reisu pārbauda pret sastāvu.",
    },
    {
      title: "GPS un degviela",
      text: "Atrašanās vieta no jūsu monitoringa sistēmas: Wialon, Mapon, Navirec, Ruptela, Navixy, Samsara, Webfleet vai ABAX. Degviela no degvielas kartes atskaites, vadītāja ierakstiem un GPS.",
    },
    {
      title: "Darba laiks, alga un rentabilitāte",
      text: "Maiņas un pārtraukumi no lietotnes, alga par kilometriem, stundām, pēc darba koplīguma (TES) vai kā norunāta neto alga. Auto rentabilitāte: ieņēmumi mīnus degviela, algas un pastāvīgās izmaksas.",
    },
  ],
  priceTitle: "Cena",
  priceText:
    "Pirmais auto bez maksas, katrs nākamais {price} (bez PVN) mēnesī – tikai par tiem auto, kas mēneša laikā brauca. Nekādu procentu ne no kravu biržas, ne no savu klientu reisiem. Pirmais mēnesis bez maksas.",
  faqTitle: "Biežāk uzdotie jautājumi",
  faq: [
    {
      q: "Kuras ostas RAHTIS pazīst?",
      a: "Visās deviņās valstīs. Piemēram, Somijā Helsinku Vuosāri, Hanko, Turku un HaminaKotka, Igaunijā Mūga un Paldiski, Latvijā Rīga un Ventspils, Lietuvā Klaipēda, Zviedrijā Kapelšēra, Stokholma un Gēteborga, Norvēģijā Oslo, Dānijā Kopenhāgena un Esbjerga, Polijā Gdiņa un Świnoujście, bet Vācijā Travemünde, Rostoka, Ķīle un Hamburgas konteineru termināļi.",
    },
    {
      q: "Vai no reisiem tiek ņemti procenti?",
      a: "Nē. Ne no kravu biržas reisiem, ne no savu klientu reisiem. Līgumu slēdzat tieši ar pasūtītāju, un viņš maksā jums.",
    },
    {
      q: "Kādā valodā vadītājs lieto lietotni?",
      a: "Savā: lietotne darbojas desmit valodās, un reisa ziņas automātiski tiek tulkotas vadītāja valodā.",
    },
    {
      q: "Vai lietotne ostā strādā bez interneta?",
      a: "Strādā. Ierašanās, pieturas, foto un paraksts saglabājas telefonā un aiziet, kad savienojums atjaunojas. CMR pavadzīmes skenējums telefonā tiek pārvērsts PDF formātā.",
    },
    {
      q: "Vai klients var pasūtīt tieši manam auto?",
      a: "Var. Uzņēmumam ir sava e-pasta adrese pasūtījumiem: no klienta pasūtījuma vēstules (teksts, PDF vai foto) top melnraksts pasūtījumā norādītajam auto. Vēlāka vēstule ar to pašu pasūtījuma numuru parādās kā izmaiņas, ko apstiprināt vai noraidāt.",
    },
    {
      q: "Cik tas maksā?",
      a: "Pirmais auto ir bez maksas. Katrs nākamais maksā {price} (bez PVN) mēnesī, tikai ja tas brauca. No {from} automašīnām – cena pēc pieprasījuma. Samaksājot gadu uz priekšu −{discount} %. Pirmais mēnesis ir bez maksas.",
    },
  ],
  finalTitle: "Paņemiet pirmo maiņas reisu",
  finalText:
    "Pievienojiet auto un vadītāju un apskatiet ostu reisus. Pirmais mēnesis ir bez maksas.",
  teaserEyebrow: "Piekabju maiņa",
  teaserTitle: "Puspiekabes ostās",
  teaserText:
    "Maiņas reisi no ostām kravu biržā, savi klienti, vadītāja lietotne 10 valodās ar CMR skeneri, sastāvi un darba laiks. Nekādu procentu no reisiem.",
  teaserCta: "Lasīt vairāk",
  footerLink: "Piekabju maiņa ostās",
  serviceType: "Pārvadātāja darba platforma piekabju maiņai",
  features_ld: [
    "Reisi no ostām un apkārtnes kravu biržā",
    "Savu klientu reisi un izsekošanas saite klientam",
    "Pasūtījuma melnraksts no e-pasta auto ar norādīto reģistrācijas numuru",
    "Vadītāja lietotne 10 valodās: pieturas, foto, paraksts, CMR skeneris, strādā bez interneta",
    "Puspiekabes, sastāvi un maksimālās pieļaujamās masas pa valstīm",
    "GPS un degvielas integrācijas",
    "Darba laiks, alga un auto rentabilitāte",
  ],
};

const lt: LandingCopy = {
  metaTitle: "Priekabų keitimas uostuose: reisai, vairuotojai, parkas",
  metaDescription:
    "Priekabų keitimui: uostų reisai iš krovinių biržos, savi klientai, vairuotojo programėlė 10 kalbų ir CMR važtaraščiai. Pirmas sunkvežimis nemokamai.",
  eyebrow: "Priekabų keitimas uostuose",
  title: "Puspriekabės iš uosto klientui be popierių kalnų",
  lede: "Imkite keitimo reisus iš krovinių biržos tokiuose uostuose kaip Vuosaris, Mūga, Kapelšeras, Travemiundė ir Gdynė, vykdykite savo klientų reisus ir laikykite sunkvežimius, vairuotojus ir dokumentus vienoje vietoje. Jokių procentų nuo reisų.",
  ctaApply: "Pateikti paraišką",
  ctaSignIn: "Prisijungti",
  dayTitle: "Kaip vyksta keitimas",
  day: [
    {
      title: "Reisas gautas",
      text: "Iš krovinių biržos netoli jūsų sunkvežimių, iš savo kliento ar iš užsakymo laiško. El. paštu gautas užsakymas tampa juodraščiu tam sunkvežimiui, kurio valstybinis numeris nurodytas užsakyme.",
    },
    {
      title: "Vairuotojui",
      text: "Sustojimai eilės tvarka vairuotojo programėlėje, kartu su puspriekabės valstybiniu numeriu. Reiso žinutės verčiamos į vairuotojo kalbą.",
    },
    {
      title: "Paėmimas uoste",
      text: "Vairuotojas pažymi atvykimą, nufotografuoja puspriekabę ir nuskenuoja CMR važtaraštį. Programėlė uosto teritorijoje veikia ir be ryšio.",
    },
    {
      title: "Pristatymas",
      text: "Atvykimas, iškrovimas, parašas ir, jei reikia, pažeidimų nuotraukos. Jūsų klientas seka reisą per sekimo nuorodą.",
    },
    {
      title: "Reisas uždarytas",
      text: "Darbo laikas ir apytikslis atlyginimas vairuotojui, pajamos ir išlaidos – į sunkvežimio pelningumą. Savaitės ataskaita apie reisus, uždarbį ir dokumentus.",
    },
  ],
  featuresTitle: "Ką gaunate",
  features: [
    {
      title: "Reisai iš uostų",
      text: "Krovinių birža rodo atvirus reisus ten, kur yra jūsų sunkvežimiai, pagal tuščią ridą. Uostai visoje veiklos teritorijoje, pavyzdžiui, Vuosaris ir Turku, Mūga ir Paldiskis, Ryga, Klaipėda, Kapelšeras ir Geteborgas, Oslas, Kopenhaga, Gdynė, Travemiundė ir Rostokas.",
    },
    {
      title: "Savi klientai",
      text: "Įtraukite kliento reisą savo sunkvežimiui arba leiskite klientui užsakyti tiesiai jūsų sunkvežimiui. Iš užsakymo laiško sukuriamas juodraštis užsakyme nurodytam sunkvežimiui. Visa kaina – jūsų.",
    },
    {
      title: "Vairuotojo programėlė 10 kalbų",
      text: "Suomių, anglų, švedų, norvegų, danų, estų, latvių, lietuvių, lenkų ir rusų. Sustojimai, atvykimas, nuotraukos, parašas ir CMR skeneris – ir be ryšio.",
    },
    {
      title: "Puspriekabės ir junginiai",
      text: "Vilkikai, puspriekabės ir konteinerių platformos. Junginio didžiausia leidžiamoji masė pagal šalį ir keliamoji galia apskaičiuojamos iš jūsų pačių transporto priemonių, o kiekvienas reisas tikrinamas pagal junginį.",
    },
    {
      title: "GPS ir kuras",
      text: "Vieta iš jūsų sekimo sistemos: Wialon, Mapon, Navirec, Ruptela, Navixy, Samsara, Webfleet ar ABAX. Kuras iš kuro kortelės ataskaitos, vairuotojo įrašų ir GPS.",
    },
    {
      title: "Darbo laikas, atlyginimas ir pelningumas",
      text: "Pamainos ir pertraukos iš programėlės, atlyginimas už kilometrus, valandas, pagal kolektyvinę sutartį (TES) arba sutartas grynasis atlyginimas. Sunkvežimio pelningumas: pajamos minus kuras, atlyginimai ir pastovios išlaidos.",
    },
  ],
  priceTitle: "Kaina",
  priceText:
    "Pirmas sunkvežimis nemokamai, už kiekvieną kitą – {price} (be PVM) per mėnesį, tik jei jis tą mėnesį važiavo. Jokių procentų nei nuo krovinių biržos, nei nuo savų klientų reisų. Pirmas mėnuo nemokamai.",
  faqTitle: "Dažni klausimai",
  faq: [
    {
      q: "Kokius uostus žino RAHTIS?",
      a: "Visose devyniose šalyse. Pavyzdžiui, Suomijoje Helsinkio Vuosaris, Hanko, Turku ir HaminaKotka, Estijoje Mūga ir Paldiskis, Latvijoje Ryga ir Ventspilis, Lietuvoje Klaipėda, Švedijoje Kapelšeras, Stokholmas ir Geteborgas, Norvegijoje Oslas, Danijoje Kopenhaga ir Esbjergas, Lenkijoje Gdynė ir Svinouiscis, o Vokietijoje Travemiundė, Rostokas, Kylis ir Hamburgo konteinerių terminalai.",
    },
    {
      q: "Ar imami procentai nuo reisų?",
      a: "Ne. Nei nuo krovinių biržos reisų, nei nuo savų klientų reisų. Sutartis sudaroma tiesiogiai su užsakovu, ir jis moka jums.",
    },
    {
      q: "Kokia kalba vairuotojas naudoja programėlę?",
      a: "Savo: programėlė veikia dešimčia kalbų, o reiso žinutės automatiškai verčiamos į vairuotojo kalbą.",
    },
    {
      q: "Ar programėlė uoste veikia be ryšio?",
      a: "Veikia. Atvykimas, sustojimai, nuotraukos ir parašas išsaugomi telefone ir išsiunčiami, kai ryšys grįžta. Nuskenuotas CMR važtaraštis telefone paverčiamas PDF.",
    },
    {
      q: "Ar klientas gali užsakyti tiesiai mano sunkvežimiui?",
      a: "Gali. Įmonė turi savo el. pašto adresą užsakymams: iš kliento užsakymo laiško (tekstas, PDF ar nuotrauka) sukuriamas juodraštis užsakyme nurodytam sunkvežimiui. Vėlesnis laiškas su tuo pačiu užsakymo numeriu rodomas kaip pakeitimas, kurį patvirtinate arba atmetate.",
    },
    {
      q: "Kiek tai kainuoja?",
      a: "Pirmas sunkvežimis nemokamas. Kiekvienas kitas kainuoja {price} (be PVM) per mėnesį, tik jei važiavo. Nuo {from} sunkvežimių – kaina pagal užklausą. Sumokėjus metams iš anksto −{discount} %. Pirmas mėnuo nemokamas.",
    },
  ],
  finalTitle: "Paimkite pirmą keitimo reisą",
  finalText:
    "Pridėkite sunkvežimį ir vairuotoją ir peržiūrėkite uostų reisus. Pirmas mėnuo nemokamas.",
  teaserEyebrow: "Priekabų keitimas",
  teaserTitle: "Puspriekabės uostuose",
  teaserText:
    "Keitimo reisai iš uostų krovinių biržoje, savi klientai, vairuotojo programėlė 10 kalbų su CMR skeneriu, junginiai ir darbo laikas. Jokių procentų nuo reisų.",
  teaserCta: "Skaityti daugiau",
  footerLink: "Priekabų keitimas uostuose",
  serviceType: "Vežėjo darbo platforma priekabų keitimui",
  features_ld: [
    "Reisai iš uostų ir apylinkių krovinių biržoje",
    "Savų klientų reisai ir sekimo nuoroda klientui",
    "Užsakymo juodraštis iš el. laiško sunkvežimiui pagal valstybinį numerį",
    "Vairuotojo programėlė 10 kalbų: sustojimai, nuotraukos, parašas, CMR skeneris, veikia be ryšio",
    "Puspriekabės, junginiai ir didžiausios leidžiamosios masės pagal šalį",
    "GPS ir kuro integracijos",
    "Darbo laikas, vairuotojo atlyginimas ir sunkvežimio pelningumas",
  ],
};

const pl: LandingCopy = {
  metaTitle: "Wymiana naczep w portach: zlecenia, kierowcy, flota",
  metaDescription:
    "Do wymian naczep: zlecenia z portów z giełdy ładunków, własni klienci, aplikacja kierowcy w 10 językach i listy przewozowe. Pierwszy pojazd gratis.",
  eyebrow: "Wymiana naczep w portach",
  title: "Naczepy z portu do klienta bez papierologii",
  lede: "Bierz z giełdy ładunków zlecenia wymiany naczep w portach takich jak Vuosaari, Muuga, Kapellskär, Travemünde i Gdynia, obsługuj zlecenia własnych klientów i trzymaj pojazdy, kierowców i dokumenty w jednym miejscu. Bez prowizji od przewozów.",
  ctaApply: "Dołącz",
  ctaSignIn: "Zaloguj się",
  dayTitle: "Tak przebiega wymiana",
  day: [
    {
      title: "Zlecenie wpływa",
      text: "Z giełdy ładunków blisko Twoich pojazdów, od własnego klienta albo z e-maila ze zleceniem. Zlecenie z e-maila trafia jako szkic do pojazdu, którego numer rejestracyjny podano w zleceniu.",
    },
    {
      title: "Do kierowcy",
      text: "Punkty trasy po kolei w aplikacji kierowcy, razem z numerem rejestracyjnym naczepy. Wiadomości dotyczące przewozu są tłumaczone na język kierowcy.",
    },
    {
      title: "Odbiór w porcie",
      text: "Kierowca potwierdza przyjazd, robi zdjęcie naczepy i skanuje list przewozowy. Aplikacja działa także bez zasięgu na terenie portu.",
    },
    {
      title: "Dostawa",
      text: "Przyjazd, rozładunek, podpis i w razie potrzeby zdjęcia uszkodzeń. Twój klient śledzi przewóz przez link do śledzenia.",
    },
    {
      title: "Przewóz zamknięty",
      text: "Czas pracy i szacunkowe wynagrodzenie kierowcy, przychody i koszty w rentowności pojazdu. Raport tygodniowy z przewozów, zarobków i dokumentów.",
    },
  ],
  featuresTitle: "Co dostajesz",
  features: [
    {
      title: "Zlecenia z portów",
      text: "Giełda ładunków pokazuje otwarte zlecenia tam, gdzie są Twoje pojazdy, według pustych kilometrów. Porty na całym obszarze działania, np. Vuosaari i Turku, Muuga i Paldiski, Ryga, Kłajpeda, Kapellskär i Göteborg, Oslo, Kopenhaga, Gdynia, Travemünde i Rostock.",
    },
    {
      title: "Własni klienci",
      text: "Dodaj zlecenie klienta do własnego pojazdu albo pozwól klientowi zamawiać bezpośrednio do Twojego pojazdu. Z e-maila ze zleceniem powstaje szkic dla pojazdu wskazanego w zleceniu. Cała cena jest Twoja.",
    },
    {
      title: "Aplikacja kierowcy w 10 językach",
      text: "Fiński, angielski, szwedzki, norweski, duński, estoński, łotewski, litewski, polski i rosyjski. Punkty trasy, przyjazd, zdjęcia, podpis i skaner listów przewozowych – także bez zasięgu.",
    },
    {
      title: "Naczepy i zestawy",
      text: "Ciągniki siodłowe, naczepy i podwozia kontenerowe. Dopuszczalna masa całkowita zestawu według kraju i ładowność liczą się z Twoich własnych pojazdów, a każde zlecenie jest sprawdzane pod kątem zestawu.",
    },
    {
      title: "GPS i paliwo",
      text: "Pozycja z Twojego systemu śledzenia: Wialon, Mapon, Navirec, Ruptela, Navixy, Samsara, Webfleet lub ABAX. Paliwo z raportu karty paliwowej, wpisów kierowcy i GPS.",
    },
    {
      title: "Czas pracy, wynagrodzenie i rentowność",
      text: "Zmiany i przerwy z aplikacji, wynagrodzenie od kilometra, od godziny, według fińskiego układu zbiorowego (TES) albo jako uzgodniona stawka netto. Rentowność pojazdu: przychody minus paliwo, wynagrodzenia i koszty stałe.",
    },
  ],
  priceTitle: "Cena",
  priceText:
    "Pierwszy pojazd gratis, za każdy kolejny {price} netto (bez VAT) miesięcznie – tylko za pojazdy, które w danym miesiącu jeździły. Bez prowizji od zleceń z giełdy ani od zleceń własnych klientów. Pierwszy miesiąc za darmo.",
  faqTitle: "Częste pytania",
  faq: [
    {
      q: "Jakie porty zna RAHTIS?",
      a: "We wszystkich dziewięciu krajach. Na przykład w Finlandii Vuosaari w Helsinkach, Hanko, Turku i HaminaKotka, w Estonii Muuga i Paldiski, na Łotwie Ryga i Windawa, na Litwie Kłajpeda, w Szwecji Kapellskär, Sztokholm i Göteborg, w Norwegii Oslo, w Danii Kopenhaga i Esbjerg, w Polsce Gdynia i Świnoujście, a w Niemczech Travemünde, Rostock, Kilonia i terminale kontenerowe w Hamburgu.",
    },
    {
      q: "Czy pobieracie procent od przewozów?",
      a: "Nie. Ani od zleceń z giełdy, ani od zleceń własnych klientów. Umowę zawierasz bezpośrednio ze zleceniodawcą, który płaci Tobie.",
    },
    {
      q: "W jakim języku kierowca korzysta z aplikacji?",
      a: "We własnym: aplikacja działa w dziesięciu językach, a wiadomości dotyczące przewozu są automatycznie tłumaczone na język kierowcy.",
    },
    {
      q: "Czy aplikacja działa w porcie bez zasięgu?",
      a: "Tak. Przyjazd, punkty trasy, zdjęcia i podpis zapisują się w telefonie i wysyłają, gdy połączenie wróci. Skan listu przewozowego jest zamieniany na PDF w telefonie.",
    },
    {
      q: "Czy klient może zamawiać bezpośrednio do mojego pojazdu?",
      a: "Tak. Firma ma własny adres e-mail na zlecenia: z e-maila klienta ze zleceniem (tekst, PDF lub zdjęcie) powstaje szkic dla pojazdu wskazanego w zleceniu. Późniejsza wiadomość z tym samym numerem zlecenia pojawia się jako zmiana, którą akceptujesz lub odrzucasz.",
    },
    {
      q: "Ile to kosztuje?",
      a: "Pierwszy pojazd jest bezpłatny. Każdy kolejny kosztuje {price} netto (bez VAT) miesięcznie, tylko jeśli jeździł. Od {from} pojazdów cena na zapytanie. Płacąc za rok z góry −{discount} %. Pierwszy miesiąc jest darmowy.",
    },
  ],
  finalTitle: "Weź pierwsze zlecenie wymiany",
  finalText:
    "Dodaj pojazd i kierowcę i zobacz zlecenia w portach. Pierwszy miesiąc jest darmowy.",
  teaserEyebrow: "Wymiana naczep",
  teaserTitle: "Naczepy w portach",
  teaserText:
    "Zlecenia wymiany naczep w portach z giełdy ładunków, własni klienci, aplikacja kierowcy w 10 językach ze skanerem listów przewozowych, zestawy i czas pracy. Bez prowizji od przewozów.",
  teaserCta: "Czytaj więcej",
  footerLink: "Wymiana naczep w portach",
  serviceType: "Platforma dla przewoźników do wymiany naczep",
  features_ld: [
    "Zlecenia z portów i z okolicy z giełdy ładunków",
    "Zlecenia własnych klientów i link do śledzenia dla klienta",
    "Szkic zlecenia z e-maila dla pojazdu według numeru rejestracyjnego",
    "Aplikacja kierowcy w 10 językach: punkty trasy, zdjęcia, podpis, skaner listów przewozowych, działa bez zasięgu",
    "Naczepy, zestawy i dopuszczalne masy całkowite według kraju",
    "Integracje GPS i paliwowe",
    "Czas pracy, wynagrodzenie i rentowność pojazdu",
  ],
};

const de: LandingCopy = {
  metaTitle: "Trailertausch in Häfen: Aufträge, Fahrer, Fuhrpark",
  metaDescription:
    "Für den Trailertausch: Hafenaufträge aus der Frachtenbörse, eigene Kunden, Fahrer-App in 10 Sprachen und Frachtbriefe. Erster Lkw kostenlos.",
  eyebrow: "Trailertausch in Häfen",
  title: "Auflieger vom Hafen zum Kunden – ohne Papierkram",
  lede: "Übernehmen Sie Tauschaufträge aus der Frachtenbörse in Häfen wie Vuosaari, Muuga, Kapellskär, Travemünde und Gdynia, fahren Sie die Aufträge Ihrer eigenen Kunden und behalten Sie Lkw, Fahrer und Papiere an einem Ort. Keine Prozente auf Aufträge.",
  ctaApply: "Jetzt registrieren",
  ctaSignIn: "Anmelden",
  dayTitle: "So läuft ein Tausch",
  day: [
    {
      title: "Auftrag kommt rein",
      text: "Aus der Frachtenbörse in der Nähe Ihrer Lkw, von Ihrem eigenen Kunden oder per Auftrags-E-Mail. Ein Auftrag per E-Mail wird zum Entwurf für den Lkw, dessen Kennzeichen im Auftrag steht.",
    },
    {
      title: "Zum Fahrer",
      text: "Stopps in der richtigen Reihenfolge in der Fahrer-App, mit dem Kennzeichen des Aufliegers. Nachrichten zum Auftrag werden in die Sprache des Fahrers übersetzt.",
    },
    {
      title: "Abholung im Hafen",
      text: "Der Fahrer bestätigt die Ankunft, fotografiert den Auflieger und scannt den Frachtbrief. Die App funktioniert im Hafengelände auch ohne Netz.",
    },
    {
      title: "Zustellung",
      text: "Ankunft, Entladung, Unterschrift und bei Bedarf Schadensfotos. Ihr eigener Kunde verfolgt den Auftrag über einen Tracking-Link.",
    },
    {
      title: "Auftrag abgeschlossen",
      text: "Arbeitszeit und voraussichtlicher Lohn für den Fahrer, Erlöse und Kosten in die Rentabilität des Lkw. Ein Wochenbericht über Aufträge, Verdienst und Papiere.",
    },
  ],
  featuresTitle: "Was Sie bekommen",
  features: [
    {
      title: "Aufträge in den Häfen",
      text: "Die Frachtenbörse zeigt offene Aufträge dort, wo Ihre Lkw sind, sortiert nach Leerkilometern. Häfen im gesamten Einsatzgebiet, zum Beispiel Vuosaari und Turku, Muuga und Paldiski, Riga, Klaipėda, Kapellskär und Göteborg, Oslo, Kopenhagen, Gdynia, Travemünde und Rostock.",
    },
    {
      title: "Eigene Kunden",
      text: "Legen Sie den Auftrag eines Kunden für Ihren eigenen Lkw an oder lassen Sie den Kunden direkt bei Ihrem Lkw bestellen. Aus einer Auftrags-E-Mail wird ein Entwurf für den im Auftrag genannten Lkw. Der volle Preis gehört Ihnen.",
    },
    {
      title: "Fahrer-App in 10 Sprachen",
      text: "Finnisch, Englisch, Schwedisch, Norwegisch, Dänisch, Estnisch, Lettisch, Litauisch, Polnisch und Russisch. Stopps, Ankunft, Fotos, Unterschrift und Frachtbrief-Scanner – auch offline.",
    },
    {
      title: "Auflieger und Kombinationen",
      text: "Sattelzugmaschinen, Sattelauflieger und Containerchassis. Das zulässige Gesamtgewicht der Kombination je Land und die Nutzlast werden aus Ihren eigenen Fahrzeugen berechnet, und jeder Auftrag wird gegen die Kombination geprüft.",
    },
    {
      title: "GPS und Kraftstoff",
      text: "Position aus Ihrem eigenen Telematiksystem: Wialon, Mapon, Navirec, Ruptela, Navixy, Samsara, Webfleet oder ABAX. Kraftstoff aus dem Tankkartenbericht, den Einträgen des Fahrers und GPS.",
    },
    {
      title: "Arbeitszeit, Lohn und Rentabilität",
      text: "Schichten und Pausen aus der App, Lohn nach Kilometern, nach Stunden, nach finnischem Tarifvertrag oder als vereinbarter Nettolohn. Rentabilität je Lkw: Erlöse minus Kraftstoff, Löhne und Fixkosten.",
    },
  ],
  priceTitle: "Preis",
  priceText:
    "Erster Lkw kostenlos, jeder weitere {price} (zzgl. MwSt.) im Monat – nur für Lkw, die in dem Monat gefahren sind. Keine Prozente auf Aufträge aus der Frachtenbörse oder von eigenen Kunden. Erster Monat kostenlos.",
  faqTitle: "Häufige Fragen",
  faq: [
    {
      q: "Welche Häfen kennt RAHTIS?",
      a: "In allen neun Ländern. Zum Beispiel in Finnland Helsinki-Vuosaari, Hanko, Turku und HaminaKotka, in Estland Muuga und Paldiski, in Lettland Riga und Ventspils, in Litauen Klaipėda, in Schweden Kapellskär, Stockholm und Göteborg, in Norwegen Oslo, in Dänemark Kopenhagen und Esbjerg, in Polen Gdynia und Świnoujście sowie in Deutschland Travemünde, Rostock, Kiel und die Hamburger Containerterminals.",
    },
    {
      q: "Nehmen Sie Prozente auf Aufträge?",
      a: "Nein. Weder auf Aufträge aus der Frachtenbörse noch auf Aufträge Ihrer eigenen Kunden. Der Vertrag kommt direkt mit dem Auftraggeber zustande, und er bezahlt Sie.",
    },
    {
      q: "In welcher Sprache nutzt der Fahrer die App?",
      a: "In seiner eigenen: Die App gibt es in zehn Sprachen, und Nachrichten zum Auftrag werden automatisch in die Sprache des Fahrers übersetzt.",
    },
    {
      q: "Funktioniert die App im Hafen ohne Netz?",
      a: "Ja. Ankunft, Stopps, Fotos und Unterschrift werden auf dem Handy gespeichert und gesendet, sobald die Verbindung wieder da ist. Der gescannte Frachtbrief wird auf dem Handy in ein PDF umgewandelt.",
    },
    {
      q: "Kann ein Kunde direkt bei meinem Lkw bestellen?",
      a: "Ja. Ihr Unternehmen hat eine eigene E-Mail-Adresse für Aufträge: Aus der Auftrags-E-Mail des Kunden (Text, PDF oder Foto) wird ein Entwurf für den im Auftrag genannten Lkw. Eine spätere E-Mail mit derselben Auftragsnummer erscheint als Änderung, die Sie annehmen oder ablehnen.",
    },
    {
      q: "Was kostet das?",
      a: "Der erste Lkw ist kostenlos. Jeder weitere kostet {price} (zzgl. MwSt.) im Monat, nur wenn er in dem Monat gefahren ist. Ab {from} Lkw Preis auf Anfrage. Ein Jahr im Voraus: −{discount} %. Der erste Monat ist kostenlos.",
    },
  ],
  finalTitle: "Übernehmen Sie Ihren ersten Trailertausch",
  finalText:
    "Fügen Sie einen Lkw und einen Fahrer hinzu und sehen Sie die Aufträge in den Häfen. Der erste Monat ist kostenlos.",
  teaserEyebrow: "Trailertausch",
  teaserTitle: "Trailertausch in Häfen",
  teaserText:
    "Tauschaufträge in Häfen aus der Frachtenbörse, eigene Kunden, Fahrer-App in 10 Sprachen mit Frachtbrief-Scanner, Kombinationen und Arbeitszeiten. Keine Prozente auf Aufträge.",
  teaserCta: "Mehr erfahren",
  footerLink: "Trailertausch in Häfen",
  serviceType: "Arbeitsplattform für Transportunternehmen im Trailertausch",
  features_ld: [
    "Aufträge in Häfen und in der Umgebung aus der Frachtenbörse",
    "Aufträge eigener Kunden und Tracking-Link für den Kunden",
    "Auftragsentwurf aus E-Mail für den Lkw mit dem genannten Kennzeichen",
    "Fahrer-App in 10 Sprachen: Stopps, Fotos, Unterschrift, Frachtbrief-Scanner, funktioniert offline",
    "Auflieger, Kombinationen und zulässige Gesamtgewichte je Land",
    "GPS- und Kraftstoff-Integrationen",
    "Arbeitszeit, Fahrerlohn und Rentabilität je Lkw",
  ],
};

const ru: LandingCopy = {
  metaTitle: "Перецепка полуприцепов в портах: рейсы, водители, парк",
  metaDescription:
    "Для перецепки полуприцепов: рейсы из портов с биржи грузов, свои клиенты, приложение водителя на 10 языках и накладные CMR. Первая машина бесплатно.",
  eyebrow: "Перецепка полуприцепов в портах",
  title: "Полуприцепы из порта к клиенту без бумажной волокиты",
  lede: "Берите с биржи рейсы на перецепку в портах Вуосаари, Мууга, Капелльшер, Травемюнде, Гдыня и других, возите заказы своих клиентов и держите машины, водителей и документы в одном месте. Никаких процентов с рейсов.",
  ctaApply: "Подключиться",
  ctaSignIn: "Войти",
  dayTitle: "Как проходит перецепка",
  day: [
    {
      title: "Рейс поступает",
      text: "С биржи — рядом с вашими машинами, от своего клиента или из письма с заказом. Заказ из письма приходит черновиком на ту машину, госномер которой указан в заказе.",
    },
    {
      title: "Водителю",
      text: "Точки по порядку в приложении водителя, вместе с госномером полуприцепа. Сообщения по рейсу переводятся на язык водителя.",
    },
    {
      title: "Забор в порту",
      text: "Водитель отмечает прибытие, фотографирует полуприцеп и сканирует накладную. Приложение работает и без сети на территории порта.",
    },
    {
      title: "Доставка",
      text: "Прибытие, выгрузка, подпись и при необходимости фото повреждений. Ваш клиент следит за рейсом по ссылке отслеживания.",
    },
    {
      title: "Рейс закрыт",
      text: "Рабочее время и расчётная зарплата водителя, доходы и расходы — в рентабельность машины. Недельный отчёт по рейсам, заработку и документам.",
    },
  ],
  featuresTitle: "Что вы получаете",
  features: [
    {
      title: "Рейсы из портов",
      text: "Биржа показывает открытые рейсы там, где ваши машины, с учётом порожнего пробега. Порты по всему региону работы, например Вуосаари и Турку, Мууга и Палдиски, Рига, Клайпеда, Капелльшер и Гётеборг, Осло, Копенгаген, Гдыня, Травемюнде и Росток.",
    },
    {
      title: "Свои клиенты",
      text: "Добавьте рейс клиента на свою машину или дайте клиенту заказывать напрямую на вашу машину. Письмо с заказом превращается в черновик для машины, указанной в заказе. Вся цена — ваша.",
    },
    {
      title: "Приложение водителя на 10 языках",
      text: "Финский, английский, шведский, норвежский, датский, эстонский, латышский, литовский, польский и русский. Точки маршрута, прибытие, фото, подпись и сканер накладных — и без сети.",
    },
    {
      title: "Полуприцепы и сцепки",
      text: "Тягачи, полуприцепы и контейнерные шасси. Максимальная разрешённая масса сцепки по странам и грузоподъёмность рассчитываются по вашим машинам, и каждый рейс проверяется на соответствие сцепке.",
    },
    {
      title: "GPS и топливо",
      text: "Местоположение из вашей системы мониторинга: Wialon, Mapon, Navirec, Ruptela, Navixy, Samsara, Webfleet или ABAX. Топливо — из отчёта по топливной карте, записей водителя и GPS.",
    },
    {
      title: "Рабочее время, зарплата и рентабельность",
      text: "Смены и перерывы из приложения, зарплата за километры, за часы, по финскому коллективному договору (TES) или как оговорённая сумма на руки. Рентабельность машины: доходы минус топливо, зарплаты и постоянные расходы.",
    },
  ],
  priceTitle: "Цена",
  priceText:
    "Первая машина бесплатно, каждая следующая — {price} (без НДС) в месяц, и только если она в этом месяце работала. Никаких процентов ни с рейсов с биржи, ни с рейсов своих клиентов. Первый месяц бесплатно.",
  faqTitle: "Вопросы и ответы",
  faq: [
    {
      q: "Какие порты знает RAHTIS?",
      a: "Во всех девяти странах. Например, в Финляндии Вуосаари в Хельсинки, Ханко, Турку и ХаминаКотка, в Эстонии Мууга и Палдиски, в Латвии Рига и Вентспилс, в Литве Клайпеда, в Швеции Капелльшер, Стокгольм и Гётеборг, в Норвегии Осло, в Дании Копенгаген и Эсбьерг, в Польше Гдыня и Свиноуйсьце, в Германии Травемюнде, Росток, Киль и контейнерные терминалы Гамбурга.",
    },
    {
      q: "Берёте ли вы процент с рейсов?",
      a: "Нет. Ни с рейсов с биржи, ни с рейсов своих клиентов. Договор заключается напрямую с заказчиком, и он платит вам.",
    },
    {
      q: "На каком языке водитель работает в приложении?",
      a: "На своём: приложение работает на десяти языках, а сообщения по рейсу автоматически переводятся на язык водителя.",
    },
    {
      q: "Работает ли приложение в порту без сети?",
      a: "Работает. Прибытие, точки маршрута, фото и подпись сохраняются в телефоне и уходят, когда связь появится. Скан накладной превращается в PDF прямо в телефоне.",
    },
    {
      q: "Может ли клиент заказывать напрямую на мою машину?",
      a: "Да. У компании есть свой адрес почты для заказов: письмо клиента с заказом (текст, PDF или фото) превращается в черновик для машины, указанной в заказе. Следующее письмо с тем же номером заказа показывается как изменение, которое вы принимаете или отклоняете.",
    },
    {
      q: "Сколько это стоит?",
      a: "Первая машина бесплатно. Каждая следующая — {price} (без НДС) в месяц, только если она работала. От {from} машин — цена по запросу. При оплате года вперёд −{discount} %. Первый месяц бесплатно.",
    },
  ],
  finalTitle: "Возьмите первый рейс на перецепку",
  finalText:
    "Добавьте машину и водителя и посмотрите рейсы в портах. Первый месяц бесплатно.",
  teaserEyebrow: "Перецепка полуприцепов",
  teaserTitle: "Полуприцепы в портах",
  teaserText:
    "Рейсы на перецепку в портах с биржи, свои клиенты, приложение водителя на 10 языках со сканером накладных, сцепки и рабочее время. Никаких процентов с рейсов.",
  teaserCta: "Подробнее",
  footerLink: "Перецепка полуприцепов в портах",
  serviceType: "Рабочая платформа перевозчика для перецепки полуприцепов",
  features_ld: [
    "Рейсы с биржи в портах и рядом с вашими машинами",
    "Рейсы своих клиентов и ссылка отслеживания для клиента",
    "Черновик заказа из письма для машины по госномеру",
    "Приложение водителя на 10 языках: точки маршрута, фото, подпись, сканер накладных, работает без сети",
    "Полуприцепы, сцепки и максимальные разрешённые массы по странам",
    "Интеграции GPS и топлива",
    "Рабочее время, зарплата и рентабельность машины",
  ],
};

/* Остальные языки — перевод с финского (смысл) и английского (помощь). */
export const TRAILER_SWAP: Record<Locale, LandingCopy> = {
  fi,
  en,
  sv,
  et,
  lv,
  lt,
  pl,
  de,
  ru,
};

/** Адрес страницы: финский слаг у финского, английский у остальных. */
export const trailerSwapPath = (locale: Locale) =>
  `/${locale}/${locale === "fi" ? "peravaunun-vaihto" : "trailer-swap"}`;

/** Фото баннера — оно же картинка превью (og:image). */
export const TRAILER_SWAP_PHOTO = {
  url: "/media/peravaunu-hero.webp",
  width: 1456,
  height: 816,
} as const;

import type { Locale } from "@/lib/i18n/config";
import type { LandingCopy } from "./types";

/**
 * Витрина «RAHTIS huolitsijoille» — для экспедиторов (11.11.2026).
 *
 * Позиционирование (решение владельца 6.11.2026): для экспедитора RAHTIS —
 * поиск перевозчиков и публикация грузов. Договор каждой перевозки —
 * напрямую между экспедитором и перевозчиком, RAHTIS берёт 0 %,
 * экспедитору бесплатно.
 *
 * Только то, что кабинет заказчика делает сейчас (проверено по коду):
 *   - в предложениях нет цены перевозчика — цену ставит сам заказчик,
 *     поэтому «выбор по цене» здесь не обещаем;
 *   - «свои машины» (vakioautot) — только машины, которые уже возили
 *     этому заказчику и чей перевозчик разрешил прямые заказы;
 *   - ссылки отслеживания для получателя у заказов с биржи нет (она есть
 *     только у своих рейсов перевозчика) — здесь её нет;
 *   - проверка документов экспедитора (docsGate, 11.11.2026): кого PRH не
 *     нашёл автоматически, загружает выписку из реестра и страховку
 *     ответственности до первой публикации. Подаётся как проверка всех
 *     сторон, а не как барьер.
 */
const fi: LandingCopy = {
  metaTitle: "Huolitsijoille: kuljetusliike jokaiselle kuormalle",
  metaDescription:
    "Julkaise irtoperä-, kontti- tai pikakuljetus kerran, valitse tarkastetun kuljetusliikkeen tarjous ja seuraa keikkaa vaiheittain. Maksuton huolitsijalle.",
  eyebrow: "RAHTIS huolitsijoille",
  title: "Kuljetusliike jokaiselle kuormalle – maksutta",
  lede: "Julkaise perävaunun vaihto, konttikuljetus tai pikakuljetus kerran. Hyväksytyt kuljetusliikkeet tekevät tarjouksen, sinä valitset auton ja seuraat keikkaa vaihe vaiheelta. Sopimus tehdään suoraan kuljetusliikkeen kanssa, eikä RAHTIS ota välityspalkkiota.",
  ctaApply: "Hae mukaan",
  ctaSignIn: "Kirjaudu",
  dayTitle: "Näin keikka kulkee",
  day: [
    {
      title: "Tilaus sisään",
      text: "Kirjoita keikka tai ohjaa asiakkaan tilaussähköposti, PDF tai kuva RAHTIKSEEN. Siitä tulee tilausluonnos, jonka tarkistat ennen julkaisua.",
    },
    {
      title: "Julkaisu kerran",
      text: "Tarjouspöydälle kuljetusliikkeille, joilla on sopiva hyväksytty auto, suoraan vakioautollesi tai ensin 2–10 omalle autolle ja vasta sitten pöydälle.",
    },
    {
      title: "Valinta tarjouksista",
      text: "Tarjouksen voi tehdä enintään kolme kuljetusliikettä. Näet arviot, Tarkastettu-merkin, ajot, täsmällisyyden, kaluston ja kuljettajan kielet. Ei huutokauppaa: hinta on se, jonka itse asetit.",
    },
    {
      title: "Seuranta vaihe vaiheelta",
      text: "Saapumiset, lastaus, purku ja viivehälytykset samassa näkymässä. Viestit kuljetusliikkeelle ja kuljettajalle käännetään – jokainen lukee omalla kielellään.",
    },
    {
      title: "Perillä",
      text: "Rahtikirja (CMR) sekä lastaus-, purku- ja vauriokuvat keikan tiedoissa. Viikkoraportti kaikista keikoista, ja raportit saa PDF-, Excel- ja CSV-muodossa.",
    },
  ],
  featuresTitle: "Mitä saat",
  features: [
    {
      title: "Irtoperät, kontit ja pikakuljetukset",
      text: "Perävaunujen vaihdot satamien, terminaalien ja asiakkaiden välillä. Konttikuljetukset 20, 30, 40 ja 45 jalkaa, konttinumero tarkistetaan. Pikakuljetukset pakettiautolla tai kuorma-autolla.",
    },
    {
      title: "Omat vakioautot",
      text: "Auton, joka on jo ajanut sinulle ja jonka kuljetusliike sallii suorat tilaukset, voi lisätä vakioautoihin. Lähetä keikka suoraan sille tai tarjoa ensin omille autoillesi.",
    },
    {
      title: "Tilaukset sähköpostista",
      text: "Yrityksellä on oma osoite, johon asiakkaan tilausviestin voi välittää. Tekstin, PDF:n tai kuvan voi myös liittää itse. Tilauksesta tulee luonnos – mitään ei julkaista ilman sinua.",
    },
    {
      title: "Jokainen omalla kielellään",
      text: "Keikan viestit sinun, kuljetusliikkeen ja kuljettajan välillä käännetään automaattisesti. Suomalainen huolitsija, virolainen kuljetusliike ja puolalainen kuski ymmärtävät toisiaan.",
    },
    {
      title: "Tarkastetut kuljetusliikkeet",
      text: "Jokainen kuljetusliike tarkastetaan ennen ensimmäistä keikkaa: yritysrekisteri, liikennelupa ja vakuutus, ja jokainen auto hyväksytään erikseen. Tarkastettu-merkki kertoo, että tilaajavastuuselvitykset ovat voimassa.",
    },
    {
      title: "Rajapinta ja webhookit",
      text: "Kytke oma TMS tai ERP: REST-rajapinta ja allekirjoitetut webhookit, kuvaus OpenAPI 3.1 -muodossa, avain hallintapaneelista. Maksuton – ei kuukausimaksua eikä kutsukohtaista hintaa.",
    },
  ],
  priceTitle: "Hinta",
  priceText:
    "Huolitsijalle RAHTIS on maksuton: ei kuukausimaksua, ei prosenttia keikoista eikä maksua rajapinnasta. Kuljetusliike laskuttaa sinua suoraan keikan hinnalla.",
  faqTitle: "Kysyttyä",
  faq: [
    {
      q: "Mitä RAHTIS maksaa huolitsijalle?",
      a: "Ei mitään. Ei kuukausimaksua, ei prosenttia keikoista, ja rajapinta on maksuton. Kuukausimaksun maksavat kuljetusliikkeet ajaneista autoistaan.",
    },
    {
      q: "Kenen kanssa sopimus tehdään?",
      a: "Suoraan keikan ottavan kuljetusliikkeen kanssa. Kuljetusliike laskuttaa sinua, eikä RAHTIS ota välityspalkkiota.",
    },
    {
      q: "Voinko käyttää omia kuljetusliikkeitäni?",
      a: "Voit. Sinulle ajaneet autot voi lisätä vakioautoiksi, jos niiden kuljetusliike sallii suorat tilaukset. Keikan voi lähettää suoraan yhdelle autolle tai ensin 2–10 auton ryhmälle ja sitten tarjouspöydälle.",
    },
    {
      q: "Miten toimijat tarkastetaan?",
      a: "Kaikki toimijat tarkastetaan. Kuljetusliikkeeltä yritysrekisteri, liikennelupa ja vakuutus, ja jokaisen auton hyväksyy ihminen. Huolitsija tarkistetaan kaupparekisteristä; jos yritystä ei löydy sieltä automaattisesti, rekisteriote ja huolitsijan vastuuvakuutus ladataan ennen ensimmäistä julkaisua. Näin kuljetusliike tietää, kenelle ajaa.",
    },
    {
      q: "Entä jos kukaan ei tarjoa tai auto peruu?",
      a: "Jos valittu kuljetusliike ei vahvista keikkaa 15 minuutissa tai peruu sen, keikka palaa pöydälle ja menee seuraaville sopiville autoille. Jos tarjouksia ei tule, saat ilmoituksen ja voit nostaa hintaa tai lähettää keikan suoraan tutulle autolle.",
    },
    {
      q: "Saako RAHTIKSEN kytkettyä omaan järjestelmään?",
      a: "Saa. REST-rajapinnalla luot ja seuraat keikkoja, ja allekirjoitetut webhookit kertovat tilan muutoksista. Kuvaus on OpenAPI 3.1 -muodossa API-dokumentaatiossa, ja avain luodaan hallintapaneelissa.",
    },
  ],
  finalTitle: "Julkaise ensimmäinen keikka",
  finalText:
    "Rekisteröi yritys, julkaise keikka ja valitse tarjouksista. Huolitsijalle maksuton.",
  teaserEyebrow: "Huolitsijoille",
  teaserTitle: "Kuljetusliikkeet kuormillesi – maksutta",
  teaserText:
    "Julkaise irtoperät, kontit ja pikakuljetukset kerran, valitse tarkastettujen kuljetusliikkeiden tarjouksista ja seuraa keikkaa vaihe vaiheelta. Ei välityspalkkiota.",
  teaserCta: "Lue lisää",
  footerLink: "RAHTIS huolitsijoille",
  serviceType: "Rahtipörssi huolitsijoille",
  features_ld: [
    "Perävaunujen vaihdot, konttikuljetukset (20–45 ft) ja pikakuljetukset",
    "Julkaisu tarjouspöydälle, suoraan vakioautolle tai ensin omille autoille",
    "Enintään kolme tarjousta, valinta arvioiden ja kaluston perusteella",
    "Tilausluonnos sähköpostista, PDF:stä tai kuvasta",
    "Seuranta vaihe vaiheelta, rahtikirja ja kuvat",
    "Automaattisesti käännetty viestintä kuljetusliikkeen ja kuljettajan kanssa",
    "Viikkoraportti",
    "Maksuton REST-rajapinta ja allekirjoitetut webhookit",
  ],
};

const en: LandingCopy = {
  metaTitle: "For freight forwarders: a carrier for every load",
  metaDescription:
    "Publish a trailer swap, container or express job once, choose a checked carrier from the offers and follow the job step by step. Free for forwarders.",
  eyebrow: "RAHTIS for freight forwarders",
  title: "A carrier for every load – free of charge",
  lede: "Publish a trailer swap, container or express job once. Approved carriers make offers, you choose the vehicle and follow the job step by step. The agreement is made directly with the carrier, and RAHTIS takes no commission.",
  ctaApply: "Join RAHTIS",
  ctaSignIn: "Sign in",
  dayTitle: "How a job works",
  day: [
    {
      title: "Order in",
      text: "Type the job, or forward the customer’s order e-mail, PDF or photo to RAHTIS. It becomes an order draft that you check before publishing.",
    },
    {
      title: "Publish once",
      text: "To the load board for carriers with a suitable approved vehicle, straight to one of your regular vehicles, or first to 2–10 of your own vehicles and only then to the board.",
    },
    {
      title: "Choose an offer",
      text: "Up to three carriers can offer. You see ratings, the Verified badge, trips, on-time rate, the vehicle and the driver’s languages. No auction: the price is the one you set.",
    },
    {
      title: "Follow every step",
      text: "Arrivals, loading, unloading and delay alerts in one view. Messages to the carrier and the driver are translated – everyone reads in their own language.",
    },
    {
      title: "Delivered",
      text: "Consignment note (CMR) and loading, unloading and damage photos on the job. A weekly report of all jobs, with reports in PDF, Excel and CSV.",
    },
  ],
  featuresTitle: "What you get",
  features: [
    {
      title: "Trailer swaps, containers, express",
      text: "Semi-trailer swaps between ports, terminals and customers. Container haulage in 20, 30, 40 and 45 ft, with the container number checked. Express jobs by van or truck.",
    },
    {
      title: "Your regular vehicles",
      text: "A truck that has already driven for you, and whose carrier allows direct orders, can be added to your regular vehicles. Send a job straight to it, or offer it to your own vehicles first.",
    },
    {
      title: "Orders from e-mail",
      text: "Your company gets its own address to forward customers’ order e-mails to. You can also paste text or upload a PDF or a photo. The order becomes a draft – nothing is published without you.",
    },
    {
      title: "Everyone in their own language",
      text: "Messages on a job between you, the carrier and the driver are translated automatically. A Finnish forwarder, an Estonian carrier and a Polish driver understand each other.",
    },
    {
      title: "Checked carriers",
      text: "Every carrier is checked before its first job: company register, operating licence and insurance, and each vehicle is approved separately. The Verified badge shows that contractor’s liability reports are valid.",
    },
    {
      title: "API and webhooks",
      text: "Connect your TMS or ERP: REST API and signed webhooks, described in OpenAPI 3.1, key from your dashboard. Free – no monthly fee and no price per call.",
    },
  ],
  priceTitle: "Price",
  priceText:
    "For forwarders RAHTIS is free: no monthly fee, no percentage on jobs and no fee for the API. The carrier invoices you directly at the job price.",
  faqTitle: "FAQ",
  faq: [
    {
      q: "What does RAHTIS cost a forwarder?",
      a: "Nothing. No monthly fee, no percentage on jobs, and the API is free. Carriers pay a monthly fee for the vehicles that drove.",
    },
    {
      q: "Who is the agreement with?",
      a: "Directly with the carrier that takes the job. The carrier invoices you, and RAHTIS takes no commission.",
    },
    {
      q: "Can I use my own carriers?",
      a: "Yes. Trucks that have driven for you can be added to your regular vehicles if their carrier allows direct orders. Send a job straight to one truck, or first to a group of 2–10 trucks and then to the load board.",
    },
    {
      q: "How are companies checked?",
      a: "Every party is checked. Carriers: company register, operating licence and insurance, and a person approves each vehicle. Forwarders are looked up in the Finnish Trade Register; if the company is not found there automatically, a register extract and forwarder’s liability insurance are uploaded before the first job is published. This way the carrier knows who it is driving for.",
    },
    {
      q: "What if no one offers or a truck cancels?",
      a: "If the chosen carrier does not confirm within 15 minutes or cancels, the job returns to the board and goes to the next suitable vehicles. If no offers come in, you get a notice and can raise the price or send the job straight to a truck you know.",
    },
    {
      q: "Can I connect RAHTIS to our own system?",
      a: "Yes. With the REST API you create and follow jobs, and signed webhooks report status changes. The API is described in OpenAPI 3.1 in the API documentation, and the key is created in your dashboard.",
    },
  ],
  finalTitle: "Publish your first job",
  finalText:
    "Register your company, publish a job and choose from the offers. Free for forwarders.",
  teaserEyebrow: "For forwarders",
  teaserTitle: "Carriers for your loads – free",
  teaserText:
    "Publish trailer swaps, containers and express jobs once, choose from offers by checked carriers and follow each job step by step. No commission.",
  teaserCta: "Read more",
  footerLink: "RAHTIS for freight forwarders",
  serviceType: "Freight exchange for freight forwarders",
  features_ld: [
    "Trailer swaps, container haulage (20–45 ft) and express transport",
    "Publish to the load board, straight to a regular vehicle or to your own vehicles first",
    "Up to three offers, chosen by ratings and equipment",
    "Order draft from e-mail, PDF or photo",
    "Step-by-step tracking, consignment note (CMR) and photos",
    "Automatically translated messages with the carrier and the driver",
    "Weekly report",
    "Free REST API and signed webhooks",
  ],
};

const sv: LandingCopy = {
  metaTitle: "För speditörer: ett åkeri för varje last",
  metaDescription:
    "Publicera trailerbyte, container eller express en gång, välj ett kontrollerat åkeris anbud och följ uppdraget steg för steg. Gratis för speditörer.",
  eyebrow: "RAHTIS för speditörer",
  title: "Ett åkeri för varje last – utan kostnad",
  lede: "Publicera ett trailerbyte, en containertransport eller en expresstransport en gång. Godkända åkerier lämnar anbud, du väljer bil och följer uppdraget steg för steg. Avtalet sluts direkt med åkeriet, och RAHTIS tar ingen förmedlingsavgift.",
  ctaApply: "Ansök nu",
  ctaSignIn: "Logga in",
  dayTitle: "Så går ett uppdrag till",
  day: [
    {
      title: "Ordern kommer in",
      text: "Skriv in uppdraget eller vidarebefordra kundens ordermejl, PDF eller bild till RAHTIS. Det blir ett orderutkast som du granskar innan det publiceras.",
    },
    {
      title: "Publicera en gång",
      text: "Till lastbörsen för åkerier som har ett lämpligt godkänt fordon, direkt till ett av dina fasta fordon eller i första hand till 2–10 av dina egna fordon och först därefter till börsen.",
    },
    {
      title: "Välj bland anbuden",
      text: "Högst tre åkerier kan lämna anbud. Du ser betyg, märket Kontrollerad, körda uppdrag, punktlighet, fordonet och förarens språk. Ingen auktion: priset är det som du själv har satt.",
    },
    {
      title: "Följ varje steg",
      text: "Ankomster, lastning, lossning och förseningslarm i samma vy. Meddelanden till åkeriet och föraren översätts – alla läser på sitt eget språk.",
    },
    {
      title: "Framme",
      text: "Fraktsedeln (CMR) samt lastnings-, lossnings- och skadefoton finns i uppdragets uppgifter. Veckorapport över alla uppdrag, och rapporterna kan tas ut som PDF, Excel och CSV.",
    },
  ],
  featuresTitle: "Det här får du",
  features: [
    {
      title: "Trailerbyten, containrar och express",
      text: "Trailerbyten mellan hamnar, terminaler och kunder. Containertransporter i 20, 30, 40 och 45 fot, med kontroll av containernumret. Expresstransporter med skåpbil eller lastbil.",
    },
    {
      title: "Dina fasta fordon",
      text: "Ett fordon som redan har kört åt dig och vars åkeri tillåter direktorder kan läggas till bland dina fasta fordon. Skicka uppdraget direkt till det eller erbjud det först till dina egna fordon.",
    },
    {
      title: "Order via e-post",
      text: "Företaget får en egen adress dit kundens ordermejl kan vidarebefordras. Du kan också klistra in text eller ladda upp en PDF eller bild själv. Ordern blir ett utkast – inget publiceras utan dig.",
    },
    {
      title: "Alla på sitt eget språk",
      text: "Meddelanden i uppdraget mellan dig, åkeriet och föraren översätts automatiskt. En finländsk speditör, ett estniskt åkeri och en polsk chaufför förstår varandra.",
    },
    {
      title: "Kontrollerade åkerier",
      text: "Varje åkeri kontrolleras före sitt första uppdrag: företagsregister, trafiktillstånd och försäkring, och varje fordon godkänns för sig. Märket Kontrollerad visar att utredningarna enligt finska beställaransvarslagen är giltiga.",
    },
    {
      title: "API och webhooks",
      text: "Koppla ditt TMS eller affärssystem (ERP): REST-API och signerade webhooks, beskrivna i OpenAPI 3.1, nyckel från kontrollpanelen. Gratis – ingen månadsavgift och inget pris per anrop.",
    },
  ],
  priceTitle: "Pris",
  priceText:
    "För speditörer är RAHTIS gratis: ingen månadsavgift, ingen procent på uppdragen och ingen avgift för API:et. Åkeriet fakturerar dig direkt till uppdragets pris.",
  faqTitle: "Vanliga frågor",
  faq: [
    {
      q: "Vad kostar RAHTIS för en speditör?",
      a: "Ingenting. Ingen månadsavgift, ingen procent på uppdragen, och API:et är gratis. Månadsavgiften betalas av åkerierna, för de fordon som har kört.",
    },
    {
      q: "Med vem sluts avtalet?",
      a: "Direkt med åkeriet som tar uppdraget. Åkeriet fakturerar dig, och RAHTIS tar ingen förmedlingsavgift.",
    },
    {
      q: "Kan jag använda mina egna åkerier?",
      a: "Ja. Fordon som har kört åt dig kan läggas till bland dina fasta fordon, om deras åkeri tillåter direktorder. Uppdraget kan skickas direkt till ett fordon eller först till en grupp på 2–10 fordon och sedan till lastbörsen.",
    },
    {
      q: "Hur kontrolleras aktörerna?",
      a: "Alla aktörer kontrolleras. Åkerier: företagsregister, trafiktillstånd och försäkring, och varje fordon godkänns manuellt. Speditören kontrolleras mot finska handelsregistret; om företaget inte hittas där automatiskt laddas ett registerutdrag och speditörens ansvarsförsäkring upp före den första publiceringen. Så vet åkeriet vem det kör åt.",
    },
    {
      q: "Och om ingen lämnar anbud eller bilen avbokar?",
      a: "Om det valda åkeriet inte bekräftar uppdraget inom 15 minuter eller avbokar det, går uppdraget tillbaka till börsen och vidare till nästa lämpliga fordon. Om inga anbud kommer får du ett meddelande och kan höja priset eller skicka uppdraget direkt till ett fordon du känner.",
    },
    {
      q: "Kan RAHTIS kopplas till vårt eget system?",
      a: "Ja. Med REST-API:et skapar och följer du uppdrag, och signerade webhooks meddelar statusändringar. Beskrivningen finns i OpenAPI 3.1-format i API-dokumentationen, och nyckeln skapas i kontrollpanelen.",
    },
  ],
  finalTitle: "Publicera ditt första uppdrag",
  finalText:
    "Registrera företaget, publicera ett uppdrag och välj bland anbuden. Gratis för speditörer.",
  teaserEyebrow: "För speditörer",
  teaserTitle: "Åkerier för dina laster – gratis",
  teaserText:
    "Publicera trailerbyten, containrar och expresstransporter en gång, välj bland anbud från kontrollerade åkerier och följ uppdraget steg för steg. Ingen förmedlingsavgift.",
  teaserCta: "Läs mer",
  footerLink: "RAHTIS för speditörer",
  serviceType: "Lastbörs för speditörer",
  features_ld: [
    "Trailerbyten, containertransporter (20–45 fot) och expresstransporter",
    "Publicering till lastbörsen, direkt till ett fast fordon eller först till egna fordon",
    "Högst tre anbud, val utifrån betyg och fordon",
    "Orderutkast från e-post, PDF eller bild",
    "Uppföljning steg för steg, fraktsedel (CMR) och foton",
    "Automatiskt översatta meddelanden med åkeriet och föraren",
    "Veckorapport",
    "Gratis REST-API och signerade webhooks",
  ],
};

const et: LandingCopy = {
  metaTitle: "Ekspediitorile: vedaja igale koormale",
  metaDescription:
    "Avalda haagisevahetus, konteiner- või ekspressvedu üks kord, vali kontrollitud vedaja pakkumine ja jälgi vedu samm-sammult. Ekspediitorile tasuta.",
  eyebrow: "RAHTIS ekspediitoritele",
  title: "Vedaja igale koormale – tasuta",
  lede: "Avalda haagisevahetus, konteinervedu või ekspressvedu üks kord. Kinnitatud vedajad teevad pakkumise, sina valid auto ja jälgid vedu samm-sammult. Leping sõlmitakse otse vedajaga ja RAHTIS vahendustasu ei võta.",
  ctaApply: "Liitu",
  ctaSignIn: "Logi sisse",
  dayTitle: "Nii vedu kulgeb",
  day: [
    {
      title: "Tellimus sisse",
      text: "Kirjuta vedu ise või suuna kliendi tellimuse e-kiri, PDF või foto edasi RAHTIS keskkonda. Sellest saab tellimuse mustand, mille vaatad enne avaldamist üle.",
    },
    {
      title: "Avaldamine üks kord",
      text: "Veobörsile vedajatele, kellel on sobiv kinnitatud auto, otse sinu püsiautole või kõigepealt 2–10 oma autole ja alles siis veobörsile.",
    },
    {
      title: "Valik pakkumiste seast",
      text: "Pakkumise saab teha kuni kolm vedajat. Näed hinnanguid, märki „Kontrollitud“, vedusid, täpsust, tehnikat ja juhi keeli. Oksjonit pole: hind on see, mille sa ise määrasid.",
    },
    {
      title: "Jälgimine samm-sammult",
      text: "Saabumised, laadimine, mahalaadimine ja hilinemise hoiatused ühes vaates. Sõnumid vedajale ja juhile tõlgitakse – igaüks loeb oma keeles.",
    },
    {
      title: "Kohal",
      text: "Veoseleht (CMR) ning laadimise, mahalaadimise ja kahjustuste fotod veo andmetes. Nädalaaruanne kõigist vedudest ning aruanded PDF-, Excel- ja CSV-vormingus.",
    },
  ],
  featuresTitle: "Mida sa saad",
  features: [
    {
      title: "Haagised, konteinerid ja ekspressveod",
      text: "Poolhaagiste vahetused sadamate, terminalide ja klientide vahel. Konteinerveod 20, 30, 40 ja 45 jalga, konteineri number kontrollitakse. Ekspressveod kaubiku või veokiga.",
    },
    {
      title: "Oma püsiautod",
      text: "Auto, mis on sulle juba sõitnud ja mille vedaja lubab otsetellimusi, saab lisada püsiautode hulka. Saada vedu otse sellele või paku seda kõigepealt oma autodele.",
    },
    {
      title: "Tellimused e-postiga",
      text: "Ettevõttel on oma aadress, kuhu saab kliendi tellimuskirja edasi suunata. Teksti, PDF-i või foto saab lisada ka ise. Tellimusest saab mustand – ilma sinuta ei avaldata midagi.",
    },
    {
      title: "Igaüks oma keeles",
      text: "Veo sõnumid sinu, vedaja ja juhi vahel tõlgitakse automaatselt. Soome ekspediitor, Eesti vedaja ja Poola juht saavad üksteisest aru.",
    },
    {
      title: "Kontrollitud vedajad",
      text: "Iga vedaja kontrollitakse enne esimest vedu: äriregister, tegevusluba ja kindlustus, ning iga auto kinnitatakse eraldi. Märk „Kontrollitud“ näitab, et tellija vastutuse tõendid kehtivad.",
    },
    {
      title: "API ja webhookid",
      text: "Ühenda oma TMS või ERP: REST API ja allkirjastatud webhookid, kirjeldus OpenAPI 3.1 vormingus, võti halduspaneelist. Tasuta – ei kuutasu ega päringupõhist hinda.",
    },
  ],
  priceTitle: "Hind",
  priceText:
    "Ekspediitorile on RAHTIS tasuta: kuutasu pole, vedudelt protsenti ei võeta ja API eest maksma ei pea. Vedaja esitab sulle arve otse veo hinnaga.",
  faqTitle: "Korduma kippuvad küsimused",
  faq: [
    {
      q: "Mis maksab RAHTIS ekspediitorile?",
      a: "Mitte midagi. Kuutasu pole, vedudelt protsenti ei võeta ja API on tasuta. Kuutasu maksavad vedajad nende autode eest, mis sõitsid.",
    },
    {
      q: "Kellega leping sõlmitakse?",
      a: "Otse vedajaga, kes veo võtab. Vedaja esitab sulle arve ja RAHTIS vahendustasu ei võta.",
    },
    {
      q: "Kas saan kasutada oma vedajaid?",
      a: "Saad. Sulle sõitnud autod saab lisada püsiautodeks, kui nende vedaja lubab otsetellimusi. Veo saab saata otse ühele autole või kõigepealt 2–10 auto rühmale ja seejärel veobörsile.",
    },
    {
      q: "Kuidas osapooli kontrollitakse?",
      a: "Kontrollitakse kõiki osapooli. Vedajalt äriregister, tegevusluba ja kindlustus ning iga auto kinnitab inimene. Ekspediitorit kontrollitakse Soome kaubandusregistri järgi; kui ettevõtet sealt automaatselt ei leita, laaditakse enne esimest avaldamist üles registri väljavõte ja ekspediitori vastutuskindlustus. Nii teab vedaja, kellele ta sõidab.",
    },
    {
      q: "Mis siis, kui keegi ei paku või auto loobub?",
      a: "Kui valitud vedaja ei kinnita vedu 15 minuti jooksul või loobub sellest, läheb vedu tagasi veobörsile ja järgmistele sobivatele autodele. Kui pakkumisi ei tule, saad teate ning võid hinda tõsta või saata veo otse tuttavale autole.",
    },
    {
      q: "Kas RAHTIS platvormi saab ühendada oma süsteemiga?",
      a: "Saab. REST API kaudu lood ja jälgid vedusid ning allkirjastatud webhookid annavad teada oleku muutustest. Kirjeldus on OpenAPI 3.1 vormingus API dokumentatsioonis ja võti luuakse halduspaneelis.",
    },
  ],
  finalTitle: "Avalda esimene vedu",
  finalText:
    "Registreeri ettevõte, avalda vedu ja vali pakkumiste seast. Ekspediitorile tasuta.",
  teaserEyebrow: "Ekspediitoritele",
  teaserTitle: "Vedajad sinu koormatele – tasuta",
  teaserText:
    "Avalda haagisevahetused, konteinerid ja ekspressveod üks kord, vali kontrollitud vedajate pakkumiste seast ja jälgi vedu samm-sammult. Vahendustasu pole.",
  teaserCta: "Loe edasi",
  footerLink: "RAHTIS ekspediitoritele",
  serviceType: "Veobörs ekspediitoritele",
  features_ld: [
    "Haagisevahetused, konteinerveod (20–45 ft) ja ekspressveod",
    "Avaldamine veobörsile, otse püsiautole või kõigepealt oma autodele",
    "Kuni kolm pakkumist, valik hinnangute ja tehnika järgi",
    "Tellimuse mustand e-kirjast, PDF-ist või fotolt",
    "Jälgimine samm-sammult, veoseleht (CMR) ja fotod",
    "Automaatselt tõlgitud suhtlus vedaja ja juhiga",
    "Nädalaaruanne",
    "Tasuta REST API ja allkirjastatud webhookid",
  ],
};

const lv: LandingCopy = {
  metaTitle: "Ekspeditoriem: pārvadātājs katrai kravai",
  metaDescription:
    "Publicējiet piekabju maiņu, konteinera vai ekspresa reisu vienreiz, izvēlieties pārbaudīta pārvadātāja piedāvājumu un sekojiet soli pa solim. Bez maksas.",
  eyebrow: "RAHTIS ekspeditoriem",
  title: "Pārvadātājs katrai kravai – bez maksas",
  lede: "Publicējiet piekabju maiņu, konteineru pārvadājumu vai ekspresa pārvadājumu vienreiz. Apstiprināti pārvadātāji iesniedz piedāvājumus, jūs izvēlaties auto un sekojat reisam soli pa solim. Līgumu slēdzat tieši ar pārvadātāju, un RAHTIS starpniecības komisiju neņem.",
  ctaApply: "Pieteikties",
  ctaSignIn: "Pieslēgties",
  dayTitle: "Kā notiek reiss",
  day: [
    {
      title: "Pasūtījums ienāk",
      text: "Ierakstiet reisu paši vai pārsūtiet klienta pasūtījuma e-pastu, PDF vai foto uz RAHTIS platformu. No tā top pasūtījuma melnraksts, ko pārbaudāt pirms publicēšanas.",
    },
    {
      title: "Publicēšana vienreiz",
      text: "Kravu biržā pārvadātājiem, kuriem ir piemērots apstiprināts auto, tieši jūsu pastāvīgajam auto vai vispirms 2–10 saviem auto un tikai tad biržā.",
    },
    {
      title: "Izvēle no piedāvājumiem",
      text: "Piedāvājumu var iesniegt ne vairāk kā trīs pārvadātāji. Redzat vērtējumus, zīmi „Pārbaudīts”, reisus, punktualitāti, tehniku un vadītāja valodas. Nekādas izsoles: cena ir tā, ko noteicāt paši.",
    },
    {
      title: "Sekošana soli pa solim",
      text: "Ierašanās, iekraušana, izkraušana un brīdinājumi par kavēšanos vienā skatā. Ziņas pārvadātājam un vadītājam tiek tulkotas – katrs lasa savā valodā.",
    },
    {
      title: "Galamērķī",
      text: "CMR pavadzīme un iekraušanas, izkraušanas un bojājumu foto reisa datos. Nedēļas atskaite par visiem reisiem, atskaites PDF, Excel un CSV formātā.",
    },
  ],
  featuresTitle: "Ko jūs iegūstat",
  features: [
    {
      title: "Piekabes, konteineri un ekspresa pārvadājumi",
      text: "Puspiekabju maiņa starp ostām, termināļiem un klientiem. Konteineru pārvadājumi – 20, 30, 40 un 45 pēdas, konteinera numurs tiek pārbaudīts. Ekspresa pārvadājumi ar furgonu vai kravas auto.",
    },
    {
      title: "Savi pastāvīgie auto",
      text: "Auto, kas jau ir braucis jums un kura pārvadātājs atļauj tiešos pasūtījumus, var pievienot pastāvīgajiem auto. Sūtiet reisu tieši tam vai vispirms piedāvājiet to saviem auto.",
    },
    {
      title: "Pasūtījumi pa e-pastu",
      text: "Uzņēmumam ir sava adrese, uz kuru var pārsūtīt klienta pasūtījuma vēstuli. Tekstu, PDF vai foto varat pievienot arī paši. No pasūtījuma top melnraksts – bez jums nekas netiek publicēts.",
    },
    {
      title: "Katrs savā valodā",
      text: "Reisa ziņas starp jums, pārvadātāju un vadītāju tiek tulkotas automātiski. Somu ekspeditors, igauņu pārvadātājs un poļu vadītājs saprot cits citu.",
    },
    {
      title: "Pārbaudīti pārvadātāji",
      text: "Katru pārvadātāju pārbauda pirms pirmā reisa: uzņēmumu reģistrs, pārvadājumu licence un apdrošināšana, un katru auto apstiprina atsevišķi. Zīme „Pārbaudīts” nozīmē, ka pasūtītāja atbildības izziņas ir derīgas.",
    },
    {
      title: "API un webhooks",
      text: "Pievienojiet savu TMS vai ERP: REST API un parakstīti webhooks, apraksts OpenAPI 3.1 formātā, atslēga vadības panelī. Bez maksas – ne mēneša maksas, ne maksas par pieprasījumu.",
    },
  ],
  priceTitle: "Cena",
  priceText:
    "Ekspeditoriem RAHTIS ir bez maksas: nav mēneša maksas, nav procentu no reisiem un nav maksas par API. Pārvadātājs izraksta rēķinu tieši jums par reisa cenu.",
  faqTitle: "Biežāk uzdotie jautājumi",
  faq: [
    {
      q: "Cik RAHTIS maksā ekspeditoram?",
      a: "Neko. Nav mēneša maksas, nav procentu no reisiem, un API ir bez maksas. Mēneša maksu maksā pārvadātāji par saviem auto, kas brauca.",
    },
    {
      q: "Ar ko tiek slēgts līgums?",
      a: "Tieši ar pārvadātāju, kas paņem reisu. Pārvadātājs izraksta rēķinu jums, un RAHTIS starpniecības komisiju neņem.",
    },
    {
      q: "Vai varu izmantot savus pārvadātājus?",
      a: "Jā. Auto, kas jums jau braukuši, var pievienot pastāvīgajiem, ja to pārvadātājs atļauj tiešos pasūtījumus. Reisu var nosūtīt tieši vienam auto vai vispirms 2–10 auto grupai un pēc tam uz kravu biržu.",
    },
    {
      q: "Kā tiek pārbaudīti uzņēmumi?",
      a: "Pārbaudīti tiek visi. Pārvadātājam – uzņēmumu reģistrs, pārvadājumu licence un apdrošināšana, un katru auto apstiprina cilvēks. Ekspeditoru pārbauda Somijas Komercreģistrā; ja uzņēmums tur automātiski netiek atrasts, pirms pirmās publicēšanas augšupielādē reģistra izrakstu un ekspeditora civiltiesiskās atbildības apdrošināšanu. Tā pārvadātājs zina, kam brauc.",
    },
    {
      q: "Ko darīt, ja neviens nepiedāvā vai auto atsakās?",
      a: "Ja izvēlētais pārvadātājs 15 minūšu laikā reisu neapstiprina vai atsakās, reiss atgriežas biržā un aiziet nākamajiem piemērotajiem auto. Ja piedāvājumu nav, saņemat paziņojumu un varat paaugstināt cenu vai nosūtīt reisu tieši pazīstamam auto.",
    },
    {
      q: "Vai RAHTIS var pievienot mūsu sistēmai?",
      a: "Var. Ar REST API veidojat reisus un sekojat tiem, un parakstīti webhooks paziņo par statusa izmaiņām. Apraksts OpenAPI 3.1 formātā ir API dokumentācijā, un atslēgu izveido vadības panelī.",
    },
  ],
  finalTitle: "Publicējiet pirmo reisu",
  finalText:
    "Reģistrējiet uzņēmumu, publicējiet reisu un izvēlieties no piedāvājumiem. Ekspeditoriem bez maksas.",
  teaserEyebrow: "Ekspeditoriem",
  teaserTitle: "Pārvadātāji jūsu kravām – bez maksas",
  teaserText:
    "Publicējiet piekabju maiņu, konteinerus un ekspresa pārvadājumus vienreiz, izvēlieties no pārbaudītu pārvadātāju piedāvājumiem un sekojiet reisam soli pa solim. Bez komisijas.",
  teaserCta: "Lasīt vairāk",
  footerLink: "RAHTIS ekspeditoriem",
  serviceType: "Kravu birža ekspeditoriem",
  features_ld: [
    "Piekabju maiņa, konteineru pārvadājumi (20–45 ft) un ekspresa pārvadājumi",
    "Publicēšana kravu biržā, tieši pastāvīgajam auto vai vispirms saviem auto",
    "Līdz trim piedāvājumiem, izvēle pēc vērtējumiem un tehnikas",
    "Pasūtījuma melnraksts no e-pasta, PDF vai foto",
    "Sekošana soli pa solim, CMR pavadzīme un foto",
    "Automātiski tulkota saziņa ar pārvadātāju un vadītāju",
    "Nedēļas atskaite",
    "Bezmaksas REST API un parakstīti webhooks",
  ],
};

const lt: LandingCopy = {
  metaTitle: "Ekspeditoriams: vežėjas kiekvienam kroviniui",
  metaDescription:
    "Paskelbkite priekabų keitimą, konteinerio ar skubų pervežimą kartą, rinkitės patikrinto vežėjo pasiūlymą ir sekite reisą etapais. Ekspeditoriui nemokama.",
  eyebrow: "RAHTIS ekspeditoriams",
  title: "Vežėjas kiekvienam kroviniui – nemokamai",
  lede: "Paskelbkite priekabų keitimą, konteinerio ar skubų pervežimą vieną kartą. Patvirtinti vežėjai teikia pasiūlymus, jūs pasirenkate mašiną ir sekate reisą etapais. Sutartis sudaroma tiesiogiai su vežėju, o RAHTIS tarpininkavimo mokesčio neima.",
  ctaApply: "Pateikti paraišką",
  ctaSignIn: "Prisijungti",
  dayTitle: "Kaip vyksta reisas",
  day: [
    {
      title: "Užsakymas gautas",
      text: "Įveskite reisą patys arba persiųskite kliento užsakymo laišką, PDF ar nuotrauką į RAHTIS platformą. Iš jo sukuriamas užsakymo juodraštis, kurį patikrinate prieš skelbdami.",
    },
    {
      title: "Paskelbimas vieną kartą",
      text: "Į krovinių biržą vežėjams, turintiems tinkamą patvirtintą mašiną, tiesiai jūsų nuolatinei mašinai arba pirma 2–10 savų mašinų ir tik tada į biržą.",
    },
    {
      title: "Pasirinkimas iš pasiūlymų",
      text: "Pasiūlymą gali pateikti ne daugiau kaip trys vežėjai. Matote įvertinimus, ženklą „Patikrintas“, reisus, punktualumą, transportą ir vairuotojo kalbas. Jokio aukciono: kaina ta, kurią nustatėte patys.",
    },
    {
      title: "Sekimas etapais",
      text: "Atvykimai, pakrovimas, iškrovimas ir vėlavimo įspėjimai viename lange. Žinutės vežėjui ir vairuotojui verčiamos – kiekvienas skaito savo kalba.",
    },
    {
      title: "Pristatyta",
      text: "CMR važtaraštis ir pakrovimo, iškrovimo bei pažeidimų nuotraukos reiso duomenyse. Savaitės ataskaita apie visus reisus, ataskaitos PDF, Excel ir CSV formatais.",
    },
  ],
  featuresTitle: "Ką gaunate",
  features: [
    {
      title: "Puspriekabės, konteineriai ir skubūs pervežimai",
      text: "Puspriekabių keitimas tarp uostų, terminalų ir klientų. Konteinerių pervežimai – 20, 30, 40 ir 45 pėdų, konteinerio numeris tikrinamas. Skubūs pervežimai furgonu ar sunkvežimiu.",
    },
    {
      title: "Savos nuolatinės mašinos",
      text: "Mašiną, kuri jau vežė jums ir kurios vežėjas leidžia tiesioginius užsakymus, galima įtraukti į nuolatines. Siųskite reisą tiesiai jai arba pirma pasiūlykite savoms mašinoms.",
    },
    {
      title: "Užsakymai el. paštu",
      text: "Įmonė turi savo adresą, kuriuo galima persiųsti kliento užsakymo laišką. Tekstą, PDF ar nuotrauką galite pridėti ir patys. Iš užsakymo sukuriamas juodraštis – be jūsų niekas neskelbiama.",
    },
    {
      title: "Kiekvienas savo kalba",
      text: "Reiso žinutės tarp jūsų, vežėjo ir vairuotojo verčiamos automatiškai. Suomių ekspeditorius, estų vežėjas ir lenkų vairuotojas supranta vienas kitą.",
    },
    {
      title: "Patikrinti vežėjai",
      text: "Kiekvienas vežėjas patikrinamas prieš pirmąjį reisą: įmonių registras, transporto licencija ir draudimas, o kiekviena mašina patvirtinama atskirai. Ženklas „Patikrintas“ rodo, kad užsakovo atsakomybės pažymos galioja.",
    },
    {
      title: "API ir webhook",
      text: "Prijunkite savo TMS ar ERP: REST API ir pasirašyti webhook, aprašas OpenAPI 3.1 formatu, raktas valdymo skydelyje. Nemokamai – jokio mėnesinio mokesčio ir jokios kainos už užklausą.",
    },
  ],
  priceTitle: "Kaina",
  priceText:
    "Ekspeditoriui RAHTIS nemokamas: jokio mėnesinio mokesčio, jokių procentų nuo reisų ir jokio mokesčio už API. Vežėjas sąskaitą jums išrašo tiesiogiai pagal reiso kainą.",
  faqTitle: "Dažni klausimai",
  faq: [
    {
      q: "Kiek RAHTIS kainuoja ekspeditoriui?",
      a: "Nieko. Jokio mėnesinio mokesčio, jokių procentų nuo reisų, o API nemokama. Mėnesinį mokestį moka vežėjai už savo mašinas, kurios važiavo.",
    },
    {
      q: "Su kuo sudaroma sutartis?",
      a: "Tiesiogiai su vežėju, kuris paima reisą. Vežėjas išrašo jums sąskaitą, o RAHTIS tarpininkavimo mokesčio neima.",
    },
    {
      q: "Ar galiu naudotis savo vežėjais?",
      a: "Taip. Jums vežusias mašinas galima įtraukti į nuolatines, jei jų vežėjas leidžia tiesioginius užsakymus. Reisą galima siųsti tiesiai vienai mašinai arba pirma 2–10 mašinų grupei ir tada į krovinių biržą.",
    },
    {
      q: "Kaip tikrinamos įmonės?",
      a: "Tikrinami visi. Vežėjo – įmonių registras, transporto licencija ir draudimas, o kiekvieną mašiną patvirtina žmogus. Ekspeditorius tikrinamas Suomijos prekybos registre; jei įmonė ten automatiškai nerandama, prieš pirmą paskelbimą įkeliamas registro išrašas ir ekspeditoriaus civilinės atsakomybės draudimas. Taip vežėjas žino, kam veža.",
    },
    {
      q: "O jei niekas nepasiūlo arba mašina atsisako?",
      a: "Jei pasirinktas vežėjas per 15 minučių reiso nepatvirtina arba jo atsisako, reisas grįžta į biržą ir keliauja kitoms tinkamoms mašinoms. Jei pasiūlymų negaunate, gausite pranešimą ir galėsite pakelti kainą arba siųsti reisą tiesiai pažįstamai mašinai.",
    },
    {
      q: "Ar RAHTIS galima prijungti prie mūsų sistemos?",
      a: "Galima. Per REST API kuriate ir sekate reisus, o pasirašyti webhook informuoja apie būsenos pokyčius. Aprašas OpenAPI 3.1 formatu pateiktas API dokumentacijoje, o raktas sukuriamas valdymo skydelyje.",
    },
  ],
  finalTitle: "Paskelbkite pirmą reisą",
  finalText:
    "Užregistruokite įmonę, paskelbkite reisą ir rinkitės iš pasiūlymų. Ekspeditoriui nemokamai.",
  teaserEyebrow: "Ekspeditoriams",
  teaserTitle: "Vežėjai jūsų kroviniams – nemokamai",
  teaserText:
    "Paskelbkite priekabų keitimus, konteinerius ir skubius pervežimus vieną kartą, rinkitės iš patikrintų vežėjų pasiūlymų ir sekite reisą etapais. Be tarpininkavimo mokesčio.",
  teaserCta: "Skaityti daugiau",
  footerLink: "RAHTIS ekspeditoriams",
  serviceType: "Krovinių birža ekspeditoriams",
  features_ld: [
    "Priekabų keitimas, konteinerių pervežimai (20–45 ft) ir skubūs pervežimai",
    "Paskelbimas krovinių biržoje, tiesiai nuolatinei mašinai arba pirma savoms mašinoms",
    "Iki trijų pasiūlymų, pasirinkimas pagal įvertinimus ir transportą",
    "Užsakymo juodraštis iš el. laiško, PDF ar nuotraukos",
    "Sekimas etapais, CMR važtaraštis ir nuotraukos",
    "Automatiškai verčiamas bendravimas su vežėju ir vairuotoju",
    "Savaitės ataskaita",
    "Nemokama REST API ir pasirašyti webhook",
  ],
};

const pl: LandingCopy = {
  metaTitle: "Dla spedytorów: przewoźnik do każdego ładunku",
  metaDescription:
    "Opublikuj raz wymianę naczep, kontener lub przewóz ekspresowy, wybierz ofertę sprawdzonego przewoźnika i śledź przewóz krok po kroku. Bezpłatnie.",
  eyebrow: "RAHTIS dla spedytorów",
  title: "Przewoźnik do każdego ładunku – bezpłatnie",
  lede: "Opublikuj raz wymianę naczep, przewóz kontenera lub przewóz ekspresowy. Zatwierdzeni przewoźnicy składają oferty, a Ty wybierasz pojazd i śledzisz przewóz krok po kroku. Umowę zawierasz bezpośrednio z przewoźnikiem, a RAHTIS nie pobiera prowizji.",
  ctaApply: "Dołącz",
  ctaSignIn: "Zaloguj się",
  dayTitle: "Tak przebiega przewóz",
  day: [
    {
      title: "Zlecenie wpływa",
      text: "Wpisz przewóz albo prześlij do RAHTIS e-mail klienta ze zleceniem, PDF lub zdjęcie. Powstaje z tego szkic zlecenia, który sprawdzasz przed publikacją.",
    },
    {
      title: "Publikacja raz",
      text: "Na giełdę ładunków dla przewoźników, którzy mają odpowiedni zatwierdzony pojazd, bezpośrednio do Twojego stałego pojazdu albo najpierw do 2–10 własnych pojazdów, a dopiero potem na giełdę.",
    },
    {
      title: "Wybór oferty",
      text: "Ofertę może złożyć najwyżej trzech przewoźników. Widzisz oceny, odznakę „Zweryfikowany”, liczbę przewozów, punktualność, pojazd i języki kierowcy. Bez licytacji: obowiązuje cena, którą ustalasz Ty.",
    },
    {
      title: "Śledzenie krok po kroku",
      text: "Przyjazdy, załadunek, rozładunek i alerty o opóźnieniach w jednym widoku. Wiadomości do przewoźnika i kierowcy są tłumaczone – każdy czyta we własnym języku.",
    },
    {
      title: "Na miejscu",
      text: "List przewozowy CMR oraz zdjęcia z załadunku, rozładunku i uszkodzeń w szczegółach przewozu. Raport tygodniowy ze wszystkich przewozów, a raporty w formatach PDF, Excel i CSV.",
    },
  ],
  featuresTitle: "Co dostajesz",
  features: [
    {
      title: "Naczepy, kontenery i przewozy ekspresowe",
      text: "Wymiany naczep między portami, terminalami i klientami. Przewozy kontenerów 20, 30, 40 i 45 stóp ze sprawdzaniem numeru kontenera. Przewozy ekspresowe busem lub ciężarówką.",
    },
    {
      title: "Własne stałe pojazdy",
      text: "Pojazd, który już jeździł dla Ciebie i którego przewoźnik dopuszcza zlecenia bezpośrednie, możesz dodać do stałych pojazdów. Wyślij przewóz bezpośrednio do niego albo zaproponuj go najpierw własnym pojazdom.",
    },
    {
      title: "Zlecenia z e-maila",
      text: "Firma ma własny adres, na który można przesyłać e-maile klientów ze zleceniami. Możesz też samodzielnie wkleić tekst albo dołączyć PDF lub zdjęcie. Ze zlecenia powstaje szkic – bez Ciebie nic nie zostanie opublikowane.",
    },
    {
      title: "Każdy we własnym języku",
      text: "Wiadomości dotyczące przewozu między Tobą, przewoźnikiem i kierowcą są tłumaczone automatycznie. Fiński spedytor, estoński przewoźnik i polski kierowca rozumieją się nawzajem.",
    },
    {
      title: "Sprawdzeni przewoźnicy",
      text: "Każdego przewoźnika sprawdzamy przed pierwszym przewozem: rejestr przedsiębiorców, licencja transportowa i ubezpieczenie, a każdy pojazd jest zatwierdzany osobno. Odznaka „Zweryfikowany” oznacza, że fińskie raporty odpowiedzialności zamawiającego (tilaajavastuu) są aktualne.",
    },
    {
      title: "API i webhooki",
      text: "Podłącz własny TMS lub ERP: REST API i podpisane webhooki, opis w formacie OpenAPI 3.1, klucz w panelu administracyjnym. Bezpłatnie – bez abonamentu i bez opłat za wywołanie.",
    },
  ],
  priceTitle: "Cena",
  priceText:
    "Dla spedytora RAHTIS jest bezpłatny: bez abonamentu, bez procentu od przewozów i bez opłat za API. Przewoźnik wystawia Ci fakturę bezpośrednio na cenę przewozu.",
  faqTitle: "Częste pytania",
  faq: [
    {
      q: "Ile RAHTIS kosztuje spedytora?",
      a: "Nic. Bez abonamentu, bez procentu od przewozów, a API jest bezpłatne. Abonament płacą przewoźnicy – za pojazdy, które jeździły.",
    },
    {
      q: "Z kim zawieram umowę?",
      a: "Bezpośrednio z przewoźnikiem, który przyjmuje przewóz. Przewoźnik wystawia Ci fakturę, a RAHTIS nie pobiera prowizji.",
    },
    {
      q: "Czy mogę korzystać z własnych przewoźników?",
      a: "Tak. Pojazdy, które jeździły dla Ciebie, możesz dodać do stałych, jeśli ich przewoźnik dopuszcza zlecenia bezpośrednie. Przewóz możesz wysłać bezpośrednio do jednego pojazdu albo najpierw do grupy 2–10 pojazdów, a potem na giełdę ładunków.",
    },
    {
      q: "Jak sprawdzani są uczestnicy?",
      a: "Sprawdzamy wszystkich. U przewoźnika: rejestr przedsiębiorców, licencja transportowa i ubezpieczenie, a każdy pojazd zatwierdza człowiek. Spedytora sprawdzamy w fińskim rejestrze handlowym; jeśli firmy nie da się tam znaleźć automatycznie, przed pierwszą publikacją przesyła się odpis z rejestru i polisę OC spedytora. Dzięki temu przewoźnik wie, dla kogo jedzie.",
    },
    {
      q: "A jeśli nikt nie złoży oferty albo pojazd zrezygnuje?",
      a: "Jeśli wybrany przewoźnik nie potwierdzi przewozu w ciągu 15 minut albo go anuluje, przewóz wraca na giełdę i trafia do kolejnych pasujących pojazdów. Jeśli nie ma ofert, dostajesz powiadomienie i możesz podnieść cenę albo wysłać przewóz bezpośrednio do znanego Ci pojazdu.",
    },
    {
      q: "Czy można podłączyć RAHTIS do własnego systemu?",
      a: "Tak. Przez REST API tworzysz i śledzisz przewozy, a podpisane webhooki informują o zmianach statusu. Opis w formacie OpenAPI 3.1 znajdziesz w dokumentacji API, a klucz tworzy się w panelu administracyjnym.",
    },
  ],
  finalTitle: "Opublikuj pierwszy przewóz",
  finalText:
    "Zarejestruj firmę, opublikuj przewóz i wybierz spośród ofert. Dla spedytora bezpłatnie.",
  teaserEyebrow: "Dla spedytorów",
  teaserTitle: "Przewoźnicy do Twoich ładunków – bezpłatnie",
  teaserText:
    "Opublikuj raz wymiany naczep, kontenery i przewozy ekspresowe, wybierz spośród ofert sprawdzonych przewoźników i śledź przewóz krok po kroku. Bez prowizji.",
  teaserCta: "Czytaj więcej",
  footerLink: "RAHTIS dla spedytorów",
  serviceType: "Giełda ładunków dla spedytorów",
  features_ld: [
    "Wymiany naczep, przewozy kontenerów (20–45 ft) i przewozy ekspresowe",
    "Publikacja na giełdzie ładunków, bezpośrednio do stałego pojazdu lub najpierw do własnych pojazdów",
    "Najwyżej trzy oferty, wybór według ocen i pojazdu",
    "Szkic zlecenia z e-maila, PDF lub zdjęcia",
    "Śledzenie krok po kroku, list przewozowy CMR i zdjęcia",
    "Automatycznie tłumaczone wiadomości z przewoźnikiem i kierowcą",
    "Raport tygodniowy",
    "Bezpłatne REST API i podpisane webhooki",
  ],
};

const de: LandingCopy = {
  metaTitle: "Für Spediteure: ein Transportunternehmen für jede Ladung",
  metaDescription:
    "Trailertausch, Container oder Expressfahrt einmal einstellen, geprüftes Transportunternehmen wählen, Schritt für Schritt verfolgen. Für Spediteure gratis.",
  eyebrow: "RAHTIS für Spediteure",
  title: "Ein Transportunternehmen für jede Ladung – kostenlos",
  lede: "Stellen Sie einen Trailertausch, einen Containertransport oder eine Expressfahrt einmal ein. Freigegebene Transportunternehmen geben Angebote ab, Sie wählen das Fahrzeug und verfolgen den Auftrag Schritt für Schritt. Der Vertrag kommt direkt mit dem Transportunternehmen zustande, und RAHTIS nimmt keine Vermittlungsprovision.",
  ctaApply: "Jetzt registrieren",
  ctaSignIn: "Anmelden",
  dayTitle: "So läuft ein Auftrag",
  day: [
    {
      title: "Auftrag kommt rein",
      text: "Tippen Sie den Auftrag ein oder leiten Sie die Auftrags-E-Mail, das PDF oder das Foto Ihres Kunden an RAHTIS weiter. Daraus wird ein Auftragsentwurf, den Sie vor der Veröffentlichung prüfen.",
    },
    {
      title: "Einmal veröffentlichen",
      text: "In die Frachtenbörse für Transportunternehmen mit passendem freigegebenem Fahrzeug, direkt an eines Ihrer Stammfahrzeuge oder zuerst an 2–10 eigene Fahrzeuge und erst dann in die Börse.",
    },
    {
      title: "Angebot wählen",
      text: "Bis zu drei Transportunternehmen können ein Angebot abgeben. Sie sehen Bewertungen, das Siegel „Geprüft“, gefahrene Aufträge, Pünktlichkeit, das Fahrzeug und die Sprachen des Fahrers. Keine Auktion: Es gilt der Preis, den Sie selbst festgelegt haben.",
    },
    {
      title: "Schritt für Schritt verfolgen",
      text: "Ankünfte, Beladung, Entladung und Verspätungswarnungen in einer Ansicht. Nachrichten an Transportunternehmen und Fahrer werden übersetzt – jeder liest in seiner eigenen Sprache.",
    },
    {
      title: "Zugestellt",
      text: "Frachtbrief (CMR) sowie Fotos von Beladung, Entladung und Schäden direkt im Auftrag. Ein Wochenbericht über alle Aufträge, Berichte als PDF, Excel und CSV.",
    },
  ],
  featuresTitle: "Was Sie bekommen",
  features: [
    {
      title: "Trailertausch, Container, Express",
      text: "Tausch von Sattelaufliegern zwischen Häfen, Terminals und Kunden. Containertransporte mit 20, 30, 40 und 45 Fuß, die Containernummer wird geprüft. Expressfahrten mit Transporter oder Lkw.",
    },
    {
      title: "Ihre Stammfahrzeuge",
      text: "Ein Fahrzeug, das schon für Sie gefahren ist und dessen Transportunternehmen Direktaufträge erlaubt, können Sie zu Ihren Stammfahrzeugen hinzufügen. Schicken Sie den Auftrag direkt dorthin oder bieten Sie ihn zuerst Ihren eigenen Fahrzeugen an.",
    },
    {
      title: "Aufträge per E-Mail",
      text: "Ihr Unternehmen bekommt eine eigene Adresse, an die Sie Auftrags-E-Mails Ihrer Kunden weiterleiten. Text, PDF oder Foto können Sie auch selbst einfügen. Aus dem Auftrag wird ein Entwurf – nichts wird ohne Sie veröffentlicht.",
    },
    {
      title: "Jeder in seiner Sprache",
      text: "Nachrichten zum Auftrag zwischen Ihnen, dem Transportunternehmen und dem Fahrer werden automatisch übersetzt. Ein finnischer Spediteur, ein estnisches Transportunternehmen und ein polnischer Fahrer verstehen einander.",
    },
    {
      title: "Geprüfte Transportunternehmen",
      text: "Jedes Transportunternehmen wird vor dem ersten Auftrag geprüft: Unternehmensregister, Güterkraftverkehrserlaubnis und Versicherung, und jedes Fahrzeug wird einzeln freigegeben. Das Siegel „Geprüft“ zeigt, dass die finnischen Nachweise zur Auftraggeberhaftung (tilaajavastuu) gültig sind.",
    },
    {
      title: "API und Webhooks",
      text: "Binden Sie Ihr TMS oder ERP an: REST-API und signierte Webhooks, beschrieben in OpenAPI 3.1, Schlüssel aus Ihrem Dashboard. Kostenlos – keine Monatsgebühr und kein Preis pro Abruf.",
    },
  ],
  priceTitle: "Preis",
  priceText:
    "Für Spediteure ist RAHTIS kostenlos: keine Monatsgebühr, keine Prozente auf Aufträge und keine Gebühr für die API. Das Transportunternehmen stellt Ihnen den Auftragspreis direkt in Rechnung.",
  faqTitle: "Häufige Fragen",
  faq: [
    {
      q: "Was kostet RAHTIS einen Spediteur?",
      a: "Nichts. Keine Monatsgebühr, keine Prozente auf Aufträge, und die API ist kostenlos. Die Monatsgebühr zahlen die Transportunternehmen für ihre Fahrzeuge, die gefahren sind.",
    },
    {
      q: "Mit wem kommt der Vertrag zustande?",
      a: "Direkt mit dem Transportunternehmen, das den Auftrag übernimmt. Es stellt Ihnen die Rechnung, und RAHTIS nimmt keine Vermittlungsprovision.",
    },
    {
      q: "Kann ich meine eigenen Transportunternehmen einsetzen?",
      a: "Ja. Fahrzeuge, die für Sie gefahren sind, können Sie zu Ihren Stammfahrzeugen hinzufügen, wenn ihr Transportunternehmen Direktaufträge erlaubt. Den Auftrag schicken Sie direkt an ein Fahrzeug oder zuerst an eine Gruppe von 2–10 Fahrzeugen und dann in die Frachtenbörse.",
    },
    {
      q: "Wie werden die Beteiligten geprüft?",
      a: "Alle Beteiligten werden geprüft. Bei Transportunternehmen Unternehmensregister, Güterkraftverkehrserlaubnis und Versicherung, und jedes Fahrzeug wird von Hand freigegeben. Spediteure werden im finnischen Handelsregister geprüft; wird das Unternehmen dort nicht automatisch gefunden, werden vor der ersten Veröffentlichung ein Registerauszug und die Verkehrshaftungsversicherung des Spediteurs hochgeladen. So weiß das Transportunternehmen, für wen es fährt.",
    },
    {
      q: "Und wenn niemand ein Angebot abgibt oder ein Fahrzeug absagt?",
      a: "Bestätigt das gewählte Transportunternehmen den Auftrag nicht innerhalb von 15 Minuten oder sagt es ab, geht der Auftrag zurück in die Börse und an die nächsten passenden Fahrzeuge. Kommen keine Angebote, werden Sie benachrichtigt und können den Preis erhöhen oder den Auftrag direkt an ein bekanntes Fahrzeug schicken.",
    },
    {
      q: "Lässt sich RAHTIS an unser eigenes System anbinden?",
      a: "Ja. Über die REST-API legen Sie Aufträge an und verfolgen sie, und signierte Webhooks melden Statusänderungen. Die Beschreibung im Format OpenAPI 3.1 finden Sie in der API-Dokumentation, den Schlüssel erstellen Sie im Dashboard.",
    },
  ],
  finalTitle: "Veröffentlichen Sie Ihren ersten Auftrag",
  finalText:
    "Registrieren Sie Ihr Unternehmen, veröffentlichen Sie einen Auftrag und wählen Sie aus den Angeboten. Für Spediteure kostenlos.",
  teaserEyebrow: "Für Spediteure",
  teaserTitle: "Transportunternehmen für Ihre Ladungen – kostenlos",
  teaserText:
    "Trailertausch, Container und Expressfahrten einmal einstellen, aus Angeboten geprüfter Transportunternehmen wählen und jeden Auftrag Schritt für Schritt verfolgen. Keine Vermittlungsprovision.",
  teaserCta: "Mehr erfahren",
  footerLink: "RAHTIS für Spediteure",
  serviceType: "Frachtenbörse für Spediteure",
  features_ld: [
    "Trailertausch, Containertransporte (20–45 Fuß) und Expressfahrten",
    "Veröffentlichung in der Frachtenbörse, direkt an ein Stammfahrzeug oder zuerst an eigene Fahrzeuge",
    "Bis zu drei Angebote, Auswahl nach Bewertungen und Fahrzeug",
    "Auftragsentwurf aus E-Mail, PDF oder Foto",
    "Tracking Schritt für Schritt, Frachtbrief (CMR) und Fotos",
    "Automatisch übersetzte Nachrichten mit Transportunternehmen und Fahrer",
    "Wochenbericht",
    "Kostenlose REST-API und signierte Webhooks",
  ],
};

const ru: LandingCopy = {
  metaTitle: "Для экспедиторов: перевозчик под каждый груз",
  metaDescription:
    "Опубликуйте перецепку, контейнер или срочный рейс один раз, выберите проверенного перевозчика и следите за рейсом по этапам. Экспедитору бесплатно.",
  eyebrow: "RAHTIS для экспедиторов",
  title: "Перевозчик под каждый груз — бесплатно",
  lede: "Опубликуйте перецепку полуприцепа, контейнерную или срочную перевозку один раз. Одобренные перевозчики присылают предложения, вы выбираете машину и следите за рейсом по этапам. Договор заключается напрямую с перевозчиком, RAHTIS не берёт комиссию.",
  ctaApply: "Подключиться",
  ctaSignIn: "Войти",
  dayTitle: "Как проходит рейс",
  day: [
    {
      title: "Заказ поступает",
      text: "Введите рейс вручную или перешлите в RAHTIS письмо клиента с заказом, PDF или фото. Из него получается черновик заказа, который вы проверяете перед публикацией.",
    },
    {
      title: "Публикация один раз",
      text: "На биржу — перевозчикам с подходящей одобренной машиной, напрямую вашей постоянной машине или сначала 2–10 своим машинам и только потом на биржу.",
    },
    {
      title: "Выбор предложения",
      text: "Предложение могут сделать не более трёх перевозчиков. Вы видите оценки, значок «Проверен», число рейсов, пунктуальность, машину и языки водителя. Никаких торгов: цена — та, которую вы назначили сами.",
    },
    {
      title: "Контроль по этапам",
      text: "Прибытия, погрузка, выгрузка и оповещения о задержках в одном окне. Сообщения перевозчику и водителю переводятся — каждый читает на своём языке.",
    },
    {
      title: "Доставлено",
      text: "Накладная CMR и фото погрузки, выгрузки и повреждений — в карточке рейса. Недельный отчёт по всем рейсам, отчёты в PDF, Excel и CSV.",
    },
  ],
  featuresTitle: "Что вы получаете",
  features: [
    {
      title: "Полуприцепы, контейнеры и срочные перевозки",
      text: "Перецепка полуприцепов между портами, терминалами и клиентами. Контейнерные перевозки 20, 30, 40 и 45 футов с проверкой номера контейнера. Срочные перевозки фургоном или грузовиком.",
    },
    {
      title: "Свои постоянные машины",
      text: "Машину, которая уже возила ваши грузы и чей перевозчик разрешает прямые заказы, можно добавить в постоянные. Отправьте рейс прямо ей или сначала предложите своим машинам.",
    },
    {
      title: "Заказы по почте",
      text: "У компании есть свой адрес, на который можно пересылать письма клиентов с заказами. Текст, PDF или фото можно добавить и самостоятельно. Из заказа получается черновик — без вас ничего не публикуется.",
    },
    {
      title: "Каждый на своём языке",
      text: "Сообщения по рейсу между вами, перевозчиком и водителем переводятся автоматически. Финский экспедитор, эстонский перевозчик и польский водитель понимают друг друга.",
    },
    {
      title: "Проверенные перевозчики",
      text: "Каждого перевозчика проверяют до первого рейса: реестр компаний, лицензия на перевозки и страховка, а каждая машина одобряется отдельно. Значок «Проверен» означает, что финские справки по ответственности заказчика (tilaajavastuu) действительны.",
    },
    {
      title: "API и вебхуки",
      text: "Подключите свою TMS или ERP: REST API и подписанные вебхуки, описание в формате OpenAPI 3.1, ключ — в панели управления. Бесплатно: ни абонентской платы, ни оплаты за запросы.",
    },
  ],
  priceTitle: "Цена",
  priceText:
    "Для экспедитора RAHTIS бесплатен: ни абонентской платы, ни процента с рейсов, ни платы за API. Перевозчик выставляет вам счёт напрямую по цене рейса.",
  faqTitle: "Вопросы и ответы",
  faq: [
    {
      q: "Сколько RAHTIS стоит экспедитору?",
      a: "Нисколько. Ни абонентской платы, ни процента с рейсов, API тоже бесплатен. Абонентскую плату вносят перевозчики — за машины, которые работали.",
    },
    {
      q: "С кем заключается договор?",
      a: "Напрямую с перевозчиком, который берёт рейс. Перевозчик выставляет вам счёт, RAHTIS не берёт комиссию.",
    },
    {
      q: "Можно ли работать со своими перевозчиками?",
      a: "Да. Машины, которые уже возили ваши грузы, можно добавить в постоянные, если их перевозчик разрешает прямые заказы. Рейс можно отправить прямо одной машине или сначала группе из 2–10 машин, а затем на биржу.",
    },
    {
      q: "Как проверяют участников?",
      a: "Проверяют всех. У перевозчика — реестр компаний, лицензия на перевозки и страховка, а каждую машину одобряет человек. Экспедитора проверяют по финскому торговому реестру; если компания не находится там автоматически, до первой публикации загружаются выписка из реестра и полис страхования ответственности экспедитора. Так перевозчик знает, на кого работает.",
    },
    {
      q: "А если предложений нет или машина отказалась?",
      a: "Если выбранный перевозчик не подтвердит рейс в течение 15 минут или отменит его, рейс возвращается на биржу и уходит следующим подходящим машинам. Если предложений нет, вы получаете уведомление и можете поднять цену или отправить рейс напрямую знакомой машине.",
    },
    {
      q: "Можно ли подключить RAHTIS к своей системе?",
      a: "Да. Через REST API вы создаёте рейсы и следите за ними, а подписанные вебхуки сообщают об изменениях статуса. Описание в формате OpenAPI 3.1 — в документации API, ключ создаётся в панели управления.",
    },
  ],
  finalTitle: "Опубликуйте первый рейс",
  finalText:
    "Зарегистрируйте компанию, опубликуйте рейс и выберите предложение. Для экспедитора бесплатно.",
  teaserEyebrow: "Для экспедиторов",
  teaserTitle: "Перевозчики для ваших грузов — бесплатно",
  teaserText:
    "Публикуйте перецепку полуприцепов, контейнеры и срочные перевозки один раз, выбирайте из предложений проверенных перевозчиков и следите за рейсом по этапам. Без комиссии.",
  teaserCta: "Подробнее",
  footerLink: "RAHTIS для экспедиторов",
  serviceType: "Биржа грузов для экспедиторов",
  features_ld: [
    "Перецепка полуприцепов, контейнерные перевозки (20–45 футов) и срочные перевозки",
    "Публикация на биржу, напрямую постоянной машине или сначала своим машинам",
    "Не более трёх предложений, выбор по оценкам и машине",
    "Черновик заказа из письма, PDF или фото",
    "Контроль по этапам, накладная CMR и фото",
    "Автоматический перевод сообщений с перевозчиком и водителем",
    "Недельный отчёт",
    "Бесплатный REST API и подписанные вебхуки",
  ],
};

/* Остальные языки — перевод с финского (смысл) и английского (помощь). */
export const FORWARDERS: Record<Locale, LandingCopy> = {
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
export const forwardersPath = (locale: Locale) =>
  `/${locale}/${locale === "fi" ? "huolitsijoille" : "forwarders"}`;

/** Фото баннера — оно же картинка превью (og:image). */
export const FORWARDERS_PHOTO = {
  url: "/media/huolinta-hero.webp",
  width: 1456,
  height: 816,
} as const;

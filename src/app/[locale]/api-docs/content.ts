import type { Locale } from '@/lib/i18n';

/**
 * Тексты документации API. Примеры кода — общие для обоих языков (они в
 * page.tsx), здесь только слова. Факты следуют за кодом: лимиты — как в
 * handler.ts, повторы — как в api_webhook_report, поля — как в openapi.ts.
 */

type Section = { title: string; paragraphs: string[] };

type DocsText = {
  title: string;
  description: string;
  intro: string;
  openapi: string;
  cabinet: string;
  start: Section;
  access: Section;
  lifecycle: Section;
  statuses: Record<string, string>;
  types: Section;
  typeRows: Record<string, string>;
  roles: Record<string, string>;
  roleHeader: string;
  statusHeader: string;
  typeHeader: string;
  sync: Section;
  details: Section;
  create: Section;
  withdraw: Section;
  trip: Section;
  offers: Section;
  amend: Section;
  claims: Section;
  webhooks: Section;
  verify: Section;
  errors: Section;
  errorCodes: Record<string, string>;
  claimKinds: Record<string, string>;
  limits: Section;
  changes: Section;
  eventHeader: string;
  whenHeader: string;
  codeHeader: string;
  meaningHeader: string;
};

const fi: DocsText = {
  title: 'API-dokumentaatio',
  description: 'RAHTIS-rajapinta tilaajille: tilausten luku ja luonti omasta järjestelmästä sekä tapahtumailmoitukset (webhook).',
  intro:
    'Rajapinnalla tilaaja hoitaa tilauksen koko elinkaaren omasta toiminnanohjauksestaan: luo tilauksen, valitsee tarjouksen tai määrää tutun auton, seuraa ajoa saapumisineen, kuittauksineen ja kuvineen, muuttaa reittiä ajon aikana, arvioi kuljetusliikkeen, hoitaa reklamaatiot ja saa ilmoituksen omaan osoitteeseensa, kun jotain muuttuu. Vastaukset ja virhekoodit ovat englanniksi, jotta ohjelma voi haarautua niiden mukaan.',
  openapi: 'Koneluettava kuvaus (OpenAPI 3.1) Postmaniin, Insomniaan tai asiakasgeneraattoriin:',
  cabinet: 'Avaimet ja webhookit luodaan kabinetissa, välilehdellä API.',
  start: {
    title: 'Aloitus',
    paragraphs: [
      'Luo avain kabinetissa. Avain näytetään vain kerran — tallenna se salaisuuksien hallintaan. Lukuavain riittää tilausten seurantaan; kaikkiin muutoksiin (luonti, valinta, määrääminen, reittimuutokset, arvio, reklamaatiot) tarvitaan kirjoitusoikeus.',
      'Testiyrityksen avain alkaa rhs_test_ ja näkee vain testiympäristön tilaukset; vastauksissa on silloin otsake Rahtis-Environment: test. Oikean yrityksen avain alkaa rhs_live_.',
      'Avain annetaan jokaisessa pyynnössä otsakkeessa Authorization: Bearer.',
    ],
  },
  access: {
    title: 'Pääsy ja testiympäristö',
    paragraphs: [
      'Rajapintaa käyttää hyväksytty tilaajayritys: hae mukaan sivulla rahtis.eu/fi/apply, ja kun yritys on hyväksytty ja tiedot täytetty, avaimet luodaan kabinetin API-välilehdellä. Rajapinnan käyttö on maksutonta.',
      'Testiympäristön (rhs_test_-avain, testiyritys, testikuljetusliikkeet ja -autot) saat pyytämällä osoitteesta admin@rahtis.eu. Testitilaukset eivät näy oikeille kuljetusliikkeille eivätkä mene laskulle.',
      'Ajat: rajapinnan aikaleimat (created_at, arrival.at, eta.at …) ovat UTC-aikaa ISO 8601 -muodossa. Reittipisteen scheduled_date ja scheduled_time ovat paikallista aikaa pisteen maassa (Suomi, Ruotsi, Norja, Tanska) — sama, jonka kuljettaja näkee.',
      'Rahat: kaikki summat ovat euroina ilman arvonlisäveroa (vat_included: false). Arvonlisävero lisätään laskulla maan mukaan.',
    ],
  },
  lifecycle: {
    title: 'Tilauksen tilat',
    paragraphs: [
      'Tilaus kulkee tilasta toiseen alla olevassa järjestyksessä. Jokaisesta muutoksesta tulee webhook (order.taken, order.started, order.reopened, order.closed, order.cancelled), ja muutoksen näkee myös GET /orders/{ref}/events.',
      'deadline_at on päätöksen määräaika: tilaajalla on 15 minuuttia valita tarjous ensimmäisestä tarjouksesta, ja valitulla kuljetusliikkeellä 15 minuuttia vahvistaa. Jos määräaika umpeutuu, tilaus palaa tilaan OPEN. Suoralla määräyksellä (POST /orders/{ref}/assign) määräaikaa ei ole: tilaus odottaa auton vahvistusta.',
    ],
  },
  statuses: {
    OPEN: 'tarjouspöydällä, odottaa tarjouksia (enintään kolme)',
    REQUESTED: 'tarjouksia on tullut — valitse yksi (POST …/offers/{id}/choose) deadline_at mennessä',
    AWAIT_DRIVER: 'auto on valittu tai määrätty, odottaa kuljetusliikkeen tai kuljettajan vahvistusta',
    IN_PROGRESS: 'vahvistettu, ajo käynnissä: reittipisteitä kuitataan',
    DONE: 'ajo päättynyt: maksut ja odotusaikalisä on kirjattu, asiakirjat saatavilla',
    CANCELLED: 'peruttu (POST …/withdraw tai kabinetista)',
    DRAFT: 'luonnos kabinetissa, ei julkaistu — rajapinnan kautta luotu tilaus julkaistaan heti',
  },
  types: {
    title: 'Tilaustyypit ja reittipisteet',
    paragraphs: [
      'haul_kind kertoo, mitä kuljetetaan: TRAILER (puoliperävaunu), CONTAINER (kontti; container_feet pakollinen) — näissä kuljetusyksikkö on numeroitu, ja trailer_plate (perävaunun rekisterinumero tai ISO 6346 -konttinumero) on pakollinen. VAN ja TRUCK ovat pikakuljetuksia autossa: ldm (lastausmetrit) ja vähintään yhden pisteen cargo_weight_kg ovat pakollisia.',
      'Pisteet annetaan ajojärjestyksessä (2–20). Jokaisessa tilauksessa on yksi PICKUP. Alla, mitä kukin tyyppi vaatii; puuttuvasta pisteestä tulee 422 ja selitys kentässä details.',
      'Lähetä kontrakti kentässä contract: RAHTIS (oletus) — RAHTIS-palvelu, palvelumaksu 5 % hinnasta, vähintään 15 € keikalta yhdessä kuljetusliikkeen maksun kanssa; DIRECT — suora sopimus kuukausimaksua käyttävän kuljetusliikkeen kanssa, ei palvelumaksua, ja tilauksen näkevät vain tällaiset kuljetusliikkeet. Kenttä contract näkyy myös tilauksen tiedoissa.',
    ],
  },
  typeRows: {
    'TRAILER_SWAP (TRAILER, CONTAINER)': 'Perävaunun tai kontin vaihto: PICKUP (yksikön nouto) → vähintään yksi DELIVERY, EXTRA_LOAD tai EXTRA_UNLOAD → TRAILER_RETURN (mihin yksikkö jätetään).',
    'ONE_WAY (TRAILER, CONTAINER)': 'Yksikkö noudetaan ja viedään perille: PICKUP → vähintään yksi DELIVERY, EXTRA_LOAD tai EXTRA_UNLOAD; TRAILER_RETURN ei pakollinen.',
    'ROUND_TRIP (TRAILER, CONTAINER)': 'Kuten ONE_WAY, mutta yksikkö palaa lähtöpaikkaan — lisää loppuun TRAILER_RETURN.',
    'ONE_WAY (VAN, TRUCK)': 'Pikakuljetus: PICKUP (lastaus) → DELIVERY (purku), välissä EXTRA_LOAD / EXTRA_UNLOAD tarvittaessa. order_type on aina ONE_WAY.',
  },
  roles: {
    PICKUP: 'nouto: yksikön nouto tai tavaran lastaus — aina ensimmäinen',
    DELIVERY: 'purku vastaanottajalle; company_name pakollinen',
    EXTRA_LOAD: 'lisälastaus matkalla; consignee kertoo, kenelle lisäkuorma on',
    EXTRA_UNLOAD: 'lisäpurku matkalla',
    TRAILER_RETURN: 'tyhjän tai lastatun yksikön jättöpaikka (trailer_loaded kertoo kumpi)',
  },
  roleHeader: 'Rooli',
  statusHeader: 'Tila',
  typeHeader: 'Tyyppi',
  sync: {
    title: 'Tilausten synkronointi',
    paragraphs: [
      'GET /orders palauttaa yrityksen tilaukset muutosajan mukaan vanhimmasta uusimpaan. Tallenna viimeksi käsitellyn tilauksen updated_at ja anna se seuraavalla kerralla parametrina updated_since. Jos vastauksessa on next_cursor, hae seuraava sivu parametrilla cursor, kunnes next_cursor on null.',
      'Suodattimet: status (pilkuin eroteltu luettelo, esim. OPEN,IN_PROGRESS) ja limit (1–100, oletus 50).',
    ],
  },
  details: {
    title: 'Tilaus, tapahtumat ja asiakirjat',
    paragraphs: [
      'GET /orders/{ref} palauttaa tilauksen reittipisteineen, etenemisen ja kuljettajan ajoneuvon, kun kuljetusliike on ottanut tilauksen.',
      'GET /orders/{ref}/events on aikajana: tilan muutokset, saapumiset ja kuittaukset reittipisteillä, asiakirjat ja reittimuutokset.',
      'GET /orders/{ref}/documents palauttaa CMR:t ja rahtikuvat. Jokainen linkki on voimassa 5 minuuttia — hae luettelo uudelleen, kun tarvitset tiedoston.',
    ],
  },
  create: {
    title: 'Tilauksen luonti',
    paragraphs: [
      'POST /orders julkaisee tilauksen pöydälle samoin säännöin kuin lomake. Jokaisella reittipisteellä on oltava tarkka sijainti: lähetä location { lat, lon } tai osoite talonumeroineen, jonka paikannus tunnistaa täsmälleen annetussa kaupungissa. Muuten vastaus on 422 ja pyyntö lähettää koordinaatit — emme arvaa naapurikaupunkia.',
      'Matka lasketaan kuorma-auton reittinä. Hinta annetaan euroina ilman arvonlisäveroa.',
      'Lähetä otsake Idempotency-Key (esim. oma tilausnumerosi tai UUID). Jos yhteys katkeaa ja toistat pyynnön samalla avaimella, saat ensimmäisen tilauksen etkä luo toista. Avain muistetaan vuorokauden.',
    ],
  },
  withdraw: {
    title: 'Tilauksen peruminen',
    paragraphs: ['POST /orders/{ref}/withdraw peruu tilauksen; runko { "reason": "…" } on vapaaehtoinen. Suoritettua ajoa ei voi perua (409).'],
  },
  trip: {
    title: 'Ajon seuranta',
    paragraphs: [
      'Jokaisella reittipisteellä on eta (arvioitu saapuminen, päivittyy liikenteen mukaan jokaisen kuittauksen jälkeen), arrival (kuljettaja saapui) ja completion (piste kuitattu). Saapumisessa ja kuittauksessa on aika ja position: laitteen sijainti sillä hetkellä sekä distance_m, etäisyys pisteen osoitteesta. Etäisyydestä näkee, oliko kuljettaja paikalla — esimerkiksi odotusajan selvittämiseksi.',
      'GET /orders/{ref}/documents palauttaa jokaiselle kuvalle ja CMR:lle captured_position (kuvauspaikka ja etäisyys pisteestä) sekä damage, jos kyse on vauriokuvasta.',
      'Sijainti on yksi piste kyseiseltä hetkeltä, ei jatkuvaa seurantaa. Pisteet säilytetään 24 kuukautta ajon päättymisestä.',
    ],
  },
  offers: {
    title: 'Tarjoukset ja auton määrääminen',
    paragraphs: [
      'GET /orders/{ref}/offers näyttää kuljetusliikkeiden tarjoamat autot kuljettajineen ja arvioineen. POST /orders/{ref}/offers/{id}/choose valitsee tarjouksen.',
      'Tuttu auto määrätään suoraan: GET /vehicles antaa autot, jotka ovat ajaneet teille, ja POST /orders/{ref}/assign { "vehicle_id" } määrää sen tilaukselle, jolla ei vielä ole tarjouksia. Kuljetusliike ja kuljettaja saavat ilmoituksen.',
      'POST /orders/{ref}/unassign peruu määräyksen ennen ajon alkua, ja tilaus palaa pöydälle.',
    ],
  },
  amend: {
    title: 'Muutokset ajon aikana ja arvio',
    paragraphs: [
      'Ajon aikana reittipistettä voi muuttaa: PATCH /orders/{ref}/stops/{sequence} — vain lähetetyt kentät muuttuvat, null tyhjentää kentän. POST /orders/{ref}/stops lisää lisälastauksen tai -purun (before_sequence kertoo paikan), DELETE /orders/{ref}/stops/{sequence} poistaa ohittamattoman pisteen. Kuormausta ja perävaunun palautusta ei poisteta. Kuljetusliike saa ilmoituksen muutoksesta, ja reitti lasketaan uudelleen.',
      'POST /orders/{ref}/reprice { "rate": { "amount" } } muuttaa hinnan; matka on oletuksena uudelleen laskettu reitti. GET /orders/{ref}/amendments listaa muutokset ja sen, onko kuljetusliike kuitannut ne.',
      'Ajon päätyttyä POST /orders/{ref}/rating { "score": 1–5, "comment" } arvioi kuljetusliikkeen; uusi arvio korvaa edellisen.',
    ],
  },
  claims: {
    title: 'Reklamaatiot',
    paragraphs: [
      'GET /claims listaa yrityksen jättämät ja sitä koskevat reklamaatiot, GET /claims/{ref} näyttää viestit ja liitteet (linkit voimassa 5 minuuttia).',
      'POST /claims { "order_ref", "kind", "description", "stop_sequence"?, "amount"? } jättää reklamaation käynnissä olevasta tai päättyneestä ajosta. POST /claims/{ref}/comments lisää viestin ja POST /claims/{ref}/attachments liitteen (multipart/form-data: file ja note; PDF, JPEG, PNG tai WebP, enintään 10 Mt). Toinen osapuoli ja ylläpitäjä saavat ilmoituksen sähköpostilla, kuten kabinetista jätettäessä.',
    ],
  },
  webhooks: {
    title: 'Webhookit',
    paragraphs: [
      'Kabinetissa annetaan https-osoite ja valitaan tapahtumat. Allekirjoitussalaisuus näytetään kerran. Osoitteen on oltava julkinen (portti 443); uudelleenohjauksia ei seurata.',
      'Ilmoituksessa on tilausnumero ja se, mikä muuttui — koko tilaus haetaan tarvittaessa GET /orders/{ref}.',
      'Vastaa 2xx 10 sekunnin kuluessa ja käsittele ilmoitus vasta sen jälkeen. Muuten toimitus yritetään uudelleen 1, 5, 15 ja 60 minuutin sekä 3, 6, 12 ja 24 tunnin kuluttua. Sama ilmoitus voi tulla kahdesti: tunnista se kentästä id. Ilmoitukset lähetetään rinnakkain eivätkä välttämättä saavu syntymisjärjestyksessä — järjestä ne kentän created_at mukaan. Kabinetin painike ”Lähetä testi” lähettää tapahtuman ping.',
    ],
  },
  verify: {
    title: 'Allekirjoituksen tarkistus',
    paragraphs: [
      'Otsake Rahtis-Signature: t=<unix-aika>,v1=<heksa>. v1 on HMAC-SHA256 salaisuudella merkkijonosta "<t>.<runko sellaisenaan>". Laske se raakarungosta ennen JSON-jäsennystä, vertaa vakioaikaisesti ja hylkää, jos t on yli 5 minuuttia vanha.',
      'Tarkistusesimerkki: salaisuus whsec_test, t=1700000000, runko {} → v1 = 35495024f4ef3f94e5a93e22221544c4b75e9a42300cd965ab81cb85cd994e91.',
    ],
  },
  errors: {
    title: 'Virheet',
    paragraphs: ['Virheen runko on { "error": { "code", "message", "details"? } }. details kertoo kentän ja syyn, kun vika on pyynnössä.'],
  },
  errorCodes: {
    bad_request: 'pyyntö on väärin muotoiltu (400)',
    unauthorized: 'avain puuttuu, on väärä tai peruttu (401)',
    forbidden: 'lukuavain, yritys ei ole aktiivinen tai voimassa olevia ehtoja ei ole hyväksytty (403)',
    not_found: 'tilausta, pistettä, tarjousta tai reklamaatiota ei ole yrityksellä (404)',
    conflict: 'tila ei salli toimintoa tai sama Idempotency-Key on käsittelyssä (409)',
    unprocessable: 'sisältö ei kelpaa: sijainti, reitti tai liiketoimintasääntö (422)',
    rate_limited: 'yli 60 pyyntöä minuutissa (429, Retry-After)',
    internal: 'odottamaton virhe, pyyntöä ei suoritettu (500)',
  },
  claimKinds: {
    CARGO_DAMAGE: 'lastin tai perävaunun vaurio',
    SHORTAGE: 'vajaus',
    DOWNTIME: 'odotusaika',
    DEVIATION: 'poikkeama reitistä tai aikataulusta',
    OTHER: 'muu',
  },
  limits: {
    title: 'Rajat ja lokit',
    paragraphs: [
      '60 pyyntöä minuutissa avainta kohden. Pyynnöistä kirjataan avain, menetelmä, polku, vastauskoodi ja kesto; loki säilytetään 90 päivää. Webhook-toimitusten loki säilytetään 30 päivää, ja 100 peräkkäisen epäonnistumisen jälkeen osoite poistetaan käytöstä.',
      'Avain lakkaa toimimasta, kun se perutaan tai kun yrityksen tai avaimen luoneen käyttäjän oikeudet päättyvät.',
    ],
  },
  changes: {
    title: 'Muutokset rajapintaan',
    paragraphs: [
      'Versio on polussa (/api/v1) ja kuvauksessa (info.version). Uusia kenttiä, tapahtumia ja arvoja lisätään ilman ennakkoilmoitusta — ohita tuntemattomat kentät ja arvot. Taaksepäin yhteensopimattomista muutoksista ilmoitetaan etukäteen sähköpostilla avainten luojille.',
    ],
  },
  eventHeader: 'Tapahtuma',
  whenHeader: 'Milloin',
  codeHeader: 'Koodi',
  meaningHeader: 'Merkitys',
};

const en: DocsText = {
  title: 'API documentation',
  description: 'RAHTIS API for shippers: read and create orders from your own system and receive webhooks.',
  intro:
    'The API runs the whole life of an order from your own ERP or TMS: create the order, choose an offer or assign a known vehicle, follow the trip with arrivals, stop confirmations and photos, amend the route in progress, rate the carrier, handle claims, and get a notification at your own URL whenever something changes. Responses and error codes are in English so your program can branch on them.',
  openapi: 'Machine-readable description (OpenAPI 3.1) for Postman, Insomnia or a client generator:',
  cabinet: 'Keys and webhooks are created in the cabinet, on the API tab.',
  start: {
    title: 'Getting started',
    paragraphs: [
      'Create a key in the cabinet. The key is shown once — store it in your secret manager. A read key is enough to follow orders; every change (creating, choosing, assigning, route changes, rating, claims) needs write access.',
      'A key of a test company starts with rhs_test_ and only sees test orders; responses then carry Rahtis-Environment: test. A key of a live company starts with rhs_live_.',
      'Send the key in every request as Authorization: Bearer.',
    ],
  },
  access: {
    title: 'Access and test environment',
    paragraphs: [
      'The API is for approved shipper companies: apply at rahtis.eu/en/apply, and once the company is approved and its details are filled in, keys are created on the API tab of the cabinet. Using the API is free.',
      'For a test environment (an rhs_test_ key, a test company, test carriers and vehicles), write to admin@rahtis.eu. Test orders are not shown to real carriers and are not invoiced.',
      'Times: API timestamps (created_at, arrival.at, eta.at …) are UTC in ISO 8601. A stop\'s scheduled_date and scheduled_time are local time in the stop\'s country (Finland, Sweden, Norway, Denmark) — the same the driver sees.',
      'Money: all amounts are euros excluding VAT (vat_included: false). VAT is added on the invoice according to the country.',
    ],
  },
  lifecycle: {
    title: 'Order statuses',
    paragraphs: [
      'An order moves through the statuses below. Every change sends a webhook (order.taken, order.started, order.reopened, order.closed, order.cancelled) and appears in GET /orders/{ref}/events.',
      'deadline_at is the decision deadline: you have 15 minutes from the first offer to choose one, and the chosen carrier has 15 minutes to confirm. When it passes, the order returns to OPEN. A direct assignment (POST /orders/{ref}/assign) has no deadline: the order waits for the vehicle to confirm.',
    ],
  },
  statuses: {
    OPEN: 'on the offer table, waiting for offers (at most three)',
    REQUESTED: 'offers have arrived — choose one (POST …/offers/{id}/choose) before deadline_at',
    AWAIT_DRIVER: 'a vehicle is chosen or assigned and waits for the carrier or driver to confirm',
    IN_PROGRESS: 'confirmed, the trip is under way: stops are being confirmed',
    DONE: 'the trip has ended: fees and the waiting surcharge are fixed, documents are available',
    CANCELLED: 'withdrawn (POST …/withdraw or in the cabinet)',
    DRAFT: 'a draft in the cabinet, not published — an order created through the API is published at once',
  },
  types: {
    title: 'Order types and stops',
    paragraphs: [
      'haul_kind says what is moved: TRAILER (semi-trailer) and CONTAINER (container_feet required) move a numbered unit, and trailer_plate (trailer registration or ISO 6346 container number) is required. VAN and TRUCK are express transport inside the vehicle: ldm (loading metres) and cargo_weight_kg on at least one stop are required.',
      'Stops are given in driving order (2–20). Every order has one PICKUP. The table shows what each type requires; a missing stop returns 422 with the reason in details.',
      'Send the contract in the contract field: RAHTIS (default) — the RAHTIS service, service fee 5 % of the price, at least 15 € per job together with the carrier fee; DIRECT — a direct contract with a carrier on the monthly plan, no service fee, and only such carriers see the order. contract is also returned with the order.',
    ],
  },
  typeRows: {
    'TRAILER_SWAP (TRAILER, CONTAINER)': 'Trailer or container swap: PICKUP (collect the unit) → at least one DELIVERY, EXTRA_LOAD or EXTRA_UNLOAD → TRAILER_RETURN (where the unit is left).',
    'ONE_WAY (TRAILER, CONTAINER)': 'The unit is collected and delivered: PICKUP → at least one DELIVERY, EXTRA_LOAD or EXTRA_UNLOAD; TRAILER_RETURN optional.',
    'ROUND_TRIP (TRAILER, CONTAINER)': 'Like ONE_WAY, but the unit comes back — end with TRAILER_RETURN.',
    'ONE_WAY (VAN, TRUCK)': 'Express: PICKUP (loading) → DELIVERY (unloading), with EXTRA_LOAD / EXTRA_UNLOAD in between if needed. order_type is always ONE_WAY.',
  },
  roles: {
    PICKUP: 'collection: the unit is picked up or the goods are loaded — always first',
    DELIVERY: 'unloading at the consignee; company_name required',
    EXTRA_LOAD: 'extra loading on the way; consignee says whom the extra load is for',
    EXTRA_UNLOAD: 'extra unloading on the way',
    TRAILER_RETURN: 'where the empty or loaded unit is left (trailer_loaded says which)',
  },
  roleHeader: 'Role',
  statusHeader: 'Status',
  typeHeader: 'Type',
  sync: {
    title: 'Synchronising orders',
    paragraphs: [
      'GET /orders returns your company\'s orders by change time, oldest first. Store the updated_at of the last order you processed and pass it next time as updated_since. When the response has next_cursor, fetch the next page with cursor until next_cursor is null.',
      'Filters: status (comma-separated, e.g. OPEN,IN_PROGRESS) and limit (1–100, default 50).',
    ],
  },
  details: {
    title: 'Order, timeline and documents',
    paragraphs: [
      'GET /orders/{ref} returns the order with its stops, progress and — once a carrier has taken it — the vehicle.',
      'GET /orders/{ref}/events is the timeline: status changes, stop arrivals and completions, documents and route amendments.',
      'GET /orders/{ref}/documents returns CMRs and trip photos. Each link is valid for 5 minutes — request the list again when you need the file.',
    ],
  },
  create: {
    title: 'Creating an order',
    paragraphs: [
      'POST /orders publishes the order to the desk under the same rules as the order form. Every stop needs a precise location: send location { lat, lon }, or an address with a house number that the geocoder recognises exactly in the given city. Otherwise the answer is 422 asking for coordinates — we do not guess the neighbouring town.',
      'Distance is calculated as a truck route. The rate is in euros, VAT excluded.',
      'Send an Idempotency-Key header (e.g. your own order number or a UUID). If the connection drops and you retry with the same key, you get the first order back instead of creating a second one. The key is remembered for 24 hours.',
    ],
  },
  withdraw: {
    title: 'Withdrawing an order',
    paragraphs: ['POST /orders/{ref}/withdraw cancels the order; the body { "reason": "…" } is optional. A completed trip cannot be withdrawn (409).'],
  },
  trip: {
    title: 'Following the trip',
    paragraphs: [
      'Every stop has eta (estimated arrival, recalculated with traffic after each confirmation), arrival (the driver arrived) and completion (the stop was confirmed). Arrival and completion carry the time and a position: the device location at that moment plus distance_m, the distance to the stop address. The distance tells whether the driver was there — for example to settle waiting time.',
      'GET /orders/{ref}/documents returns captured_position (where it was taken and the distance to the stop) for every photo and CMR, and damage for damage photos.',
      'A position is one point from that moment, not continuous tracking. Points are kept for 24 months after the trip ends.',
    ],
  },
  offers: {
    title: 'Offers and assigning a vehicle',
    paragraphs: [
      'GET /orders/{ref}/offers shows the vehicles offered by carriers, with driver and rating. POST /orders/{ref}/offers/{id}/choose chooses an offer.',
      'A known vehicle can be assigned directly: GET /vehicles lists the vehicles that have driven for you, and POST /orders/{ref}/assign { "vehicle_id" } assigns one to an order that has no offers yet. The carrier and the driver are notified.',
      'POST /orders/{ref}/unassign cancels the assignment before the trip starts, and the order returns to the desk.',
    ],
  },
  amend: {
    title: 'Changes in progress and rating',
    paragraphs: [
      'During the trip a stop can be changed: PATCH /orders/{ref}/stops/{sequence} — only the fields you send change, null clears a field. POST /orders/{ref}/stops adds an extra loading or unloading (before_sequence says where), and DELETE /orders/{ref}/stops/{sequence} removes a stop not yet passed. Pickup and trailer return cannot be removed. The carrier is notified and the route is recalculated.',
      'POST /orders/{ref}/reprice { "rate": { "amount" } } changes the rate; the distance defaults to the recalculated route. GET /orders/{ref}/amendments lists the changes and whether the carrier has acknowledged them.',
      'After the trip, POST /orders/{ref}/rating { "score": 1–5, "comment" } rates the carrier; a new rating replaces the previous one.',
    ],
  },
  claims: {
    title: 'Claims',
    paragraphs: [
      'GET /claims lists the claims filed by your company and against it; GET /claims/{ref} shows messages and attachments (links valid for 5 minutes).',
      'POST /claims { "order_ref", "kind", "description", "stop_sequence"?, "amount"? } files a claim for a trip in progress or completed. POST /claims/{ref}/comments adds a message and POST /claims/{ref}/attachments a file (multipart/form-data: file and note; PDF, JPEG, PNG or WebP up to 10 MB). The other party and the operator are notified by email, as when filing from the cabinet.',
    ],
  },
  webhooks: {
    title: 'Webhooks',
    paragraphs: [
      'In the cabinet, enter an https URL and choose the events. The signing secret is shown once. The URL must be public (port 443); redirects are not followed.',
      'A notification carries the order number and what changed — fetch GET /orders/{ref} for the full order when you need it.',
      'Answer 2xx within 10 seconds and do the work afterwards. Otherwise the delivery is retried after 1, 5, 15 and 60 minutes, then 3, 6, 12 and 24 hours. The same notification can arrive twice: recognise it by id. Notifications are sent in parallel and may arrive out of order — order them by created_at. The Send test button in the cabinet sends a ping event.',
    ],
  },
  verify: {
    title: 'Verifying the signature',
    paragraphs: [
      'Header Rahtis-Signature: t=<unix time>,v1=<hex>. v1 is HMAC-SHA256 with your secret over the string "<t>.<raw body>". Compute it over the raw body before JSON parsing, compare in constant time, and reject when t is older than 5 minutes.',
      'Test vector: secret whsec_test, t=1700000000, body {} → v1 = 35495024f4ef3f94e5a93e22221544c4b75e9a42300cd965ab81cb85cd994e91.',
    ],
  },
  errors: {
    title: 'Errors',
    paragraphs: ['An error body is { "error": { "code", "message", "details"? } }. details names the field and the issue when the request is at fault.'],
  },
  errorCodes: {
    bad_request: 'the request is malformed (400)',
    unauthorized: 'the key is missing, wrong or revoked (401)',
    forbidden: 'read-only key, inactive company, or the current terms are not accepted (403)',
    not_found: 'no such order, stop, offer or claim in your company (404)',
    conflict: 'the state does not allow it, or the same Idempotency-Key is being processed (409)',
    unprocessable: 'the content is not acceptable: location, route or a business rule (422)',
    rate_limited: 'more than 60 requests per minute (429, Retry-After)',
    internal: 'unexpected error; the request was not completed (500)',
  },
  claimKinds: {
    CARGO_DAMAGE: 'damage to the cargo or trailer',
    SHORTAGE: 'shortage',
    DOWNTIME: 'waiting time',
    DEVIATION: 'deviation from the route or schedule',
    OTHER: 'other',
  },
  limits: {
    title: 'Limits and logs',
    paragraphs: [
      '60 requests per minute per key. For each request the key, method, path, response code and duration are logged; the log is kept for 90 days. The webhook delivery log is kept for 30 days, and a URL is disabled after 100 consecutive failures.',
      'A key stops working when it is revoked or when the rights of the company or of the user who created it end.',
    ],
  },
  changes: {
    title: 'Changes to the API',
    paragraphs: [
      'The version is in the path (/api/v1) and in the description (info.version). New fields, events and values are added without notice — ignore fields and values you do not know. Backward-incompatible changes are announced in advance by email to the key creators.',
    ],
  },
  eventHeader: 'Event',
  whenHeader: 'When',
  codeHeader: 'Code',
  meaningHeader: 'Meaning',
};

export const DOCS: Record<Locale, DocsText> = { fi, en };

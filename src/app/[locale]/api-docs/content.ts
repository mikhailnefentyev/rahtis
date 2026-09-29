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
  sync: Section;
  details: Section;
  create: Section;
  withdraw: Section;
  webhooks: Section;
  events: Record<string, string>;
  verify: Section;
  errors: Section;
  errorCodes: Record<string, string>;
  limits: Section;
  eventHeader: string;
  whenHeader: string;
  codeHeader: string;
  meaningHeader: string;
};

const fi: DocsText = {
  title: 'API-dokumentaatio',
  description: 'RAHTIS-rajapinta tilaajille: tilausten luku ja luonti omasta järjestelmästä sekä tapahtumailmoitukset (webhook).',
  intro:
    'Rajapinnalla tilaaja liittää oman toiminnanohjauksensa RAHTIS-palveluun: lukee tilaukset ja niiden etenemisen, luo ja peruu tilauksia ja saa ilmoituksen omaan osoitteeseensa, kun tilaus muuttuu. Vastaukset ja virhekoodit ovat englanniksi, jotta ohjelma voi haarautua niiden mukaan.',
  openapi: 'Koneluettava kuvaus (OpenAPI 3.1) Postmaniin, Insomniaan tai asiakasgeneraattoriin:',
  cabinet: 'Avaimet ja webhookit luodaan kabinetissa, välilehdellä API.',
  start: {
    title: 'Aloitus',
    paragraphs: [
      'Luo avain kabinetissa. Avain näytetään vain kerran — tallenna se salaisuuksien hallintaan. Lukuavain riittää tilausten seurantaan; tilausten luontiin ja perumiseen tarvitaan kirjoitusoikeus.',
      'Testiyrityksen avain alkaa rhs_test_ ja näkee vain testiympäristön tilaukset; vastauksissa on silloin otsake Rahtis-Environment: test. Oikean yrityksen avain alkaa rhs_live_.',
      'Avain annetaan jokaisessa pyynnössä otsakkeessa Authorization: Bearer.',
    ],
  },
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
      'GET /orders/{ref}/events on aikajana: tilan muutokset sekä saapumiset ja kuittaukset reittipisteillä.',
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
  webhooks: {
    title: 'Webhookit',
    paragraphs: [
      'Kabinetissa annetaan https-osoite ja valitaan tapahtumat. Allekirjoitussalaisuus näytetään kerran. Osoitteen on oltava julkinen (portti 443); uudelleenohjauksia ei seurata.',
      'Ilmoituksessa on tilausnumero ja se, mikä muuttui — koko tilaus haetaan tarvittaessa GET /orders/{ref}.',
      'Vastaa 2xx 10 sekunnin kuluessa ja käsittele ilmoitus vasta sen jälkeen. Muuten toimitus yritetään uudelleen 1, 5, 15 ja 60 minuutin sekä 3, 6, 12 ja 24 tunnin kuluttua. Sama ilmoitus voi tulla kahdesti: tunnista se kentästä id. Kabinetin painike ”Lähetä testi” lähettää tapahtuman ping.',
    ],
  },
  events: {
    'order.taken': 'kuljetusliike otti tilauksen',
    'order.reopened': 'kuljetusliike luopui, tilaus on taas pöydällä',
    'order.stop_completed': 'reittipiste kuitattu',
    'order.closed': 'ajo suoritettu',
    'order.cancelled': 'tilaus peruttu',
    'document.added': 'CMR tai rahtikuva lisätty',
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
    not_found: 'tilausta ei ole yrityksellä (404)',
    conflict: 'tila ei salli toimintoa tai sama Idempotency-Key on käsittelyssä (409)',
    unprocessable: 'sisältö ei kelpaa: sijainti, reitti tai liiketoimintasääntö (422)',
    rate_limited: 'yli 60 pyyntöä minuutissa (429, Retry-After)',
    internal: 'odottamaton virhe, pyyntöä ei suoritettu (500)',
  },
  limits: {
    title: 'Rajat ja lokit',
    paragraphs: [
      '60 pyyntöä minuutissa avainta kohden. Pyynnöistä kirjataan avain, menetelmä, polku, vastauskoodi ja kesto; loki säilytetään 90 päivää. Webhook-toimitusten loki säilytetään 30 päivää, ja 100 peräkkäisen epäonnistumisen jälkeen osoite poistetaan käytöstä.',
      'Avain lakkaa toimimasta, kun se perutaan tai kun yrityksen tai avaimen luoneen käyttäjän oikeudet päättyvät.',
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
    'The API connects your own ERP or TMS to RAHTIS: read orders and their progress, create and withdraw orders, and get a notification at your own URL when an order changes. Responses and error codes are in English so your program can branch on them.',
  openapi: 'Machine-readable description (OpenAPI 3.1) for Postman, Insomnia or a client generator:',
  cabinet: 'Keys and webhooks are created in the cabinet, on the API tab.',
  start: {
    title: 'Getting started',
    paragraphs: [
      'Create a key in the cabinet. The key is shown once — store it in your secret manager. A read key is enough to follow orders; creating and withdrawing orders needs write access.',
      'A key of a test company starts with rhs_test_ and only sees test orders; responses then carry Rahtis-Environment: test. A key of a live company starts with rhs_live_.',
      'Send the key in every request as Authorization: Bearer.',
    ],
  },
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
      'GET /orders/{ref}/events is the timeline: status changes and stop arrivals and completions.',
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
  webhooks: {
    title: 'Webhooks',
    paragraphs: [
      'In the cabinet, enter an https URL and choose the events. The signing secret is shown once. The URL must be public (port 443); redirects are not followed.',
      'A notification carries the order number and what changed — fetch GET /orders/{ref} for the full order when you need it.',
      'Answer 2xx within 10 seconds and do the work afterwards. Otherwise the delivery is retried after 1, 5, 15 and 60 minutes, then 3, 6, 12 and 24 hours. The same notification can arrive twice: recognise it by id. The Send test button in the cabinet sends a ping event.',
    ],
  },
  events: {
    'order.taken': 'a carrier took the order',
    'order.reopened': 'the carrier gave it up; the order is back on the desk',
    'order.stop_completed': 'a stop was completed',
    'order.closed': 'the trip is done',
    'order.cancelled': 'the order was withdrawn',
    'document.added': 'a CMR or trip photo was added',
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
    not_found: 'no such order in your company (404)',
    conflict: 'the state does not allow it, or the same Idempotency-Key is being processed (409)',
    unprocessable: 'the content is not acceptable: location, route or a business rule (422)',
    rate_limited: 'more than 60 requests per minute (429, Retry-After)',
    internal: 'unexpected error; the request was not completed (500)',
  },
  limits: {
    title: 'Limits and logs',
    paragraphs: [
      '60 requests per minute per key. For each request the key, method, path, response code and duration are logged; the log is kept for 90 days. The webhook delivery log is kept for 30 days, and a URL is disabled after 100 consecutive failures.',
      'A key stops working when it is revoked or when the rights of the company or of the user who created it end.',
    ],
  },
  eventHeader: 'Event',
  whenHeader: 'When',
  codeHeader: 'Code',
  meaningHeader: 'Meaning',
};

export const DOCS: Record<Locale, DocsText> = { fi, en };

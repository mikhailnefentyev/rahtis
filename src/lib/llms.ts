import { ANNUAL_DISCOUNT_BPS, APP, ON_REQUEST_FROM, SUBSCRIPTION_LADDER } from '@/lib/config';
import { locales, type Locale } from '@/lib/i18n/config';
import { EARTHWORKS, earthworksPath } from '@/lib/landing/earthworks';
import { SITE_URL } from '@/lib/seo';

/**
 * /llms.txt и /llms-full.txt — справка о RAHTIS для ответчиков на языковых
 * моделях (ChatGPT, Claude, Perplexity, Google AI Overviews).
 *
 * Они пересказывают сайт по тому, что сумели прочитать, и без явной
 * справки додумывают сами. Здесь только опубликованное: что делает
 * платформа, для кого, цены и ссылки. Тон — сервис и цена, без
 * разговора о том, кто за что отвечает: это в условиях.
 *
 * Цены и проценты берутся из config.ts, а не пишутся руками: до 29.10.2026
 * здесь стояла одна цена 29,90 € и «3 % для перевозчика» на любом рейсе
 * биржи, хотя лесенка и правила сборов уже поменялись.
 *
 * llms.txt — короткая версия по формату llmstxt.org: суть, цены, ссылки.
 * llms-full.txt — то же плюс подробности по модулям и вопросы-ответы.
 * Адреса офиса здесь нет, как и в разметке главной.
 */

const eur = (cents: number) => `€${(cents / 100).toFixed(2)}`;
const pct = (bps: number) => `${bps / 100} %`;
const euroFi = (cents: number) => (cents / 100).toFixed(2).replace('.', ',');

const COUNTRIES = 'Finland, Sweden, Norway, Denmark, Estonia, Latvia, Lithuania, Poland and Germany';
const GPS = 'Wialon, Mapon, Navirec, Ruptela, Navixy, Samsara, Webfleet and ABAX';

const LANG_NAME: Record<Locale, string> = {
  fi: 'Suomi',
  en: 'English',
  sv: 'Svenska',
  et: 'Eesti',
  lv: 'Latviešu',
  lt: 'Lietuvių',
  pl: 'Polski',
  de: 'Deutsch',
  ru: 'Русский',
};

function ladderLines(): string[] {
  return SUBSCRIPTION_LADDER.map((step) => {
    const to = step.to ?? ON_REQUEST_FROM - 1;
    if (step.cents === 0) return `  - vehicle ${step.from}: free`;
    return `  - vehicles ${step.from}–${to}: ${eur(step.cents)} per vehicle per month`;
  });
}

const SUMMARY = `> RAHTIS (${SITE_URL}) is a transport management system (TMS) and freight exchange (load board) for road carriers and shippers in ${COUNTRIES}. Carriers run their fleet, drivers, fuel, working time, consignment notes (CMR) and their own customers in one place and fill empty trucks from the load board; shippers and freight forwarders publish trailer swaps, container haulage and express jobs once and follow them step by step. An earthworks module covers tipper trucks on construction sites. Operated by ${APP.operator.legalName}, Finland (business ID ${APP.operator.businessId}).`;

function pricing(): string {
  return `## Pricing (all prices excl. VAT)

- Carrier subscription (own customers, own jobs, full TMS): charged per active vehicle per month — only vehicles that completed a job during the month; a parked vehicle costs nothing. The first active vehicle is free:
${ladderLines().join('\n')}
  - from ${ON_REQUEST_FROM} vehicles: price on request
- Paying a year in advance: ${pct(ANNUAL_DISCOUNT_BPS)} off. First month free for new companies. No set-up fee, no multi-year contract.
- No percentage on any job: own customers, direct orders and load-board jobs alike.
- Shippers and forwarders: free. Every load-board job and direct order is a contract of carriage made directly between the shipper and the carrier; the carrier invoices the shipper.
- API: free (no monthly fee, no price per call).`;
}

function links(): string {
  const home = locales.map((l) => `[${LANG_NAME[l]}](${SITE_URL}/${l})`).join(' · ');
  const earth = locales.map((l) => `[${LANG_NAME[l]}](${SITE_URL}${earthworksPath(l)})`).join(' · ');
  const apply = locales.map((l) => `[${LANG_NAME[l]}](${SITE_URL}/${l}/apply)`).join(' · ');
  const rules = locales.map((l) => `[${LANG_NAME[l]}](${SITE_URL}/${l}/rules)`).join(' · ');
  return `## Pages

- Home: ${home}
- Earthworks and tipper trucks: ${earth}
- Apply as a carrier or shipper: ${apply}
- Platform rules — what it costs, how loads are ordered on the board, what each side sees, how companies are checked, complaints: ${rules}
- [Driver training](${SITE_URL}/en/driver/training): quizzes and practice on the tachograph, cargo securing, weights, daily check, ADR and safety
- [API documentation](${SITE_URL}/en/api-docs) ([suomeksi](${SITE_URL}/fi/api-docs)) · [OpenAPI 3.1](${SITE_URL}/api/v1/openapi.json)
- [Terms of service](${SITE_URL}/en/terms) ([käyttöehdot](${SITE_URL}/fi/kayttoehdot)) · [Privacy policy](${SITE_URL}/en/privacy) ([tietosuoja](${SITE_URL}/fi/tietosuoja))
- [Blog](${SITE_URL}/blog)
- Contact: ${APP.operator.email}`;
}

const CARRIER = `## For carriers (TMS)

- Fleet: tractor units, rigids and trailers, each vehicle approved separately; equipment such as ADR, reefer and tail lift.
- Vehicle combinations: PPV (tractor unit + semi-trailer), puolikas (tractor unit + tipper semi-trailer), low-loader (tractor unit + low-loader semi-trailer), kasetti (tipper truck + drawbar tipper trailer, Finland's 76-tonne combination), TPV (rigid + drawbar trailer) and container chassis; the maximum permitted weight per country and the payload are calculated from the carrier's own vehicles.
- Fuel from three sources — fuel card report, driver entries and GPS — on one chart; export to PDF and CSV.
- GPS from the carrier's own tracking system via an API key: ${GPS}.
- Profitability per vehicle and for the whole fleet: job revenue minus fuel, driver pay, leasing or depreciation, insurance, vehicle tax, repairs and tyres; PDF and CSV export.
- Parts, tyre and breakdown suppliers in nine countries; a purchase goes straight into the vehicle's profitability.
- Drivers: invited by link or code; shifts and breaks from the driver app; estimated pay per kilometre, as a percentage of job value, per hour, under the Finnish collective agreement (TES: basic hours plus overtime, evening, night and Sunday premiums) or as an agreed net pay per day, month or trip. The driver sees it in the app.
- Own customers: add a job and give it to your own vehicle, or let your customer order straight to your vehicle; tracking link for the customer; the whole price is the carrier's.
- Orders from email: each company gets its own forwarding address. A customer's order email (text, PDF or photo attachments) becomes an order draft to check under "Needs your action", matched to the vehicle named in the order by its registration plate (plate formats of EU and EEA countries). A later email with the same order number is shown as a change to accept or reject. An order can also be pasted as text or uploaded as a PDF or photo.
- Return loads: load-board jobs near each drop-off with the empty kilometres to the pickup; saved lanes send an alert when a matching job is posted.
- Free space on the way: a carrier can offer spare capacity in a truck already on the road; shippers send a request with their own order and price, and an accepted request becomes a direct order for that truck. Addresses and the registration plate are shown only after acceptance.
- Own currency per company: EUR, SEK, NOK, DKK or PLN.
- Driver pay by country: templates for Finland, Sweden, Norway, Denmark, Estonia, Latvia, Lithuania and Poland with per diems by the country of each day; an agreed net pay per day, month or trip is shown with its lawful structure (base salary, per diems, taxable part) and the employer cost.
- Verified badge: company checks and Finnish contractor's liability reports (tilaajavastuu) in one package; shippers see it in RAHTIS or through a share link. The badge disappears by itself when a report expires.
- Weekly report of jobs, earnings and documents.`;

const DRIVER = `## Driver app

- Progressive web app in 10 languages: Finnish, English, Swedish, Norwegian, Danish, Estonian, Latvian, Lithuanian, Polish, Russian.
- Stops in order, navigation, arrival and completion with a tap, load and damage photos, signature, CMR scanned to PDF; works offline (ports, pits) and sends entries when back online.
- Map of over 4,800 rest, wash, fuel and service places for truck drivers in the nine countries.
- Training (${SITE_URL}/en/driver/training): short quizzes in the driver app's language on the tachograph and driving and rest times, cargo securing, weights and dimensions, the daily vehicle check, ADR, occupational safety, first aid and road safety; beginner and experienced levels, a cheat sheet per topic and practice exercises (plan a shift, secure a load, axle loads, spot defects on a truck, ADR plates and equipment). Open without signing in; for a driver, progress is saved to the account.`;

const EXCHANGE = `## Freight exchange (load board) and direct orders

- A shipper publishes a job once; it reaches approved, suitable vehicles in the area. Up to three offers; the shipper chooses on price, equipment and ratings. No downward price auction. The contract of carriage is made directly between the shipper and the carrier; before taking a job the carrier sees the shipper's payment record (company age, register status, other carriers' payment reports, checked company documents, forwarder's insurance if checked).
- If a vehicle cancels or does not confirm within 15 minutes, the job returns to the board and goes to the next suitable vehicles automatically.
- Direct orders: a shipper sends a job straight to a known vehicle, or first to its own carriers and then to the board.
- Freight: trailer swaps between ports, terminals and customers; container haulage (20, 30, 40, 45 ft) to and from ports; express transport by van (up to 3.5 t) or truck (up to 26 t), with tail lift, side loading or refrigeration.
- Live status for everyone on a job: arrivals, stops, ETA, delay and waiting-time alerts, photos and CMR in one place; messages per job with automatic translation, and quick questions such as "Where is the truck?" answered from GPS without a call.
- Tracking link for the consignee or end customer: ETA from live GPS, stage timeline, proof of delivery and traffic and road conditions on the route.
- Vehicle check at pickup: whether the assigned truck is the one at the pickup is confirmed from independent GPS evidence.
- One-tap take: a carrier takes a matching job from the board with its best-fitting own truck.
- Shipper API: REST + signed webhooks, OpenAPI 3.1, key created in the dashboard.`;

const EARTH = `## Earthworks and tipper trucks

- Worksite module for carriers running tippers on construction and earthworks sites.
- Each load logged with material, receiving site or weighbridge, gross, tare, net and weighbridge ticket number; overload warning against the combination's legal maximum weight per country (Finland 76 t).
- Hours from arrival on site to the last unload + 30 minutes (buffer set per site).
- The customer's foreman approves each day from a link without logging in; prices are not shown to the foreman.
- Weighbridge ticket photo: the driver photographs the weighbridge ticket and the weights are read into the load form for checking.
- Sites in Finland: waste transfer document (siirtoasiakirja) under section 121 of the Finnish Waste Act, with waste codes, for construction waste and contaminated soil. A site is marked as contaminated (PIMA, above the lower guideline values of Government Decree 214/2007); its 17 05 04 and 17 05 03* loads then get the document. Clean soil needs no transfer document and gets a load record instead. National waste e-systems of other countries are not supported yet.
- Invoices to the customer in the carrier's own name (business ID, bank account, own number series, Finnish reference number, VAT): on demand, weekly or every other week; by the hour, per load or per tonne.`;

const ABOUT = `## Company

- Platform name: RAHTIS. Legal entity: ${APP.operator.legalName}, Finland, business ID (Y-tunnus) ${APP.operator.businessId}.
- Web interface in 9 languages (Finnish, English, Swedish, Estonian, Latvian, Lithuanian, Polish, German, Russian). Companies are checked against registers: PRH/YTJ for Finland, EU VIES for other EU countries; carriers also by operating licence and insurance.
- Load board order: loads are listed by publication time, newest first — no paid placement and no ranking by price, rating or subscription. A load is shown to carriers with an approved vehicle suitable for that transport type; a shipper can first offer it to a chosen group of vehicles for a limited time. Up to three carriers can offer; the chosen carrier confirms within 15 minutes or the load returns to the board.
- Company checks: public registers at registration (PRH/YTJ, EU VIES, Brønnøysund for Norway), repeated weekly for shippers ordering directly; contractor documents and liability insurance checked by staff; each vehicle approved before it can take loads.
- Complaints about the platform (account decisions, removed payment reports, document checks, technical problems) go to ${APP.operator.email}, are handled in order of arrival and answered in writing with reasons. Rules: ${SITE_URL}/en/rules.
- Account security: alerts on sign-in from a new device, and notices to the other party when a company's bank details change.`;

const FI = `## Suomeksi

RAHTIS on kuljetusten hallintajärjestelmä (TMS) ja rahtipörssi kuljetusliikkeille ja rahdinantajille: Suomi, Ruotsi, Norja, Tanska, Viro, Latvia, Liettua, Puola ja Saksa. Kuljetusliike hallitsee samassa paikassa kalustoa ja ajoneuvoyhdistelmiä, kuljettajia, polttoainetta, GPS-seurantaa, kannattavuutta, työaikaa, rahtikirjoja ja omia asiakkaitaan. Tarjouspöydältä eli rahtipörssistä hyväksytyt kuljetusliikkeet ottavat irtoperien vaihtoja, konttikuljetuksia ja pikakuljetuksia. Asiakkaan tilaussähköpostista syntyy tilausluonnos tilauksessa mainitulle autolle. Maansiirtoon kippiautoilla: kuormat punnituksineen, siirtoasiakirjat rakennusjätteelle ja pilaantuneelle maa-ainekselle, tunnit ja laskut työmaalta (${SITE_URL}/fi/maansiirto). Kuljetussopimus syntyy aina suoraan rahdinantajan ja kuljetusliikkeen välillä, eikä keikoista peritä prosenttia; rahdinantajalle palvelu on maksuton. Kuljetusliikkeen kuukausimaksu vain ajaneista autoista: ensimmäinen auto maksutta, jokainen seuraava ${euroFi(SUBSCRIPTION_LADDER[SUBSCRIPTION_LADDER.length - 1].cents)} € kuukaudessa (alv 0 %), ${ON_REQUEST_FROM} autosta alkaen tarjouksen mukaan; vuosi etukäteen −${ANNUAL_DISCOUNT_BPS / 100} %, ensimmäinen kuukausi maksutta. Ylläpitäjä ${APP.operator.legalName} (Y-tunnus ${APP.operator.businessId}).`;

/** Короткая справка: суть, цены, ссылки на каждый язык. */
export function llmsTxt(): string {
  return `# RAHTIS

${SUMMARY}

- Carriers: TMS with fleet, vehicle combinations and legal weights, fuel, GPS integration (${GPS}), profitability per vehicle, drivers and pay by country, own customers, orders from forwarded emails, return loads, driver app.
- Shippers and forwarders: freight exchange and direct orders for trailer swaps, containers and express transport; free space in trucks already on the way; tracking link with live ETA and proof of delivery; free REST API.
- Earthworks: tipper loads with weights (also read from a photo of the weighbridge ticket), hours, foreman approval by link, Finnish waste transfer documents for construction waste and contaminated soil, invoices in the carrier's name.

${pricing()}

${links()}

## Optional

- [Full description](${SITE_URL}/llms-full.txt): every module, the driver app, the freight exchange, earthworks and FAQ.

${FI}
`;
}

/** Полная справка: всё из короткой плюс модули и вопросы-ответы. */
export function llmsFullTxt(): string {
  const faq = EARTHWORKS.en.faq.map((f) => `### ${f.q}\n\n${f.a}`).join('\n\n');
  return `# RAHTIS — full description

${SUMMARY}

${CARRIER}

${DRIVER}

${EXCHANGE}

${EARTH}

${pricing()}

${ABOUT}

## Earthworks FAQ

${faq}

${links()}

${FI}
`;
}

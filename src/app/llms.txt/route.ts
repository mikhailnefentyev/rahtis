import { APP, SUBSCRIPTION_UNIT_CENTS } from '@/lib/config';
import { SITE_URL } from '@/lib/seo';

/**
 * /llms.txt — справка о RAHTIS для ответчиков на языковых моделях
 * (ChatGPT, Perplexity и подобных).
 *
 * Они пересказывают сайт по тому, что сумели прочитать, и без явной
 * справки додумывают сами. Здесь только опубликованное: что делает
 * платформа, для кого, цены и ссылки. Тон — сервис и цена, без
 * разговора о том, кто за что отвечает: это в условиях.
 */
export const dynamic = 'force-static';

const euro = (cents: number) => (cents / 100).toFixed(2).replace('.', ',');

const BODY = `# RAHTIS

> RAHTIS (${SITE_URL}) is a Finnish transport management platform and freight exchange for carriers and shippers in Northern Europe: Finland, Sweden, Norway, Denmark, Estonia, Latvia, Lithuania, Poland and Germany. It is three things in one: (1) an operations platform (TMS) where a transport company runs its own fleet, drivers, working time, consignment notes (CMR) and its own customers; (2) an offer table — a freight exchange (rahtipörssi) — where approved carriers take jobs published by shippers and freight forwarders; (3) direct work between shipper and carrier: orders sent straight to a known vehicle, tracking links and an API. Freight: trailer swaps, container haulage and express van/truck transport. Operated by ${APP.operator.legalName} (business ID ${APP.operator.businessId}), Helsinki, Finland.

## Transport management for carriers (TMS)

- Fleet: every vehicle with its equipment (axles, ADR, reefer, tail lift), approved for the service one by one.
- Drivers: invited by link or code; several dispatchers per company with their own logins.
- Own trips and own customers: add a job yourself and give it to your own vehicle, or let your customer send orders straight to your vehicle; the customer can get a tracking link. The whole price is the carrier's, no percentage.
- Driver app (PWA) in 10 languages: stops in order, navigation, arrival and completion marks, load and damage photos, signature, consignment note scanned to PDF; works offline in ports.
- Working time and an indicative wage from the carrier's own rates or the collective agreement tables; shifts.
- Map of rest, wash and service places in Finland, Sweden, Norway and Denmark.
- Weekly report of jobs, earnings and documents; claims handled per trip.

## Freight exchange (offer table)

- A shipper publishes a job once; it reaches suitable approved vehicles in the area at once.
- Up to three offers; the shipper chooses by price, equipment and ratings. No price auction downwards.
- If a vehicle cancels or does not confirm in 15 minutes, the job returns to the table and goes to the next suitable vehicles by itself.
- Carriers see open jobs in their area and can find a return load where the previous trip ends.

## Direct work between shippers and carriers

- Direct orders: a shipper sends a job straight to a known vehicle, or first to a group of its own vehicles and then to the offer table.
- A carrier can invite its own customers to order through RAHTIS.

## Freight types

- Trailer swaps (perävaunun vaihto / irtoperät) between ports, terminals and customers — e.g. Hanko, Helsinki Vuosaari, Turku, Kotka.
- Container haulage (20', 40', 45') to and from ports and terminals.
- Express transport by van or truck (up to 3.5 t or 26 t; tail lift, side loading, reefer).

## For everyone on a trip

- Live trip status: arrivals, completed stops, estimated arrival, delay and waiting-time alerts, photos and CMR in one place.
- Messages per trip between shipper, carrier and driver, with automatic translation (10 languages).
- Driver app (PWA) in 10 languages: Finnish, English, Swedish, Norwegian, Danish, Estonian, Latvian, Lithuanian, Polish, Russian.
- Web interface in 9 languages: Finnish, English, Swedish, Estonian, Latvian, Lithuanian, Polish, German, Russian (company registration checks: PRH for Finland, EU VIES for other EU countries).
- Shipper API (REST + webhooks) to create and follow orders from the shipper's own system: ${SITE_URL}/en/api-docs

## Pricing

- Carriers on the monthly plan: ${euro(SUBSCRIPTION_UNIT_CENTS)} € (excl. VAT) per vehicle per month, only for vehicles that drove during the month. No percentage on own clients and direct orders; a weekly report of the jobs.
- RAHTIS service on the offer table: service fee 5 % for the shipper and 3 % for the carrier, at least 15 € per job together.
- Direct contract with a carrier on the monthly plan: no service fee.
- API use is free.
- First month free for new companies.

## Who it is for

- Transport companies (carriers) of any size, from one truck upwards, that want one system for their fleet, drivers and own customers — and work from the offer table when a vehicle is free.
- Shippers, freight forwarders and logistics operators that need trailer swaps, container moves or express transport in Northern Europe, from the exchange or directly from their own carriers.

## Links

- Home (English): ${SITE_URL}/en
- Etusivu (suomi): ${SITE_URL}/fi
- Apply / Hae mukaan: ${SITE_URL}/en/apply
- API documentation: ${SITE_URL}/en/api-docs
- Terms of service: ${SITE_URL}/en/terms
- Privacy policy: ${SITE_URL}/en/privacy
- Contact: ${APP.operator.email}

## Suomeksi

RAHTIS on suomalainen kuljetusten hallintajärjestelmä ja rahtipörssi Pohjois-Euroopassa: Suomi, Ruotsi, Norja, Tanska, Viro, Latvia, Liettua, Puola ja Saksa. Kuljetusliike hallitsee samassa paikassa kalustoa, kuljettajia, työaikaa, rahtikirjoja ja omia asiakkaitaan (suorat tilaukset, seurantalinkki asiakkaalle, ei prosenttia omista keikoista). Tarjouspöydältä eli rahtipörssistä hyväksytyt kuljetusliikkeet ottavat tilaajien ja huolitsijoiden julkaisemia kuljetuksia. Rahti: irtoperien vaihdot, konttikuljetukset ja pikakuljetukset. Ylläpitäjä ${APP.operator.legalName} (Y-tunnus ${APP.operator.businessId}).
`;

export function GET() {
  return new Response(BODY, {
    headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'public, max-age=3600' },
  });
}

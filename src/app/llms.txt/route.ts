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

> RAHTIS (${SITE_URL}) is a Finnish freight platform for trailer swaps, container haulage and express van/truck transport in Finland and Scandinavia (Finland, Sweden, Norway, Denmark). Shippers and freight forwarders publish transport orders; approved carriers take them from an offer table or receive them directly. Carriers also use RAHTIS as their own operations platform: driver app, working time, consignment notes (CMR), trip photos and reports. Operated by ${APP.operator.legalName} (business ID ${APP.operator.businessId}), Helsinki, Finland.

## What RAHTIS does

- Trailer swaps (perävaunun vaihto / irtoperät) between ports, terminals and customers — e.g. Hanko, Helsinki Vuosaari, Turku, Kotka.
- Container haulage (20', 40', 45') to and from ports and terminals.
- Express transport by van or truck.
- Offer table: an order reaches suitable approved vehicles at once; up to three offers, the shipper picks one.
- Direct orders: a shipper sends a job straight to a known vehicle, or first to a group of its own vehicles and then to the offer table.
- Live trip status: arrivals, completed stops, estimated arrival, delay and waiting-time alerts, photos and CMR in one place.
- Messages per trip between shipper, carrier and driver, with automatic translation (10 languages).
- Driver app (PWA) in 10 languages: Finnish, English, Swedish, Norwegian, Danish, Estonian, Latvian, Lithuanian, Polish, Russian.
- Shipper API (REST + webhooks) to create and follow orders from the shipper's own system: ${SITE_URL}/en/api-docs

## Pricing

- Carriers on the monthly plan: ${euro(SUBSCRIPTION_UNIT_CENTS)} € (excl. VAT) per vehicle per month, only for vehicles that drove during the month. No percentage on own clients and direct orders; a weekly report of the jobs.
- RAHTIS service on the offer table: service fee 5 % for the shipper and 3 % for the carrier, at least 15 € per job together.
- Direct contract with a carrier on the monthly plan: no service fee.
- API use is free.
- First month free for new companies.

## Who it is for

- Shippers, freight forwarders and logistics operators that need trailer swaps, container moves or express transport in the Nordics.
- Transport companies (carriers) of any size, from one truck upwards, that want work from the offer table or a platform for their own clients.

## Links

- Home (English): ${SITE_URL}/en
- Etusivu (suomi): ${SITE_URL}/fi
- Apply / Hae mukaan: ${SITE_URL}/en/apply
- API documentation: ${SITE_URL}/en/api-docs
- Terms of service: ${SITE_URL}/en/terms
- Privacy policy: ${SITE_URL}/en/privacy
- Contact: ${APP.operator.email}

## Suomeksi

RAHTIS on suomalainen kuljetusalusta irtoperien vaihtoihin, konttikuljetuksiin ja pikakuljetuksiin Suomessa ja Skandinaviassa. Tilaajat julkaisevat kuljetuksia, hyväksytyt kuljetusliikkeet ottavat ne tarjouspöydältä tai saavat suorana tilauksena. Kuljetusliikkeille RAHTIS on myös oma työalusta: kuljettajan sovellus, työaika, rahtikirjat, kuvat ja raportit. Ylläpitäjä ${APP.operator.legalName} (Y-tunnus ${APP.operator.businessId}).
`;

export function GET() {
  return new Response(BODY, {
    headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'public, max-age=3600' },
  });
}

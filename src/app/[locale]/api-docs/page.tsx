import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { LocaleSwitch } from '@/components/layout/LocaleSwitch';
import { APP, siteUrl } from '@/lib/config';
import { getI18n, isLocale } from '@/lib/i18n';
import { pageMetadata } from '@/lib/seo';
import { DOCS } from './content';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const d = DOCS[locale];
  return pageMetadata({ locale, paths: { fi: '/api-docs', en: '/api-docs' }, title: d.title, description: d.description });
}

/**
 * Документация API заказчиков — открыта без входа: её читает программист
 * заказчика, у которого нет доступа в кабинет. Слова — в content.ts,
 * примеры кода — здесь, общие для обоих языков.
 */
export default async function ApiDocsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const { t } = await getI18n(locale);
  const d = DOCS[locale];
  const base = `${siteUrl()}/api/v1`;

  const examples = {
    start: `curl ${base}/orders?status=OPEN,IN_PROGRESS \\
  -H "Authorization: Bearer $RAHTIS_KEY"`,
    sync: `let cursor = null;
do {
  const url = new URL('${base}/orders');
  url.searchParams.set('updated_since', lastSync);
  if (cursor) url.searchParams.set('cursor', cursor);
  const res = await fetch(url, { headers: { Authorization: \`Bearer \${process.env.RAHTIS_KEY}\` } });
  const page = await res.json();
  for (const order of page.data) await save(order);   // lastSync = order.updated_at
  cursor = page.next_cursor;
} while (cursor);`,
    create: `curl -X POST ${base}/orders \\
  -H "Authorization: Bearer $RAHTIS_KEY" \\
  -H "Content-Type: application/json" \\
  -H "Idempotency-Key: PO-4471" \\
  -d '{
    "order_type": "ONE_WAY",
    "shipper_ref": "PO-4471",
    "rate": { "amount": 300 },
    "trailer": "Curtainsider 13.6 m",
    "trailer_plate": "ABC-123",
    "stops": [
      { "role": "PICKUP", "address": "Satamatie 1", "city": "Hanko", "country": "FI",
        "location": { "lat": 59.8208, "lon": 22.9565 },
        "scheduled_date": "2026-10-05", "cargo_weight_kg": 20000 },
      { "role": "DELIVERY", "address": "Tikkurilantie 10", "city": "Vantaa", "country": "FI",
        "company_name": "Vastaanottaja Oy", "scheduled_date": "2026-10-05" }
    ]
  }'`,
    error: `HTTP/1.1 422
{
  "error": {
    "code": "unprocessable",
    "message": "Some stops are invalid.",
    "details": [
      { "field": "stops[1].address",
        "issue": "address could not be located precisely; send location { lat, lon }" }
    ]
  }
}`,
    withdraw: `curl -X POST ${base}/orders/RS-2026-0142/withdraw \\
  -H "Authorization: Bearer $RAHTIS_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{ "reason": "Customer cancelled" }'`,
    payload: `POST /your/webhook
Rahtis-Event: order.stop_completed
Rahtis-Delivery: 3f1c9a52-6a0e-4c43-9d7e-5b2f0e8d1a44
Rahtis-Signature: t=1790000000,v1=5d1e…

{
  "id": "3f1c9a52-6a0e-4c43-9d7e-5b2f0e8d1a44",
  "type": "order.stop_completed",
  "created_at": "2026-10-05T09:12:44.120Z",
  "data": {
    "ref": "RS-2026-0142",
    "shipper_ref": "PO-4471",
    "stop": { "sequence": 0, "role": "PICKUP", "city": "Hanko",
              "completed_at": "2026-10-05T09:12:43.980Z" }
  }
}`,
    node: `import crypto from 'node:crypto';

// rawBody: the request body exactly as received (Buffer or string), before JSON.parse
function verify(header, rawBody, secret) {
  const parts = Object.fromEntries(header.split(',').map((p) => p.split('=')));
  const expected = crypto.createHmac('sha256', secret).update(\`\${parts.t}.\${rawBody}\`).digest('hex');
  const fresh = Math.abs(Date.now() / 1000 - Number(parts.t)) < 300;
  return fresh && parts.v1?.length === 64 &&
    crypto.timingSafeEqual(Buffer.from(parts.v1, 'hex'), Buffer.from(expected, 'hex'));
}`,
    python: `import hmac, hashlib, time

def verify(header: str, raw_body: bytes, secret: str) -> bool:
    parts = dict(p.split("=", 1) for p in header.split(","))
    signed = parts["t"].encode() + b"." + raw_body
    expected = hmac.new(secret.encode(), signed, hashlib.sha256).hexdigest()
    fresh = abs(time.time() - int(parts["t"])) < 300
    return fresh and hmac.compare_digest(parts.get("v1", ""), expected)`,
  };

  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-10">
      <nav className="mb-8 flex items-center justify-between gap-4">
        <Link href={`/${locale}`} className="text-[13px] text-ink-muted hover:text-ink">
          ← {t.brand.name}
        </Link>
        <LocaleSwitch current={locale} />
      </nav>

      <h1 className="text-2xl font-semibold tracking-tight">{d.title}</h1>
      <p className="mt-3 text-[14px] leading-relaxed text-ink-muted">{d.intro}</p>
      <p className="mt-3 text-[14px] leading-relaxed text-ink-muted">
        {d.openapi}{' '}
        <a href="/api/v1/openapi.json" className="font-mono text-[13px] text-ink underline underline-offset-2">
          {base}/openapi.json
        </a>
      </p>
      <p className="mt-2 text-[14px] leading-relaxed text-ink-muted">{d.cabinet}</p>

      <Section id="start" section={d.start} code={[examples.start]} />
      <Section id="sync" section={d.sync} code={[examples.sync]} />
      <Section id="orders" section={d.details} />
      <Section id="create" section={d.create} code={[examples.create, examples.error]} />
      <Section id="withdraw" section={d.withdraw} code={[examples.withdraw]} />

      <Section id="webhooks" section={d.webhooks}>
        <table className="mt-4 w-full text-left text-[13px]">
          <thead>
            <tr className="border-b border-line text-ink-faint">
              <th className="py-2 pr-4 font-medium">{d.eventHeader}</th>
              <th className="py-2 font-medium">{d.whenHeader}</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(d.events).map(([event, when]) => (
              <tr key={event} className="border-b border-line/60 align-top">
                <td className="py-2 pr-4 font-mono text-[12px] whitespace-nowrap">{event}</td>
                <td className="py-2 text-ink-muted">{when}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <Code text={examples.payload} />
      </Section>

      <Section id="signature" section={d.verify} code={[examples.node, examples.python]} />

      <Section id="errors" section={d.errors}>
        <table className="mt-4 w-full text-left text-[13px]">
          <thead>
            <tr className="border-b border-line text-ink-faint">
              <th className="py-2 pr-4 font-medium">{d.codeHeader}</th>
              <th className="py-2 font-medium">{d.meaningHeader}</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(d.errorCodes).map(([code, meaning]) => (
              <tr key={code} className="border-b border-line/60 align-top">
                <td className="py-2 pr-4 font-mono text-[12px] whitespace-nowrap">{code}</td>
                <td className="py-2 text-ink-muted">{meaning}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      <Section id="limits" section={d.limits} />

      <p className="mt-10 border-t border-line pt-4 text-xs text-ink-dim">
        {t.brand.legalEntity} · {APP.operator.businessId} · {t.landing.footerCountry}
      </p>
    </main>
  );
}

function Section({
  id,
  section,
  code = [],
  children,
}: {
  id: string;
  section: { title: string; paragraphs: string[] };
  code?: string[];
  children?: React.ReactNode;
}) {
  return (
    <section id={id} className="mt-10 scroll-mt-6">
      <h2 className="border-b border-line pb-2 text-lg font-semibold tracking-tight">{section.title}</h2>
      {section.paragraphs.map((p) => (
        <p key={p} className="mt-3 text-[14px] leading-relaxed text-ink-muted">
          {p}
        </p>
      ))}
      {code.map((c) => (
        <Code key={c} text={c} />
      ))}
      {children}
    </section>
  );
}

function Code({ text }: { text: string }) {
  return (
    <pre className="mt-4 overflow-x-auto rounded-control border border-line bg-sunken p-4 text-[12px] leading-relaxed">
      <code>{text}</code>
    </pre>
  );
}

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Badge, Button, Card, CardBody, EmptyState, Mono } from '@/components/ui';
import { deleteWebhookAction, pingWebhookAction, revokeApiKeyAction } from '@/lib/api/actions';
import { requireRole } from '@/lib/auth/guard';
import { siteUrl } from '@/lib/config';
import { getI18n, isLocale } from '@/lib/i18n';
import { createClient } from '@/lib/supabase/server';
import { CreateKeyForm } from './CreateKeyForm';
import { CreateWebhookForm } from './CreateWebhookForm';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const { t } = await getI18n(locale);
  return { title: t.api.title };
}

/**
 * Ключи API заказчика.
 *
 * Список показывает только начало ключа: сам ключ виден один раз, при
 * выпуске (CreateKeyForm). Здесь же короткий пример запроса — чтобы
 * программист заказчика начал без переписки с нами.
 */
export default async function ApiKeysPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  await requireRole(locale, 'SHIPPER');
  const [{ t, f }, supabase] = await Promise.all([getI18n(locale), createClient()]);

  const { data } = await supabase
    .from('api_keys')
    .select('id,name,prefix,scope,created_at,last_used_at,revoked_at')
    .order('created_at', { ascending: false });
  const keys = data ?? [];
  const active = keys.filter((k) => !k.revoked_at);
  const revoked = keys.filter((k) => k.revoked_at);
  const base = `${siteUrl()}/api/v1`;

  const [{ data: hooksData }, { data: deliveriesData }] = await Promise.all([
    supabase
      .from('api_webhooks')
      .select('id,url,events,created_at,disabled_at,failures')
      .is('disabled_at', null)
      .order('created_at'),
    supabase
      .from('api_webhook_deliveries')
      .select('id,webhook_id,event,status,attempts,last_status,last_error,created_at,delivered_at')
      .order('created_at', { ascending: false })
      .limit(20),
  ]);
  const hooks = hooksData ?? [];
  const deliveries = deliveriesData ?? [];

  return (
    <main className="cab-page">
      <h1 className="page-title">{t.api.title}</h1>
      <p className="mt-2 mb-6 max-w-2xl text-[13px] leading-relaxed text-ink-muted">{t.api.subtitle}</p>

      <Card className="mb-8">
        <CardBody>
          <CreateKeyForm locale={locale} />
        </CardBody>
      </Card>

      <section className="mb-8">
        <h2 className="mb-4 border-b border-line pb-2 text-[13px] font-semibold tracking-tight text-ink-faint">
          {t.api.activeKeys}
        </h2>
        {active.length === 0 ? (
          <EmptyState title={t.api.none} description={t.api.noneHint} />
        ) : (
          <div className="flex flex-col gap-3">
            {active.map((k) => (
              <Card key={k.id} stripe="ok">
                <CardBody className="flex flex-wrap items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <span className="text-[14px] font-semibold">{k.name}</span>
                      <Badge tone={k.scope === 'WRITE' ? 'warn' : 'neutral'}>{t.api.scopes[k.scope]}</Badge>
                    </div>
                    <p className="mt-1 text-[13px] text-ink-muted">
                      <Mono>{k.prefix}_…</Mono> · {t.api.created} {f.date(k.created_at)} ·{' '}
                      {k.last_used_at ? `${t.api.lastUsed} ${f.dateTime(k.last_used_at)}` : t.api.neverUsed}
                    </p>
                  </div>
                  <form action={revokeApiKeyAction}>
                    <input type="hidden" name="locale" value={locale} />
                    <input type="hidden" name="id" value={k.id} />
                    <Button type="submit" size="sm" variant="danger">
                      {t.api.revoke}
                    </Button>
                  </form>
                </CardBody>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section className="mb-8">
        <h2 className="mb-4 border-b border-line pb-2 text-[13px] font-semibold tracking-tight text-ink-faint">
          {t.api.quickStart}
        </h2>
        <p className="mb-3 max-w-2xl text-[13px] leading-relaxed text-ink-muted">{t.api.quickStartHint}</p>
        <pre className="overflow-x-auto rounded-control border border-line bg-sunken p-4 text-[12px] leading-relaxed">
          <code>{`curl ${base}/orders?status=OPEN,IN_PROGRESS \\
  -H "Authorization: Bearer rhs_live_…"

curl ${base}/orders/RS-2026-0001
curl ${base}/orders/RS-2026-0001/events
curl ${base}/orders/RS-2026-0001/documents`}</code>
        </pre>
        <p className="mt-3 max-w-2xl text-[12px] leading-relaxed text-ink-dim">{t.api.limits}</p>
        <p className="mt-3 text-[13px]">
          <a href={`/${locale}/api-docs`} className="text-ink underline underline-offset-2">
            {t.api.docsLink} →
          </a>
        </p>
      </section>

      <section className="mb-8">
        <h2 className="mb-4 border-b border-line pb-2 text-[13px] font-semibold tracking-tight text-ink-faint">
          {t.api.hooks.title}
        </h2>
        <p className="mb-4 max-w-2xl text-[13px] leading-relaxed text-ink-muted">{t.api.hooks.subtitle}</p>

        {hooks.length > 0 && (
          <div className="mb-4 flex flex-col gap-3">
            {hooks.map((h) => (
              <Card key={h.id} stripe={h.failures > 0 ? 'warn' : 'ok'}>
                <CardBody className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <Mono className="break-all text-[13px]">{h.url}</Mono>
                    <p className="mt-1 text-[12px] text-ink-muted">{h.events.join(' · ')}</p>
                    {h.failures > 0 && (
                      <p className="mt-1 text-[12px] text-warn">
                        {t.api.hooks.failures}: {h.failures}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <form action={pingWebhookAction}>
                      <input type="hidden" name="locale" value={locale} />
                      <input type="hidden" name="id" value={h.id} />
                      <Button type="submit" size="sm">
                        {t.api.hooks.ping}
                      </Button>
                    </form>
                    <form action={deleteWebhookAction}>
                      <input type="hidden" name="locale" value={locale} />
                      <input type="hidden" name="id" value={h.id} />
                      <Button type="submit" size="sm" variant="danger">
                        {t.api.hooks.remove}
                      </Button>
                    </form>
                  </div>
                </CardBody>
              </Card>
            ))}
          </div>
        )}

        <Card className="mb-4">
          <CardBody>
            <CreateWebhookForm locale={locale} />
          </CardBody>
        </Card>

        {deliveries.length > 0 && (
          <div className="mb-4">
            <p className="label-micro mb-2">{t.api.hooks.recent}</p>
            <ul className="flex flex-col gap-1 text-[12px]">
              {deliveries.map((d) => (
                <li key={d.id} className="flex flex-wrap gap-x-3 text-ink-muted">
                  <Mono>{f.dateTime(d.created_at)}</Mono>
                  <Mono className="text-ink">{d.event}</Mono>
                  <Badge tone={d.status === 'SENT' ? 'ok' : d.status === 'FAILED' ? 'danger' : 'neutral'}>
                    {t.api.hooks.statuses[d.status as 'SENT' | 'FAILED' | 'PENDING']}
                  </Badge>
                  {d.last_status ? <span>HTTP {d.last_status}</span> : null}
                  {d.last_error && d.status !== 'SENT' ? <span>{d.last_error}</span> : null}
                  {d.attempts > 1 ? <span>× {d.attempts}</span> : null}
                </li>
              ))}
            </ul>
          </div>
        )}

        <p className="mb-2 max-w-2xl text-[13px] leading-relaxed text-ink-muted">{t.api.hooks.verifyHint}</p>
        <pre className="overflow-x-auto rounded-control border border-line bg-sunken p-4 text-[12px] leading-relaxed">
          <code>{`// Node.js
const [t, v1] = req.headers['rahtis-signature'].split(',').map((p) => p.split('=')[1]);
const expected = crypto.createHmac('sha256', SECRET).update(\`\${t}.\${rawBody}\`).digest('hex');
const ok = crypto.timingSafeEqual(Buffer.from(v1), Buffer.from(expected))
  && Math.abs(Date.now() / 1000 - Number(t)) < 300;`}</code>
        </pre>
      </section>

      {revoked.length > 0 && (
        <section>
          <h2 className="mb-4 border-b border-line pb-2 text-[13px] font-semibold tracking-tight text-ink-faint">
            {t.api.revokedKeys}
          </h2>
          <ul className="flex flex-col gap-1.5 text-[13px] text-ink-muted">
            {revoked.map((k) => (
              <li key={k.id}>
                {k.name} · <Mono>{k.prefix}_…</Mono> · {t.api.revokedAt} {f.date(k.revoked_at!)}
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}

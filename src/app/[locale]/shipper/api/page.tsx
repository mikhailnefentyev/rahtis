import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Badge, Button, Card, CardBody, EmptyState, Mono } from '@/components/ui';
import { revokeApiKeyAction } from '@/lib/api/actions';
import { requireRole } from '@/lib/auth/guard';
import { siteUrl } from '@/lib/config';
import { getI18n, isLocale } from '@/lib/i18n';
import { createClient } from '@/lib/supabase/server';
import { CreateKeyForm } from './CreateKeyForm';

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

  return (
    <main className="mx-auto w-full max-w-4xl px-5 py-8">
      <h1 className="text-xl font-semibold tracking-tight">{t.api.title}</h1>
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

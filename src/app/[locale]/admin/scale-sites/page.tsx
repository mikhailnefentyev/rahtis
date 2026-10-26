import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Badge, Button, Card, CardBody, EmptyState } from '@/components/ui';
import { requireRole } from '@/lib/auth/guard';
import { getI18n, isLocale } from '@/lib/i18n';
import { decideScaleSiteAction } from '@/lib/sites/actions';
import { createClient } from '@/lib/supabase/server';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const { t } = await getI18n(locale);
  return { title: t.scaleSites.title };
}

/**
 * Проверка пунктов приёмки. В общий список попадают только пункты,
 * одобренные здесь, и весы mScales; пункт, добавленный водителем, до
 * решения видит лишь его компания.
 */
export default async function ScaleSitesAdminPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  await requireRole(locale, 'ADMIN');
  const [{ t, f }, supabase] = await Promise.all([getI18n(locale), createClient()]);
  const s = t.scaleSites;

  const [{ data: sites }, { data: companies }] = await Promise.all([
    supabase.from('scale_sites').select('*').order('created_at', { ascending: false }),
    supabase.from('companies').select('id, name'),
  ]);
  const companyName = new Map((companies ?? []).map((c) => [c.id, c.name]));
  const pending = (sites ?? []).filter((x) => !x.approved_at && !x.rejected_at);
  const approved = (sites ?? []).filter((x) => x.approved_at);

  const decide = (id: string, decision: 'APPROVE' | 'REJECT', label: string, variant: 'primary' | 'ghost') => (
    <form action={decideScaleSiteAction}>
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="decision" value={decision} />
      <Button type="submit" size="sm" variant={variant}>
        {label}
      </Button>
    </form>
  );

  return (
    <main className="cab-page">
      <h1 className="page-title">{s.title}</h1>
      <p className="mt-2 mb-6 max-w-2xl text-[13px] leading-relaxed text-ink-muted">{s.lede}</p>

      <h2 className="mb-3 border-b border-line pb-2 text-[13px] font-semibold tracking-tight text-ink-faint">
        {s.pending} · {pending.length}
      </h2>
      {pending.length === 0 ? (
        <EmptyState title={s.pending} description={s.empty} />
      ) : (
        <div className="mb-8 flex flex-col gap-2">
          {pending.map((site) => (
            <Card key={site.id}>
              <CardBody className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0 text-[13px]">
                  <p className="text-[15px] font-semibold">{site.name}</p>
                  <p className="text-ink-muted">
                    {s.addedBy}: {site.created_by_company ? (companyName.get(site.created_by_company) ?? '—') : '—'} · {f.dateTime(site.created_at)}
                    {site.lat != null && site.lon != null && (
                      <>
                        {' · '}
                        <a
                          className="text-accent underline"
                          href={`https://www.openstreetmap.org/?mlat=${site.lat}&mlon=${site.lon}#map=16/${site.lat}/${site.lon}`}
                          target="_blank"
                          rel="noopener"
                        >
                          {s.map}
                        </a>
                      </>
                    )}
                  </p>
                </div>
                <div className="flex gap-2">
                  {decide(site.id, 'APPROVE', s.approve, 'primary')}
                  {decide(site.id, 'REJECT', s.reject, 'ghost')}
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      <h2 className="mt-8 mb-3 border-b border-line pb-2 text-[13px] font-semibold tracking-tight text-ink-faint">
        {s.approvedList} · {approved.length}
      </h2>
      <ul className="flex flex-col divide-y divide-line text-[13px]">
        {approved.map((site) => (
          <li key={site.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
            <span>
              {site.name}
              {site.city ? `, ${site.city}` : ''}
              {site.mscales && (
                <Badge tone="info" className="ml-2">
                  mScales
                </Badge>
              )}
            </span>
            {decide(site.id, 'REJECT', s.reject, 'ghost')}
          </li>
        ))}
      </ul>
    </main>
  );
}

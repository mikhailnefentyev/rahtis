import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Badge, Button, Card, CardBody, Mono } from '@/components/ui';
import { VerifiedBadge } from '@/components/domain/VerifiedBadge';
import { requireRole } from '@/lib/auth/guard';
import { siteUrl } from '@/lib/config';
import { businessIdLabel } from '@/lib/country';
import { daysUntil, todayInHelsinki } from '@/lib/dates';
import { isLocale } from '@/lib/i18n';
import { getViewerI18n } from '@/lib/i18n/viewer';
import { createClient } from '@/lib/supabase/server';
import { deleteVerificationAction } from '@/lib/verification/actions';
import { fill } from '@/lib/verification/fill';
import { itemStatus, itemStatusTone, type VerificationItem } from '@/lib/verification/items';
import { loadPackage, VERIFICATION_BUCKET } from '@/lib/verification/package';
import { RefreshRegistry } from './RefreshRegistry';
import { ShareLinks, type ShareRow } from './ShareLinks';
import { UploadForm } from './UploadForm';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const { t } = await getViewerI18n(locale);
  return { title: t.verification.nav };
}

type ShareSource = {
  id: string;
  token: string;
  label: string | null;
  created_at: string;
  expires_at: string | null;
  revoked_at: string | null;
};

/* Состояние ссылки — на момент запроса, вне рендера. */
function toShareRows(shares: ShareSource[], prefix: string): ShareRow[] {
  const now = Date.now();
  return shares.map((s) => ({
    id: s.id,
    url: `${prefix}${s.token}`,
    label: s.label,
    created_at: s.created_at,
    expires_at: s.expires_at,
    state: s.revoked_at ? 'REVOKED' : s.expires_at && Date.parse(s.expires_at) <= now ? 'EXPIRED' : 'ACTIVE',
  }));
}

/**
 * Пакет tilaajavastuu перевозчика: что требует закон, что уже есть,
 * что истекает. Реестровые пункты закрываются данными PRH автоматически,
 * остальные — справками с датой выдачи. Значок выдаёт оператор, а гаснет
 * он сам, когда истекает любой пункт (app.company_verified).
 */
export default async function VerificationPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const viewer = await requireRole(locale, 'CARRIER');
  const company = viewer.company!;
  const [{ t, f }, supabase] = await Promise.all([getViewerI18n(locale), createClient()]);
  const v = t.verification;
  const today = todayInHelsinki();

  const [pkg, { data: documents }, { data: grant }, { data: shares }] = await Promise.all([
    loadPackage(company.id, false),
    supabase
      .from('verification_documents')
      .select('id, items, source, file_name, storage_path, issued_on, valid_until')
      .eq('company_id', company.id)
      .order('valid_until', { ascending: false }),
    supabase.from('verification_grants').select('granted_at, revoked_at').eq('company_id', company.id).maybeSingle(),
    supabase
      .from('verification_shares')
      .select('id, token, label, created_at, expires_at, revoked_at')
      .eq('company_id', company.id)
      .order('created_at', { ascending: false }),
  ]);

  /* Свои файлы подписывает клиент пользователя: политика Storage проверяется ещё раз. */
  const { data: signed } = (documents ?? []).length
    ? await supabase.storage.from(VERIFICATION_BUCKET).createSignedUrls(
        (documents ?? []).map((d) => d.storage_path),
        600,
      )
    : { data: [] };
  const urlOf = (path: string) => signed?.find((s) => s.path === path)?.signedUrl ?? null;

  const granted = Boolean(grant && !grant.revoked_at);
  const verified = pkg?.verified ?? false;
  const date = (iso: string) => f.date(`${iso.slice(0, 10)}T12:00:00Z`);

  const shareRows = toShareRows(shares ?? [], `${siteUrl()}/${locale}/v/`);

  return (
    <main className="cab-page">
      <h1 className="page-title">{v.title}</h1>
      <p className="mt-2 mb-6 max-w-2xl text-[13px] leading-relaxed text-ink-muted">{v.subtitle}</p>

      <Card stripe={verified ? 'ok' : granted ? 'warn' : 'neutral'} className="mb-8">
        <CardBody className="flex flex-wrap items-center gap-3">
          {verified && <VerifiedBadge label={v.badge} hint={v.badgeHint} />}
          <span className="text-[13px] text-ink">
            {verified ? v.statusVerified : granted ? v.statusLapsed : v.statusNotGranted}
          </span>
        </CardBody>
      </Card>

      <section className="mb-8">
        <h2 className="mb-4 border-b border-line pb-2 text-[13px] font-semibold tracking-tight text-ink-faint">
          {v.registryTitle}
        </h2>
        <Card>
          <CardBody className="flex flex-wrap items-start justify-between gap-4">
            <div className="grid min-w-0 gap-x-6 gap-y-1 text-[13px] sm:grid-cols-2">
              <p>
                <span className="text-ink-faint">{businessIdLabel(company.country, v.businessId)}: </span>
                <Mono>{company.business_id}</Mono>
              </p>
              <p>
                <span className="text-ink-faint">{v.company}: </span>
                {pkg?.registry?.officialName ?? company.name}
              </p>
              {pkg?.registry ? (
                <>
                  {(
                    [
                      [v.tradeRegister, pkg.registry.tradeRegister],
                      [v.prepayment, pkg.registry.prepayment],
                      [v.vat, pkg.registry.vat],
                      [v.employer, pkg.registry.employer],
                    ] as Array<[string, boolean | null]>
                  ).map(([label, value]) => (
                    <p key={label}>
                      <span className="text-ink-faint">{label}: </span>
                      {value == null ? v.unknown : value ? v.yes : v.no}
                    </p>
                  ))}
                  {pkg.registry.checkedAt && (
                    <p className="text-xs text-ink-dim sm:col-span-2">
                      {fill(v.checkedAt, { date: f.date(pkg.registry.checkedAt) })}
                    </p>
                  )}
                </>
              ) : (
                <p className="text-ink-muted sm:col-span-2">{v.noRegistry}</p>
              )}
            </div>
            <RefreshRegistry />
          </CardBody>
        </Card>
      </section>

      <section className="mb-8">
        <h2 className="mb-4 border-b border-line pb-2 text-[13px] font-semibold tracking-tight text-ink-faint">
          {v.packageTitle}
        </h2>
        <div className="grid gap-3 lg:grid-cols-2">
          {(pkg?.items ?? []).map((i) => {
            const tone = itemStatusTone[i.status];
            return (
              <Card key={i.item} stripe={i.status === 'MISSING' ? 'warn' : tone}>
                <CardBody className="flex flex-col gap-2">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <h3 className="text-[13px] font-semibold tracking-tight">{v.items[i.item]}</h3>
                    <Badge tone={tone}>{v.status[i.status]}</Badge>
                  </div>
                  {i.valid_until && (
                    <p className="text-xs text-ink-muted">
                      {fill(v.validUntilDate, { date: date(i.valid_until) })} ·{' '}
                      {i.source === 'PRH' ? v.fromPrh : v.fromDocument}
                    </p>
                  )}
                  <p className="text-xs text-ink-dim">{v.itemHints[i.item]}</p>
                  <UploadForm item={i.item} today={today} compact />
                </CardBody>
              </Card>
            );
          })}

          <Card stripe="info" className="lg:col-span-2">
            <CardBody className="flex flex-col gap-2">
              <h3 className="text-[13px] font-semibold tracking-tight">{v.vastuuTitle}</h3>
              <p className="text-xs text-ink-muted">{v.vastuuHint}</p>
              <UploadForm item={null} today={today} compact />
            </CardBody>
          </Card>
        </div>
      </section>

      <section className="mb-8">
        <h2 className="mb-4 border-b border-line pb-2 text-[13px] font-semibold tracking-tight text-ink-faint">
          {v.documents}
        </h2>
        {(documents ?? []).length === 0 ? (
          <p className="text-[13px] text-ink-muted">{v.noDocuments}</p>
        ) : (
          <div className="flex flex-col gap-2">
            {(documents ?? []).map((d) => {
              const status = itemStatus(daysUntil(`${d.valid_until}T12:00:00Z`));
              const url = urlOf(d.storage_path);
              const items = d.items as VerificationItem[];
              return (
                <Card key={d.id}>
                  <CardBody className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[13px] font-semibold">
                          {d.source === 'VASTUU' ? v.vastuuTitle : v.items[items[0]]}
                        </span>
                        <Badge tone={itemStatusTone[status]}>{v.status[status]}</Badge>
                      </div>
                      <p className="mt-0.5 truncate text-xs text-ink-muted">
                        {d.source === 'VASTUU' && `${items.map((i) => v.items[i]).join(' · ')} · `}
                        {d.file_name}
                      </p>
                      <p className="text-xs text-ink-dim">
                        {fill(v.issued, { date: date(d.issued_on) })} · {fill(v.validUntilDate, { date: date(d.valid_until) })}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {url && (
                        <a href={url} target="_blank" rel="noopener noreferrer" className="text-[13px] text-accent hover:underline">
                          {v.open}
                        </a>
                      )}
                      <form action={deleteVerificationAction}>
                        <input type="hidden" name="locale" value={locale} />
                        <input type="hidden" name="id" value={d.id} />
                        <Button type="submit" size="sm" variant="ghost">
                          {v.remove}
                        </Button>
                      </form>
                    </div>
                  </CardBody>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      <section className="mb-8">
        <h2 className="mb-2 border-b border-line pb-2 text-[13px] font-semibold tracking-tight text-ink-faint">
          {v.shareTitle}
        </h2>
        <p className="mb-4 max-w-2xl text-[13px] leading-relaxed text-ink-muted">{v.shareHint}</p>
        <ShareLinks rows={shareRows} today={today} />
      </section>
    </main>
  );
}

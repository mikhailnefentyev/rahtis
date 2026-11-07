import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { CabinetShell } from '@/components/layout/CabinetShell';
import { Button, Card, CardBody, EmptyState, Mono } from '@/components/ui';
import { cabinetPath, signInPath } from '@/lib/auth/paths';
import { getViewer } from '@/lib/auth/viewer';
import { isLocale } from '@/lib/i18n';
import { getViewerI18n } from '@/lib/i18n/viewer';
import { dismissEmailDraftAction } from '@/lib/inbound/actions';
import { loadEmailChanges } from '@/lib/inbound/changesLoad';
import { emailChangesAsNewAction } from '@/lib/orders/amend';
import { EmailChangesForm } from './EmailChangesForm';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const { t } = await getViewerI18n(locale);
  return { title: t.emailChanges.metaTitle };
}

/**
 * Поправка к рейсу из письма (7.11.2026): клиент прислал письмо с тем же
 * номером заказа, что у идущего рейса. Здесь — «сейчас → в письме» и
 * выбор, что принять. Ничего не меняется без человека.
 */
export default async function EmailChangesPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  if (!isLocale(locale)) notFound();

  const viewer = await getViewer();
  if (viewer.status === 'guest' || viewer.status === 'mfa') redirect(signInPath(locale, `/${locale}/email-changes/${id}`));
  if (viewer.status !== 'ready' || (viewer.role !== 'SHIPPER' && viewer.role !== 'CARRIER')) notFound();

  const [{ t, f }, loaded] = await Promise.all([getViewerI18n(locale), loadEmailChanges(id, locale, viewer.role)]);
  const tc = t.emailChanges;
  const back = cabinetPath(locale, viewer.role);
  const tripHref = viewer.role === 'CARRIER' ? `/${locale}/carrier/desk` : `/${locale}/shipper/orders`;

  let content: React.ReactNode;
  if (!loaded.ok) {
    content = (
      <EmptyState
        className="mt-6"
        title={tc.gone}
        action={
          <Link href={back} className="text-[13px] font-semibold text-accent hover:underline">
            ← {t.brand.operator}
          </Link>
        }
      />
    );
  } else {
    const { value } = loaded;
    const stopLabels: Record<string, string> = {};
    for (const stop of value.changes.stops) {
      const kind = (t.stopKind as Record<string, string>)[stop.role] ?? stop.role;
      stopLabels[stop.stopId] = [kind, stop.city].filter(Boolean).join(' · ') + (stop.place ? ` (${stop.place})` : '');
    }
    const hidden = (
      <>
        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="draft_id" value={value.draftId} />
      </>
    );

    content = (
      <>
        <h1 className="page-title">{tc.title.replace('{ref}', value.order.ref)}</h1>
        <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-ink-muted">
          {tc.intro
            .replace('{subject}', value.subject || '—')
            .replace('{from}', value.from)
            .replace('{date}', f.dateTime(value.receivedAt))
            .replace('{shipperRef}', value.order.shipperRef ?? '—')}
        </p>

        <Card className="mt-5">
          <CardBody>
            {value.changes.empty ? (
              <p className="text-[13px]">{tc.empty}</p>
            ) : (
              <EmailChangesForm locale={locale} draftId={value.draftId} changes={value.changes} stopLabels={stopLabels} />
            )}
          </CardBody>
        </Card>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Link href={tripHref} className="text-[13px] font-semibold text-accent hover:underline">
            {tc.toTrip} <Mono>{value.order.ref}</Mono> →
          </Link>
          <span className="flex-1" />
          <form action={emailChangesAsNewAction}>
            {hidden}
            <Button type="submit" size="sm">
              {tc.asNew}
            </Button>
          </form>
          <form action={dismissEmailDraftAction}>
            {hidden}
            <Button type="submit" size="sm" variant="ghost">
              {tc.dismiss}
            </Button>
          </form>
        </div>
      </>
    );
  }

  return (
    <CabinetShell locale={locale} role={viewer.role} company={viewer.company}>
      <main className="cab-page cab-page--narrow">{content}</main>
    </CabinetShell>
  );
}

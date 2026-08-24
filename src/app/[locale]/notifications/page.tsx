import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { LocaleSwitch } from '@/components/layout/LocaleSwitch';
import { Button, Card, CardBody, EmptyState, Mono } from '@/components/ui';
import { markAllReadAction } from '@/lib/notifications/actions';
import { cabinetPath, noAccessPath, signInPath } from '@/lib/auth/paths';
import { getViewer } from '@/lib/auth/viewer';
import { getI18n, isLocale } from '@/lib/i18n';
import { createClient } from '@/lib/supabase/server';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const { t } = await getI18n(locale);
  return { title: t.notify.title };
}

/**
 * Уведомления компании.
 *
 * Первый из двух каналов и единственный, который работает всегда. Здесь
 * лежит то же, что дублируется письмом, — и текст написан так, чтобы
 * письма могло не быть вовсе.
 */
export default async function NotificationsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const viewer = await getViewer();
  if (viewer.status === 'guest') redirect(signInPath(locale, `/${locale}/notifications`));

  const [{ t, f }, supabase] = await Promise.all([getI18n(locale), createClient()]);

  const { data: rows } = await supabase
    .from('notifications')
    .select('id, created_at, kind, title, body, link, read_at')
    .order('created_at', { ascending: false })
    .limit(100);

  const list = rows ?? [];
  const unread = list.filter((row) => row.read_at === null).length;
  const back = viewer.status === 'ready' ? cabinetPath(locale, viewer.role) : noAccessPath(locale);

  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-8">
      <nav className="mb-6 flex items-center justify-between gap-4">
        <Link href={back} className="text-[13px] text-ink-muted hover:text-ink">
          ← {viewer.status === 'ready' ? t.role[viewer.role] : t.brand.operator}
        </Link>
        <LocaleSwitch current={locale} />
      </nav>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold tracking-tight">{t.notify.title}</h1>

        {unread > 0 && (
          <form action={markAllReadAction}>
            <input type="hidden" name="locale" value={locale} />
            <Button type="submit" size="sm">
              {t.notify.markAllRead}
            </Button>
          </form>
        )}
      </div>

      {list.length === 0 ? (
        <EmptyState className="mt-6" title={t.notify.empty} description={t.notify.emptyHint} />
      ) : (
        <ul className="mt-6 flex flex-col gap-2.5">
          {list.map((row) => (
            <li key={row.id}>
              {/* Непрочитанное отличается полосой, а не цветом текста: цвет уже занят статусами. */}
              <Card stripe={row.read_at === null ? 'info' : 'neutral'}>
                <CardBody className="flex flex-col gap-1.5">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                    <span className="text-[14px] font-semibold">{row.title}</span>
                    <Mono className="text-xs text-ink-faint">{f.dateTime(row.created_at)}</Mono>
                  </div>

                  {row.body && (
                    <p className="text-[13px] leading-relaxed text-ink-muted">{row.body}</p>
                  )}

                  {row.link && (
                    <Link
                      href={`/${locale}${row.link}`}
                      className="self-start text-[13px] font-semibold text-accent hover:underline"
                    >
                      {t.notify.open} →
                    </Link>
                  )}
                </CardBody>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

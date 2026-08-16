import { notFound, redirect } from 'next/navigation';
import { Button, Card, CardBody } from '@/components/ui';
import { signOutAction } from '@/lib/auth/actions';
import { cabinetPath, signInPath } from '@/lib/auth/paths';
import { getViewer } from '@/lib/auth/viewer';
import { getI18n, isLocale } from '@/lib/i18n';

/**
 * Тупик для тех, у кого кабинета нет.
 *
 * Два случая, и оба реальные:
 *   — пользователь без профиля (заведён вручную, роли в app_metadata нет);
 *   — компания отклонена модерацией.
 *
 * Молча выкидывать таких на страницу входа нельзя: человек ввёл верный
 * пароль, и «вход не сработал» без объяснения выглядит как поломка.
 */
export default async function NoAccessPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const viewer = await getViewer();
  if (viewer.status === 'guest') redirect(signInPath(locale));

  /* Профиль появился, компания не отклонена — здесь делать нечего. */
  if (viewer.status === 'ready' && viewer.company?.status !== 'REJECTED') {
    redirect(cabinetPath(locale, viewer.role));
  }

  const { t } = await getI18n(locale);
  const rejected = viewer.status === 'ready';

  return (
    <main className="flex flex-1 items-center justify-center px-5 py-12">
      <Card className="w-full max-w-md" stripe={rejected ? 'danger' : 'warn'}>
        <CardBody className="p-6">
          <h1 className="text-[15px] font-semibold tracking-tight">{t.auth.noAccessTitle}</h1>
          <p className="mt-2 text-[13px] leading-relaxed text-ink-muted">
            {rejected ? t.auth.rejectedText : t.auth.noProfileText}
          </p>

          <p className="mt-4 font-mono text-xs text-ink-dim">{viewer.email}</p>

          <form action={signOutAction} className="mt-5">
            <input type="hidden" name="locale" value={locale} />
            <Button type="submit" className="w-full">
              {t.auth.signOut}
            </Button>
          </form>
        </CardBody>
      </Card>
    </main>
  );
}

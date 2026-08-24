import { notFound, redirect } from 'next/navigation';
import { Button, Card, CardBody } from '@/components/ui';
import { signOutAction } from '@/lib/auth/actions';
import { cabinetPath, signInPath } from '@/lib/auth/paths';
import { getViewer } from '@/lib/auth/viewer';
import { LocaleSwitch } from '@/components/layout/LocaleSwitch';
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

  const frozen = viewer.status === 'ready' && Boolean(viewer.company?.frozen_at);
  const rejected = viewer.status === 'ready' && viewer.company?.status === 'REJECTED';

  /* Профиль есть, компания жива и не отклонена — здесь делать нечего. */
  if (viewer.status === 'ready' && !rejected && !frozen) {
    redirect(cabinetPath(locale, viewer.role));
  }

  const { t } = await getI18n(locale);

  return (
    <main className="relative flex flex-1 items-center justify-center px-5 py-12">
      <div className="absolute top-5 right-5">
        <LocaleSwitch current={locale} />
      </div>

      <Card className="w-full max-w-md" stripe={rejected ? 'danger' : 'warn'}>
        <CardBody className="p-6">
          <h1 className="text-[15px] font-semibold tracking-tight">
            {frozen ? t.auth.frozenTitle : t.auth.noAccessTitle}
          </h1>
          {/*
            * Три разные причины — три разных текста. «Нет доступа» без
            * объяснения превращает человека в звонок оператору.
            */}
          <p className="mt-2 text-[13px] leading-relaxed text-ink-muted">
            {frozen
              ? t.auth.frozenText
              : rejected
                ? t.auth.rejectedText
                : t.auth.noProfileText}
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

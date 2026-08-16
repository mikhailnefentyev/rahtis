import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { Card, CardBody } from '@/components/ui';
import { signInPath } from '@/lib/auth/paths';
import { getViewer } from '@/lib/auth/viewer';
import { getI18n, isLocale } from '@/lib/i18n';
import { SetPasswordForm } from './form';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const { t } = await getI18n(locale);
  return { title: t.invite.title };
}

export default async function SetPasswordPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  /*
   * Сессия здесь уже должна быть: её создала ссылка из письма. Без неё
   * страница бессмысленна — менять пароль некому.
   */
  const viewer = await getViewer();
  if (viewer.status === 'guest') {
    redirect(`${signInPath(locale)}?reason=link`);
  }

  const { t } = await getI18n(locale);

  return (
    <main className="flex flex-1 items-center justify-center px-5 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <p className="font-mono text-xl font-extrabold tracking-tight text-accent">
            {t.brand.name}
          </p>
          <p className="label-micro mt-2">{viewer.email}</p>
        </div>

        <Card>
          <CardBody className="p-6">
            <h1 className="text-[15px] font-semibold tracking-tight">{t.invite.title}</h1>
            <p className="mt-1.5 mb-5 text-[13px] leading-relaxed text-ink-muted">
              {t.invite.subtitle}
            </p>
            <SetPasswordForm />
          </CardBody>
        </Card>
      </div>
    </main>
  );
}

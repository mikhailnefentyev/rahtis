import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { LocaleSwitch } from '@/components/layout/LocaleSwitch';
import { Card, CardBody, Kv, Mono } from '@/components/ui';
import { cabinetPath, noAccessPath, signInPath } from '@/lib/auth/paths';
import { getViewer } from '@/lib/auth/viewer';
import { getI18n, isLocale } from '@/lib/i18n';
import { ChangePasswordForm } from './form';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const { t } = await getI18n(locale);
  return { title: t.account.title };
}

/**
 * Личные настройки пользователя.
 *
 * Отдельно от «Yritystiedot»: там реквизиты компании, которые видит
 * бухгалтерия и которые попадают в счёт, здесь — доступ конкретного
 * человека. Смешивать их значит показывать пароль рядом с IBAN.
 *
 * Раздел общий для всех трёх ролей: пароль у оператора устроен так же,
 * как у перевозчика.
 */
export default async function AccountPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const viewer = await getViewer();
  if (viewer.status === 'guest') redirect(signInPath(locale, `/${locale}/account`));

  const { t } = await getI18n(locale);
  const back = viewer.status === 'ready' ? cabinetPath(locale, viewer.role) : noAccessPath(locale);

  return (
    <main className="mx-auto w-full max-w-2xl px-5 py-8">
      {/* Своей шапки у раздела нет, поэтому язык переключается отсюда. */}
      <nav className="mb-6 flex items-center justify-between gap-4">
        <Link href={back} className="text-[13px] text-ink-muted hover:text-ink">
          ← {viewer.status === 'ready' ? t.role[viewer.role] : t.brand.operator}
        </Link>
        <LocaleSwitch current={locale} />
      </nav>

      <h1 className="text-xl font-semibold tracking-tight">{t.account.title}</h1>

      <div className="mt-6 flex flex-col gap-4">
        <Card>
          <CardBody className="flex flex-col gap-1.5">
            <Kv k={t.company.email} v={<Mono>{viewer.email}</Mono>} />
            {viewer.status === 'ready' && (
              <>
                <Kv k={t.cabinet.yourRole} v={t.role[viewer.role]} />
                {viewer.company && <Kv k={t.cabinet.company} v={viewer.company.name} />}
              </>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardBody className="flex flex-col gap-4">
            <div>
              <h2 className="text-[15px] font-semibold tracking-tight">
                {t.account.passwordTitle}
              </h2>
              <p className="mt-1.5 text-[13px] leading-relaxed text-ink-muted">
                {t.account.passwordHint}
              </p>
            </div>

            <ChangePasswordForm />
          </CardBody>
        </Card>
      </div>
    </main>
  );
}

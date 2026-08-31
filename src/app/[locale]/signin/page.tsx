import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Card, CardBody } from '@/components/ui';
import { redirectIfSignedIn } from '@/lib/auth/actions';
import { LocaleSwitch } from '@/components/layout/LocaleSwitch';
import { getI18n, isLocale } from '@/lib/i18n';
import { SignInForm } from './form';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const { t } = await getI18n(locale);
  return { title: t.auth.signInTitle };
}

export default async function SignInPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ next?: string; reason?: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  /* Вошедшему на странице входа делать нечего. */
  await redirectIfSignedIn(locale);

  const { t } = await getI18n(locale);
  const { next, reason } = await searchParams;

  return (
    <main className="relative flex flex-1 items-center justify-center px-5 py-12">
      <div className="absolute top-5 right-5">
        <LocaleSwitch current={locale} />
      </div>

      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <Image
            src="/logo.png"
            alt={t.brand.name}
            width={1117}
            height={281}
            priority
            className="mx-auto h-8 w-auto"
          />
          <p className="label-micro mt-2">{t.brand.tagline}</p>
        </div>

        <Card>
          <CardBody className="p-6">
            <h1 className="text-[15px] font-semibold tracking-tight">{t.auth.signInTitle}</h1>
            <p className="mt-1.5 mb-5 text-[13px] leading-relaxed text-ink-muted">
              {t.auth.signInSubtitle}
            </p>

            {/* Пришли по просроченной или уже использованной ссылке из письма. */}
            {reason === 'link' && (
              <p
                role="alert"
                className="mb-4 rounded-control border border-warn/35 bg-warn/10 px-3 py-2 text-[13px] text-warn"
              >
                {t.invite.linkExpired}
              </p>
            )}

            <SignInForm next={next ?? null} />

            {/*
              * Ссылка под формой, а не над ней: сначала попытка войти,
              * потом путь для тех, у кого не вышло. Наверху она отвлекала
              * бы всех ради меньшинства.
              */}
            <p className="mt-4 text-[13px]">
              <Link href={`/${locale}/forgot`} className="text-ink-muted hover:text-ink">
                {t.recovery.link}
              </Link>
            </p>
          </CardBody>
        </Card>

        <p className="mt-5 text-center text-[13px] text-ink-muted">
          {t.auth.noApplicationYet}{' '}
          <Link href={`/${locale}/apply`} className="text-accent hover:underline">
            {t.auth.applyLink}
          </Link>
        </p>
      </div>
    </main>
  );
}

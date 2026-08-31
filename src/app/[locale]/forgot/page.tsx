import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { LocaleSwitch } from '@/components/layout/LocaleSwitch';
import { Card, CardBody } from '@/components/ui';
import { signInPath } from '@/lib/auth/paths';
import { getI18n, isLocale } from '@/lib/i18n';
import { ForgotForm } from './form';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const { t } = await getI18n(locale);
  return { title: t.recovery.title };
}

/**
 * «Забыли пароль».
 *
 * Страница намеренно скупая: одно поле и одна кнопка. Всё, что можно
 * сюда добавить — подсказки, ссылки, объяснения, — работает против
 * человека, который уже раздражён тем, что не может войти.
 */
export default async function ForgotPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const { t } = await getI18n(locale);

  return (
    <main className="relative flex flex-1 items-center justify-center px-5 py-12">
      <div className="absolute top-5 right-5">
        <LocaleSwitch current={locale} />
      </div>

      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <Link href={`/${locale}`} className="inline-block">
            <Image
              src="/logo.png"
              alt={t.brand.name}
              width={1117}
              height={281}
              priority
              className="mx-auto h-8 w-auto"
            />
          </Link>
          <p className="label-micro mt-2">{t.brand.tagline}</p>
        </div>

        <Card>
          <CardBody className="p-6">
            <h1 className="text-[15px] font-semibold tracking-tight">{t.recovery.title}</h1>
            <p className="mt-1.5 mb-5 text-[13px] leading-relaxed text-ink-muted">
              {t.recovery.subtitle}
            </p>

            <ForgotForm locale={locale} />
          </CardBody>
        </Card>

        <p className="mt-5 text-center text-[13px] text-ink-muted">
          <Link href={signInPath(locale)} className="text-accent hover:underline">
            {t.recovery.backToSignIn}
          </Link>
        </p>
      </div>
    </main>
  );
}

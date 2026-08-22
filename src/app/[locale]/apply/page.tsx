import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { signInPath } from '@/lib/auth/paths';
import { LocaleSwitch } from '@/components/layout/LocaleSwitch';
import { getI18n, isLocale } from '@/lib/i18n';
import { ApplyForm } from './form';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const { t } = await getI18n(locale);
  return { title: t.apply.title };
}

export default async function ApplyPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const { t } = await getI18n(locale);

  return (
    <main className="relative flex flex-1 items-center justify-center px-5 py-12">
      <div className="absolute top-5 right-5">
        <LocaleSwitch current={locale} />
      </div>

      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <Link
            href={`/${locale}`}
            className="font-mono text-xl font-extrabold tracking-tight text-accent"
          >
            {t.brand.name}
          </Link>
          <p className="label-micro mt-2">{t.brand.tagline}</p>
        </div>

        <ApplyForm />

        <p className="mt-5 text-center text-[13px] text-ink-muted">
          <Link href={signInPath(locale)} className="text-accent hover:underline">
            {t.auth.submit}
          </Link>
        </p>
      </div>
    </main>
  );
}

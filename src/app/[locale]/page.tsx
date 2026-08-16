import Link from 'next/link';
import { notFound } from 'next/navigation';
import { buttonClass } from '@/components/ui';
import { cabinetPath, signInPath } from '@/lib/auth/paths';
import { getViewer } from '@/lib/auth/viewer';
import { getI18n, isLocale } from '@/lib/i18n';

/**
 * Временная точка входа Этапа 1.
 *
 * Полноценный лендинг с формой заявки появится на Этапе 2. Сейчас страница
 * решает одну задачу: увести вошедшего в его кабинет, остальным показать вход.
 */
export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const [{ t }, viewer] = await Promise.all([getI18n(locale), getViewer()]);

  const target =
    viewer.status === 'ready' ? cabinetPath(locale, viewer.role) : signInPath(locale);

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 px-5 py-12 text-center">
      <h1 className="font-mono text-2xl font-extrabold tracking-tight text-accent">
        {t.brand.name}
      </h1>
      <p className="label-micro">{t.brand.tagline}</p>
      <p className="max-w-sm text-[13px] leading-relaxed text-ink-muted">{t.brand.description}</p>

      <Link href={target} className={buttonClass({ variant: 'primary', size: 'lg', className: 'mt-2' })}>
        {viewer.status === 'ready' ? t.role[viewer.role] : t.auth.submit}
      </Link>
    </main>
  );
}

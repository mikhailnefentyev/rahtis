import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { Badge } from '@/components/ui';
import { companyStatusTone } from '@/components/ui/tone';
import { cabinetPath, noAccessPath, signInPath } from '@/lib/auth/paths';
import { getViewer } from '@/lib/auth/viewer';
import { getI18n, isLocale } from '@/lib/i18n';
import { RequisitesForm } from './form';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const { t } = await getI18n(locale);
  return { title: t.requisites.title };
}

/**
 * Заполнение реквизитов, шаг APPROVED → ACTIVE.
 *
 * Страница общая для обеих ролей: состав полей разный, но путь один —
 * компания сама дозаполняет то, без чего ей нельзя ни выставить счёт,
 * ни заплатить.
 */
export default async function RequisitesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const viewer = await getViewer();
  if (viewer.status === 'guest') redirect(signInPath(locale, `/${locale}/requisites`));
  if (viewer.status === 'orphan') redirect(noAccessPath(locale));

  /* У администратора компании нет — реквизиты заполнять нечему. */
  if (!viewer.company) redirect(cabinetPath(locale, viewer.role));
  if (viewer.company.status === 'REJECTED') redirect(noAccessPath(locale));

  const { t } = await getI18n(locale);
  const company = viewer.company;

  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-8">
      <nav className="mb-6">
        <Link
          href={cabinetPath(locale, viewer.role)}
          className="text-[13px] text-ink-muted hover:text-ink"
        >
          ← {t.role[viewer.role]}
        </Link>
      </nav>

      <div className="flex flex-wrap items-center gap-2.5">
        <h1 className="text-xl font-semibold tracking-tight">{t.requisites.title}</h1>
        <Badge tone={companyStatusTone[company.status]}>{t.companyStatus[company.status]}</Badge>
      </div>
      <p className="mt-2 mb-6 max-w-xl text-[13px] leading-relaxed text-ink-muted">
        {company.status === 'ACTIVE'
          ? t.requisites.alreadyActive
          : company.kind === 'CARRIER'
            ? t.requisites.subtitleCarrier
            : t.requisites.subtitleShipper}
      </p>

      <RequisitesForm company={company} />
    </main>
  );
}

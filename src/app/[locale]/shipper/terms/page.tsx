import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { LegalDocument } from '@/components/domain/LegalDocument';
import { requireRole } from '@/lib/auth/guard';
import { getI18n, isLocale } from '@/lib/i18n';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const { t } = await getI18n(locale);
  /*
   * Ни canonical, ни описания: раздел кабинета, а не страница витрины.
   * robots сюда не пускает — договор стороны не предмет поиска.
   */
  return { title: t.legal.SHIPPER_AGREEMENT, robots: { index: false, follow: false } };
}

/**
 * Договор заказчика — в кабинете заказчика.
 *
 * Общие условия и политика висят на витрине: их читают до регистрации,
 * решая, иметь ли с платформой дело. Договор стороны читает тот, кто уже
 * внутри, и посторонним он говорит только о чужих деньгах — ставках,
 * простое, сроках оплаты. Поэтому адрес закрыт ролью, а не просто
 * неизвестен.
 *
 * Гейт стоит дважды: макет кабинета уже зовёт requireRole, и страница
 * зовёт его же. Второй вызов не лишний — макет можно однажды переписать,
 * а строка отсюда никуда не денется.
 */
export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  await requireRole(locale, 'SHIPPER');
  const { t } = await getI18n(locale);

  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">{t.legal.SHIPPER_AGREEMENT}</h1>
      <LegalDocument locale={locale} kind="SHIPPER_AGREEMENT" />
    </main>
  );
}

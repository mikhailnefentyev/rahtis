import { notFound, redirect } from 'next/navigation';
import { accountPath } from '@/lib/auth/paths';
import { isLocale } from '@/lib/i18n';

/**
 * Реквизиты переехали в «Omat tiedot» — туда же, где пароль.
 *
 * Адрес оставлен живым, а не удалён: он разослан в письмах о допуске и
 * лежит в закладках у тех, кто уже проходил активацию. Страница с
 * текстом «раздел переехал» была бы лишним кликом — переносим сразу.
 */
export default async function RequisitesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  redirect(accountPath(locale));
}

import { notFound } from 'next/navigation';
import { HeroPort } from '@/components/domain/HeroPort';
import { LandingSections } from '@/components/domain/LandingSections';
import { isLocale } from '@/lib/i18n';

/**
 * Главная страница.
 *
 * Показывается всем одинаково, включая вошедших: это витрина компании, а
 * не приложение. Уводить вошедшего в кабинет редиректом значило бы, что
 * сотрудник заказчика не может открыть сайт своей платформы и посмотреть,
 * что там написано. Вход в кабинет стоит в шапке первого экрана.
 */
export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  return (
    <main>
      <HeroPort locale={locale} />
      <LandingSections locale={locale} />
    </main>
  );
}

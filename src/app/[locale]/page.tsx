import { notFound } from 'next/navigation';
import { HeroPort } from '@/components/domain/HeroPort';
import { LandingSections } from '@/components/domain/LandingSections';
import { SiteHeader } from '@/components/layout/SiteHeader';
import { isLocale } from '@/lib/i18n';

/**
 * Главная страница.
 *
 * Показывается всем одинаково, включая вошедших: это витрина компании, а
 * не приложение. Уводить вошедшего в кабинет редиректом значило бы, что
 * сотрудник заказчика не может открыть сайт своей платформы и посмотреть,
 * что там написано. Вход в кабинет стоит в шапке.
 */
export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  return (
    <>
      <SiteHeader />

      <main>
        <HeroPort locale={locale} />

        {/*
          * Метка конца первого экрана. По ней шапка понимает, что съёмка
          * кончилась и пора становиться светлой полосой.
          *
          * Пустой элемент вместо порога в пикселях: высота первого экрана
          * задана в svh и меняется от поворота телефона и от того,
          * свёрнута ли адресная строка. Любое число пришлось бы
          * пересчитывать на каждый resize, а метка едет сама.
          */}
        <div id="hero-end" aria-hidden="true" />

        <LandingSections locale={locale} />
      </main>
    </>
  );
}

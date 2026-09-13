import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { HeroPort } from '@/components/domain/HeroPort';
import { LandingSections } from '@/components/domain/LandingSections';
import { SiteHeader } from '@/components/layout/SiteHeader';
import { APP } from '@/lib/config';
import { getI18n, isLocale } from '@/lib/i18n';
import { placeCountries } from '@/lib/routing/places';
import { SITE_URL, pageMetadata, samePath } from '@/lib/seo';

/**
 * Главная страница.
 *
 * Показывается всем одинаково, включая вошедших: это витрина компании, а
 * не приложение. Уводить вошедшего в кабинет редиректом значило бы, что
 * сотрудник заказчика не может открыть сайт своей платформы и посмотреть,
 * что там написано. Вход в кабинет стоит в шапке.
 */
/*
 * Заголовок главной раньше был просто «RAHTIS»: шаблон из layout
 * подставлял имя марки, а своего заголовка у страницы не было. Самое
 * дорогое поле на сайте занимало слово, которое никто не ищет.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const { t } = await getI18n(locale);

  return pageMetadata({
    locale,
    paths: samePath(''),
    title: t.seo.homeTitle,
    description: t.seo.homeDescription,
  });
}

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const { t } = await getI18n(locale);

  /*
   * Карточка организации для машин.
   *
   * Поисковику от неё пользы для молодого сайта немного. Нужна она
   * другому читателю: ответчикам на основе языковых моделей, которые
   * пересказывают, чем занимается компания. Они опираются на
   * размеченные факты охотнее, чем на текст страницы, и без разметки
   * пересказывают то, что придумают сами.
   *
   * Только то, что и так опубликовано: юрлицо, Y-tunnus, адрес почты и
   * четыре страны работы. Адреса конторы здесь нет — на витрине его
   * тоже нет, и появляться он должен решением, а не заодно с разметкой.
   */
  const organisation = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: t.brand.name,
    legalName: APP.operator.legalName,
    url: `${SITE_URL}/${locale}`,
    logo: `${SITE_URL}/og.png`,
    description: t.seo.homeDescription,
    email: APP.operator.email,
    taxID: APP.operator.businessId,
    areaServed: placeCountries().map((code) => ({
      '@type': 'Country',
      name: t.landing.country[code as keyof typeof t.landing.country],
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        /*
         * Значения свои, из словаря и настроек, чужого текста здесь нет.
         */
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organisation) }}
      />

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

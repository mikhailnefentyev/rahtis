import type { Metadata } from 'next';
import { headers } from 'next/headers';
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
  const root = locale === 'en' && (await headers()).get('x-rahtis-root') === '1';

  const metadata = pageMetadata({
    locale,
    paths: samePath(''),
    title: t.seo.homeTitle,
    description: t.seo.homeDescription,
    canonical: root ? `${SITE_URL}/` : undefined,
    xDefault: `${SITE_URL}/`,
  });

  /*
   * Марка — первым словом. Шаблон «%s · RAHTIS» из layout на страницу
   * того же сегмента не действует, и главная называлась без имени: по
   * запросу «RAHTIS» ей было нечем совпасть.
   */
  const title = `${t.brand.name} – ${t.seo.homeTitle}`;
  return {
    ...metadata,
    title: { absolute: title },
    openGraph: { ...metadata.openGraph, title },
    twitter: { ...metadata.twitter, title },
  };
}

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const { t } = await getI18n(locale);
  const root = locale === 'en' && (await headers()).get('x-rahtis-root') === '1';
  const pageUrl = root ? `${SITE_URL}/` : `${SITE_URL}/${locale}`;

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
    url: pageUrl,
    logo: `${SITE_URL}/og.png`,
    description: t.seo.homeDescription,
    email: APP.operator.email,
    taxID: APP.operator.businessId,
    areaServed: placeCountries().map((code) => ({
      '@type': 'Country',
      name: t.landing.country[code as keyof typeof t.landing.country],
    })),
  };

  /* Сайт целиком: имя и языки — по ним ответчики узнают, что rahtis.eu и RAHTIS одно и то же. */
  const website = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: t.brand.name,
    url: `${SITE_URL}/`,
    inLanguage: ['fi', 'en'],
    publisher: { '@type': 'Organization', name: APP.operator.legalName },
  };

  return (
    <>
      <script
        type="application/ld+json"
        /*
         * Значения свои, из словаря и настроек, чужого текста здесь нет.
         */
        dangerouslySetInnerHTML={{ __html: JSON.stringify([organisation, website]) }}
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

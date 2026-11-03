import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { HeroPort } from '@/components/domain/HeroPort';
import { LandingSections } from '@/components/domain/LandingSections';
import { SiteHeader } from '@/components/layout/SiteHeader';
import { APP, ladderStepLabel, ON_REQUEST_FROM, SUBSCRIPTION_LADDER, SUBSCRIPTION_MAX_CENTS } from '@/lib/config';
import { getI18n, isLocale } from '@/lib/i18n';
import { locales } from '@/lib/i18n/config';
import { placeCountries } from '@/lib/routing/places';
import { hasArticles } from '@/lib/blog/heycatch';
import { ORG_SAME_AS, SITE_URL, pageMetadata, samePath } from '@/lib/seo';

/* Цена для schema.org: точка и два знака, как требует разметка. */
const euro = (cents: number) => (cents / 100).toFixed(2);

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
    description: t.seo.homeMeta,
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
  const showBlog = await hasArticles();

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
  /*
   * Три карточки связаны через @id: издатель сайта и поставщик программы —
   * та же организация, а не три разных лица с одним именем.
   */
  const orgId = `${SITE_URL}/#organization`;
  const organisation = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': orgId,
    name: t.brand.name,
    legalName: APP.operator.legalName,
    url: pageUrl,
    logo: `${SITE_URL}/og.png`,
    description: t.seo.homeDescription,
    email: APP.operator.email,
    taxID: APP.operator.businessId,
    sameAs: ORG_SAME_AS,
    areaServed: placeCountries().map((code) => ({
      '@type': 'Country',
      name: new Intl.DisplayNames([locale], { type: 'region' }).of(code) ?? code,
    })),
  };

  /* Сайт целиком: имя и языки — по ним ответчики узнают, что rahtis.eu и RAHTIS одно и то же. */
  const website = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: t.brand.name,
    url: `${SITE_URL}/`,
    /* Витрина на девяти языках; раньше здесь стояли только fi и en. */
    inLanguage: [...locales],
    publisher: { '@id': orgId },
  };

  /*
   * The product itself: a transport management system and a freight
   * exchange. Without it, answer engines file RAHTIS under "trailer swap
   * platform" only — the carrier's own fleet, drivers and customers are
   * what most carriers come for.
   */
  const software = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: t.brand.name,
    url: pageUrl,
    applicationCategory: 'BusinessApplication',
    applicationSubCategory: t.seo.category,
    operatingSystem: 'Web, Android, iOS',
    description: t.seo.homeDescription,
    featureList: t.seo.features,
    inLanguage: [...locales],
    /*
     * Ступени из config: первая машина за 0 €, каждая следующая — своя
     * цена за машину в месяц. От ON_REQUEST_FROM машин цена по
     * запросу, поэтому у последней ступени верхняя граница ON_REQUEST_FROM − 1.
     * Описание — тот же абзац, что в кабинете (машины, которые ездили,
     * первая бесплатно, −10 % за год).
     */
    offers: {
      '@type': 'AggregateOffer',
      lowPrice: euro(Math.min(...SUBSCRIPTION_LADDER.map((s) => s.cents))),
      highPrice: euro(SUBSCRIPTION_MAX_CENTS),
      priceCurrency: 'EUR',
      offerCount: SUBSCRIPTION_LADDER.length,
      description: t.subscription.lede,
      offers: SUBSCRIPTION_LADDER.map((step) => {
        const to = step.to ?? ON_REQUEST_FROM - 1;
        return {
          '@type': 'Offer',
          name: `${t.subscription.colVehicles}: ${ladderStepLabel(step)}`,
          price: euro(step.cents),
          priceCurrency: 'EUR',
          priceSpecification: {
            '@type': 'UnitPriceSpecification',
            price: euro(step.cents),
            priceCurrency: 'EUR',
            unitText: t.seo.priceUnit,
            referenceQuantity: { '@type': 'QuantitativeValue', value: 1, unitCode: 'MON' },
            eligibleQuantity: { '@type': 'QuantitativeValue', minValue: step.from, maxValue: to, unitText: t.subscription.colVehicles },
            valueAddedTaxIncluded: false,
          },
        };
      }),
    },
    provider: { '@id': orgId },
  };

  return (
    <>
      <script
        type="application/ld+json"
        /*
         * Значения свои, из словаря и настроек, чужого текста здесь нет.
         */
        dangerouslySetInnerHTML={{ __html: JSON.stringify([organisation, website, software]) }}
      />

      <SiteHeader showBlog={showBlog} />

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

        <LandingSections locale={locale} showBlog={showBlog} />
      </main>
    </>
  );
}

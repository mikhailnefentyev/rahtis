import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ConsentSettingsLink } from '@/components/layout/AnalyticsConsent';
import { LocaleSwitch } from '@/components/layout/LocaleSwitch';
import { buttonClass, Card, CardBody } from '@/components/ui';
import { signInPath } from '@/lib/auth/paths';
import { APP, ON_REQUEST_FROM, SUBSCRIPTION_LADDER, SUBSCRIPTION_MAX_CENTS } from '@/lib/config';
import { isLocale } from '@/lib/i18n';
import { EARTHWORKS, earthworksPath } from '@/lib/landing/earthworks';
import { SITE_URL } from '@/lib/seo';

/**
 * Посадочная страница модуля объектов: самосвалы и земляные работы.
 *
 * Своя рамка, а не шапка главной: меню главной — якоря её разделов, и
 * здесь они вели бы в никуда. Серверная: интерактива нет.
 */
export async function EarthworksPage({ locale }: { locale: string }) {
  if (!isLocale(locale)) notFound();
  const c = EARTHWORKS[locale];
  const url = `${SITE_URL}${earthworksPath(locale)}`;

  /*
   * Разметка для поиска и ответчиков: услуга с ценой и вопросы-ответы.
   * Значения свои, из модуля текстов; чужого текста нет.
   */
  const ld = [
    {
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      name: `RAHTIS – ${c.eyebrow}`,
      url,
      applicationCategory: 'BusinessApplication',
      applicationSubCategory: c.serviceType,
      operatingSystem: 'Web, Android, iOS',
      description: c.metaDescription,
      featureList: c.features_ld,
      inLanguage: locale,
      /* Как на главной: первая машина 0 €, следующие по цене за машину в месяц, без ALV; от ON_REQUEST_FROM — по запросу. */
      offers: {
        '@type': 'AggregateOffer',
        priceCurrency: 'EUR',
        lowPrice: (Math.min(...SUBSCRIPTION_LADDER.map((s) => s.cents)) / 100).toFixed(2),
        highPrice: (SUBSCRIPTION_MAX_CENTS / 100).toFixed(2),
        offers: SUBSCRIPTION_LADDER.map((step) => ({
          '@type': 'Offer',
          price: (step.cents / 100).toFixed(2),
          priceCurrency: 'EUR',
          eligibleQuantity: { '@type': 'QuantitativeValue', minValue: step.from, maxValue: step.to ?? ON_REQUEST_FROM - 1, unitText: 'vehicle' },
          priceSpecification: { '@type': 'UnitPriceSpecification', price: (step.cents / 100).toFixed(2), priceCurrency: 'EUR', valueAddedTaxIncluded: false },
        })),
      },
      provider: { '@type': 'Organization', name: APP.operator.legalName, url: `${SITE_URL}/` },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      inLanguage: locale,
      mainEntity: c.faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'RAHTIS', item: `${SITE_URL}/${locale}` },
        { '@type': 'ListItem', position: 2, name: c.eyebrow, item: url },
      ],
    },
  ];

  const section = 'mx-auto w-full max-w-5xl px-5';
  const h2 = 'text-[clamp(22px,2.6vw,30px)] leading-tight font-semibold tracking-tight text-balance';

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld).replace(/</g, '\\u003c') }} />

      <header className="border-b border-line bg-surface">
        <div className={`${section} flex items-center justify-between gap-4 py-4`}>
          <Link href={`/${locale}`} aria-label="RAHTIS">
            <Image src="/logo-header.png" alt="RAHTIS" width={954} height={240} sizes="96px" className="h-6 w-auto" priority />
          </Link>
          <nav className="flex items-center gap-3 text-[14px]">
            <LocaleSwitch current={locale} />
            <Link href={signInPath(locale)} className="hidden text-ink-muted hover:text-ink sm:inline">
              {c.ctaSignIn}
            </Link>
            <Link href={`/${locale}/apply`} className={buttonClass({ variant: 'primary', size: 'sm' })}>
              {c.ctaApply}
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        {/*
          Тёмный баннер, как в блоге: фото самосвала на карьере справа растворяется
          в фирменном тёмно-синем, текст белый. На телефоне фото — приглушённый фон.
        */}
        <section className="relative isolate overflow-hidden bg-ink text-white">
          <div
            aria-hidden
            className="absolute inset-y-0 right-0 -z-10 w-full opacity-30 lg:w-[62%] lg:opacity-100 lg:[mask-image:linear-gradient(to_right,transparent_0%,black_50%)]"
          >
            <Image
              src="/media/maansiirto-hero.webp"
              alt=""
              fill
              priority
              sizes="(min-width: 1024px) 62vw, 100vw"
              className="object-cover object-[60%_center] brightness-[0.82] lg:object-[62%_center]"
            />
          </div>
          {/* Небо на фото светлее фона: затемнение слева и сверху прячет шов. */}
          <div aria-hidden className="absolute inset-0 -z-10 hidden bg-[radial-gradient(120%_90%_at_100%_70%,transparent_35%,var(--color-ink)_85%)] lg:block" />
          <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-t from-ink/70 via-transparent to-transparent" />
          <div className={`${section} py-16 sm:py-24 lg:py-28`}>
            <div className="max-w-[34rem]">
              <p className="label-micro text-accent-bright">{c.eyebrow}</p>
              <h1 className="mt-3 max-w-[24ch] text-[clamp(30px,4.2vw,46px)] leading-[1.08] font-semibold tracking-tight text-balance text-white">
                {c.title}
              </h1>
              <p className="mt-4 max-w-[62ch] text-[17px] leading-relaxed text-white/75">{c.lede}</p>
              <div className="mt-7 flex flex-wrap gap-3">
                <Link href={`/${locale}/apply`} className={buttonClass({ variant: 'primary', size: 'lg', className: 'h-12 text-[15px]' })}>
                  {c.ctaApply}
                </Link>
                <Link
                  href={signInPath(locale)}
                  className="inline-flex h-12 items-center gap-2 rounded-control border border-white/30 px-5 text-[15px] font-semibold text-white transition-colors hover:bg-white/10"
                >
                  {c.ctaSignIn}
                </Link>
              </div>
            </div>
          </div>
        </section>

        <section className={`${section} py-16`}>
          <h2 className={h2}>{c.dayTitle}</h2>
          <ol className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {c.day.map((step, i) => (
              <li key={step.title} className="rounded-card border border-line bg-surface p-4">
                <span className="font-mono text-[13px] text-ink-faint">{String(i + 1).padStart(2, '0')}</span>
                <h3 className="mt-1.5 text-[16px] leading-snug font-semibold">{step.title}</h3>
                <p className="mt-1.5 text-[14px] leading-relaxed text-ink-muted">{step.text}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="border-y border-line bg-surface">
          <div className={`${section} py-16`}>
            <h2 className={h2}>{c.featuresTitle}</h2>
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {c.features.map((f) => (
                <Card key={f.title} className="border-t-2 border-t-accent">
                  <CardBody>
                    <h3 className="text-[17px] leading-snug font-semibold">{f.title}</h3>
                    <p className="mt-2 text-[15px] leading-relaxed text-ink-muted">{f.text}</p>
                  </CardBody>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section className={`${section} py-16`}>
          <div className="grid gap-10 lg:grid-cols-[1fr_1.4fr]">
            <div>
              <h2 className={h2}>{c.priceTitle}</h2>
              <p className="mt-4 text-[16px] leading-relaxed text-ink-muted">{c.priceText}</p>
            </div>
            <div>
              <h2 className={h2}>{c.faqTitle}</h2>
              <div className="mt-4 divide-y divide-line border-y border-line">
                {c.faq.map((f) => (
                  <details key={f.q} className="group py-3.5">
                    <summary className="cursor-pointer list-none text-[16px] font-semibold marker:hidden">
                      <span className="mr-2 inline-block text-ink-faint transition-transform group-open:rotate-90">›</span>
                      {f.q}
                    </summary>
                    <p className="mt-2 pl-5 text-[15px] leading-relaxed text-ink-muted">{f.a}</p>
                  </details>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="border-t border-line bg-surface">
          <div className={`${section} py-16 text-center`}>
            <h2 className={`${h2} mx-auto max-w-[28ch]`}>{c.finalTitle}</h2>
            <p className="mx-auto mt-3 max-w-[56ch] text-[16px] text-ink-muted">{c.finalText}</p>
            <Link
              href={`/${locale}/apply`}
              className={buttonClass({ variant: 'primary', size: 'lg', className: 'mt-7 h-12 text-[15px]' })}
            >
              {c.ctaApply}
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className={`${section} flex flex-wrap items-center justify-between gap-3 py-5 text-[12px] text-ink-faint`}>
          <span>
            © {new Date().getFullYear()} {APP.operator.legalName} · Y-tunnus {APP.operator.businessId}
          </span>
          <span className="flex gap-3">
            <Link href={`/${locale}`} className="hover:text-ink">
              RAHTIS
            </Link>
            <ConsentSettingsLink className="hover:text-ink" />
          </span>
        </div>
      </footer>
    </div>
  );
}

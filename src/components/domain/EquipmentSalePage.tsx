import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ConsentSettingsLink } from '@/components/layout/AnalyticsConsent';
import { LocaleSwitch } from '@/components/layout/LocaleSwitch';
import { buttonClass, Card, CardBody } from '@/components/ui';
import { signInPath } from '@/lib/auth/paths';
import { cn } from '@/lib/cn';
import { APP } from '@/lib/config';
import { getDictionary, isLocale } from '@/lib/i18n';
import { fill, installmentUiCopy } from '@/lib/installments/copy';
import { installmentMoney } from '@/lib/installments/countries';
import { countryName } from '@/lib/installments/countryCopy';
import { publicListings } from '@/lib/installments/publicListings';
import {
  equipmentSaleCopy,
  equipmentSalePath,
  filterListings,
  listingFacets,
  listingQuery,
  parseListingFilter,
  type PublicListingFilter,
} from '@/lib/landing/equipmentSale';
import { installmentCopy, installmentPath } from '@/lib/landing/installment';
import { SITE_URL } from '@/lib/seo';
import { LandingHero } from './LandingHero';
import { TruckPhoto } from './TruckPhoto';

/**
 * Открытая страница «Техника на продажу в рассрочку» (решение владельца
 * 23.11.2026): объявления видят все, без входа.
 *
 * Рамка и тёмный баннер — как у остальных посадочных (ProductLanding,
 * LandingHero); карточки — с мягкой цветной тенью (shadow-card, при
 * наведении shadow-lift). Сначала телефон: одна колонка, отбор — ссылки
 * с переносом, ничего не шире экрана в 320 px.
 *
 * В карточке — только то, что отдаёт public_equipment_listings(): фото по
 * классу и марке БЕЗ номерного знака, марка и модель, класс, пробег, цена
 * без НДС в валюте объявления, срок и взнос, страна. Продавца, контактов
 * и идентификаторов на странице нет — и в разметке тоже.
 *
 * Отбор по стране и классу — обычные ссылки со строкой запроса: работает
 * без JavaScript. Предложение делается в кабинете: кнопка ведёт на вход с
 * возвратом в каталог. Серверная: интерактива нет.
 */
export async function EquipmentSalePage({
  locale,
  query,
}: {
  locale: string;
  query: { country?: string | string[]; class?: string | string[] };
}) {
  if (!isLocale(locale)) notFound();
  const c = equipmentSaleCopy(locale);
  const calc = installmentCopy(locale);
  const ui = installmentUiCopy(locale);
  const [t, all] = await Promise.all([getDictionary(locale), publicListings()]);

  const path = `/${locale}${equipmentSalePath(locale)}`;
  const url = `${SITE_URL}${path}`;
  const filter = parseListingFilter(all, query);
  const rows = filterListings(all, filter);
  const facets = listingFacets(all);
  const filtered = Boolean(filter.country || filter.vehicleClass);

  const classLabel = (code: string) => (t.vehicleClass as Record<string, string | undefined>)[code] ?? code;
  const numberLocale = locale === 'en' ? 'en-GB' : locale;
  /* Вход с возвратом в каталог кабинета: там предложение и делается. */
  const offerHref = signInPath(locale, `/${locale}/carrier/installments?tab=catalog`);
  const applyHref = `/${locale}/apply`;
  const href = (next: PublicListingFilter) => `${path}${listingQuery(next)}`;

  /*
   * Разметка для поиска: список предложений без продавца. Цена — без НДС,
   * в валюте объявления; страна — где машина продаётся.
   */
  const ld = [
    {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      name: c.title,
      url,
      inLanguage: locale,
      numberOfItems: all.length,
      itemListElement: all.slice(0, 50).map((l, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        item: {
          '@type': 'Product',
          name: l.make,
          category: classLabel(l.vehicle_class),
          offers: {
            '@type': 'Offer',
            price: (l.price_cents / 100).toFixed(2),
            priceCurrency: l.currency,
            availability: 'https://schema.org/InStock',
            itemCondition: 'https://schema.org/UsedCondition',
            areaServed: l.country,
            priceSpecification: {
              '@type': 'PriceSpecification',
              price: (l.price_cents / 100).toFixed(2),
              priceCurrency: l.currency,
              valueAddedTaxIncluded: false,
            },
          },
        },
      })),
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
  const pill = (active: boolean) =>
    cn(
      'inline-flex min-h-9 items-center rounded-full border px-3 py-1 text-[14px] transition-colors',
      active ? 'border-accent bg-accent/10 font-semibold text-accent' : 'border-line bg-surface text-ink-muted hover:border-accent-line hover:text-ink',
    );

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld).replace(/</g, '\\u003c') }} />

      <header className="border-b border-line bg-surface">
        {/* На экране 320 px немецкая кнопка «Jetzt registrieren» не помещалась: поля и промежутки шапки на телефоне уже. */}
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-2 px-4 py-4 sm:gap-3 sm:px-5">
          <Link href={`/${locale}`} aria-label="RAHTIS" className="shrink-0">
            <Image src="/logo-header.png" alt="RAHTIS" width={954} height={240} sizes="96px" className="h-6 w-auto" priority />
          </Link>
          <nav className="flex min-w-0 items-center gap-2 text-[14px] sm:gap-3">
            <LocaleSwitch current={locale} />
            <Link href={offerHref} className="hidden text-ink-muted hover:text-ink sm:inline">
              {calc.ctaSignIn}
            </Link>
            <Link href={applyHref} className={`${buttonClass({ variant: 'primary', size: 'sm' })} whitespace-nowrap`}>
              {calc.ctaApply}
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1" lang={locale}>
        <LandingHero
          locale={locale}
          photo="equipmentSale"
          eyebrow={c.eyebrow}
          title={c.title}
          lede={c.lede}
          ctaApply={calc.ctaApply}
          ctaSignIn={c.ctaOffer}
          signInHref={offerHref}
        />

        <section className={`${section} py-12 sm:py-16`} aria-labelledby="for-sale">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <h2 id="for-sale" className={h2}>
              {c.listTitle}
            </h2>
            {all.length > 0 && <span className="font-mono text-[13px] text-ink-faint">{rows.length}</span>}
          </div>

          {/* Отбор — ссылки: работает без JavaScript. Показывается, когда есть из чего выбирать. */}
          {all.length > 0 && (facets.countries.length > 1 || facets.classes.length > 1) && (
            <div className="mt-5 flex flex-col gap-3">
              {facets.countries.length > 1 && (
                <nav aria-label={c.filterCountry} className="flex flex-wrap items-center gap-2">
                  <span className="label-micro mr-1">{c.filterCountry}</span>
                  <Link href={href({ ...filter, country: null })} className={pill(!filter.country)} aria-current={!filter.country ? 'true' : undefined}>
                    {c.filterAll}
                  </Link>
                  {facets.countries.map((code) => (
                    <Link
                      key={code}
                      href={href({ ...filter, country: code })}
                      className={pill(filter.country === code)}
                      aria-current={filter.country === code ? 'true' : undefined}
                    >
                      {countryName(locale, code)}
                    </Link>
                  ))}
                </nav>
              )}
              {facets.classes.length > 1 && (
                <nav aria-label={c.filterClass} className="flex flex-wrap items-center gap-2">
                  <span className="label-micro mr-1">{c.filterClass}</span>
                  <Link
                    href={href({ ...filter, vehicleClass: null })}
                    className={pill(!filter.vehicleClass)}
                    aria-current={!filter.vehicleClass ? 'true' : undefined}
                  >
                    {c.filterAll}
                  </Link>
                  {facets.classes.map((code) => (
                    <Link
                      key={code}
                      href={href({ ...filter, vehicleClass: code })}
                      className={pill(filter.vehicleClass === code)}
                      aria-current={filter.vehicleClass === code ? 'true' : undefined}
                    >
                      {classLabel(code)}
                    </Link>
                  ))}
                </nav>
              )}
            </div>
          )}

          {rows.length === 0 ? (
            /* Пусто: приглашение продавцам; при отборе без результата — ссылка «показать все». */
            <div className="mt-8 rounded-card border border-line border-t-2 border-t-accent bg-surface p-6 shadow-card sm:p-8">
              <h3 className="text-[19px] leading-snug font-semibold text-balance">{filtered ? c.emptyFiltered : c.emptyTitle}</h3>
              <p className="mt-2 max-w-[62ch] text-[15px] leading-relaxed text-ink-muted">{c.emptyText}</p>
              <div className="mt-5 flex flex-wrap items-center gap-3">
                <Link href={applyHref} className={buttonClass({ variant: 'primary', size: 'md' })}>
                  {calc.ctaApply}
                </Link>
                {filtered && (
                  <Link href={path} className="text-[14px] font-semibold text-accent hover:underline">
                    {c.showAll} ›
                  </Link>
                )}
              </div>
            </div>
          ) : (
            <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {rows.map((l, i) => {
                const money = installmentMoney(locale, l.currency, true);
                return (
                  <li key={`${l.make}-${l.price_cents}-${l.published_on ?? ''}-${i}`} className="min-w-0">
                    <Card className="h-full transition-shadow hover:shadow-lift">
                      <CardBody className="flex h-full flex-col gap-3">
                        {/* Фото по марке и классу; номерного знака на открытой странице нет. */}
                        <TruckPhoto
                          make={l.make}
                          vehicleClass={l.vehicle_class}
                          plate={null}
                          country={l.country}
                          sizes="(min-width: 1024px) 300px, (min-width: 640px) 50vw, 100vw"
                          priority={i < 2}
                        />
                        <div className="min-w-0 flex-1">
                          <h3 className="text-[17px] leading-snug font-semibold [overflow-wrap:anywhere]">{l.make}</h3>
                          <p className="mt-0.5 text-[13px] text-ink-muted [overflow-wrap:anywhere]">
                            {classLabel(l.vehicle_class)}
                            {l.odometer_km != null ? ` · ${l.odometer_km.toLocaleString(numberLocale)} km` : ''}
                          </p>
                          <p className="mt-3 flex flex-wrap items-baseline gap-x-2">
                            <span className="font-mono text-[20px] leading-tight font-bold">{money(l.price_cents)}</span>
                            <span className="text-[12px] text-ink-faint">{c.priceNote}</span>
                          </p>
                          <p className="mt-1 font-mono text-[13px] text-ink-muted">
                            {fill(ui.catalog.terms, { months: String(l.months), down: money(l.down_payment_cents) })}
                          </p>
                          <p className="mt-2 text-[13px] text-ink-muted">
                            <span className="mr-1.5 inline-block rounded-[4px] border border-line bg-sunken px-1.5 py-px font-mono text-[11px] font-semibold text-ink">
                              {l.country}
                            </span>
                            {countryName(locale, l.country)}
                          </p>
                        </div>
                        <Link href={offerHref} className={buttonClass({ variant: 'primary', size: 'sm', className: 'h-auto min-h-9 self-start py-2 text-left whitespace-normal' })}>
                          {c.ctaOffer}
                        </Link>
                      </CardBody>
                    </Card>
                  </li>
                );
              })}
            </ul>
          )}

          <p className="mt-6 max-w-[72ch] text-[13px] leading-relaxed text-ink-faint">{c.sameCountry}</p>
        </section>

        <section className="border-y border-line bg-surface">
          <div className={`${section} py-12 sm:py-16`}>
            <h2 className={h2}>{c.howTitle}</h2>
            <ol className="mt-8 grid gap-4 md:grid-cols-3">
              {c.how.map((step, i) => (
                <li key={step.title} className="rounded-card border border-line border-t-2 border-t-accent bg-surface p-4 shadow-card">
                  <span className="font-mono text-[13px] text-ink-faint">{String(i + 1).padStart(2, '0')}</span>
                  <h3 className="mt-1.5 text-[16px] leading-snug font-semibold">{step.title}</h3>
                  <p className="mt-1.5 text-[14px] leading-relaxed text-ink-muted">{step.text}</p>
                </li>
              ))}
            </ol>
            {/* RAHTIS — не сторона сделки: это площадка с расчётом, документами, счетами и напоминаниями. */}
            <p className="mt-6 max-w-[72ch] text-[15px] leading-relaxed text-ink">{c.notParty}</p>
            <Link href={`/${locale}${installmentPath(locale)}`} className="mt-3 inline-block text-[15px] font-semibold text-accent hover:underline">
              {c.calcLink} →
            </Link>
          </div>
        </section>

        <section className={`${section} py-12 text-center sm:py-16`}>
          <h2 className={`${h2} mx-auto max-w-[28ch]`}>{c.finalTitle}</h2>
          <p className="mx-auto mt-3 max-w-[56ch] text-[16px] text-ink-muted">{c.finalText}</p>
          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            <Link href={applyHref} className={buttonClass({ variant: 'primary', size: 'lg', className: 'h-12 text-[15px]' })}>
              {calc.ctaApply}
            </Link>
            <Link href={offerHref} className={buttonClass({ size: 'lg', className: 'h-auto min-h-12 py-2 text-[15px] whitespace-normal' })}>
              {c.ctaOffer}
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
            <Link href={`/${locale}`} className="inline-block py-2 hover:text-ink">
              RAHTIS
            </Link>
            <ConsentSettingsLink className="inline-block py-2 hover:text-ink" />
          </span>
        </div>
      </footer>
    </div>
  );
}

import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ConsentSettingsLink } from '@/components/layout/AnalyticsConsent';
import { LocaleSwitch } from '@/components/layout/LocaleSwitch';
import { buttonClass, Select } from '@/components/ui';
import { signInPath } from '@/lib/auth/paths';
import { APP } from '@/lib/config';
import { isLocale } from '@/lib/i18n';
import { installmentUiCopy } from '@/lib/installments/copy';
import { openInstallmentCountries } from '@/lib/installments/countries';
import { equipmentSaleCopy, equipmentSalePath } from '@/lib/landing/equipmentSale';
import { installmentCopy, installmentPath } from '@/lib/landing/installment';
import { pickInstallmentCountry } from '@/lib/landing/installmentCountry';
import { installmentCountryLandingCopy } from '@/lib/landing/installmentCountryCopy';
import { installmentCountryOptions, installmentCountryView } from '@/lib/landing/installmentCountryView';
import { SITE_URL } from '@/lib/seo';
import { InstallmentCalculator } from './InstallmentCalculator';

/**
 * Открытая страница калькулятора рассрочки техники (21.11.2026).
 * Рамка как у других посадочных (ProductLanding), но без фото-баннера:
 * главное здесь — калькулятор, он стоит сразу под заголовком.
 *
 * Страна расчёта (24.11.2026): ?country= или страна языка страницы
 * (installmentCountry.ts). Калькулятор, шаги, вопросы и оговорка — по ней
 * (installmentCountryView); у Финляндии всё как было. Выбор — обычная форма
 * GET: работает без JavaScript, адрес с ?country= можно отправить. Canonical
 * и hreflang — без строки запроса (pageMetadata в page.tsx её не видит).
 */
export function InstallmentLanding({ locale, country: query }: { locale: string; country?: string | string[] }) {
  if (!isLocale(locale)) notFound();
  const c = installmentCopy(locale);
  const country = pickInstallmentCountry(locale, query, openInstallmentCountries());
  const view = installmentCountryView(c, locale, country, installmentUiCopy(locale).listing.vatFixed);
  const options = installmentCountryOptions(locale);
  const lc = installmentCountryLandingCopy(locale);
  /* Тот же адрес, что canonical страницы (pageMetadata): с языком в пути (22.11.2026). */
  const url = `${SITE_URL}/${locale}${installmentPath(locale)}`;
  const lang = locale;

  const ld = [
    {
      '@context': 'https://schema.org',
      '@type': 'WebApplication',
      name: `RAHTIS – ${c.eyebrow}`,
      url,
      applicationCategory: 'FinanceApplication',
      operatingSystem: 'Web',
      description: c.metaDescription,
      inLanguage: lang,
      isAccessibleForFree: true,
      offers: { '@type': 'Offer', price: '0.00', priceCurrency: 'EUR' },
      provider: { '@type': 'Organization', name: APP.operator.legalName, url: `${SITE_URL}/` },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      inLanguage: lang,
      /* Вопросы — те же, что на странице для выбранной страны. */
      mainEntity: view.faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
    },
  ];

  const section = 'mx-auto w-full max-w-6xl px-5';
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
            <Link href={`/${locale}/apply`} className={`${buttonClass({ variant: 'primary', size: 'sm' })} whitespace-nowrap`}>
              {c.ctaApply}
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1" lang={lang}>
        <section className={`${section} pt-12 pb-8`}>
          <p className="label-micro text-accent">{c.eyebrow}</p>
          <h1 className="mt-3 max-w-[24ch] text-[clamp(28px,4vw,44px)] leading-[1.1] font-semibold tracking-tight text-balance">
            {c.title}
          </h1>
          <p className="mt-4 max-w-[64ch] text-[17px] leading-relaxed text-ink-muted">{view.lede}</p>
          {/* Открытая страница объявлений: что уже продаётся в рассрочку (23.11.2026). */}
          <Link href={`/${locale}${equipmentSalePath(locale)}`} className="mt-4 inline-block text-[15px] font-semibold text-accent hover:underline">
            {equipmentSaleCopy(locale).linkLabel} →
          </Link>
        </section>

        <section className={`${section} pb-16`} aria-label={c.calcTitle}>
          {/* Страна расчёта: форма GET, на телефоне поле и кнопка переносятся. */}
          <form method="get" action={`/${locale}${installmentPath(locale)}`} className="mb-5 flex flex-wrap items-end gap-3">
            <label className="flex min-w-0 flex-1 flex-col gap-1.5 sm:max-w-xs">
              <span className="label-micro">{lc.countryLabel}</span>
              <Select name="country" defaultValue={country} className="h-10 w-full">
                {options.map((o) => (
                  <option key={o.code} value={o.code}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </label>
            <button type="submit" className={buttonClass({ variant: 'default', size: 'lg' })}>
              {lc.countryApply}
            </button>
          </form>
          <InstallmentCalculator key={view.calc.code} copy={c} locale={locale} country={view.calc} />
        </section>

        <section className="border-y border-line bg-surface">
          <div className={`${section} py-16`}>
            <h2 className={h2}>{c.howTitle}</h2>
            <ol className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              {view.how.map((step, i) => (
                <li key={step.title} className="rounded-card border border-line bg-surface p-4">
                  <span className="font-mono text-[13px] text-ink-faint">{String(i + 1).padStart(2, '0')}</span>
                  <h3 className="mt-1.5 text-[16px] leading-snug font-semibold">{step.title}</h3>
                  <p className="mt-1.5 text-[14px] leading-relaxed text-ink-muted">{step.text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className={`${section} py-16`}>
          <h2 className={h2}>{c.faqTitle}</h2>
          <div className="mt-4 max-w-3xl divide-y divide-line border-y border-line">
            {view.faq.map((f) => (
              <details key={f.q} className="group py-3.5">
                <summary className="cursor-pointer list-none text-[16px] font-semibold marker:hidden">
                  <span className="mr-2 inline-block text-ink-faint transition-transform group-open:rotate-90">›</span>
                  {f.q}
                </summary>
                <p className="mt-2 pl-5 text-[15px] leading-relaxed text-ink-muted">{f.a}</p>
              </details>
            ))}
          </div>
          <p className="mt-6 max-w-3xl text-[13px] leading-relaxed text-ink-faint">{view.disclaimer}</p>
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

import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ConsentSettingsLink } from '@/components/layout/AnalyticsConsent';
import { LocaleSwitch } from '@/components/layout/LocaleSwitch';
import { buttonClass } from '@/components/ui';
import { signInPath } from '@/lib/auth/paths';
import { APP } from '@/lib/config';
import { isLocale } from '@/lib/i18n';
import { installmentCopy, installmentPath } from '@/lib/landing/installment';
import { SITE_URL } from '@/lib/seo';
import { InstallmentCalculator } from './InstallmentCalculator';

/**
 * Открытая страница калькулятора рассрочки техники (21.11.2026).
 * Рамка как у других посадочных (ProductLanding), но без фото-баннера:
 * главное здесь — калькулятор, он стоит сразу под заголовком.
 */
export function InstallmentLanding({ locale }: { locale: string }) {
  if (!isLocale(locale)) notFound();
  const c = installmentCopy(locale);
  const url = `${SITE_URL}${installmentPath(locale)}`;
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
      mainEntity: c.faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
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
            <Link href={`/${locale}/apply`} className={buttonClass({ variant: 'primary', size: 'sm' })}>
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
          <p className="mt-4 max-w-[64ch] text-[17px] leading-relaxed text-ink-muted">{c.lede}</p>
        </section>

        <section className={`${section} pb-16`} aria-label={c.calcTitle}>
          <InstallmentCalculator copy={c} locale={locale} />
        </section>

        <section className="border-y border-line bg-surface">
          <div className={`${section} py-16`}>
            <h2 className={h2}>{c.howTitle}</h2>
            <ol className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              {c.how.map((step, i) => (
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
          <p className="mt-6 max-w-3xl text-[13px] leading-relaxed text-ink-faint">{c.disclaimer}</p>
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

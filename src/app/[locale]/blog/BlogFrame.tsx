import Image from 'next/image';
import Link from 'next/link';
import { ConsentSettingsLink } from '@/components/layout/AnalyticsConsent';
import { buttonClass } from '@/components/ui';
import { signInPath } from '@/lib/auth/paths';
import { APP } from '@/lib/config';
import { blogLabels } from '@/lib/blog/visuals';
import { blogPath, isBlogLocale } from '@/lib/blog/translations';

/** Ширина разделов блога — как на странице maansiirto. */
export const BLOG_SECTION = 'mx-auto w-full max-w-5xl px-5';

/**
 * Рамка страниц блога: шапка и подвал в стиле сайта (как у страницы
 * maansiirto): марка, «Блог», «Войти», главная кнопка «Подать заявку».
 * У каждого языка сайта свой блог (08.11.2026): финский — /blog (так его
 * ищет HeyCatch), остальные — /de/blog и т. д.; рамка говорит на языке
 * страницы. Разделы страницы задают сами страницы.
 */
export function BlogFrame({ children, lang = 'fi' }: { children: React.ReactNode; lang?: string }) {
  const t = blogLabels(lang);
  const site = isBlogLocale(lang) ? lang : 'fi';
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="border-b border-line bg-surface">
        <div className={`${BLOG_SECTION} flex items-center justify-between gap-4 py-4`}>
          <Link href={`/${site}`} aria-label="RAHTIS">
            <Image src="/logo-header.png" alt="RAHTIS" width={954} height={240} sizes="96px" className="h-6 w-auto" priority />
          </Link>
          <nav className="flex items-center gap-4 text-[14px]">
            <Link href={blogPath(site)} className="hidden text-ink-muted hover:text-ink sm:inline">
              {t.blog}
            </Link>
            <Link href={signInPath(site)} className="hidden text-ink-muted hover:text-ink sm:inline">
              {t.signIn}
            </Link>
            <Link href={`/${site}/apply`} className={buttonClass({ variant: 'primary', size: 'sm' })}>
              {t.join}
            </Link>
          </nav>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t border-line">
        <div className={`${BLOG_SECTION} flex flex-wrap items-center justify-between gap-3 py-5 text-[12px] text-ink-faint`}>
          <span>
            © {new Date().getFullYear()} {APP.operator.legalName} · Y-tunnus {APP.operator.businessId}
          </span>
          <span className="flex gap-3">
            <Link href={`/${site}`} className="hover:text-ink">
              RAHTIS
            </Link>
            <Link href={site === 'fi' ? '/fi/tietosuoja' : `/${site}/privacy`} className="hover:text-ink">
              {t.privacy}
            </Link>
            <ConsentSettingsLink className="hover:text-ink" />
          </span>
        </div>
      </footer>
    </div>
  );
}

export function formatDate(iso: string, lang = 'fi'): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? iso
    : date.toLocaleDateString(lang === 'en' ? 'en-GB' : lang, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Helsinki' });
}

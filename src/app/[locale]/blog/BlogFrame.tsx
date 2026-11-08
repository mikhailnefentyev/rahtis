import Image from 'next/image';
import Link from 'next/link';
import { ConsentSettingsLink } from '@/components/layout/AnalyticsConsent';
import { APP } from '@/lib/config';
import { blogLabels } from '@/lib/blog/visuals';

/**
 * Рамка страниц блога: марка, ссылки на список и заявку, подвал.
 * Блог живёт по адресу /blog без языка (так его ищет HeyCatch). Статьи в
 * основном финские (08.11.2026), поэтому рамка говорит на языке статьи
 * (или большинства статей в списке) и ведёт на заявку и политику на нём.
 */
export function BlogFrame({ children, lang = 'fi' }: { children: React.ReactNode; lang?: string }) {
  const t = blogLabels(lang);
  const site = lang === 'en' ? 'en' : 'fi';
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-4 px-5 py-4">
          <Link href="/" aria-label="RAHTIS">
            <Image src="/logo-header.png" alt="RAHTIS" width={954} height={240} className="h-6 w-auto" priority />
          </Link>
          <nav className="flex items-center gap-4 text-[13px]">
            <Link href="/blog" className="text-ink-muted hover:text-ink">
              {t.blog}
            </Link>
            <Link href={`/${site}/apply`} className="font-medium text-ink hover:underline">
              {t.join}
            </Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-10">{children}</main>
      <footer className="border-t border-line">
        <div className="mx-auto flex w-full max-w-3xl flex-wrap items-center justify-between gap-3 px-5 py-5 text-[12px] text-ink-faint">
          <span>
            © {new Date().getFullYear()} {APP.operator.legalName} · {APP.operator.businessId}
          </span>
          <span className="flex gap-3">
            <Link href={site === 'fi' ? '/fi/tietosuoja' : '/en/privacy'} className="hover:text-ink">
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

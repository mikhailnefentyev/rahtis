import Image from 'next/image';
import Link from 'next/link';
import { ConsentSettingsLink } from '@/components/layout/AnalyticsConsent';
import { APP } from '@/lib/config';

/**
 * Рамка страниц блога: марка, ссылки на список и заявку, подвал.
 * Блог живёт по адресу /blog без языка (так его ищет HeyCatch), статьи —
 * по-английски, поэтому и рамка английская.
 */
export function BlogFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-4 px-5 py-4">
          <Link href="/" aria-label="RAHTIS">
            <Image src="/logo-header.png" alt="RAHTIS" width={954} height={240} className="h-6 w-auto" priority />
          </Link>
          <nav className="flex items-center gap-4 text-[13px]">
            <Link href="/blog" className="text-ink-muted hover:text-ink">
              Blog
            </Link>
            <Link href="/en/apply" className="font-medium text-ink hover:underline">
              Join RAHTIS
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
            <Link href="/en/privacy" className="hover:text-ink">
              Privacy notice
            </Link>
            <ConsentSettingsLink className="hover:text-ink" />
          </span>
        </div>
      </footer>
    </div>
  );
}

export function formatDate(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? iso
    : date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Helsinki' });
}

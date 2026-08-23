import Link from 'next/link';
import { LocaleSwitch } from '@/components/layout/LocaleSwitch';
import { Badge, Button } from '@/components/ui';
import { companyStatusTone } from '@/components/ui/tone';
import { signOutAction } from '@/lib/auth/actions';
import { accountPath, cabinetPath } from '@/lib/auth/paths';
import { getI18n, type Locale } from '@/lib/i18n';
import type { Company, PartyRole } from '@/types/db';

/**
 * Шапка кабинета: марка, роль, компания и выход.
 *
 * Серверный компонент: выход — обычная форма с серверным действием,
 * поэтому кнопка работает и до загрузки клиентского кода.
 */
export async function CabinetHeader({
  locale,
  role,
  company,
}: {
  locale: Locale;
  role: PartyRole;
  company: Company | null;
}) {
  const { t } = await getI18n(locale);

  return (
    <header className="sticky top-0 z-10 border-b border-line bg-ground/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3">
        <Link
          href={cabinetPath(locale, role)}
          className="font-mono text-lg font-extrabold tracking-tight text-accent"
        >
          {t.brand.name}
        </Link>
        <span className="label-micro hidden sm:inline">{t.role[role]}</span>

        <div className="ml-auto flex flex-wrap items-center gap-3">
          {company && (
            <span className="flex items-center gap-2 text-[13px] text-ink-muted">
              <span className="max-w-[16rem] truncate">{company.name}</span>
              <Badge tone={companyStatusTone[company.status]}>
                {t.companyStatus[company.status]}
              </Badge>
            </span>
          )}

          <Link
            href={accountPath(locale)}
            className="text-[13px] text-ink-muted hover:text-ink"
          >
            {t.account.title}
          </Link>

          <LocaleSwitch current={locale} />

          <form action={signOutAction}>
            <input type="hidden" name="locale" value={locale} />
            <Button type="submit" variant="ghost" size="sm">
              {t.auth.signOut}
            </Button>
          </form>
        </div>
      </div>
    </header>
  );
}

import Image from 'next/image';
import Link from 'next/link';
import { CabinetTabs, type CabinetTab } from '@/components/layout/CabinetTabs';
import { LocaleSwitch } from '@/components/layout/LocaleSwitch';
import { Badge, Button } from '@/components/ui';
import { companyStatusTone } from '@/components/ui/tone';
import { signOutAction } from '@/lib/auth/actions';
import { accountPath, cabinetPath } from '@/lib/auth/paths';
import { getI18n, type Dictionary, type Locale } from '@/lib/i18n';
import { createClient } from '@/lib/supabase/server';
import type { Company, PartyRole } from '@/types/db';

/**
 * Шапка кабинета: марка, разделы, компания и выход.
 *
 * Серверный компонент: выход — обычная форма с серверным действием,
 * поэтому кнопка работает и до загрузки клиентского кода.
 *
 * Два ряда, а не один. Верхний отвечает на «кто я», нижний — на «куда
 * идти». Раньше разделы лежали кнопками на первом экране кабинета, и
 * попасть из списка рейсов в календарь можно было только через возврат
 * наверх.
 *
 * Фон непрозрачный. Полупрозрачный с backdrop-blur выглядел легче, но
 * сквозь него просвечивал текст уезжающей страницы, и закреплённая шапка
 * читалась как сломанная.
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
  const [{ t }, supabase] = await Promise.all([getI18n(locale), createClient()]);

  /*
   * Счётчик считает функция, а не выборка списка: в шапке нужно одно
   * число, а уведомлений у работающей компании со временем станут сотни.
   */
  const { data: unread } = await supabase.rpc('unread_notifications');

  const home = cabinetPath(locale, role);

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-ground">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 px-5 pt-3 pb-2">
        {/*
          * Логотип, а не надпись. Размеры заданы явно и высота
          * фиксирована: без них next/image не зарезервирует место, и
          * шапка дёрнется, когда картинка догрузится.
          *
          * priority: логотип виден сразу и не должен въезжать после
          * содержимого страницы.
          */}
        <Link href={home} className="flex shrink-0 items-center">
          <Image
            src="/logo-header.png"
            alt={t.brand.name}
            width={954}
            height={240}
            priority
            className="h-5 w-auto sm:h-6"
          />
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
            href={`/${locale}/notifications`}
            className="relative text-[13px] text-ink-muted hover:text-ink"
          >
            {t.notify.title}
            {/* Число рядом, а не точка: «сколько ждёт» важнее, чем «что-то есть». */}
            {typeof unread === 'number' && unread > 0 && (
              <span className="unread-badge">{unread > 99 ? '99+' : unread}</span>
            )}
          </Link>

          {/*
            * Одна ссылка на личное и на реквизиты компании. Раньше их было
            * две, и вели они на две почти одинаковые страницы: пароль на
            * одной, IBAN на другой — при том, что открывает их один и тот
            * же человек и по одному и тому же поводу «поправить свои
            * данные».
            */}
          <Link href={accountPath(locale)} className="text-[13px] text-ink-muted hover:text-ink">
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

      <CabinetTabs tabs={cabinetTabs(locale, role, home, t)} />
    </header>
  );
}

/** Разделы роли. Первым всегда корень кабинета — по нему сравнение точное. */
function cabinetTabs(locale: Locale, role: PartyRole, home: string, t: Dictionary): CabinetTab[] {
  const overview: CabinetTab = { href: home, label: t.nav.overview };

  if (role === 'CARRIER') {
    return [
      overview,
      { href: `/${locale}/carrier/desk`, label: t.desk.title },
      { href: `/${locale}/carrier/fleet`, label: t.fleet.title },
      { href: `/${locale}/carrier/done`, label: t.done.titleCarrier },
    ];
  }

  if (role === 'SHIPPER') {
    return [
      overview,
      { href: `/${locale}/shipper/orders`, label: t.orders.title },
      { href: `/${locale}/shipper/done`, label: t.done.titleShipper },
    ];
  }

  return [
    overview,
    { href: `/${locale}/admin/billing`, label: t.done.titleAdmin },
    { href: `/${locale}/admin/legal`, label: t.legal.manage },
    { href: `/${locale}/admin/outbox`, label: t.outbox.title },
  ];
}

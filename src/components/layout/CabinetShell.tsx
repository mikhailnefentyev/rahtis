import Image from 'next/image';
import Link from 'next/link';
import { LegalReaccept } from '@/components/layout/LegalReaccept';
import { LocaleSwitch } from '@/components/layout/LocaleSwitch';
import { Badge } from '@/components/ui';
import { companyStatusTone } from '@/components/ui/tone';
import { signOutAction } from '@/lib/auth/actions';
import { accountPath, cabinetPath } from '@/lib/auth/paths';
import { getI18n, type Dictionary, type Locale } from '@/lib/i18n';
import { createClient } from '@/lib/supabase/server';
import type { Company, PartyRole } from '@/types/db';
import { SideNav, TabBar, type NavGroup, type NavItem } from './CabinetNav';
import { NavIcon } from './NavIcon';

/**
 * Каркас кабинета: боковая панель, строка сверху, содержимое.
 *
 * 8.10.2026 переделан из двухрядной шапки. За месяц кабинет перевозчика
 * оброс девятью вкладками в одну строку, и ежедневная работа стояла
 * вровень с настройками. Теперь разделы сгруппированы — работа, компания,
 * документы, — а на телефоне уходят в нижнее меню с листом «Valikko».
 *
 * Серверный: счётчик уведомлений, ждущие условия и выход (форма с
 * серверным действием) работают и до загрузки клиентского кода.
 */
export async function CabinetShell({
  locale,
  role,
  company,
  children,
}: {
  locale: Locale;
  role: PartyRole;
  company: Company | null;
  children: React.ReactNode;
}) {
  const [{ t }, supabase] = await Promise.all([getI18n(locale), createClient()]);
  const { data: unread } = await supabase.rpc('unread_notifications');

  const home = cabinetPath(locale, role);
  const { groups, primary } = navigation(locale, role, home, t);
  const count = typeof unread === 'number' ? unread : 0;

  const signOut = (
    <form action={signOutAction}>
      <input type="hidden" name="locale" value={locale} />
      <button type="submit" className="cab-icon-btn" aria-label={t.auth.signOut} title={t.auth.signOut}>
        <NavIcon name="logout" className="size-[18px]" />
      </button>
    </form>
  );

  return (
    <div className="cab-shell">
      <aside className="cab-side" aria-label={t.nav.menu}>
        <Link href={home} className="cab-brand">
          <Image src="/logo-header-light.png" alt={t.brand.name} width={954} height={240} priority className="h-5 w-auto" />
          <span>{t.role[role]}</span>
        </Link>

        <SideNav groups={groups} home={home} />

        {company && (
          <Link href={accountPath(locale)} className="cab-company">
            <span className="cab-avatar" aria-hidden>
              {company.name.trim().charAt(0).toUpperCase()}
            </span>
            <span className="min-w-0">
              <b className="block truncate">{company.name}</b>
              <span className="cab-company__sub">{t.account.title}</span>
            </span>
          </Link>
        )}
      </aside>

      <div className="cab-main">
        <div className="cab-top">
          {/* На телефоне панели нет — марка в строке сверху. */}
          <Link href={home} className="cab-top__brand">
            <Image src="/logo-header.png" alt={t.brand.name} width={954} height={240} className="h-5 w-auto" />
          </Link>

          {role !== 'ADMIN' && <LegalReaccept locale={locale} companyStatus={company?.status} compact />}

          <div className="ml-auto flex items-center gap-2">
            {company && (
              <span className="cab-top__status">
                <Badge tone={companyStatusTone[company.status]}>{t.companyStatus[company.status]}</Badge>
              </span>
            )}
            <Link
              href={`/${locale}/notifications`}
              className="cab-icon-btn relative"
              aria-label={count > 0 ? `${t.notify.title} (${count})` : t.notify.title}
              title={t.notify.title}
            >
              <NavIcon name="bell" className="size-[18px]" />
              {count > 0 && <span className="cab-icon-btn__badge">{count > 99 ? '99+' : count}</span>}
            </Link>
            <Link href={accountPath(locale)} className="cab-icon-btn cab-top__desktop" aria-label={t.account.title} title={t.account.title}>
              <NavIcon name="user" className="size-[18px]" />
            </Link>
            <LocaleSwitch current={locale} />
            <span className="cab-top__desktop">{signOut}</span>
          </div>
        </div>

        <div className="cab-content">{children}</div>
      </div>

      <TabBar
        primary={primary}
        groups={groups}
        home={home}
        menuLabel={t.nav.menu}
        closeLabel={t.action.close}
        extra={
          <div className="cab-sheet__extra">
            <Link href={accountPath(locale)} className="cab-nav__link">
              <NavIcon name="user" />
              {t.account.title}
            </Link>
            <form action={signOutAction}>
              <input type="hidden" name="locale" value={locale} />
              <button type="submit" className="cab-nav__link w-full">
                <NavIcon name="logout" />
                {t.auth.signOut}
              </button>
            </form>
          </div>
        }
      />
    </div>
  );
}

/** Разделы роли по группам и четыре главных — для нижнего меню телефона. */
function navigation(
  locale: Locale,
  role: PartyRole,
  home: string,
  t: Dictionary,
): { groups: NavGroup[]; primary: NavItem[] } {
  const overview: NavItem = { href: home, label: t.nav.overview, icon: 'home' };

  if (role === 'CARRIER') {
    const desk: NavItem = { href: `/${locale}/carrier/desk`, label: t.desk.title, short: t.nav.deskShort, icon: 'desk' };
    const own: NavItem = { href: `/${locale}/carrier/own`, label: t.own.title, short: t.nav.ownShort, icon: 'own' };
    const done: NavItem = { href: `/${locale}/carrier/done`, label: t.done.titleCarrier, short: t.nav.doneShort, icon: 'done' };
    return {
      groups: [
        { label: t.nav.groupWork, items: [overview, desk, own, done] },
        {
          label: t.nav.groupCompany,
          items: [
            { href: `/${locale}/carrier/fleet`, label: t.fleet.title, icon: 'fleet' },
            { href: `/${locale}/carrier/drivers`, label: t.drivers.title, icon: 'drivers' },
            { href: `/${locale}/carrier/partners`, label: t.partners.title, icon: 'clients' },
          ],
        },
        {
          label: t.nav.groupDocuments,
          items: [
            { href: `/${locale}/carrier/reports`, label: t.periodReport.title, icon: 'reports' },
            { href: `/${locale}/carrier/claims`, label: t.claims.title, icon: 'claims' },
          ],
        },
      ],
      primary: [overview, desk, own, done],
    };
  }

  if (role === 'SHIPPER') {
    const orders: NavItem = { href: `/${locale}/shipper/orders`, label: t.orders.title, short: t.nav.ordersShort, icon: 'orders' };
    const done: NavItem = { href: `/${locale}/shipper/done`, label: t.done.titleShipper, short: t.nav.doneShort, icon: 'done' };
    const reports: NavItem = { href: `/${locale}/shipper/reports`, label: t.periodReport.title, short: t.nav.reportsShort, icon: 'reports' };
    return {
      groups: [
        { label: t.nav.groupWork, items: [overview, orders, done] },
        {
          label: t.nav.groupCompany,
          items: [
            { href: `/${locale}/shipper/vehicles`, label: t.known.title, icon: 'vehicles' },
            { href: `/${locale}/shipper/api`, label: t.api.nav, icon: 'api' },
          ],
        },
        {
          label: t.nav.groupDocuments,
          items: [reports, { href: `/${locale}/shipper/claims`, label: t.claims.title, icon: 'claims' }],
        },
      ],
      primary: [overview, orders, done, reports],
    };
  }

  const onboarding: NavItem = { href: `/${locale}/admin/onboarding`, label: t.onboardingAdmin.nav, icon: 'onboarding' };
  const billing: NavItem = { href: `/${locale}/admin/billing`, label: t.done.titleAdmin, icon: 'billing' };
  const claims: NavItem = { href: `/${locale}/admin/claims`, label: t.claims.title, icon: 'claims' };
  return {
    groups: [
      { label: t.nav.groupWork, items: [overview, onboarding, billing, claims] },
      {
        label: t.nav.groupPlatform,
        items: [
          { href: `/${locale}/admin/reports`, label: t.periodReport.title, icon: 'reports' },
          { href: `/${locale}/admin/outbox`, label: t.outbox.title, icon: 'outbox' },
          { href: `/${locale}/admin/operator`, label: t.operator.tab, icon: 'operator' },
        ],
      },
      {
        label: t.nav.groupContent,
        items: [
          { href: `/${locale}/admin/legal`, label: t.legal.manage, icon: 'legal' },
          { href: `/${locale}/admin/training`, label: t.adminTraining.nav, icon: 'training' },
        ],
      },
    ],
    primary: [overview, onboarding, billing, claims],
  };
}

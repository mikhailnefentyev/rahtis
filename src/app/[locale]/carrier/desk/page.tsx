import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Card, CardBody, buttonClass } from '@/components/ui';
import { requireRole } from '@/lib/auth/guard';
import { cabinetPath } from '@/lib/auth/paths';
import { getI18n, isLocale } from '@/lib/i18n';
import { createClient } from '@/lib/supabase/server';
import { Assignments } from './Assignments';
import { DeskList } from './DeskList';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const { t } = await getI18n(locale);
  return { title: t.desk.title };
}

export default async function DeskPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ region?: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const viewer = await requireRole(locale, 'CARRIER');
  const company = viewer.company!;

  const [{ t, m }, supabase, { region }] = await Promise.all([
    getI18n(locale),
    createClient(),
    searchParams,
  ]);

  /*
   * Гейт спрашивается у базы, а не выводится из данных на странице:
   * то же правило действует внутри desk_orders, и держать его в двух
   * местах значит рано или поздно получить расхождение.
   */
  const [{ data: readiness }, { data: orders }, { data: regions }, { data: assignments }, { data: vehicles }] =
    await Promise.all([
      supabase.rpc('company_readiness', { p_company_id: company.id }),
      supabase.rpc('desk_orders', { p_region: region ?? undefined }),
      supabase.rpc('desk_regions'),
      supabase.rpc('my_assignments'),
      /* Отклик подаётся конкретной машиной — нужен список допущенных. */
      supabase
        .from('vehicles')
        .select('*')
        .eq('company_id', company.id)
        .eq('access', 'APPROVED')
        .order('plate'),
    ]);

  const state = readiness?.[0];
  const canTakeOrders = state?.can_take_orders ?? false;

  return (
    <main className="mx-auto w-full max-w-4xl px-5 py-8">
      <nav className="mb-6">
        <Link
          href={cabinetPath(locale, 'CARRIER')}
          className="text-[13px] text-ink-muted hover:text-ink"
        >
          ← {t.role.CARRIER}
        </Link>
      </nav>

      <h1 className="text-xl font-semibold tracking-tight">{t.desk.title}</h1>
      <p className="mt-2 mb-6 max-w-xl text-[13px] leading-relaxed text-ink-muted">
        {t.desk.subtitle}
      </p>

      {/* Закреплённые рейсы важнее стола: они требуют действия и горят по срокам. */}
      <Assignments assignments={assignments ?? []} />

      {!canTakeOrders ? (
        /*
         * Закрытый стол объясняется, а не показывается пустым списком:
         * причин две, и они требуют разных действий.
         */
        <Card stripe="warn">
          <CardBody className="flex flex-col items-start gap-3">
            <h2 className="text-[15px] font-semibold tracking-tight">{t.desk.closedTitle}</h2>
            <p className="max-w-xl text-[13px] leading-relaxed text-ink-muted">
              {state?.has_license && state?.has_insurance && !state?.documents_ok
                ? t.desk.closedExpired
                : t.desk.closedNoVehicle}
            </p>
            <Link
              href={`/${locale}/carrier/fleet`}
              className={buttonClass({ variant: 'primary', size: 'md' })}
            >
              {t.desk.openFleet}
            </Link>
          </CardBody>
        </Card>
      ) : (
        <>
          <nav className="mb-5 flex flex-wrap gap-1.5">
            <Link
              href={`/${locale}/carrier/desk`}
              className={buttonClass({
                variant: region ? 'default' : 'primary',
                size: 'sm',
              })}
            >
              {t.desk.allRegions}
            </Link>
            {(regions ?? []).map((row) => (
              <Link
                key={row.city}
                href={`/${locale}/carrier/desk?region=${encodeURIComponent(row.city)}`}
                className={buttonClass({
                  variant: region === row.city ? 'primary' : 'default',
                  size: 'sm',
                })}
              >
                {m('desk.regionCount', { city: row.city, count: row.open_orders })}
              </Link>
            ))}
          </nav>

          <p className="label-micro mb-4">
            {m('desk.ordersCount', { count: (orders ?? []).length })}
          </p>

          <DeskList orders={orders ?? []} vehicles={vehicles ?? []} />
        </>
      )}
    </main>
  );
}

import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { TruckPhoto } from '@/components/domain/TruckPhoto';
import { Badge, Card, CardBody, EmptyState, buttonClass } from '@/components/ui';
import { requireRole } from '@/lib/auth/guard';
import { cn } from '@/lib/cn';
import { dealBadgeTone, installmentsAvailable } from '@/lib/installments/access';
import { setListingStatusAction } from '@/lib/installments/actions';
import { fill, installmentUiCopy } from '@/lib/installments/copy';
import { isLocale } from '@/lib/i18n';
import { installmentPath } from '@/lib/landing/installment';
import { createClient } from '@/lib/supabase/server';
import { ActionForm } from './ActionForm';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  return { title: installmentUiCopy(locale).title };
}

type Tab = 'mine' | 'deals' | 'catalog';

/**
 * Продажа техники в рассрочку (22.11.2026): свои объявления, переговоры и
 * сделки, каталог машин других перевозчиков. Продаёт и покупает главный в
 * компании с действующими документами — проверяет база.
 */
export default async function InstallmentsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const [{ locale }, { tab: rawTab }] = await Promise.all([params, searchParams]);
  if (!isLocale(locale)) notFound();
  const viewer = await requireRole(locale, 'CARRIER');
  const company = viewer.company!;
  /* Раздел только для финских компаний: пункта в меню у остальных нет, по прямой ссылке — «страницы нет» (22.11.2026). */
  if (!installmentsAvailable(company.country)) notFound();
  const ui = installmentUiCopy(locale);
  const tab: Tab = rawTab === 'deals' || rawTab === 'catalog' ? rawTab : 'mine';
  const supabase = await createClient();

  const [{ data: readiness }, { data: listings }, { data: deals }, { data: catalog }] = await Promise.all([
    supabase.rpc('company_readiness', { p_company_id: company.id }),
    supabase
      .from('equipment_listings')
      .select('id, status, price_cents, down_payment_cents, months, vehicle_id, published_at')
      .eq('seller_company_id', company.id)
      .order('created_at', { ascending: false }),
    supabase.rpc('my_installment_deals'),
    supabase.rpc('equipment_catalog'),
  ]);
  const owner = viewer.status === 'ready' && viewer.profile.member_kind !== 'DISPATCHER';
  const allowed = owner && Boolean(readiness?.[0]?.documents_ok);

  const vehicleIds = (listings ?? []).map((l) => l.vehicle_id);
  const { data: vehicles } = vehicleIds.length
    ? await supabase.from('vehicles').select('id, make, plate, vehicle_class').in('id', vehicleIds)
    : { data: [] as { id: string; make: string; plate: string; vehicle_class: string }[] };
  const vehicleById = new Map((vehicles ?? []).map((v) => [v.id, v]));

  const money = new Intl.NumberFormat(locale === 'en' ? 'en-GB' : locale, { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
  const eur = (cents: number) => money.format(cents / 100);
  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: 'mine', label: ui.tabs.mine, count: listings?.length },
    { key: 'deals', label: ui.tabs.deals, count: (deals ?? []).filter((d) => d.status === 'NEGOTIATING').length },
    { key: 'catalog', label: ui.tabs.catalog, count: catalog?.length },
  ];

  return (
    <main className="cab-page flex flex-col gap-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="page-title">{ui.title}</h1>
          <p className="mt-1 max-w-[70ch] text-[14px] text-ink-muted">{ui.intro}</p>
        </div>
        <Link href={`/${locale}${installmentPath(locale)}`} className="text-[13px] text-accent hover:underline">
          {ui.calculatorLink} ›
        </Link>
      </header>

      {!allowed && <p className="rounded-card border border-warn/35 bg-warn/10 px-4 py-3 text-[14px] text-warn">{ui.notAllowed}</p>}

      <nav className="flex flex-wrap gap-1 border-b border-line" aria-label={ui.title}>
        {tabs.map((t) => (
          <Link
            key={t.key}
            href={`/${locale}/carrier/installments${t.key === 'mine' ? '' : `?tab=${t.key}`}`}
            aria-current={t.key === tab ? 'page' : undefined}
            className={cn(
              '-mb-px border-b-2 px-3 py-2 text-[14px]',
              t.key === tab ? 'border-accent font-semibold text-accent' : 'border-transparent text-ink-muted hover:text-ink',
            )}
          >
            {t.label}
            {t.count ? <span className="ml-1.5 font-mono text-[12px] text-ink-faint">{t.count}</span> : null}
          </Link>
        ))}
      </nav>

      {tab === 'mine' &&
        ((listings ?? []).length === 0 ? (
          <EmptyState title={ui.tabs.mine} description={ui.emptyMine} />
        ) : (
          <div className="flex flex-col gap-3">
            {(listings ?? []).map((l) => {
              const v = vehicleById.get(l.vehicle_id);
              return (
                <Card key={l.id}>
                  <CardBody className="flex flex-col gap-4 sm:flex-row sm:items-start">
                    <TruckPhoto make={v?.make} vehicleClass={v?.vehicle_class} plate={v?.plate} country={company.country} className="sm:w-[200px] sm:shrink-0" />
                    <div className="flex min-w-0 flex-1 flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-[15px] font-bold">{v?.plate}</span>
                          <Badge tone={l.status === 'PUBLISHED' ? 'ok' : l.status === 'RESERVED' ? 'info' : 'neutral'}>{ui.status[l.status]}</Badge>
                        </div>
                        <p className="mt-1 text-[14px]">{v?.make}</p>
                        <p className="mt-1 font-mono text-[14px]">
                          {eur(l.price_cents)} · {fill(ui.catalog.terms, { months: String(l.months), down: eur(l.down_payment_cents) })}
                        </p>
                      </div>
                      {allowed && (l.status === 'DRAFT' || l.status === 'PUBLISHED') && (
                        <div className="flex flex-wrap gap-2">
                          <Link href={`/${locale}/carrier/installments/edit/${l.id}`} className={buttonClass({ size: 'sm' })}>
                            {ui.listing.editTitle}
                          </Link>
                          <ActionForm
                            action={setListingStatusAction}
                            fields={{ locale, id: l.id, status: l.status === 'DRAFT' ? 'PUBLISHED' : 'WITHDRAWN' }}
                            label={l.status === 'DRAFT' ? ui.listing.publish : ui.listing.withdraw}
                            variant={l.status === 'DRAFT' ? 'primary' : 'default'}
                          />
                        </div>
                      )}
                    </div>
                  </CardBody>
                </Card>
              );
            })}
          </div>
        ))}

      {tab === 'deals' &&
        ((deals ?? []).length === 0 ? (
          <EmptyState title={ui.tabs.deals} description={ui.emptyDeals} />
        ) : (
          <div className="flex flex-col gap-3">
            {(deals ?? []).map((d) => (
              <Link key={d.deal_id} href={`/${locale}/carrier/installments/${d.deal_id}`} className="block">
                <Card className="transition-colors hover:border-accent-line">
                  <CardBody className="flex flex-col gap-4 sm:flex-row sm:items-center">
                    <TruckPhoto make={d.make} vehicleClass={d.vehicle_class} plate={d.plate} country={company.country} className="sm:w-[160px] sm:shrink-0" />
                    <div className="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-[15px] font-bold">{d.plate}</span>
                          <Badge tone={dealBadgeTone(d.status)}>{ui.status[d.status] ?? d.status}</Badge>
                          <span className="text-[13px] text-ink-muted">{ui.role[d.role]}</span>
                        </div>
                        <p className="mt-1 text-[14px]">
                          {d.make} · {d.counterparty_name}
                        </p>
                        <p className="mt-1 font-mono text-[14px]">
                          {eur(d.price_cents)} · {fill(ui.catalog.monthsShort, { months: String(d.months) })}
                          {d.contract_number ? ` · ${d.contract_number}` : ''}
                        </p>
                      </div>
                      {d.status === 'NEGOTIATING' && (
                        <span className="text-[13px] text-ink-muted">{d.proposed_by_me ? ui.deal.proposedByMe : ui.deal.proposedByThem}</span>
                      )}
                    </div>
                  </CardBody>
                </Card>
              </Link>
            ))}
          </div>
        ))}

      {tab === 'catalog' &&
        ((catalog ?? []).length === 0 ? (
          <EmptyState title={ui.tabs.catalog} description={allowed ? ui.emptyCatalog : ui.notAllowed} />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {(catalog ?? []).map((l) => (
              <Card key={l.listing_id}>
                <CardBody className="flex h-full flex-col gap-3">
                  <TruckPhoto make={l.make} vehicleClass={l.vehicle_class} plate={l.plate} country={null} sizes="(min-width: 1280px) 380px, (min-width: 640px) 50vw, 100vw" />
                  <div className="flex-1">
                    <p className="font-semibold">{l.make}</p>
                    <p className="text-[13px] text-ink-muted">
                      {ui.catalog.seller}: {l.seller_name}
                      {l.seller_city ? ` · ${l.seller_city}` : ''}
                      {l.odometer_km != null ? ` · ${l.odometer_km.toLocaleString(locale === 'en' ? 'en-GB' : locale)} km` : ''}
                    </p>
                    <p className="mt-2 font-mono text-[15px] font-bold">{eur(l.price_cents)}</p>
                    <p className="font-mono text-[13px] text-ink-muted">
                      {fill(ui.catalog.terms, { months: String(l.months), down: eur(l.down_payment_cents) })}
                    </p>
                  </div>
                  <Link
                    href={l.my_deal_id ? `/${locale}/carrier/installments/${l.my_deal_id}` : `/${locale}/carrier/installments/listing/${l.listing_id}`}
                    className={buttonClass({ variant: l.my_deal_id ? 'default' : 'primary', size: 'sm', className: 'self-start' })}
                  >
                    {l.my_deal_id ? ui.catalog.myDeal : ui.catalog.open}
                  </Link>
                </CardBody>
              </Card>
            ))}
          </div>
        ))}
    </main>
  );
}

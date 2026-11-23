import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { TruckPhoto } from '@/components/domain/TruckPhoto';
import { Badge, Card, CardBody, EmptyState, buttonClass } from '@/components/ui';
import { requireRole } from '@/lib/auth/guard';
import { cn } from '@/lib/cn';
import {
  canBuyInstallments,
  canSellInstallments,
  catalogTabShown,
  dealBadgeTone,
  installmentsAvailable,
  installmentsBase,
  saleVehicleEditable,
  type InstallmentCabinet,
} from '@/lib/installments/access';
import { setListingStatusAction, submitSaleVehicleAction } from '@/lib/installments/actions';
import { fill, installmentUiCopy } from '@/lib/installments/copy';
import { installmentCurrency, installmentMoney } from '@/lib/installments/countries';
import { countryName, installmentCountryCopy } from '@/lib/installments/countryCopy';
import { equipmentSalePath } from '@/lib/landing/equipmentSale';
import { isLocale } from '@/lib/i18n';
import { getViewerI18n } from '@/lib/i18n/viewer';
import { installmentPath } from '@/lib/landing/installment';
import { createClient } from '@/lib/supabase/server';
import { ActionForm } from './ActionForm';

export async function installmentsMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  return { title: installmentUiCopy(locale).title };
}

type Tab = 'mine' | 'deals' | 'catalog';

/**
 * Продажа техники в рассрочку (22.11.2026): свои объявления, переговоры и
 * сделки, каталог машин на продажу.
 *
 * Решение 23.11.2026: продаёт главный в любой проверенной финской компании,
 * покупает только перевозчик с действующими документами — проверяет база.
 * Экран один на два кабинета (role): у перевозчика — как раньше, с каталогом;
 * у компании без парка каталога нет, зато есть её машины на продажу — их
 * проверяет оператор, и одобренную можно выставить.
 */
export async function InstallmentsScreen({
  params,
  searchParams,
  role,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ tab?: string }>;
  role: InstallmentCabinet;
}) {
  const [{ locale }, { tab: rawTab }] = await Promise.all([params, searchParams]);
  if (!isLocale(locale)) notFound();
  const viewer = await requireRole(locale, role);
  const home = `/${locale}${installmentsBase(role)}`;
  const carrier = role === 'CARRIER';
  const withCatalog = catalogTabShown(role);
  const company = viewer.company!;
  /* Раздел только для финских компаний: пункта в меню у остальных нет, по прямой ссылке — «страницы нет» (22.11.2026). */
  if (!installmentsAvailable(company.country)) notFound();
  /* Вступление и «кто может продавать» — про страну компании (23.11.2026); у финской — как было. */
  const ui = installmentUiCopy(locale, company.country);
  const { t } = await getViewerI18n(locale);
  const tab: Tab = rawTab === 'deals' || (rawTab === 'catalog' && withCatalog) ? rawTab : 'mine';
  const supabase = await createClient();

  /* Документы перевозчика и каталог нужны только покупателю; машины на продажу — только компании без парка. */
  const [{ data: readiness }, { data: listings }, { data: deals }, { data: catalog }, { data: saleVehicles }] = await Promise.all([
    carrier ? supabase.rpc('company_readiness', { p_company_id: company.id }) : Promise.resolve({ data: null }),
    supabase
      .from('equipment_listings')
      .select('id, status, price_cents, currency, down_payment_cents, months, vehicle_id, sale_vehicle_id, published_at')
      .eq('seller_company_id', company.id)
      .order('created_at', { ascending: false }),
    supabase.rpc('my_installment_deals'),
    withCatalog ? supabase.rpc('equipment_catalog') : Promise.resolve({ data: null }),
    carrier
      ? Promise.resolve({ data: null })
      : supabase.from('equipment_sale_vehicles').select('*').eq('company_id', company.id).order('created_at', { ascending: false }),
  ]);
  const owner = viewer.status === 'ready' && viewer.profile.member_kind !== 'DISPATCHER';
  const facts = { kind: company.kind, country: company.country, status: company.status, owner };
  /* Продавцу хватает проверенной финской компании; лицензия и страховка нужны только чтобы покупать (23.11.2026). */
  const canSell = canSellInstallments(facts);
  const canBuy = canBuyInstallments({ ...facts, documentsOk: Boolean(readiness?.[0]?.documents_ok) });

  /* Машина объявления — из парка или из машин на продажу: у объявления ровно одна из двух ссылок. */
  const vehicleIds = (listings ?? []).map((l) => l.vehicle_id).filter((v): v is string => Boolean(v));
  const { data: vehicles } = vehicleIds.length
    ? await supabase.from('vehicles').select('id, make, plate, vehicle_class').in('id', vehicleIds)
    : { data: [] as { id: string; make: string; plate: string; vehicle_class: string }[] };
  const vehicleById = new Map<string, { make: string; plate: string; vehicle_class: string }>([
    ...(vehicles ?? []).map((v) => [v.id, v] as const),
    ...(saleVehicles ?? []).map((v) => [v.id, v] as const),
  ]);
  const liveSaleVehicles = new Set(
    (listings ?? [])
      .filter((l) => l.sale_vehicle_id && ['DRAFT', 'PUBLISHED', 'RESERVED'].includes(l.status))
      .map((l) => l.sale_vehicle_id as string),
  );

  /*
   * Каждая сумма — в валюте своего объявления или сделки (страны продавца),
   * без пересчёта (23.11.2026). До миграции 20261128100000 каталог и список
   * сделок валюту и страну не отдают — тогда это валюта страны компании.
   */
  const ownCurrency = installmentCurrency(company.country);
  const eur = (cents: number, currency?: string | null) => installmentMoney(locale, currency ?? ownCurrency, true)(cents);
  const cc = installmentCountryCopy(locale);
  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: 'mine', label: ui.tabs.mine, count: listings?.length },
    { key: 'deals', label: ui.tabs.deals, count: (deals ?? []).filter((d) => d.status === 'NEGOTIATING').length },
    ...(withCatalog ? [{ key: 'catalog' as const, label: ui.tabs.catalog, count: catalog?.length }] : []),
  ];

  return (
    <main className="cab-page flex flex-col gap-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="page-title">{ui.title}</h1>
          <p className="mt-1 max-w-[70ch] text-[14px] text-ink-muted">{carrier ? ui.intro : ui.introSeller}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Link href={`/${locale}${installmentPath(locale)}`} className="text-[13px] text-accent hover:underline">
            {ui.calculatorLink} ›
          </Link>
          {/* Открытая страница объявлений: её видят все, без входа (23.11.2026). */}
          <Link href={`/${locale}${equipmentSalePath(locale)}`} className="text-[13px] text-accent hover:underline">
            {cc.publicLink} ›
          </Link>
          {/*
            * Вход в продажу — здесь же (22.11.2026): раньше объявление можно было
            * начать только мелкой ссылкой в карточке машины в парке, и в самом
            * разделе не было ни выбора машины, ни формы.
            */}
          {canSell && (
            <Link href={`${home}/new`} className={buttonClass({ variant: 'primary', size: 'sm' })}>
              {ui.sell}
            </Link>
          )}
        </div>
      </header>

      {/* Продавать нельзя: компания ещё не проверена оператором или вошёл не главный пользователь. */}
      {!canSell && (
        <p className="rounded-card border border-warn/35 bg-warn/10 px-4 py-3 text-[14px] text-warn">{ui.notAllowed}</p>
      )}
      {/* Перевозчик продавать может, а покупать — только с действующими документами (23.11.2026). */}
      {canSell && carrier && !canBuy && (
        <p className="rounded-card border border-warn/35 bg-warn/10 px-4 py-3 text-[14px] text-warn">
          {ui.buyNotAllowed}{' '}
          {/* Куда идти: документы компании — в парке. */}
          <Link href={`/${locale}/carrier/fleet`} className="font-semibold underline underline-offset-2">
            {t.fleet.title} ›
          </Link>
        </p>
      )}

      <nav className="flex flex-wrap gap-1 border-b border-line" aria-label={ui.title}>
        {tabs.map((t) => (
          <Link
            key={t.key}
            href={`${home}${t.key === 'mine' ? '' : `?tab=${t.key}`}`}
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

      {/*
        * Машины на продажу у компании без парка (23.11.2026): карточку проверяет
        * оператор, как машину парка; одобренную можно выставить. Править можно,
        * пока карточка не на проверке и по ней нет объявления.
        */}
      {tab === 'mine' && !carrier && (
        <section className="flex flex-col gap-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-[17px] font-semibold">{ui.saleVehicles.title}</h2>
              <p className="mt-1 max-w-[70ch] text-[13px] text-ink-muted">{ui.saleVehicles.hint}</p>
            </div>
            {canSell && (
              <Link href={`${home}/vehicle/new`} className={buttonClass({ size: 'sm' })}>
                {t.fleet.addVehicle}
              </Link>
            )}
          </div>
          {(saleVehicles ?? []).length === 0 ? (
            <p className="text-[14px] text-ink-muted">{t.fleet.noVehicles}</p>
          ) : (
            (saleVehicles ?? []).map((v) => (
              <Card key={v.id}>
                <CardBody className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-[15px] font-bold">{v.plate}</span>
                      {v.sold_deal_id ? (
                        <Badge tone="info">{ui.stage3.soldBadge}</Badge>
                      ) : (
                        <Badge tone={v.access === 'APPROVED' ? 'ok' : v.access === 'PENDING' ? 'warn' : v.access === 'REJECTED' ? 'danger' : 'neutral'}>
                          {t.vehicleAccess[v.access]}
                        </Badge>
                      )}
                    </div>
                    <p className="mt-1 text-[14px]">
                      {v.make} · {t.vehicleClass[v.vehicle_class]}
                    </p>
                    {v.access === 'PENDING' && <p className="mt-1 text-[13px] text-ink-muted">{t.fleet.onReview}</p>}
                    {v.access === 'REJECTED' && (
                      <p className="mt-1 text-[13px] text-danger">
                        {t.fleet.rejectedHint}
                        {v.rejection_reason ? ` ${v.rejection_reason}` : ''}
                      </p>
                    )}
                    {v.sold_deal_id && (
                      <Link href={`${home}/${v.sold_deal_id}`} className="mt-1 inline-block text-[13px] text-accent hover:underline">
                        {ui.deal.title} ›
                      </Link>
                    )}
                  </div>
                  {canSell && !v.sold_deal_id && (
                    <div className="flex flex-wrap gap-2">
                      {saleVehicleEditable(v, liveSaleVehicles.has(v.id)) && (
                        <Link href={`${home}/vehicle/${v.id}`} className={buttonClass({ size: 'sm' })}>
                          {t.fleet.editVehicle}
                        </Link>
                      )}
                      {(v.access === 'DRAFT' || v.access === 'REJECTED') && (
                        <ActionForm action={submitSaleVehicleAction} fields={{ locale, id: v.id }} label={t.fleet.submitForApproval} variant="primary" />
                      )}
                      {v.access === 'APPROVED' && !liveSaleVehicles.has(v.id) && (
                        <Link href={`${home}/new?vehicle=${v.id}`} className={buttonClass({ variant: 'primary', size: 'sm' })}>
                          {ui.sell}
                        </Link>
                      )}
                    </div>
                  )}
                </CardBody>
              </Card>
            ))
          )}
        </section>
      )}

      {tab === 'mine' &&
        ((listings ?? []).length === 0 ? (
          <EmptyState
            title={ui.tabs.mine}
            description={carrier ? ui.emptyMine : ui.emptyMineSeller}
            action={
              canSell ? (
                <Link href={`${home}/new`} className={buttonClass({ variant: 'primary', size: 'md' })}>
                  {ui.sell}
                </Link>
              ) : undefined
            }
          />
        ) : (
          <div className="flex flex-col gap-3">
            {(listings ?? []).map((l) => {
              const v = vehicleById.get(l.vehicle_id ?? l.sale_vehicle_id ?? '');
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
                          {eur(l.price_cents, l.currency)} · {fill(ui.catalog.terms, { months: String(l.months), down: eur(l.down_payment_cents, l.currency) })}
                        </p>
                      </div>
                      {canSell && (l.status === 'DRAFT' || l.status === 'PUBLISHED') && (
                        <div className="flex flex-wrap gap-2">
                          <Link href={`${home}/edit/${l.id}`} className={buttonClass({ size: 'sm' })}>
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
              <Link key={d.deal_id} href={`${home}/${d.deal_id}`} className="block">
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
                          {eur(d.price_cents, d.currency)} · {fill(ui.catalog.monthsShort, { months: String(d.months) })}
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
          <EmptyState title={ui.tabs.catalog} description={canBuy ? ui.emptyCatalog : ui.buyNotAllowed} />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {(catalog ?? []).map((l) => (
              <Card key={l.listing_id}>
                <CardBody className="flex h-full flex-col gap-3">
                  <TruckPhoto make={l.make} vehicleClass={l.vehicle_class} plate={l.plate} country={l.seller_country ?? null} sizes="(min-width: 1280px) 380px, (min-width: 640px) 50vw, 100vw" />
                  <div className="flex-1">
                    <p className="font-semibold">{l.make}</p>
                    <p className="text-[13px] text-ink-muted">
                      {ui.catalog.seller}: {l.seller_name}
                      {l.seller_city ? ` · ${l.seller_city}` : ''}
                      {l.odometer_km != null ? ` · ${l.odometer_km.toLocaleString(locale === 'en' ? 'en-GB' : locale)} km` : ''}
                    </p>
                    <p className="text-[13px] text-ink-muted">
                      {cc.country}: {countryName(locale, l.seller_country ?? company.country)}
                    </p>
                    <p className="mt-2 font-mono text-[15px] font-bold">{eur(l.price_cents, l.currency)}</p>
                    <p className="font-mono text-[13px] text-ink-muted">
                      {fill(ui.catalog.terms, { months: String(l.months), down: eur(l.down_payment_cents, l.currency) })}
                    </p>
                  </div>
                  {/* Сделка — только внутри одной страны (23.11.2026): у объявления другой страны вместо кнопки — пояснение. */}
                  {(l.same_country ?? true) || l.my_deal_id ? (
                    <Link
                      href={l.my_deal_id ? `${home}/${l.my_deal_id}` : `${home}/listing/${l.listing_id}`}
                      className={buttonClass({ variant: l.my_deal_id ? 'default' : 'primary', size: 'sm', className: 'self-start' })}
                    >
                      {l.my_deal_id ? ui.catalog.myDeal : ui.catalog.open}
                    </Link>
                  ) : (
                    <p className="text-[13px] text-ink-muted">
                      {fill(cc.otherCountry, { country: countryName(locale, l.seller_country ?? company.country) })}
                    </p>
                  )}
                </CardBody>
              </Card>
            ))}
          </div>
        ))}
    </main>
  );
}

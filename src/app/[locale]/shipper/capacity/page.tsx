import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Badge, Button, Card, CardBody, buttonClass } from '@/components/ui';
import { VerifiedBadge } from '@/components/domain/VerifiedBadge';
import { CabotageNote, spaceText, vehicleText } from '@/components/domain/capacity/CabotageNote';
import { RequestForm, type RequestOrderOption } from '@/components/domain/capacity/RequestForm';
import { requireRole } from '@/lib/auth/guard';
import { cancelCapacityRequestAction } from '@/lib/capacity/actions';
import { publishDraftOrderAction } from '@/lib/orders/actions';
import { isLocale } from '@/lib/i18n';
import { getViewerI18n } from '@/lib/i18n/viewer';
import { createClient } from '@/lib/supabase/server';
import type { Database } from '@/types/database';

type OfferRow = Database['public']['Functions']['capacity_offers_search']['Returns'][number];

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const { t } = await getViewerI18n(locale);
  return { title: t.capacity.shipperTitle };
}

const COUNTRIES = ['FI', 'SE', 'NO', 'DK', 'EE', 'LV', 'LT', 'PL', 'DE'];

/**
 * «Свободное место по пути» у заказчика и экспедитора: опубликованное
 * перевозчиками место — городами, датами, местом и кузовом, с именем
 * перевозчика и значком проверки. Ни номера машины, ни адресов. Запрос —
 * своим заказом и своей ценой; ?order= — подсказки к одному заказу.
 */
export default async function ShipperCapacityPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ country?: string; city?: string; from?: string; to?: string; order?: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const viewer = await requireRole(locale, 'SHIPPER');
  const company = viewer.company!;
  const [{ t, f }, supabase, query] = await Promise.all([getViewerI18n(locale), createClient(), searchParams]);
  const c = t.capacity;

  const isDate = (v?: string) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined);
  const country = COUNTRIES.includes((query.country ?? '').toUpperCase()) ? query.country!.toUpperCase() : undefined;
  const city = (query.city ?? '').trim().slice(0, 60) || undefined;
  const dateFrom = isDate(query.from);
  const dateTo = isDate(query.to);
  const focusOrder = /^[0-9a-f-]{36}$/.test(query.order ?? '') ? query.order : undefined;

  const [searchRes, { data: myOrders }, requestsRes, suggestRes] = await Promise.all([
    supabase.rpc('capacity_offers_search', { p_country: country, p_city: city, p_date_from: dateFrom, p_date_to: dateTo }),
    /* Свои заказы, с которыми можно просить место: черновик или на столе, груз в кузове. */
    supabase
      .from('orders')
      .select('id, ref, shipper_ref, haul_kind, ldm, rate_cents, currency, status')
      .eq('shipper_company_id', company.id)
      .in('status', ['DRAFT', 'OPEN'])
      .in('haul_kind', ['VAN', 'TRUCK', 'SEMI'])
      .order('created_at', { ascending: false })
      .limit(100),
    supabase.rpc('capacity_requests_for_shipper'),
    focusOrder ? supabase.rpc('capacity_suggestions', { p_order_ids: [focusOrder] }) : Promise.resolve({ data: [], error: null }),
  ]);

  const orderIds = (myOrders ?? []).map((o) => o.id);
  const { data: stops } = orderIds.length
    ? await supabase.from('order_stops').select('order_id, role, city, scheduled_date, sequence').in('order_id', orderIds).order('sequence')
    : { data: [] };
  const options: RequestOrderOption[] = (myOrders ?? []).map((o) => {
    const own = (stops ?? []).filter((s) => s.order_id === o.id);
    const pick = own.find((s) => s.role === 'PICKUP');
    const drop = [...own].reverse().find((s) => s.role === 'DELIVERY');
    const route = pick && drop ? ` · ${pick.city} → ${drop.city}` : '';
    const size = o.ldm ? ` · ${String(o.ldm).replace('.', ',')} ldm` : '';
    return {
      id: o.id,
      label: `${o.ref}${o.shipper_ref ? ` (${o.shipper_ref})` : ''}${route}${size}`,
      price: o.rate_cents,
      currency: o.currency,
      date: pick?.scheduled_date ?? null,
    };
  });

  const failed = Boolean(searchRes.error);
  const offers = searchRes.error ? [] : (searchRes.data ?? []);
  const suggestions = suggestRes.error ? [] : (suggestRes.data ?? []);
  const requests = requestsRes.error ? [] : (requestsRes.data ?? []);
  const focus = options.find((o) => o.id === focusOrder);
  const day = (d: string) => f.date(`${d}T12:00:00Z`);
  const dates = (a: string, b: string) => (a === b ? day(a) : `${day(a)} – ${day(b)}`);
  /* «Описать груз»: заказ черновиком под это место — на стол он не уходит, пока не решит заказчик. */
  const newOrderHref = (offerId: string) => `/${locale}/shipper/orders?new=1&space=${offerId}`;
  /* Черновик, по которому запрос не принят и другого не ждёт, — «опубликовать на столе». */
  const drafts = new Set((myOrders ?? []).filter((o) => o.status === 'DRAFT').map((o) => o.id));
  const waiting = new Set(requests.filter((r) => r.status === 'PENDING').map((r) => r.order_id));
  /* Кнопка — у последнего такого запроса заказа (список — свежие выше). */
  const publishAt = new Map<string, string>();
  for (const r of requests) {
    if ((r.status === 'DECLINED' || r.status === 'EXPIRED') && r.order_id && drafts.has(r.order_id) && !waiting.has(r.order_id) && !publishAt.has(r.order_id)) {
      publishAt.set(r.order_id, r.request_id);
    }
  }

  const offerCard = (o: Pick<OfferRow, 'offer_id' | 'from_city' | 'to_city' | 'available_from' | 'available_to' | 'free_ldm' | 'free_kg' | 'free_pallets' | 'body' | 'vehicle_class' | 'carrier_name' | 'verified' | 'cabotage_ops' | 'my_pending'> & { detour_km?: number }) => (
    <Card key={o.offer_id} id={`offer-${o.offer_id}`} className="scroll-mt-24">
      <CardBody className="flex flex-col gap-2.5">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="text-[14px] font-semibold">
            {o.from_city} → {o.to_city}
          </span>
          <span className="text-[13px] text-ink-muted">{dates(o.available_from, o.available_to)}</span>
          {o.my_pending > 0 && <Badge tone="info">{c.requested}</Badge>}
        </div>
        <p className="text-[13px]">
          {c.freeLine.replace('{space}', spaceText(t, locale, { ldm: o.free_ldm === null ? null : Number(o.free_ldm), kg: o.free_kg, pallets: o.free_pallets }))}
          <span className="text-ink-muted"> · {vehicleText(t, o.vehicle_class, o.body)}</span>
          {typeof o.detour_km === 'number' && <span className="text-ink-muted"> · {c.detour.replace('{km}', String(o.detour_km))}</span>}
        </p>
        <p className="flex flex-wrap items-center gap-2 text-[13px]">
          <span className="font-semibold">{o.carrier_name}</span>
          {o.verified && <VerifiedBadge label={t.verification.badge} hint={t.verification.badgeHint} />}
        </p>
        <CabotageNote t={t} show={o.cabotage_ops !== null} ops={o.cabotage_ops} />
        <details>
          <summary className="cursor-pointer text-[13px] font-semibold text-accent">{c.requestSpace}</summary>
          <div className="mt-2">
            <RequestForm offerId={o.offer_id} orders={options} defaultOrderId={focusOrder} newOrderHref={newOrderHref(o.offer_id)} />
          </div>
        </details>
      </CardBody>
    </Card>
  );

  return (
    <main className="cab-page">
      <h1 className="page-title">{c.shipperTitle}</h1>
      <p className="mt-2 mb-6 max-w-xl text-[13px] leading-relaxed text-ink-muted">{c.shipperSubtitle}</p>

      {failed && (
        <Card stripe="warn" className="mb-6">
          <CardBody>
            <p className="text-[13px] text-ink-muted">{c.notReady}</p>
          </CardBody>
        </Card>
      )}

      {focus && (
        <section className="mb-8">
          <h2 className="mb-4 border-b border-line pb-2 text-[13px] font-semibold tracking-tight text-ink-faint">
            {c.forOrder.replace('{order}', focus.label)}
          </h2>
          {suggestions.length === 0 ? (
            <p className="text-[13px] text-ink-muted">{c.noMatches}</p>
          ) : (
            <div className="flex flex-col gap-3">{suggestions.map((s) => offerCard(s))}</div>
          )}
        </section>
      )}

      {requests.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-4 border-b border-line pb-2 text-[13px] font-semibold tracking-tight text-ink-faint">{c.myRequests}</h2>
          <ul className="flex flex-col divide-y divide-line">
            {requests.map((r) => (
              <li key={r.request_id} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 py-2.5 text-[13px]">
                <Badge tone={r.status === 'PENDING' ? 'warn' : r.status === 'ACCEPTED' ? 'ok' : 'neutral'}>
                  {(c.requestStatus as Record<string, string>)[r.status] ?? r.status}
                </Badge>
                <span className="font-mono text-[12px]">{r.order_ref}</span>
                <span>
                  {r.from_city} → {r.to_city} · {dates(r.date_from, r.date_to)}
                </span>
                <span className="font-semibold">{f.money(r.price_cents, r.currency)}</span>
                <span className="text-ink-muted">{r.carrier_name}</span>
                {r.decline_reason && <span className="text-ink-muted">«{r.decline_reason}»</span>}
                {r.status === 'PENDING' && (
                  <form action={cancelCapacityRequestAction}>
                    <input type="hidden" name="locale" value={locale} />
                    <input type="hidden" name="request_id" value={r.request_id} />
                    <Button type="submit" size="sm" variant="ghost">
                      {c.cancelRequest}
                    </Button>
                  </form>
                )}
                {r.order_id && publishAt.get(r.order_id) === r.request_id && (
                  <form action={publishDraftOrderAction}>
                    <input type="hidden" name="locale" value={locale} />
                    <input type="hidden" name="order_id" value={r.order_id} />
                    <Button type="submit" size="sm" variant="primary">
                      {t.inbox.publishDesk}
                    </Button>
                  </form>
                )}
                {r.status === 'ACCEPTED' && r.order_id && (
                  <Link href={`/${locale}/shipper/orders#order-${r.order_id}`} className="text-accent hover:underline">
                    {c.openOrder}
                  </Link>
                )}
                {r.cabotage_ops !== null && (
                  <span className="w-full">
                    <CabotageNote t={t} show ops={r.cabotage_ops} />
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2 className="mb-4 border-b border-line pb-2 text-[13px] font-semibold tracking-tight text-ink-faint">{c.allOffers}</h2>
        <form className="mb-5 flex flex-wrap items-end gap-2" method="get">
          <label className="flex flex-col gap-1 text-[13px]">
            <span className="label-micro">{c.filterCountry}</span>
            <select name="country" defaultValue={country ?? ''} className="h-9 rounded-control border border-line bg-surface px-2 text-[13px]">
              <option value="">{c.anyCountry}</option>
              {COUNTRIES.map((cc) => (
                <option key={cc} value={cc}>
                  {cc}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-[13px]">
            <span className="label-micro">{c.filterCity}</span>
            <input name="city" defaultValue={city ?? ''} className="h-9 w-40 rounded-control border border-line bg-surface px-2 text-[13px]" />
          </label>
          <label className="flex flex-col gap-1 text-[13px]">
            <span className="label-micro">{c.dateFrom}</span>
            <input type="date" name="from" defaultValue={dateFrom ?? ''} className="h-9 rounded-control border border-line bg-surface px-2 text-[13px]" />
          </label>
          <label className="flex flex-col gap-1 text-[13px]">
            <span className="label-micro">{c.dateTo}</span>
            <input type="date" name="to" defaultValue={dateTo ?? ''} className="h-9 rounded-control border border-line bg-surface px-2 text-[13px]" />
          </label>
          {focusOrder && <input type="hidden" name="order" value={focusOrder} />}
          <button type="submit" className={buttonClass({ variant: 'primary', size: 'sm' })}>
            {c.filter}
          </button>
        </form>

        {offers.length === 0 ? (
          <p className="text-[13px] text-ink-muted">{c.noOffers}</p>
        ) : (
          <div className="flex flex-col gap-3">{offers.map((o) => offerCard(o))}</div>
        )}
      </section>
    </main>
  );
}

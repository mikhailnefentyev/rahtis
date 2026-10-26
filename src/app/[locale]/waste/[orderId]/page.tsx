import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { signInPath } from '@/lib/auth/paths';
import { getViewer } from '@/lib/auth/viewer';
import { isLocale } from '@/lib/i18n';
import { getViewerI18n } from '@/lib/i18n/viewer';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { DIWASS_MANDATORY_FROM, ewcLabel, nationalSystem } from '@/lib/waste/shipment';
import { PrintButton } from '../../carrier/sites/[id]/load/[loadId]/PrintButton';
import { WasteForm } from './WasteForm';

export const metadata: Metadata = { title: 'Annex VII' };

/**
 * Отходы в заказе: отметка, процедура и документ Приложения VII
 * (Регламент (ЕС) 2024/1157, ст. 18) для печати вместе с CMR.
 *
 * Открывают обе стороны заказа — заказчик и назначенный перевозчик;
 * доступ решает RLS: чужой заказ просто не находится. Названия и
 * реквизиты сторон читаются ключом сервиса уже после этой проверки —
 * у перевозчика нет права читать карточку заказчика напрямую.
 *
 * Документ — по форме Приложения VII, по-английски с номерами граф:
 * так его читают контролёр и получатель в любой стране.
 */
export default async function WastePage({ params }: { params: Promise<{ locale: string; orderId: string }> }) {
  const { locale, orderId } = await params;
  if (!isLocale(locale) || !/^[0-9a-f-]{36}$/.test(orderId)) notFound();

  const viewer = await getViewer();
  if (viewer.status !== 'ready') redirect(signInPath(locale, `/${locale}/waste/${orderId}`));

  const [{ t, f }, supabase] = await Promise.all([getViewerI18n(locale), createClient()]);
  const w = t.waste;

  const { data: order } = await supabase
    .from('orders')
    .select('id, ref, shipper_company_id, assigned_company_id, assigned_vehicle_id, trailer_plate, status')
    .eq('id', orderId)
    .maybeSingle();
  /*
   * Заказ по RLS видят не только стороны: открытый заказ — перевозчики
   * на бирже. Реквизиты сторон ниже читаются ключом сервиса, поэтому
   * пускаем только заказчика, назначенного перевозчика и оператора.
   */
  const companyId = viewer.company?.id ?? null;
  const isParty =
    viewer.role === 'ADMIN' ||
    (companyId !== null && (order?.shipper_company_id === companyId || order?.assigned_company_id === companyId));
  if (!order || !isParty) {
    return (
      <main className="cab-page cab-page--narrow">
        <p className="text-[13px] text-ink-muted">{w.noAccess}</p>
      </main>
    );
  }

  const [{ data: stops }, { data: waste }] = await Promise.all([
    supabase.from('order_stops').select('role, sequence, country, company_name, address, city, scheduled_date').eq('order_id', orderId).order('sequence'),
    supabase.from('order_waste').select('*').eq('order_id', orderId).maybeSingle(),
  ]);

  const admin = createAdminClient();
  const ids = [order.shipper_company_id, order.assigned_company_id].filter((x): x is string => Boolean(x));
  const [{ data: companies }, { data: vehicle }] = await Promise.all([
    admin.from('companies').select('id, name, legal_name, business_id, legal_street, legal_postal_code, legal_city, legal_country, contact_email, country').in('id', ids),
    order.assigned_vehicle_id ? admin.from('vehicles').select('plate').eq('id', order.assigned_vehicle_id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const shipper = companies?.find((c) => c.id === order.shipper_company_id) ?? null;
  const carrier = companies?.find((c) => c.id === order.assigned_company_id) ?? null;

  const route = stops ?? [];
  const countries = route.map((s) => s.country).filter((c): c is string => Boolean(c));
  const first = route[0];
  const last = route[route.length - 1];
  const day = first?.scheduled_date ?? new Date().toISOString().slice(0, 10);
  const region = new Intl.DisplayNames([locale], { type: 'region' });
  const countryName = (c: string) => region.of(c) ?? c;

  const party = (c: typeof shipper) =>
    c ? (
      <>
        {c.legal_name ?? c.name}
        {c.business_id && <span className="font-mono"> · {c.business_id}</span>}
        {c.legal_street && (
          <span className="block">
            {c.legal_street}, {c.legal_postal_code} {c.legal_city}, {c.legal_country ?? c.country}
          </span>
        )}
        {c.contact_email && <span className="block">{c.contact_email}</span>}
      </>
    ) : (
      '—'
    );

  const box = (n: string, label: string, value: React.ReactNode) => (
    <tr className="border-t border-line align-top">
      <th className="w-[38%] py-2 pr-4 text-left text-[12px] font-medium text-ink-muted">
        <span className="font-mono">{n}.</span> {label}
      </th>
      <td className="py-2 text-[13px]">{value}</td>
    </tr>
  );

  const national = first?.country ? nationalSystem(first.country, day) : null;
  const nationalText = national && first?.country
    ? (national.scope === 'ALL' ? w.nationalAll : national.scope === 'HAZARDOUS' ? w.nationalHazardous : w.nationalNone)
        .replace('{country}', countryName(first.country))
        .replace('{system}', national.name)
    : null;
  const printable = waste && (waste.procedure === 'ANNEX_VII' || waste.procedure === 'NOTIFICATION');

  return (
    <main className="cab-page max-w-3xl print:max-w-none">
      <header className="mb-4 print:hidden">
        <h1 className="page-title">
          {w.title} <span className="font-mono text-[15px] text-ink-muted">{order.ref}</span>
        </h1>
        <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-ink-muted">{w.lede}</p>
        {countries.length > 0 && (
          <p className="mt-2 text-[13px]">
            {w.countries}: <b>{[...new Set(countries)].map(countryName).join(' → ')}</b>
          </p>
        )}
      </header>

      <div className="print:hidden">
        <WasteForm orderId={order.id} waste={waste} countries={countries} />

        {waste && (
          <div className="mt-4 flex flex-col gap-2 text-[13px] leading-relaxed">
            {waste.procedure === 'ANNEX_VII' && (
              <>
                <p>{day < DIWASS_MANDATORY_FROM ? w.paperUntil : w.diwassHint}</p>
                <p className="text-ink-muted">{w.carrierConfirms}</p>
              </>
            )}
            {waste.procedure === 'NOTIFICATION' && <p className="text-warn">{w.notificationNote}</p>}
            {waste.procedure === 'REUSE' && <p>{w.reuseNote}</p>}
            {waste.procedure === 'DOMESTIC' && nationalText && <p>{nationalText}</p>}
          </div>
        )}
      </div>

      {printable && (
        <article className="mt-6 rounded-card border border-line bg-surface p-6 print:mt-0 print:border-0 print:p-0">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-xl font-bold tracking-tight">Annex VII</h2>
              <p className="text-[12px] text-ink-muted">
                Information accompanying shipments of waste as referred to in Article 18 of Regulation (EU) 2024/1157 · {order.ref}
                {waste.diwass_number && <span className="font-mono"> · DIWASS {waste.diwass_number}</span>}
              </p>
            </div>
            <span className="print:hidden">
              <PrintButton />
            </span>
          </div>
          <table className="w-full">
            <tbody>
              {box('1', 'Person who arranges the shipment', party(shipper))}
              {box('2', 'Importer / consignee', (
                <>
                  {waste.consignee_name ?? '—'}
                  {waste.consignee_address && <span className="block">{waste.consignee_address}</span>}
                  {waste.consignee_contact && <span className="block">{waste.consignee_contact}</span>}
                </>
              ))}
              {box('3', 'Actual quantity', waste.quantity_kg ? `${(waste.quantity_kg / 1000).toLocaleString('en', { maximumFractionDigits: 3 })} t (${waste.quantity_kg.toLocaleString('fi-FI')} kg)` : '—')}
              {box('4', 'Actual date of shipment', first?.scheduled_date ? f.date(`${first.scheduled_date}T12:00:00Z`) : '—')}
              {box('5', 'Carrier', (
                <>
                  {party(carrier)}
                  <span className="block">
                    Means of transport: R (road)
                    {vehicle?.plate && <span className="font-mono"> · {vehicle.plate}</span>}
                    {order.trailer_plate && <span className="font-mono"> + {order.trailer_plate}</span>}
                  </span>
                  <span className="block text-ink-muted">Date of transfer: ________ · Signature: ________</span>
                </>
              ))}
              {box('6', 'Waste generator / site of generation', (
                <>
                  {waste.producer_name ?? '—'}
                  <span className="block">{waste.producer_address ?? (first ? `${first.company_name ?? ''} ${first.address}, ${first.city}`.trim() : '')}</span>
                </>
              ))}
              {box('7', 'Recovery facility', (
                <>
                  {waste.facility_name ?? '—'}
                  {(waste.facility_address ?? last) && (
                    <span className="block">{waste.facility_address ?? (last ? `${last.address}, ${last.city}` : '')}</span>
                  )}
                </>
              ))}
              {box('8', 'Recovery operation', waste.recovery_code ?? '—')}
              {box('9', 'Usual description of the waste', waste.description ?? '—')}
              {box('10', 'Waste identification', (
                <>
                  {waste.basel_code && <span className="block font-mono">Basel/OECD/EU: {waste.basel_code}</span>}
                  {waste.ewc_code && <span className="block font-mono">EU list of waste: {ewcLabel(waste.ewc_code)}</span>}
                </>
              ))}
              {box('11', 'Countries concerned (dispatch → destination)', [...new Set(countries)].join(' → ') || '—')}
              {box('12', 'Declaration of the person arranging the shipment', (
                <>
                  I hereby declare that the above information is complete and correct to my best knowledge. I also declare that effective written contractual obligations have been entered into with the consignee
                  {waste.contract_ref ? ` (${waste.contract_ref})` : ''}.
                  <span className="mt-2 block text-ink-muted">Name: ________ · Date: ________ · Signature: ________</span>
                </>
              ))}
              {box('13', 'Signature upon receipt of the waste by the consignee', <span className="text-ink-muted">Name: ________ · Date: ________ · Signature: ________</span>)}
              {box('14', 'Receipt at the recovery facility', <span className="text-ink-muted">Quantity received: ________ · Name: ________ · Date: ________ · Signature: ________</span>)}
            </tbody>
          </table>
          <p className="mt-4 text-[11px] text-ink-dim">RAHTIS · {w.print}</p>
        </article>
      )}
    </main>
  );
}

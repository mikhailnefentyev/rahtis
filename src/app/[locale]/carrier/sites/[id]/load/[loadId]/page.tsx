import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireRole } from '@/lib/auth/guard';
import { getDictionary, isLocale } from '@/lib/i18n';
import { getViewerI18n } from '@/lib/i18n/viewer';
import { material, wasteCodeLabel } from '@/lib/sites/work';
import { createClient } from '@/lib/supabase/server';
import { PrintButton } from './PrintButton';

export const metadata: Metadata = { title: 'Siirtoasiakirja' };

/**
 * Siirtoasiakirja — документ на перевозку отходов по jätelaki 646/2011,
 * 121 §: владелец (заказчик), перевозчик, получатель, время, место начала
 * и конца, код и название отхода по перечню, количество и подтверждения
 * сторон. Документ по-фински с английскими подписями: так его читают
 * пункт приёмки и контролёр.
 *
 * Подтверждения: владелец — подтверждение дня прорабом, перевозчик —
 * отметка водителя о выгрузке, получатель — талон взвешивания.
 */
export default async function TransferDocumentPage({ params }: { params: Promise<{ locale: string; id: string; loadId: string }> }) {
  const { locale, id, loadId } = await params;
  if (!isLocale(locale)) notFound();

  const viewer = await requireRole(locale, 'CARRIER');
  const company = viewer.company!;
  const [{ t, f }, fi, supabase] = await Promise.all([getViewerI18n(locale), getDictionary('fi'), createClient()]);

  const { data: load } = await supabase.from('site_loads').select('*').eq('id', loadId).eq('job_id', id).maybeSingle();
  if (!load) notFound();
  const [{ data: job }, { data: day }] = await Promise.all([
    supabase.from('site_jobs').select('*').eq('id', id).maybeSingle(),
    supabase.from('site_days').select('*').eq('id', load.day_id).maybeSingle(),
  ]);
  if (!job || !day) notFound();

  const [{ data: driver }, { data: vehicle }, { data: trailer }, { data: receiver }] = await Promise.all([
    supabase.from('drivers').select('full_name').eq('id', day.driver_id).maybeSingle(),
    day.vehicle_id ? supabase.from('vehicles').select('plate').eq('id', day.vehicle_id).maybeSingle() : Promise.resolve({ data: null }),
    day.trailer_id ? supabase.from('trailers').select('plate').eq('id', day.trailer_id).maybeSingle() : Promise.resolve({ data: null }),
    load.scale_site_id ? supabase.from('scale_sites').select('name, address, city').eq('id', load.scale_site_id).maybeSingle() : Promise.resolve({ data: null }),
  ]);

  const kind = material(load.material_code);
  const materialFi = fi.siteWork.materials[load.material_code as keyof typeof fi.siteWork.materials] ?? load.material_code;
  const number = `${day.day.replaceAll('-', '')}-${load.id.slice(0, 8).toUpperCase()}`;

  const row = (labelFi: string, labelEn: string, value: React.ReactNode) => (
    <tr className="border-t border-line align-top">
      <th className="w-[38%] py-2 pr-4 text-left text-[12px] font-medium text-ink-muted">
        {labelFi}
        <span className="block text-[11px] font-normal text-ink-dim">{labelEn}</span>
      </th>
      <td className="py-2 text-[13px]">{value}</td>
    </tr>
  );

  return (
    <main className="cab-page max-w-3xl print:max-w-none">
      <div className="mb-4 flex items-center justify-between gap-3 print:hidden">
        <Link href={`/${locale}/carrier/sites/${job.id}`} className="text-[13px] text-ink-muted hover:text-ink">
          ← {job.name}
        </Link>
        <PrintButton />
      </div>

      <article className="rounded-card border border-line bg-surface p-6 print:border-0 print:p-0">
        <header className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
          <h1 className="text-xl font-bold tracking-tight">
            Siirtoasiakirja <span className="text-[13px] font-normal text-ink-muted">· Waste transfer document</span>
          </h1>
          <span className="font-mono text-[13px]">Nro {number}</span>
        </header>
        <p className="mb-4 text-[12px] text-ink-muted">Jätelaki 646/2011, 121 § · RAHTIS</p>

        <table className="w-full">
          <tbody>
            {row('Jätteen haltija (tuottaja)', 'Waste holder', (
              <>
                {job.customer_name}
                {job.customer_business_id && <span className="font-mono"> · {job.customer_business_id}</span>}
                {job.customer_email && <span className="block text-ink-muted">{job.customer_email}</span>}
              </>
            ))}
            {row('Kuljettaja', 'Carrier', (
              <>
                {company.name}
                {company.business_id && <span className="font-mono"> · {company.business_id}</span>}
                <span className="block text-ink-muted">
                  {driver?.full_name ?? '—'}
                  {vehicle?.plate && <span className="font-mono"> · {vehicle.plate}</span>}
                  {trailer?.plate && <span className="font-mono"> + {trailer.plate}</span>}
                </span>
              </>
            ))}
            {row('Vastaanottaja', 'Receiver', receiver ? `${receiver.name}${receiver.city ? `, ${receiver.city}` : ''}` : '—')}
            {row('Siirron ajankohta', 'Date and time of transfer', (
              <>
                {f.date(`${day.day}T12:00:00Z`)} · {f.time(day.arrived_at)} – {f.time(load.unloaded_at)}
              </>
            ))}
            {row('Siirron alkamispaikka', 'Place of departure', `${job.name}${job.address ? `, ${job.address}` : ''}`)}
            {row('Siirron päättymispaikka', 'Place of destination', receiver ? `${receiver.name}${receiver.address ? `, ${receiver.address}` : ''}${receiver.city ? `, ${receiver.city}` : ''}` : '—')}
            {row('Jätteen nimike (jäteluettelo)', 'Waste code and name', (
              <>
                <span className="font-mono">{wasteCodeLabel(load.material_code)}</span> {materialFi}
              </>
            ))}
            {row('Määrä', 'Quantity', (
              <>
                {load.net_kg != null ? <span className="font-mono font-semibold">{load.net_kg.toLocaleString('fi-FI')} kg</span> : '—'}
                {load.gross_kg != null && load.tare_kg != null && (
                  <span className="block text-ink-muted">
                    brutto {load.gross_kg.toLocaleString('fi-FI')} kg · tara {load.tare_kg.toLocaleString('fi-FI')} kg
                  </span>
                )}
              </>
            ))}
            {row('Haltijan vahvistus', 'Holder confirmation', day.approved_at ? `${day.approved_by} · ${f.dateTime(day.approved_at)}` : 'Odottaa työnjohtajan vahvistusta')}
            {row('Kuljettajan vahvistus', 'Carrier confirmation', `${driver?.full_name ?? '—'} · ${f.dateTime(load.unloaded_at)}`)}
            {row('Vastaanottajan vahvistus', 'Receiver confirmation', load.ticket_no ? `Punnituslippu ${load.ticket_no}` : '—')}
          </tbody>
        </table>

        <p className="mt-4 text-[12px] text-ink-muted">
          {kind?.registry ? t.sites.registryNote : t.sites.registryNo}
        </p>
      </article>
    </main>
  );
}

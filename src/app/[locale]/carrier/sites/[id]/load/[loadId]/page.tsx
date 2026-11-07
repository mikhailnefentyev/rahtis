import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireRole } from '@/lib/auth/guard';
import { getDictionary, isLocale } from '@/lib/i18n';
import { getViewerI18n } from '@/lib/i18n/viewer';
import { isSiteCountry, LABELS_EN, wasteDocFor } from '@/lib/sites/wasteDocs';
import { parseRegistrations, registrationLine } from '@/lib/waste/registrations';
import { finnishTransferRequired, isContaminated, material, wasteCodeLabel } from '@/lib/sites/work';
import { createClient } from '@/lib/supabase/server';
import { PrintButton } from './PrintButton';
import { SiirtoPanel } from './SiirtoPanel';
import { siirtoConfig } from '@/lib/siirto/client';
import { loadSiirto } from '@/lib/siirto/load';

export const metadata: Metadata = { title: 'Siirtoasiakirja' };

/**
 * Документ на перевозку груза с объекта — по стране объекта (wasteDocs.ts).
 *
 * В Финляндии это siirtoasiakirja (jätelaki 646/2011, 121 §), в Дании —
 * følgeseddel, в Германии для обычного грунта — весовая накладная. Где
 * закон требует госсистему (BDO, GPAIS, APUS, PISTRIK, eANV для опасных),
 * страница прямо говорит, что эта распечатка документ не заменяет, и
 * даёт данные рейса для ввода.
 *
 * Подписи — на языке страны объекта с английской строкой под каждой:
 * так документ читают пункт приёмки и контролёр.
 *
 * Подтверждения: владелец — подтверждение дня прорабом, перевозчик —
 * отметка водителя о выгрузке, получатель — талон взвешивания.
 */
export default async function TransferDocumentPage({ params }: { params: Promise<{ locale: string; id: string; loadId: string }> }) {
  const { locale, id, loadId } = await params;
  if (!isLocale(locale)) notFound();

  const viewer = await requireRole(locale, 'CARRIER');
  const company = viewer.company!;
  const [{ t, f }, supabase] = await Promise.all([getViewerI18n(locale), createClient()]);

  const { data: load } = await supabase.from('site_loads').select('*').eq('id', loadId).eq('job_id', id).maybeSingle();
  if (!load) notFound();
  const [{ data: job }, { data: day }] = await Promise.all([
    supabase.from('site_jobs').select('*').eq('id', id).maybeSingle(),
    supabase.from('site_days').select('*').eq('id', load.day_id).maybeSingle(),
  ]);
  if (!job || !day) notFound();

  const country = isSiteCountry(job.country) ? job.country : 'FI';
  /* Название груза — на языке страны объекта, где есть словарь; иначе по-английски. */
  const docLocale = isLocale(country.toLowerCase()) ? country.toLowerCase() : 'en';
  const [docDict, enDict] = await Promise.all([getDictionary(docLocale as Parameters<typeof getDictionary>[0]), getDictionary('en')]);

  const [{ data: driver }, { data: vehicle }, { data: trailer }, { data: receiver }] = await Promise.all([
    supabase.from('drivers').select('full_name').eq('id', day.driver_id).maybeSingle(),
    day.vehicle_id ? supabase.from('vehicles').select('plate').eq('id', day.vehicle_id).maybeSingle() : Promise.resolve({ data: null }),
    day.trailer_id ? supabase.from('trailers').select('plate').eq('id', day.trailer_id).maybeSingle() : Promise.resolve({ data: null }),
    load.scale_site_id ? supabase.from('scale_sites').select('name, address, city').eq('id', load.scale_site_id).maybeSingle() : Promise.resolve({ data: null }),
  ]);

  const kind = material(load.material_code);
  const contaminated = isContaminated(load.material_code, job.contaminated);
  const fiRequired = finnishTransferRequired(load.material_code, job.contaminated);
  const doc = wasteDocFor(country, kind?.hazardous ?? false, day.day, fiRequired);
  /* Реестр SIIRTO — только финский объект и только когда документ обязателен. */
  const siirto = country === 'FI' && fiRequired ? await loadSiirto(load.id, company) : null;
  const siirtoCfg = siirtoConfig();
  const L = doc.labels;
  const E = LABELS_EN;
  const code = load.material_code as keyof typeof docDict.siteWork.materials;
  const materialName = docDict.siteWork.materials[code] ?? load.material_code;
  const materialEn = enDict.siteWork.materials[code] ?? load.material_code;
  const number = `${day.day.replaceAll('-', '')}-${load.id.slice(0, 8).toUpperCase()}`;
  const kg = (value: number) => value.toLocaleString('fi-FI');

  const row = (labelLocal: string, labelEn: string, value: React.ReactNode) => (
    <tr className="border-t border-line align-top">
      <th className="w-[38%] py-2 pr-4 text-left text-[12px] font-medium text-ink-muted">
        {labelLocal}
        {labelLocal !== labelEn && <span className="block text-[11px] font-normal text-ink-dim">{labelEn}</span>}
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
            {doc.title} <span className="text-[13px] font-normal text-ink-muted">· {doc.titleEn}</span>
          </h1>
          <span className="font-mono text-[13px]">Nro {number}</span>
        </header>
        <p className="mb-4 text-[12px] text-ink-muted">
          {doc.law} · {country} · RAHTIS
        </p>

        {doc.state && (
          <div className="mb-4 rounded-control border border-warn/40 bg-warn/10 px-3 py-2.5 text-[13px] leading-relaxed">
            <p className="font-semibold text-warn">{doc.state.local}</p>
            <p className="mt-1 text-ink-muted">{doc.state.en}</p>
            <a href={doc.state.url} target="_blank" rel="noreferrer" className="mt-1.5 inline-block font-semibold text-accent hover:underline print:hidden">
              {doc.state.name} →
            </a>
          </div>
        )}

        <table className="w-full">
          <tbody>
            {row(L.holder, E.holder, (
              <>
                {job.customer_name}
                {job.customer_business_id && <span className="font-mono"> · {job.customer_business_id}</span>}
                {job.customer_email && <span className="block text-ink-muted">{job.customer_email}</span>}
              </>
            ))}
            {row(L.carrier, E.carrier, (
              <>
                {company.legal_name ?? company.name}
                {company.business_id && <span className="font-mono"> · {company.business_id}</span>}
                {company.legal_street && (
                  <span className="block text-ink-muted">
                    {company.legal_street}, {company.legal_postal_code} {company.legal_city}
                  </span>
                )}
                {registrationLine(parseRegistrations(company.waste_registrations), country) && (
                  <span className="block font-mono text-[12px]">{registrationLine(parseRegistrations(company.waste_registrations), country)}</span>
                )}
                <span className="block text-ink-muted">
                  {driver?.full_name ?? '—'}
                  {vehicle?.plate && <span className="font-mono"> · {vehicle.plate}</span>}
                  {trailer?.plate && <span className="font-mono"> + {trailer.plate}</span>}
                </span>
              </>
            ))}
            {row(L.receiver, E.receiver, receiver ? `${receiver.name}${receiver.city ? `, ${receiver.city}` : ''}` : '—')}
            {row(L.time, E.time, (
              <>
                {f.date(`${day.day}T12:00:00Z`)} · {f.time(day.arrived_at)} – {f.time(load.unloaded_at)}
              </>
            ))}
            {row(L.from, E.from, `${job.name}${job.address ? `, ${job.address}` : ''}`)}
            {row(L.to, E.to, receiver ? `${receiver.name}${receiver.address ? `, ${receiver.address}` : ''}${receiver.city ? `, ${receiver.city}` : ''}` : '—')}
            {row(L.waste, E.waste, (
              <>
                <span className="font-mono">{wasteCodeLabel(load.material_code)}</span> {materialName}
                {materialName !== materialEn && <span className="block text-ink-muted">{materialEn}</span>}
              </>
            ))}
            {kind?.soil && row(L.soil, E.soil, contaminated ? L.contaminated : L.clean)}
            {row(L.quantity, E.quantity, (
              <>
                {load.net_kg != null ? <span className="font-mono font-semibold">{kg(load.net_kg)} kg</span> : '—'}
                {load.gross_kg != null && load.tare_kg != null && (
                  <span className="block text-ink-muted">
                    brutto {kg(load.gross_kg)} kg · tara {kg(load.tare_kg)} kg
                  </span>
                )}
              </>
            ))}
            {row(L.holderOk, E.holderOk, day.approved_at ? `${day.approved_by} · ${f.dateTime(day.approved_at)}` : `${L.pending}`)}
            {row(L.carrierOk, E.carrierOk, `${driver?.full_name ?? '—'} · ${f.dateTime(load.unloaded_at)}`)}
            {row(L.receiverOk, E.receiverOk, load.ticket_no ? `${L.ticket} ${load.ticket_no}` : '—')}
          </tbody>
        </table>

        {doc.note && (
          <div className="mt-4 text-[12px] leading-relaxed">
            <p>{doc.note.local}</p>
            <p className="text-ink-muted">{doc.note.en}</p>
          </div>
        )}
        {country === 'FI' && (
          <p className="mt-4 text-[12px] text-ink-muted">{fiRequired ? t.sites.registryNote : t.sites.registryNo}</p>
        )}
      </article>

      {siirto && (
        <SiirtoPanel
          loadId={load.id}
          enabled={siirtoCfg !== null}
          test={siirtoCfg?.test ?? true}
          documentId={siirto.documentId}
          sentAt={siirto.sentAt}
          lastError={siirto.error}
          missing={siirto.result.ok ? null : siirto.result.missing}
          receiver={siirto.receiver}
        />
      )}
    </main>
  );
}

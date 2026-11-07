import 'server-only';

import { getDictionary } from '@/lib/i18n';
import { finnishTransferRequired, isContaminated, material } from '@/lib/sites/work';
import { createClient } from '@/lib/supabase/server';
import type { Company } from '@/types/db';
import { buildShippingDocument, type SiirtoInput, type SiirtoResult } from './document';

/*
 * Рейс объекта → данные для документа SIIRTO. Читает под правами
 * вошедшего перевозчика (RLS): чужой рейс просто не найдётся.
 */

export type LoadSiirto = {
  loadId: string;
  /** Данные пункта приёмки для формы «дописать получателя». */
  receiver: {
    siteId: string;
    operatorName: string | null;
    operatorBusinessId: string | null;
    postalCode: string | null;
    contactName: string | null;
    contactPhone: string | null;
    treatmentCode: string | null;
  } | null;
  documentId: string | null;
  sentAt: string | null;
  error: string | null;
  result: SiirtoResult;
};

export async function loadSiirto(loadId: string, company: Company): Promise<LoadSiirto | null> {
  const supabase = await createClient();
  const { data: load } = await supabase.from('site_loads').select('*').eq('id', loadId).maybeSingle();
  if (!load) return null;
  const [{ data: job }, { data: day }] = await Promise.all([
    supabase.from('site_jobs').select('*').eq('id', load.job_id).maybeSingle(),
    supabase.from('site_days').select('*').eq('id', load.day_id).maybeSingle(),
  ]);
  if (!job || !day) return null;

  const [{ data: driver }, { data: vehicle }, { data: trailer }, { data: site }, { data: details }, fi] = await Promise.all([
    supabase.from('drivers').select('full_name, phone, email').eq('id', day.driver_id).maybeSingle(),
    day.vehicle_id ? supabase.from('vehicles').select('plate').eq('id', day.vehicle_id).maybeSingle() : Promise.resolve({ data: null }),
    day.trailer_id ? supabase.from('trailers').select('plate').eq('id', day.trailer_id).maybeSingle() : Promise.resolve({ data: null }),
    load.scale_site_id ? supabase.from('scale_sites').select('name, address, city').eq('id', load.scale_site_id).maybeSingle() : Promise.resolve({ data: null }),
    /* Данные получателя — отдельной таблицей: контакт видят только те, кто с пунктом работает (RLS). */
    load.scale_site_id
      ? supabase.from('scale_site_receivers').select('*').eq('site_id', load.scale_site_id).maybeSingle()
      : Promise.resolve({ data: null }),
    getDictionary('fi'),
  ]);

  const kind = material(load.material_code);
  const input: SiirtoInput = {
    required: finnishTransferRequired(load.material_code, job.contaminated),
    country: job.country ?? 'FI',
    materialCode: load.material_code,
    hazardous: kind?.hazardous ?? false,
    materialName: fi.siteWork.materials[load.material_code as keyof typeof fi.siteWork.materials] ?? load.material_code,
    contaminated: isContaminated(load.material_code, job.contaminated),
    netKg: load.net_kg,
    day: day.day,
    unloadedAt: load.unloaded_at,
    plates: [vehicle?.plate ?? '', trailer?.plate ?? ''],
    job: {
      name: job.name,
      address: job.address,
      customerName: job.customer_name,
      customerBusinessId: job.customer_business_id,
      customerStreet: job.customer_street,
      customerPostalCode: job.customer_postal_code,
      customerCity: job.customer_city,
      customerCountry: job.customer_country,
      contactName: job.customer_contact_name,
      contactPhone: job.customer_contact_phone,
      contactEmail: job.customer_email,
      treatmentCode: job.treatment_code,
      hazardCodes: job.hazard_codes ?? [],
      hazardComposition: job.hazard_composition,
    },
    carrier: {
      name: company.legal_name ?? company.name,
      businessId: company.business_id,
      street: company.legal_street,
      postalCode: company.legal_postal_code,
      city: company.legal_city,
    },
    driver: { name: driver?.full_name ?? '', phone: driver?.phone ?? null, email: driver?.email ?? null },
    receiver: site
      ? {
          name: site.name,
          address: site.address,
          city: site.city,
          postalCode: details?.postal_code ?? null,
          operatorName: details?.operator_name ?? null,
          operatorBusinessId: details?.operator_business_id ?? null,
          contactName: details?.contact_name ?? null,
          contactPhone: details?.contact_phone ?? null,
          treatmentCode: details?.treatment_code ?? null,
        }
      : null,
  };

  return {
    loadId: load.id,
    receiver: load.scale_site_id
      ? {
          siteId: load.scale_site_id,
          operatorName: details?.operator_name ?? null,
          operatorBusinessId: details?.operator_business_id ?? null,
          postalCode: details?.postal_code ?? null,
          contactName: details?.contact_name ?? null,
          contactPhone: details?.contact_phone ?? null,
          treatmentCode: details?.treatment_code ?? null,
        }
      : null,
    documentId: load.siirto_document_id,
    sentAt: load.siirto_sent_at,
    error: load.siirto_error,
    result: buildShippingDocument(input),
  };
}

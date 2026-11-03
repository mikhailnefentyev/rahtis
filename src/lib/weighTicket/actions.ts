'use server';

import { revalidatePath } from 'next/cache';
import { requireRole } from '@/lib/auth/guard';
import { getDictionary, isLocale, type Locale, defaultLocale } from '@/lib/i18n';
import { createClient } from '@/lib/supabase/server';
import type { Json } from '@/types/database';
import type { ReadResult } from './reading';
import { storeWeighTicket } from './store';

function toLocale(value: FormDataEntryValue | null): Locale {
  const raw = String(value ?? '');
  return isLocale(raw) ? raw : defaultLocale;
}

const str = (form: FormData, key: string) => String(form.get(key) ?? '').trim();
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Фото весового талона → поля рейса.
 *
 * Зовут и водитель (экран «Объект»), и диспетчер (страница объекта): кто
 * может работать с объектом, решает база по сессии. Ничего не сохраняет в
 * рейс — только фото и прочитанное; рейс человек сохраняет сам после
 * проверки.
 */
export async function readWeighTicketAction(formData: FormData): Promise<ReadResult> {
  const file = formData.get('file');
  const ticketId = str(formData, 'ticket_id');
  const jobId = str(formData, 'job_id');
  if (!(file instanceof File) || !UUID.test(ticketId) || !UUID.test(jobId)) return { ok: false, error: 'invalid' };

  let expectedPlates: string[] = [];
  try {
    const parsed: unknown = JSON.parse(str(formData, 'expected_plates') || '[]');
    if (Array.isArray(parsed)) expectedPlates = parsed.filter((p): p is string => typeof p === 'string').map((p) => p.slice(0, 20)).slice(0, 5);
  } catch {
    expectedPlates = [];
  }

  const supabase = await createClient();
  const result = await storeWeighTicket(supabase, { id: ticketId, jobId, file, read: true, expectedPlates });
  if (!result.ok) return { ok: false, error: result.error === 'retry' ? 'failed' : result.error };
  return {
    ok: true,
    ticketId: result.ticketId,
    status: result.status === 'NOT_READ' ? 'FAILED' : result.status,
    reading: result.reading,
    duplicates: result.duplicates,
  };
}

export type CarrierLoadState = { error: string | null; done: boolean };

const kg = (form: FormData, key: string): number | null | 'bad' => {
  const raw = str(form, key).replace(/[\s ]/g, '');
  if (!raw) return null;
  const value = Number.parseInt(raw, 10);
  return /^\d+$/.test(raw) && Number.isFinite(value) ? value : 'bad';
};

/**
 * Диспетчер сохраняет рейс по талону: правит рейс или добавляет новый в
 * день водителя (свой объект), на объекте под заказ платформы только
 * прикрепляет фото. Границы весов — как у базы (site_loads).
 */
export async function saveCarrierLoadAction(_previous: CarrierLoadState, formData: FormData): Promise<CarrierLoadState> {
  const locale = toLocale(formData.get('locale'));
  const t = await getDictionary(locale);
  await requireRole(locale, 'CARRIER');

  const dayId = str(formData, 'day_id');
  const loadId = str(formData, 'load_id');
  const ticketId = str(formData, 'weigh_ticket_id');
  const jobId = str(formData, 'job_id');
  const gross = kg(formData, 'gross_kg');
  const tare = kg(formData, 'tare_kg');
  const unloadedAt = str(formData, 'unloaded_at');

  if (!UUID.test(dayId) || (loadId && !UUID.test(loadId)) || (ticketId && !UUID.test(ticketId))) {
    return { error: t.error.generic, done: false };
  }
  if (
    gross === 'bad' ||
    tare === 'bad' ||
    (gross !== null && (gross < 100 || gross > 120_000)) ||
    (tare !== null && (tare < 100 || tare > 60_000)) ||
    (gross !== null && tare !== null && gross <= tare)
  ) {
    return { error: t.weighTicket.badWeights, done: false };
  }

  const data: Record<string, Json> = {
    material_code: str(formData, 'material_code') || null,
    scale_site_id: UUID.test(str(formData, 'scale_site_id')) ? str(formData, 'scale_site_id') : null,
    gross_kg: gross,
    tare_kg: tare,
    ticket_no: str(formData, 'ticket_no').slice(0, 60) || null,
    unloaded_at: unloadedAt && Number.isFinite(Date.parse(unloadedAt)) ? new Date(unloadedAt).toISOString() : null,
  };

  const supabase = await createClient();
  const { error } = await supabase.rpc('carrier_site_load_save', {
    p_day_id: dayId,
    p_load_id: loadId || undefined,
    p_data: data as Json,
    p_weigh_ticket_id: ticketId || undefined,
  });
  if (error) {
    console.error('рейс по талону:', error.message);
    return { error: error.code === '55000' ? t.weighTicket.dayLocked : t.error.generic, done: false };
  }

  if (UUID.test(jobId)) revalidatePath(`/${locale}/carrier/sites/${jobId}`);
  return { error: null, done: true };
}

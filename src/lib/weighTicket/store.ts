import 'server-only';

import { createHash } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/admin';
import type { Database, Json } from '@/types/database';
import { extractWeighTicket } from './extract';
import type { Duplicates, TicketReading } from './reading';

export const TICKET_BUCKET = 'weigh-tickets';
export const TICKET_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_BYTES = 10 * 1024 * 1024;

export type StoreResult =
  | { ok: true; ticketId: string; status: 'READ' | 'NOT_CONFIGURED' | 'FAILED' | 'NOT_READ'; reading: TicketReading | null; duplicates: Duplicates }
  /* invalid — файл не тот; denied — объект не свой; retry — не дошло (хранилище, сеть). */
  | { ok: false; error: 'invalid' | 'denied' | 'retry' };

/* Отказы базы по существу: повтор ничего не изменит. */
const FINAL = new Set(['42501', 'P0002', '22023', '23514', '22P02', '55000']);

/**
 * Фото весового талона: в бакет, на чтение, в базу.
 *
 * Порядок как у чека заправки. Сначала сессия вызывающего (водитель или
 * диспетчер) называет компанию объекта — иначе служебный ключ положил бы
 * файл за кого угодно. Потом файл кладётся в папку компании, читается и
 * регистрируется функцией базы под той же сессией. База отказала по
 * существу — файл убирается.
 *
 * id — идентификатор действия: повтор из очереди телефона кладёт тот же
 * файл по тому же пути, а база возвращает прежнюю строку.
 */
export async function storeWeighTicket(
  supabase: SupabaseClient<Database>,
  input: {
    id: string;
    jobId: string;
    file: File;
    /** Читать ли фото (false — пришло из очереди вместе с рейсом). */
    read: boolean;
    expectedPlates: string[];
    loadEventId?: string;
  },
): Promise<StoreResult> {
  const { file } = input;
  if (
    file.size === 0 ||
    file.size > MAX_BYTES ||
    !TICKET_TYPES.includes(file.type) ||
    ![input.id, input.jobId].every((id) => /^[0-9a-f-]{36}$/i.test(id))
  ) {
    return { ok: false, error: 'invalid' };
  }

  const { data: context, error: contextError } = await supabase.rpc('weigh_ticket_context', { p_job_id: input.jobId });
  if (contextError) return { ok: false, error: contextError.code && FINAL.has(contextError.code) ? 'denied' : 'retry' };
  const ctx = context as { company_id?: string; country?: string | null; plates?: string[] } | null;
  if (!ctx?.company_id) return { ok: false, error: 'denied' };

  const bytes = await file.arrayBuffer();
  const sha256 = createHash('sha256').update(Buffer.from(bytes)).digest('hex');
  const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
  const path = `${ctx.company_id}/${input.jobId}/${input.id}.${ext}`;

  /* Без перезаписи: файл уже есть — это повтор, первая попытка не дождалась базы. */
  const admin = createAdminClient();
  let created = false;
  const { error: uploadError } = await admin.storage.from(TICKET_BUCKET).upload(path, file, { contentType: file.type, upsert: false });
  if (uploadError) {
    const exists = /exists|duplicate/i.test(uploadError.message) || (uploadError as { statusCode?: string }).statusCode === '409';
    if (!exists) return { ok: false, error: 'retry' };
  } else {
    created = true;
  }

  let status: 'READ' | 'NOT_CONFIGURED' | 'FAILED' | 'NOT_READ' = 'NOT_READ';
  let reading: TicketReading | null = null;
  if (input.read) {
    const result = await extractWeighTicket({
      mime: file.type,
      bytes,
      plates: (ctx.plates ?? []).filter((p): p is string => typeof p === 'string'),
      expectedPlates: input.expectedPlates,
      country: ctx.country ?? 'FI',
    });
    if (result.ok) {
      status = 'READ';
      reading = result.reading;
    } else {
      status = result.reason === 'not_configured' ? 'NOT_CONFIGURED' : 'FAILED';
    }
  }

  const { data, error } = await supabase.rpc('weigh_ticket_add', {
    p_id: input.id,
    p_job_id: input.jobId,
    p_storage_path: path,
    p_mime_type: file.type,
    p_size_bytes: file.size,
    p_sha256: sha256,
    p_status: status,
    p_reading: (reading
      ? {
          ticket_number: reading.ticketNumber,
          weighed_at: reading.weighedAt,
          plates: reading.plates,
          gross_kg: reading.grossKg,
          tare_kg: reading.tareKg,
          net_kg: reading.netKg,
          unit: reading.unit,
          material: reading.material,
          material_code: reading.materialCode,
          scale_name: reading.scaleName,
          customer: reading.customer,
          confidence: reading.confidence,
          notes: reading.notes,
        }
      : null) as Json,
    p_load_event_id: input.loadEventId,
  });

  if (error || !data) {
    const final = Boolean(error?.code && FINAL.has(error.code));
    if (final && created) await admin.storage.from(TICKET_BUCKET).remove([path]);
    return { ok: false, error: final ? 'denied' : 'retry' };
  }

  const row = data as { id: string; duplicates?: Partial<Duplicates> };
  return {
    ok: true,
    ticketId: row.id,
    status,
    reading,
    duplicates: { photo: row.duplicates?.photo ?? [], ticket: row.duplicates?.ticket ?? [] },
  };
}

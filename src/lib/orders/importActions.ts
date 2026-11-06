'use server';

import { getViewer } from '@/lib/auth/viewer';
import { getDictionary, isLocale, defaultLocale, type Locale } from '@/lib/i18n';
import { createClient } from '@/lib/supabase/server';
import type { OrderDraft } from './importDraft';
import { importHints, locateDraft, readOrderDraft } from './importServer';

/**
 * «Luo tekstistä tai PDF:stä»: письмо, PDF или снимок заказа → черновик формы.
 *
 * Заказ не создаётся: действие возвращает значения, и форма открывается
 * заполненной. Текст и файл живут только в этом запросе — в базу и
 * хранилище ничего не пишется.
 *
 * Доступ: заказчик — для своей формы заказа; перевозчик — для своего
 * рейса, по той же подписке, что и сами свои рейсы (own_orders_access).
 * Проверка стоит до вызова модели: вызов стоит денег.
 */

/* Vercel не принимает тело запроса больше 4,5 МБ; снимки браузер ужимает до отправки. */
const MAX_FILE_BYTES = 4 * 1024 * 1024;
const FILE_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
const MAX_TEXT = 30_000;

export type ImportState = { ok: true; draft: OrderDraft } | { ok: false; error: string };

function toLocale(value: FormDataEntryValue | null): Locale {
  const raw = String(value ?? '');
  return isLocale(raw) ? raw : defaultLocale;
}

export async function importOrderAction(formData: FormData): Promise<ImportState> {
  const locale = toLocale(formData.get('locale'));
  const t = await getDictionary(locale);

  const viewer = await getViewer();
  if (viewer.status !== 'ready' || !viewer.company || (viewer.role !== 'SHIPPER' && viewer.role !== 'CARRIER')) {
    return { ok: false, error: t.error.forbidden };
  }
  const supabase = await createClient();
  const carrier = viewer.role === 'CARRIER';
  if (carrier) {
    const { data: access } = await supabase.rpc('own_orders_access');
    if (access !== true) return { ok: false, error: t.own.subscriptionOnly };
  }

  const text = String(formData.get('text') ?? '').trim().slice(0, MAX_TEXT);
  const upload = formData.get('file');
  const file = upload instanceof File && upload.size > 0 ? upload : null;
  if (!text && !file) return { ok: false, error: t.orderImport.nothing };
  if (file) {
    if (!FILE_TYPES.includes(file.type)) return { ok: false, error: t.orderImport.wrongFile };
    if (file.size > MAX_FILE_BYTES) return { ok: false, error: t.orderImport.tooLarge };
  }

  /* Подсказки: клиенты перевозчика и точки последних заказов компании. */
  const clients = carrier ? ((await supabase.rpc('carrier_clients')).data ?? []) : null;
  const places = await importHints(supabase, { shipperIds: carrier ? (clients ?? []).map((c) => c.id) : [viewer.company.id] });

  const result = await readOrderDraft({
    text,
    file: file ? { name: file.name, mime: file.type, bytes: await file.arrayBuffer() } : null,
    carrier,
    country: viewer.company.country ?? 'FI',
    clients: clients ? clients.map((c) => ({ id: c.id, name: c.name, business_id: c.business_id })) : null,
    places,
  });
  if (!result.ok) {
    return {
      ok: false,
      error: result.reason === 'not_configured' ? t.orderImport.notConfigured : result.reason === 'empty' ? t.orderImport.empty : t.orderImport.failed,
    };
  }

  const located = await locateDraft(result.draft, locale);
  return { ok: true, draft: located };
}

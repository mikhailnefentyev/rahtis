'use server';

import { revalidatePath } from 'next/cache';
import { after } from 'next/server';
import { requireRole } from '@/lib/auth/guard';
import { flashError } from '@/lib/forms/flash';
import { defaultLocale, getDictionary, isLocale, type Locale } from '@/lib/i18n';
import { createClient } from '@/lib/supabase/server';
import { correctFree, worthOffering } from './compute';
import { explainCapacityError as explain } from './explain';
import { loadCarrierCapacity, offerInsert, syncCapacity } from './load';

/*
 * Догрузы: публикация, отзыв, режим — перевозчик; запрос и отмена —
 * заказчик; ответ на запрос — перевозчик. Права решают RLS и функции
 * базы; здесь — разбор формы и человеческий текст отказа.
 */

function toLocale(value: FormDataEntryValue | null): Locale {
  const raw = String(value ?? '');
  return isLocale(raw) ? raw : defaultLocale;
}

const text = (form: FormData, key: string): string => String(form.get(key) ?? '').trim();

/** Число из поля: «6,5» и «6.5»; пусто — не задано. */
function decimal(form: FormData, key: string): number | undefined {
  const raw = text(form, key).replace(',', '.').replace(/\s+/g, '');
  if (!raw) return undefined;
  const value = Number(raw);
  return Number.isFinite(value) ? value : undefined;
}

const date = (form: FormData, key: string): string | undefined => {
  const value = text(form, key);
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : undefined;
};

function revalidateCarrier(locale: Locale) {
  revalidatePath(`/${locale}/carrier`, 'layout');
}

/** Опубликовать место отрезка (с поправкой цифр) или поправить опубликованное. */
export async function publishCapacityAction(formData: FormData): Promise<void> {
  const locale = toLocale(formData.get('locale'));
  const t = await getDictionary(locale);
  await requireRole(locale, 'CARRIER');

  const vehicleId = text(formData, 'vehicle_id');
  const orderId = text(formData, 'order_id');
  const { proposals } = await loadCarrierCapacity();
  const p = proposals.find((x) => x.vehicleId === vehicleId && x.orderIds.includes(orderId));
  if (!p || (!p.offerable && !p.offer)) {
    await flashError(t.capacity.gone);
    revalidateCarrier(locale);
    return;
  }
  if (p.mode === 'NEVER') {
    await flashError(t.capacity.modeNever);
    return;
  }

  const free = correctFree(p.free, p.capacity, {
    ldm: decimal(formData, 'free_ldm'),
    kg: (() => {
      const tonnes = decimal(formData, 'free_t');
      return tonnes === undefined ? undefined : Math.round(tonnes * 1000);
    })(),
    pallets: decimal(formData, 'free_pallets'),
  });
  if (!worthOffering(free)) {
    await flashError(t.capacity.tooSmall);
    return;
  }

  const supabase = await createClient();
  const { error } = p.offer
    ? await supabase
        .from('capacity_offers')
        .update({
          free_ldm: free.ldm,
          free_kg: free.kg,
          free_pallets: free.pallets,
          computed_ldm: p.free.ldm,
          computed_kg: p.free.kg,
          status: 'PUBLISHED',
          auto: false,
        })
        .eq('id', p.offer.id)
    : await supabase.from('capacity_offers').insert(offerInsert(p, free, false));
  if (error) await flashError(explain(t, error));
  revalidateCarrier(locale);
}

/** Снять место: другие его больше не видят, ждущие запросы истекают (триггер). */
export async function withdrawCapacityAction(formData: FormData): Promise<void> {
  const locale = toLocale(formData.get('locale'));
  const t = await getDictionary(locale);
  await requireRole(locale, 'CARRIER');
  const supabase = await createClient();
  const { error } = await supabase
    .from('capacity_offers')
    .update({ status: 'WITHDRAWN' })
    .eq('id', text(formData, 'offer_id'))
    .in('status', ['DRAFT', 'PUBLISHED']);
  if (error) await flashError(explain(t, error));
  revalidateCarrier(locale);
}

const MODES = new Set(['ASK', 'AUTO', 'NEVER']);

/**
 * Режим публикации компании или машины. У машины пустое значение —
 * «как у компании» (строка удаляется). Журнал и отзыв — триггер базы.
 */
export async function setCapacityModeAction(formData: FormData): Promise<void> {
  const locale = toLocale(formData.get('locale'));
  const t = await getDictionary(locale);
  const viewer = await requireRole(locale, 'CARRIER');
  const company = viewer.company!;

  const vehicleId = text(formData, 'vehicle_id') || null;
  const mode = text(formData, 'mode');
  if (mode && !MODES.has(mode)) return;
  if (!mode && !vehicleId) return;

  const supabase = await createClient();
  const scope = supabase.from('capacity_publish_settings').select('id').eq('company_id', company.id);
  const { data: existing } = await (vehicleId ? scope.eq('vehicle_id', vehicleId) : scope.is('vehicle_id', null)).maybeSingle();

  let error: { code?: string; message?: string } | null = null;
  if (!mode) {
    if (existing) ({ error } = await supabase.from('capacity_publish_settings').delete().eq('id', existing.id));
  } else if (existing) {
    ({ error } = await supabase.from('capacity_publish_settings').update({ mode }).eq('id', existing.id));
  } else {
    ({ error } = await supabase.from('capacity_publish_settings').insert({ company_id: company.id, vehicle_id: vehicleId, mode }));
  }
  if (error) {
    await flashError(explain(t, error));
  } else if (mode === 'AUTO') {
    /* Согласие дано — публикуем сразу, а не ночью. */
    after(() => syncCapacity([company.id]).then(() => undefined, (e: unknown) => console.error('capacity sync:', e)));
  }
  revalidateCarrier(locale);
}

/** Ответ на запрос: принять (заказ становится прямым на этой машине) или отклонить. */
export async function decideCapacityRequestAction(formData: FormData): Promise<void> {
  const locale = toLocale(formData.get('locale'));
  const t = await getDictionary(locale);
  const viewer = await requireRole(locale, 'CARRIER');
  const accept = text(formData, 'accept') === '1';

  const supabase = await createClient();
  const { error } = await supabase.rpc('capacity_request_decide', {
    p_request_id: text(formData, 'request_id'),
    p_accept: accept,
    p_reason: text(formData, 'reason').slice(0, 300) || undefined,
  });
  if (error) await flashError(explain(t, error));
  else if (accept) {
    const companyId = viewer.company!.id;
    after(() => syncCapacity([companyId]).then(() => undefined, (e: unknown) => console.error('capacity sync:', e)));
  }
  revalidateCarrier(locale);
}

export type CapacityRequestState = { error: string | null; done: boolean };

/** Запрос заказчика: своё место по своему заказу с ценой. */
export async function requestCapacityAction(_previous: CapacityRequestState, formData: FormData): Promise<CapacityRequestState> {
  const locale = toLocale(formData.get('locale'));
  const t = await getDictionary(locale);
  await requireRole(locale, 'SHIPPER');

  const price = decimal(formData, 'price');
  if (price === undefined || price < 1) return { error: t.capacity.badPrice, done: false };
  const pallets = decimal(formData, 'pallets');

  const supabase = await createClient();
  const { error } = await supabase.rpc('capacity_request_create', {
    p_offer_id: text(formData, 'offer_id'),
    p_order_id: text(formData, 'order_id'),
    p_price_cents: Math.round(price * 100),
    p_date_from: date(formData, 'date_from'),
    p_date_to: date(formData, 'date_to'),
    p_pallets: pallets === undefined ? undefined : Math.round(pallets),
    p_description: text(formData, 'description').slice(0, 500) || undefined,
  });
  if (error) return { error: explain(t, error), done: false };
  revalidatePath(`/${locale}/shipper`, 'layout');
  return { error: null, done: true };
}

/** Одним нажатием из подсказки: цена — ставка заказа, даты — его забор. */
export async function quickCapacityRequestAction(formData: FormData): Promise<void> {
  const locale = toLocale(formData.get('locale'));
  const t = await getDictionary(locale);
  await requireRole(locale, 'SHIPPER');

  const orderId = text(formData, 'order_id');
  const supabase = await createClient();
  const { data: order } = await supabase.from('orders').select('rate_cents').eq('id', orderId).maybeSingle();
  if (!order?.rate_cents) {
    await flashError(t.capacity.badPrice);
    return;
  }
  const { error } = await supabase.rpc('capacity_request_create', {
    p_offer_id: text(formData, 'offer_id'),
    p_order_id: orderId,
    p_price_cents: order.rate_cents,
  });
  if (error) await flashError(explain(t, error));
  revalidatePath(`/${locale}/shipper`, 'layout');
}

export async function cancelCapacityRequestAction(formData: FormData): Promise<void> {
  const locale = toLocale(formData.get('locale'));
  const t = await getDictionary(locale);
  await requireRole(locale, 'SHIPPER');
  const supabase = await createClient();
  const { error } = await supabase.rpc('capacity_request_cancel', { p_request_id: text(formData, 'request_id') });
  if (error) await flashError(explain(t, error));
  revalidatePath(`/${locale}/shipper`, 'layout');
}

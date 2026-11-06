import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { isValidContainerNumber } from '@/lib/containerNumber';
import { todayInHelsinki } from '@/lib/dates';
import { CURRENCIES } from '@/lib/money/currency';
import { suggestAddressAction } from '@/lib/routing/actions';
import { PLACES } from '@/lib/routing/places';
import type { Database } from '@/types/database';
import { draftIsEmpty, normalizeDraft, type DraftStop, type OrderDraft } from './importDraft';
import { parseOrderDocument, type ParseInput } from './importParse';

/*
 * Общее для «из текста или PDF» (importActions) и заказа из письма
 * (inbound/receive): подсказки разбору, вызов n8n и проверка ответа.
 * Клиент базы — параметром: сессионный в кабинете, служебный в вебхуке.
 */

type Client = SupabaseClient<Database>;
export type ImportClient = { id: string; name: string; business_id: string | null };

/** Подсказки: клиенты перевозчика и точки последних заказов компании. */
export async function importHints(
  supabase: Client,
  input: { shipperIds: string[] },
): Promise<string[]> {
  const { shipperIds } = input;
  const { data: recent } = shipperIds.length
    ? await supabase.from('orders').select('id').in('shipper_company_id', shipperIds).order('created_at', { ascending: false }).limit(40)
    : { data: [] };
  const recentIds = (recent ?? []).map((o) => o.id);
  const { data: stops } = recentIds.length
    ? await supabase.from('order_stops').select('place_name, company_name, address').in('order_id', recentIds).limit(300)
    : { data: [] };
  const places = [
    ...new Set(
      (stops ?? [])
        .map((s) => [s.place_name, s.company_name, s.address].filter(Boolean).join(' — '))
        .filter((s) => s.length > 3),
    ),
  ].slice(0, 50);
  return [...places, ...PLACES.map((p) => `${p.name} — ${p.address}`)];
}

export type DraftResult = { ok: true; draft: OrderDraft } | { ok: false; reason: 'not_configured' | 'failed' | 'empty' };

/**
 * Текст/файл → проверенный черновик без координат. Свой рейс перевозчика
 * — в любой валюте RAHTIS; заказ заказчика — только евро (как в форме).
 */
export async function readOrderDraft(input: {
  text: string;
  file: ParseInput['file'];
  carrier: boolean;
  country: string;
  clients: ImportClient[] | null;
  places: string[];
}): Promise<DraftResult> {
  const today = todayInHelsinki();
  const weekday = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Helsinki', weekday: 'long' }).format(new Date());
  const result = await parseOrderDocument({
    text: input.text,
    file: input.file,
    today,
    weekday,
    role: input.carrier ? 'CARRIER' : 'SHIPPER',
    country: input.country,
    clients: (input.clients ?? []).map((c) => (c.business_id ? `${c.name} (${c.business_id})` : c.name)),
    places: input.places,
  });
  if (!result.ok) return { ok: false, reason: result.reason };

  const draft = normalizeDraft(result.draft, {
    isValidContainer: isValidContainerNumber,
    clients: input.carrier ? (input.clients ?? []) : null,
    currencies: input.carrier ? CURRENCIES : undefined,
    today,
  });
  if (!draft || draftIsEmpty(draft)) return { ok: false, reason: 'empty' };
  return { ok: true, draft };
}

const fold = (s: string) =>
  s.toLocaleLowerCase('fi').normalize('NFD').replace(/\p{M}/gu, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

/**
 * Координаты — только уверенные. Поле адреса устроено так, что адрес
 * выбирают из подсказки, потому что геокодер на неверный адрес не
 * отвечает «нет», а подбирает похожую улицу в другом городе. Поэтому
 * подставляем подсказку, только если это наша площадка или точный адрес
 * с тем же индексом и городом, что в письме. Иначе адрес остаётся
 * текстом, и человек выбирает строку из списка сам.
 *
 * Подсказка требует вошедшего человека — зовётся из кабинета.
 */
export async function locateDraft(draft: OrderDraft, locale: string): Promise<OrderDraft> {
  const locate = async (stop: DraftStop | null): Promise<DraftStop | null> => {
    if (!stop || !stop.address.text || stop.chosen) return stop;
    const query = stop.address.street ? stop.address.text : stop.address.placeName || stop.address.text;
    const found = await suggestAddressAction(query, undefined, locale);
    if (!found.ok) return stop;
    const pick = found.suggestions.find((s) => {
      if (!s.position || !s.precise) return false;
      if (s.id.startsWith('place:')) return !stop.address.city || fold(s.label).includes(fold(stop.address.city));
      if (!stop.address.street) return false;
      if (stop.address.postalCode && s.postalCode && s.postalCode.replace(/\s/g, '') !== stop.address.postalCode.replace(/\s/g, '')) return false;
      if (stop.address.city && !(fold(s.city ?? '') === fold(stop.address.city) || fold(s.label).includes(fold(stop.address.city)))) return false;
      if (stop.address.country && s.country && s.country !== stop.address.country) return false;
      return true;
    });
    if (!pick) return stop;
    return {
      ...stop,
      address: { ...stop.address, text: pick.label },
      chosen: { address: pick.label, city: pick.city, country: pick.country, position: pick.position, score: pick.score, precise: pick.precise },
    };
  };

  const [pickup, delivery, ret, ...extras] = await Promise.all([
    locate(draft.pickup),
    locate(draft.delivery),
    locate(draft.ret),
    ...draft.extras.map((e) => locate(e.stop)),
  ]);
  const located: OrderDraft = {
    ...draft,
    pickup,
    delivery,
    ret,
    extras: draft.extras.map((e, i) => ({ ...e, stop: extras[i] ?? e.stop })),
  };
  const all = [located.pickup, located.delivery, located.ret, ...located.extras.map((e) => e.stop)];
  if (all.some((s) => s && s.address.text && !s.chosen) && !located.missing.includes('addressCheck')) {
    located.missing = [...located.missing, 'addressCheck'];
  }
  return located;
}

'use server';

import { getViewer } from '@/lib/auth/viewer';
import { isValidContainerNumber } from '@/lib/containerNumber';
import { todayInHelsinki } from '@/lib/dates';
import { getDictionary, isLocale, defaultLocale, type Locale } from '@/lib/i18n';
import { suggestAddressAction } from '@/lib/routing/actions';
import { PLACES } from '@/lib/routing/places';
import { createClient } from '@/lib/supabase/server';
import { CURRENCIES } from '@/lib/money/currency';
import { draftIsEmpty, normalizeDraft, type DraftStop, type OrderDraft } from './importDraft';
import { parseOrderDocument } from './importParse';

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

const fold = (s: string) =>
  s.toLocaleLowerCase('fi').normalize('NFD').replace(/\p{M}/gu, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

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
  const shipperIds = carrier ? (clients ?? []).map((c) => c.id) : [viewer.company.id];
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
  const curated = PLACES.map((p) => `${p.name} — ${p.address}`);

  const today = todayInHelsinki();
  const weekday = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Helsinki', weekday: 'long' }).format(new Date());

  const result = await parseOrderDocument({
    text,
    file: file ? { name: file.name, mime: file.type, bytes: await file.arrayBuffer() } : null,
    today,
    weekday,
    role: carrier ? 'CARRIER' : 'SHIPPER',
    country: viewer.company.country ?? 'FI',
    clients: (clients ?? []).map((c) => (c.business_id ? `${c.name} (${c.business_id})` : c.name)),
    places: [...places, ...curated],
  });
  if (!result.ok) {
    return { ok: false, error: result.reason === 'not_configured' ? t.orderImport.notConfigured : t.orderImport.failed };
  }

  const draft = normalizeDraft(result.draft, {
    isValidContainer: isValidContainerNumber,
    clients: carrier ? (clients ?? []).map((c) => ({ id: c.id, name: c.name, business_id: c.business_id })) : null,
    /* Свой рейс — в любой валюте RAHTIS (форма покажет её); заказ заказчика — только евро. */
    currencies: carrier ? CURRENCIES : undefined,
    today,
  });
  if (!draft || draftIsEmpty(draft)) return { ok: false, error: t.orderImport.empty };

  /*
   * Координаты — только уверенные. Поле адреса устроено так, что адрес
   * выбирают из подсказки, потому что геокодер на неверный адрес не
   * отвечает «нет», а подбирает похожую улицу в другом городе. Поэтому
   * подставляем подсказку, только если это наша площадка или точный адрес
   * с тем же индексом и городом, что в письме. Иначе адрес остаётся
   * текстом, и человек выбирает строку из списка сам.
   */
  const locate = async (stop: DraftStop | null): Promise<DraftStop | null> => {
    if (!stop || !stop.address.text) return stop;
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

  return { ok: true, draft: located };
}

/**
 * Поправка к рейсу из письма: что в рейсе сейчас → что пришло в письме.
 *
 * Клиент присылает изменения по тому же номеру заказа (другое время,
 * другой адрес, другая машина). Здесь — только сравнение: какие поля
 * каких точек отличаются и чем их можно заменить. Применяет человек,
 * отметив строки, — обычными функциями правки (amend_stop,
 * change_trip_assignment), и в журнал правка ложится с его именем.
 *
 * Правила:
 *  - пустое в письме — не «стереть», а «не сказано»: такие поля не трогаем;
 *  - пройденную точку не правим (база тоже не даст) — строка видна, но без галочки;
 *  - новый адрес принимается только с координатами (как при публикации);
 *    без них — строка «поправьте вручную»;
 *  - точки сопоставляются по порядку; если в письме их другое число —
 *    сравниваются первая с первой и последняя с последней, остальное
 *    человек правит сам, и об этом сказано.
 *
 * Модуль чистый: его гоняют тесты на node без сборки. Сравнение номера
 * машины приходит параметром.
 */

import type { DraftStop, OrderDraft } from '../orders/importDraft';

export type CurrentStop = {
  id: string;
  role: string;
  sequence: number;
  completed: boolean;
  address: string;
  city: string;
  place_name: string | null;
  company_name: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  scheduled_date: string | null;
  scheduled_time: string | null;
  external_ref: string | null;
  cargo_weight_kg: number | null;
  lat: number | null;
  lon: number | null;
};

export type ChangeKey = 'address' | 'date' | 'time' | 'ref' | 'company' | 'contact' | 'phone' | 'weight';

export type FieldChange = {
  key: ChangeKey;
  now: string;
  next: string;
  /** Что уйдёт в amend_stop; null — автоматически нельзя (почему — в blocked). */
  patch: Record<string, string> | null;
  blocked: 'done' | 'noCoordinates' | null;
};

export type StopChanges = { stopId: string; role: string; city: string; place: string; fields: FieldChange[] };

export type VehicleChange = {
  now: string | null;
  next: string;
  /** Машина парка из письма; null — такой нет. */
  vehicleId: string | null;
};

export type TripChanges = {
  stops: StopChanges[];
  vehicle: VehicleChange | null;
  /** В письме другое число точек: сравнены только первая и последняя. */
  stopCountDiffers: boolean;
  empty: boolean;
};

/** Сравнение текста без регистра, диакритики и знаков. */
export const fold = (s: string | null | undefined): string =>
  (s ?? '')
    .toLocaleLowerCase('fi')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();

const digits = (s: string | null | undefined): string => (s ?? '').replace(/[^\d+]/g, '').replace(/^00/, '+');

/** Тонны формы («24,5») в килограммы. */
export function tonnesToKgText(value: string): number | null {
  const n = Number.parseFloat(value.replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? Math.round(n * 1000) : null;
}

const kgToTonnes = (kg: number | null): string =>
  kg === null ? '' : String(Math.round(kg) / 1000).replace('.', ',');

/** Расстояние в метрах (для «тот же адрес, написан иначе»). */
function meters(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const rad = Math.PI / 180;
  const x = (b.lon - a.lon) * rad * Math.cos(((a.lat + b.lat) / 2) * rad);
  const y = (b.lat - a.lat) * rad;
  return Math.sqrt(x * x + y * y) * 6_371_000;
}

/**
 * Тот же ли адрес. Совпала точка на карте (до 150 м) — тот же, как бы
 * ни был написан. Иначе — улица и город из письма содержатся в адресе
 * рейса.
 */
export function sameAddress(now: CurrentStop, next: DraftStop): boolean {
  const pos = next.chosen?.position ?? null;
  if (pos && now.lat !== null && now.lon !== null) return meters({ lat: now.lat, lon: now.lon }, pos) <= 150;
  const hay = ` ${fold(`${now.address} ${now.city} ${now.place_name ?? ''}`)} `;
  const street = fold(next.address.street);
  const city = fold(next.address.city);
  const place = fold(next.address.placeName);
  if (!street && !city && !place) return true;
  if (!street && place) return hay.includes(` ${place} `);
  return (!street || hay.includes(` ${street} `)) && (!city || hay.includes(` ${city} `));
}

/** Точки письма по порядку маршрута. */
export function draftStops(draft: OrderDraft): DraftStop[] {
  return [draft.pickup, ...draft.extras.map((e) => e.stop), draft.delivery, draft.ret].filter(
    (s): s is DraftStop => s !== null,
  );
}

function compareStop(now: CurrentStop, next: DraftStop): FieldChange[] {
  const out: FieldChange[] = [];
  const add = (key: ChangeKey, nowText: string, nextText: string, patch: Record<string, string> | null, blocked: FieldChange['blocked'] = null) =>
    out.push({ key, now: nowText, next: nextText, patch: now.completed ? null : patch, blocked: now.completed ? 'done' : blocked });

  if (!sameAddress(now, next)) {
    const chosen = next.chosen;
    const nowText = [now.address, now.city].filter(Boolean).join(', ');
    if (chosen?.position) {
      add('address', nowText, chosen.address, {
        address: chosen.address,
        city: chosen.city ?? next.address.city,
        country: chosen.country ?? next.address.country,
        lat: String(chosen.position.lat),
        lon: String(chosen.position.lon),
        geocode_score: String(chosen.score),
      });
    } else {
      add('address', nowText, next.address.text, null, 'noCoordinates');
    }
  }

  if (next.date && next.date !== (now.scheduled_date ?? '')) {
    add('date', now.scheduled_date ?? '', next.date, { scheduled_date: next.date });
  }
  const nowTime = (now.scheduled_time ?? '').slice(0, 5);
  if (next.time && next.time !== nowTime) add('time', nowTime, next.time, { scheduled_time: next.time });

  if (next.ref && fold(next.ref) !== fold(now.external_ref)) add('ref', now.external_ref ?? '', next.ref, { external_ref: next.ref });
  if (next.company && fold(next.company) !== fold(now.company_name)) {
    add('company', now.company_name ?? '', next.company, { company_name: next.company });
  }
  if (next.contact && fold(next.contact) !== fold(now.contact_name)) {
    add('contact', now.contact_name ?? '', next.contact, { contact_name: next.contact });
  }
  if (next.phone && digits(next.phone) !== digits(now.contact_phone)) {
    add('phone', now.contact_phone ?? '', next.phone, { contact_phone: next.phone });
  }
  const kg = next.weight ? tonnesToKgText(next.weight) : null;
  if (kg !== null && kg !== (now.cargo_weight_kg === null ? null : Math.round(now.cargo_weight_kg))) {
    add('weight', kgToTonnes(now.cargo_weight_kg), next.weight, { cargo_weight_kg: String(kg) });
  }
  return out;
}

export function tripChanges(input: {
  stops: CurrentStop[];
  draft: OrderDraft;
  /** Назначенная машина рейса. */
  vehicle: { id: string; plate: string } | null;
  /** Машина парка по номеру из письма. */
  findVehicle: (plate: string) => { id: string; plate: string } | null;
}): TripChanges {
  const current = [...input.stops].sort((a, b) => a.sequence - b.sequence);
  const next = draftStops(input.draft);

  const pairs: [CurrentStop, DraftStop][] = [];
  const differs = next.length > 0 && next.length !== current.length;
  if (next.length > 0 && current.length > 0) {
    if (!differs) {
      current.forEach((s, i) => pairs.push([s, next[i]]));
    } else {
      pairs.push([current[0], next[0]]);
      if (current.length > 1 && next.length > 1) pairs.push([current[current.length - 1], next[next.length - 1]]);
    }
  }

  const stops: StopChanges[] = [];
  for (const [now, nextStop] of pairs) {
    const fields = compareStop(now, nextStop);
    if (fields.length > 0) {
      stops.push({ stopId: now.id, role: now.role, city: now.city, place: now.place_name ?? now.company_name ?? '', fields });
    }
  }

  let vehicle: VehicleChange | null = null;
  if (input.draft.vehiclePlate) {
    const found = input.findVehicle(input.draft.vehiclePlate);
    if (!found || found.id !== input.vehicle?.id) {
      vehicle = { now: input.vehicle?.plate ?? null, next: found?.plate ?? input.draft.vehiclePlate, vehicleId: found?.id ?? null };
    }
  }

  return { stops, vehicle, stopCountDiffers: differs, empty: stops.length === 0 && vehicle === null && !differs };
}

/** Ключ выбора в форме: «точка:поле» или «vehicle». */
export const changeKey = (stopId: string, key: ChangeKey): string => `${stopId}:${key}`;

/**
 * Отмеченное человеком — в правки по точкам (одна строка журнала на
 * точку). Берётся только то, что сравнение само разрешило: ключи из
 * формы лишь выбирают.
 */
export function selectedPatches(changes: TripChanges, chosen: Set<string>): { stopId: string; patch: Record<string, string>; address: boolean }[] {
  const out: { stopId: string; patch: Record<string, string>; address: boolean }[] = [];
  for (const stop of changes.stops) {
    const patch: Record<string, string> = {};
    let address = false;
    for (const field of stop.fields) {
      if (!field.patch || !chosen.has(changeKey(stop.stopId, field.key))) continue;
      Object.assign(patch, field.patch);
      if (field.key === 'address') address = true;
    }
    if (Object.keys(patch).length > 0) out.push({ stopId: stop.stopId, patch, address });
  }
  return out;
}

/** Номер заказа клиента для сравнения: только буквы и цифры. */
export const refKey = (value: string | null | undefined): string =>
  (value ?? '').toUpperCase().replace(/[^\p{L}\p{N}]/gu, '');

/**
 * Черновик заказа из письма или PDF: ответ модели → значения формы.
 *
 * Модель отвечает по строгой схеме (rahtis-order-parse.json), но схема
 * гарантирует только форму ответа, а не смысл: дата может быть «2026-02-31»,
 * вес — отрицательным, тип рейса — пустым. Всё, что уходит в форму,
 * проверяется здесь, а непроверенное просто не подставляется: пустое поле
 * человек видит и заполнит, а неверное — может пропустить.
 *
 * Модуль чистый (без '@/'-импортов значений): его гоняют тесты на node
 * без сборки. Проверка номера контейнера приходит параметром.
 *
 * Заказ здесь не создаётся. Черновик только открывает обычную форму, и
 * публикует её человек — после того как посмотрел на подсвеченные поля.
 */

import type { HaulKind } from './haul';

export const DRAFT_HAUL_KINDS = ['TRAILER', 'CONTAINER', 'VAN', 'TRUCK', 'SEMI', 'TIPPER'] as const satisfies readonly HaulKind[];

/** Что модель может назвать пропущенным; те же ключи считает и сайт. */
export const MISSING_KEYS = [
  'haulKind',
  'unit',
  'pickupAddress',
  'pickupDate',
  'deliveryAddress',
  'deliveryDate',
  'returnAddress',
  'company',
  'weight',
  'ldm',
  'rate',
  'client',
  'addressCheck',
] as const;
export type MissingKey = (typeof MISSING_KEYS)[number];

export type DraftAddress = {
  /** Строка для поля адреса: «Satamakatu 1, 10900 Hanko». */
  text: string;
  /** Для поиска координат: отдельно, как прислала модель. */
  street: string;
  postalCode: string;
  city: string;
  country: string;
  placeName: string;
};

export type DraftStop = {
  address: DraftAddress;
  company: string;
  date: string;
  time: string;
  contact: string;
  phone: string;
  ref: string;
  /** Тонны, как в поле формы: «24,5». */
  weight: string;
  note: string;
  /**
   * Адрес, найденный в подсказке уверенно (тот же вид, что ChosenAddress
   * поля адреса). Нет — человек выбирает из списка сам.
   */
  chosen?: {
    address: string;
    city: string | null;
    country: string | null;
    position: { lat: number; lon: number } | null;
    score: number;
    precise: boolean;
  } | null;
};

export type DraftClient = { id: string | null; name: string; email: string; businessId: string };

export type OrderDraft = {
  haulKind: HaulKind;
  shipperRef: string;
  unitPlate: string;
  /** Номер машины (тягача, грузовика), если заказ его называет; ключ сравнения — plateKey. */
  vehiclePlate: string;
  containerFeet: string;
  ldm: string;
  rate: string;
  /** Валюта подставленной ставки (евро или, у своего рейса, валюта письма); цены нет — null. */
  currency: string | null;
  comment: string;
  pickup: DraftStop | null;
  /** Вторая точка экспресса. */
  delivery: DraftStop | null;
  /** Действия перецепа и контейнера, по порядку. */
  extras: { role: 'EXTRA_LOAD' | 'EXTRA_UNLOAD'; stop: DraftStop }[];
  /** Отцепка перецепа и контейнера. */
  ret: DraftStop | null;
  client: DraftClient | null;
  /** Поля, которые заполнил разбор: подсвечиваются в форме. */
  filled: string[];
  missing: MissingKey[];
  confidence: 'high' | 'medium' | 'low';
  /** Цена была в чужой валюте — в поле не подставлена, сказано в списке. */
  foreignPrice: string | null;
};

type Raw = Record<string, unknown>;

const text = (value: unknown, max = 200): string =>
  typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, max) : '';

const num = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const n = Number.parseFloat(value.replace(/\s/g, '').replace(',', '.'));
    return Number.isFinite(n) ? n : null;
  }
  return null;
};

/** Число в записи формы: запятая, без хвоста «,0». */
const decimal = (value: number, digits = 2): string =>
  String(Math.round(value * 10 ** digits) / 10 ** digits).replace('.', ',');

/** Только существующая дата YYYY-MM-DD. */
export function cleanDate(value: unknown): string {
  const s = text(value, 10);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!match) return '';
  const [, y, m, d] = match.map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d ? s : '';
}

/** HH:MM в 24 часа; «8:00» → «08:00». */
export function cleanTime(value: unknown): string {
  const match = /^(\d{1,2})[:.](\d{2})$/.exec(text(value, 5));
  if (!match) return '';
  const h = Number(match[1]);
  const m = Number(match[2]);
  return h < 24 && m < 60 ? `${String(h).padStart(2, '0')}:${match[2]}` : '';
}

const COUNTRY = /^[A-Z]{2}$/;

function readAddress(raw: Raw): DraftAddress {
  const street = text(raw.street);
  const postalCode = text(raw.postal_code, 12);
  const city = text(raw.city, 80);
  const countryRaw = text(raw.country, 2).toUpperCase();
  const country = COUNTRY.test(countryRaw) ? countryRaw : '';
  const placeName = text(raw.place_name, 120);
  const tail = [postalCode, city].filter(Boolean).join(' ');
  /* Улицы нет — ищем по названию площадки и городу: «Vuosaaren satama, Helsinki». */
  const head = street || placeName;
  return { text: [head, tail].filter(Boolean).join(', '), street, postalCode, city, country, placeName };
}

function readStop(raw: Raw): DraftStop {
  const weightKg = num(raw.weight_kg);
  const from = cleanTime(raw.time_from);
  const to = cleanTime(raw.time_to);
  /* В форме одно поле времени: начало окна туда, само окно — в указания по точке. */
  const window = from && to && to !== from ? `${from}–${to}` : !from && to ? `–${to}` : '';
  const note = [window, text(raw.note, 400)].filter(Boolean).join(' · ');
  return {
    address: readAddress(raw),
    company: text(raw.company, 200),
    date: cleanDate(raw.date),
    time: from,
    contact: text(raw.contact_name, 120),
    phone: text(raw.contact_phone, 40).replace(/[^\d+]/g, ''),
    ref: text(raw.reference, 60),
    weight: weightKg && weightKg > 0 && weightKg <= 76_000 ? decimal(weightKg / 1000, 3) : '',
    note,
  };
}

const stopKind = (raw: Raw) => {
  const k = text(raw.kind, 10);
  return k === 'PICKUP' || k === 'LOAD' || k === 'UNLOAD' || k === 'DROP' ? k : 'UNLOAD';
};

const fold = (s: string) => s.toLocaleLowerCase('fi').normalize('NFD').replace(/\p{M}/gu, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

/** Клиент из справочника перевозчика: по Y-tunnus, потом по имени без формы собственности. */
export function matchClient(
  name: string,
  businessId: string,
  clients: { id: string; name: string; business_id: string | null }[],
): string | null {
  const id = businessId.replace(/\s/g, '').toUpperCase();
  if (id) {
    const byId = clients.find((c) => (c.business_id ?? '').replace(/\s/g, '').toUpperCase() === id);
    if (byId) return byId.id;
  }
  const strip = (s: string) => fold(s).replace(/\b(oy|oyj|ab|ky|tmi|as|sia|uab|sp z o o|gmbh|ltd|oü|ou)\b/g, '').replace(/\s+/g, ' ').trim();
  const wanted = strip(name);
  if (wanted.length < 2) return null;
  return clients.find((c) => strip(c.name) === wanted)?.id ?? null;
}

export function normalizeDraft(
  raw: unknown,
  options: {
    isValidContainer: (value: string) => boolean;
    /** Свой рейс перевозчика: клиент из письма. */
    clients?: { id: string; name: string; business_id: string | null }[] | null;
    /**
     * Валюты, в которых цену можно подставить в поле как есть. По
     * умолчанию — только евро (заказ через RAHTIS); у своего рейса
     * перевозчика — все валюты RAHTIS.
     */
    currencies?: readonly string[];
    today: string;
  },
): OrderDraft | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Raw;
  const filled: string[] = [];
  const missing = new Set<MissingKey>();
  const comment: string[] = [];

  const unit = text(r.unit_number, 20).toUpperCase().replace(/\s+/g, '');
  const ldmValue = num(r.ldm);
  const weightKg = num(r.weight_kg);

  let haulKind: HaulKind;
  const kindRaw = text(r.haul_kind, 12);
  if ((DRAFT_HAUL_KINDS as readonly string[]).includes(kindRaw)) {
    haulKind = kindRaw as HaulKind;
    filled.push('haulKind');
  } else {
    /* Не названо — догадка по признакам, и она в списке «проверьте». */
    haulKind = unit && options.isValidContainer(unit)
      ? 'CONTAINER'
      : unit
        ? 'TRAILER'
        : (ldmValue ?? 0) >= 13 || (weightKg ?? 0) > 15_000
          ? 'SEMI'
          : 'TRUCK';
    missing.add('haulKind');
  }
  const express = haulKind === 'VAN' || haulKind === 'TRUCK' || haulKind === 'SEMI' || haulKind === 'TIPPER';

  const shipperRef = text(r.shipper_ref, 60);
  if (shipperRef) filled.push('shipperRef');

  let unitPlate = '';
  if (!express && unit) {
    /* Неверную контрольную цифру не подставляем: форма не даст опубликовать, а глаз её не заметит. */
    if (haulKind !== 'CONTAINER' || options.isValidContainer(unit)) {
      unitPlate = unit;
      filled.push('unit');
    } else {
      comment.push(`${unit} (?)`);
    }
  }
  if (!express && !unitPlate) missing.add('unit');

  /* Машина под рейс: номер прицепа сюда не берём, даже если модель перепутала поля. */
  const vehicleRaw = text(r.vehicle_plate, 40);
  const vehicleKeys = plateCandidates(vehicleRaw);
  const vehiclePlate = vehicleKeys.length > 0 && !vehicleKeys.includes(plateKey(unit)) ? vehicleRaw.toUpperCase() : '';
  if (vehiclePlate) filled.push('vehicle');

  const feetRaw = num(r.container_feet);
  const containerFeet = haulKind === 'CONTAINER' && feetRaw && [20, 30, 40, 45].includes(feetRaw) ? String(feetRaw) : '';
  if (containerFeet) filled.push('containerFeet');

  const ldm = express && haulKind !== 'TIPPER' && ldmValue && ldmValue > 0 && ldmValue <= 20 ? decimal(ldmValue, 1) : '';
  if (ldm) filled.push('ldm');
  else if (express && haulKind !== 'TIPPER' && haulKind !== 'SEMI') missing.add('ldm');

  /*
   * Цена — в принятой валюте: у заказа через RAHTIS только евро, у своего
   * рейса — валюта письма, если она из наших. Курс не угадываем: чужая
   * валюта уходит в список «проверьте», поле остаётся пустым.
   */
  const price = num(r.price);
  const priceCurrency = text(r.currency, 3).toUpperCase() || 'EUR';
  const accepted = options.currencies ?? ['EUR'];
  let rate = '';
  let currency: string | null = null;
  let foreignPrice: string | null = null;
  if (price && price > 0 && price < 1_000_000) {
    if (accepted.includes(priceCurrency)) {
      rate = decimal(price);
      currency = priceCurrency;
      filled.push('rate');
    } else {
      foreignPrice = `${decimal(price)} ${priceCurrency}`;
    }
  }
  if (!rate) missing.add('rate');

  /* Точки по порядку маршрута. */
  const stopsRaw = (Array.isArray(r.stops) ? r.stops : []).filter((s): s is Raw => Boolean(s) && typeof s === 'object').slice(0, 12);
  const stops = stopsRaw.map((s) => ({ kind: stopKind(s), stop: readStop(s) }));

  let pickup: DraftStop | null = null;
  let delivery: DraftStop | null = null;
  let ret: DraftStop | null = null;
  const extras: OrderDraft['extras'] = [];
  const leftovers: DraftStop[] = [];

  if (express) {
    const first = stops.findIndex((s) => s.kind === 'PICKUP' || s.kind === 'LOAD');
    const pickIndex = first >= 0 ? first : stops.length > 1 ? 0 : -1;
    let lastIndex = -1;
    for (let i = stops.length - 1; i > pickIndex; i -= 1) {
      if (stops[i].kind === 'UNLOAD' || stops[i].kind === 'DROP') {
        lastIndex = i;
        break;
      }
    }
    if (lastIndex < 0 && stops.length > pickIndex + 1) lastIndex = stops.length - 1;
    pickup = pickIndex >= 0 ? stops[pickIndex].stop : null;
    delivery = lastIndex >= 0 ? stops[lastIndex].stop : null;
    stops.forEach((s, i) => {
      if (i !== pickIndex && i !== lastIndex) leftovers.push(s.stop);
    });
  } else {
    let pickIndex = stops.findIndex((s) => s.kind === 'PICKUP');
    if (pickIndex < 0 && stops.length > 0) pickIndex = 0;
    let retIndex = -1;
    for (let i = stops.length - 1; i > pickIndex; i -= 1) {
      if (stops[i].kind === 'DROP') {
        retIndex = i;
        break;
      }
    }
    pickup = pickIndex >= 0 ? stops[pickIndex].stop : null;
    ret = retIndex >= 0 ? stops[retIndex].stop : null;
    stops.forEach((s, i) => {
      if (i === pickIndex || i === retIndex) return;
      if (i < pickIndex || (retIndex >= 0 && i > retIndex)) {
        leftovers.push(s.stop);
        return;
      }
      extras.push({ role: s.kind === 'LOAD' || s.kind === 'PICKUP' ? 'EXTRA_LOAD' : 'EXTRA_UNLOAD', stop: s.stop });
    });
  }

  /* Вес заказа — на забор, если у точки своего нет. */
  if (pickup && !pickup.weight && weightKg && weightKg > 0 && weightKg <= 76_000) {
    pickup = { ...pickup, weight: decimal(weightKg / 1000, 3) };
  }

  /*
   * Поле номера погрузки есть только у загрузки в пути (EXTRA_LOAD). У
   * остальных точек номер из письма уходит в указания по точке, а не
   * пропадает.
   */
  const refToNote = (s: DraftStop | null): DraftStop | null =>
    s && s.ref ? { ...s, ref: '', note: [`Ref ${s.ref}`, s.note].filter(Boolean).join(' · ') } : s;
  pickup = refToNote(pickup);
  delivery = refToNote(delivery);
  ret = refToNote(ret);
  for (const e of extras) if (e.role === 'EXTRA_UNLOAD') e.stop = refToNote(e.stop)!;

  /* Прошедшие даты не подставляем: форма их всё равно не примет. */
  const notPast = (s: DraftStop | null) => (s && s.date && s.date < options.today ? { ...s, date: '' } : s);
  pickup = notPast(pickup);
  delivery = notPast(delivery);
  ret = notPast(ret);

  const markStop = (slot: string, s: DraftStop | null) => {
    if (!s) return;
    if (s.address.text) filled.push(`${slot}.address`);
    if (s.address.placeName) filled.push(`${slot}.place_name`);
    for (const key of ['company', 'date', 'time', 'contact', 'phone', 'ref', 'weight', 'note'] as const) {
      if (s[key]) filled.push(`${slot}.${key}`);
    }
  };
  markStop('pickup', pickup);
  markStop('delivery', delivery);
  markStop('ret', ret);
  extras.forEach((e, i) => markStop(`extra-${i + 1}`, e.stop));

  if (!pickup?.address.text) missing.add('pickupAddress');
  if (!pickup?.date) missing.add('pickupDate');
  if (express) {
    if (!delivery?.address.text) missing.add('deliveryAddress');
    if (!delivery?.date) missing.add('deliveryDate');
    if (!pickup?.company || !delivery?.company) missing.add('company');
    if (haulKind !== 'TIPPER' && !pickup?.weight) missing.add('weight');
  } else {
    if (!ret?.address.text) missing.add('returnAddress');
    if (extras.some((e) => !e.stop.company)) missing.add('company');
  }

  /* Груз, паллеты и лишние точки — в комментарий: отдельных полей для них в форме нет. */
  const cargo = text(r.cargo_description, 300);
  const pallets = num(r.pallets);
  if (cargo) comment.push(cargo);
  if (pallets && pallets > 0 && pallets < 1000) comment.push(`${Math.round(pallets)} EUR-pal`);
  for (const s of leftovers) {
    comment.push(`+ ${[s.company, s.address.text, s.date, s.time].filter(Boolean).join(', ')}`);
  }
  const notes = text(r.notes, 800);
  if (notes) comment.push(notes);
  const commentText = comment.join('\n').slice(0, 1500);
  if (commentText) filled.push('comment');

  /* Заказчик из письма — только для своего рейса перевозчика. */
  let client: DraftClient | null = null;
  if (options.clients) {
    const c = (r.customer && typeof r.customer === 'object' ? r.customer : {}) as Raw;
    const name = text(c.name, 200);
    const businessId = text(c.business_id, 20);
    const email = text(c.email, 200).toLowerCase();
    const id = name || businessId ? matchClient(name, businessId, options.clients) : null;
    if (id || name) {
      client = { id, name: id ? '' : name, email: /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) ? email : '', businessId: id ? '' : businessId };
      filled.push('client');
    } else {
      missing.add('client');
    }
  }

  /* Что модель сама назвала пропущенным — добавляем, если это наши ключи. */
  for (const key of Array.isArray(r.missing) ? r.missing : []) {
    if ((MISSING_KEYS as readonly string[]).includes(key as string)) {
      const k = key as MissingKey;
      /* Сайт знает лучше про то, что сам заполнил. */
      if (k === 'rate' && rate) continue;
      if (k === 'unit' && unitPlate) continue;
      if (k === 'client' && (client || !options.clients)) continue;
      if (!express && (k === 'deliveryAddress' || k === 'deliveryDate' || k === 'ldm')) continue;
      if (express && (k === 'unit' || k === 'returnAddress')) continue;
      missing.add(k);
    }
  }

  const conf = text(r.confidence, 6);
  return {
    haulKind,
    shipperRef,
    unitPlate,
    vehiclePlate,
    containerFeet,
    ldm,
    rate,
    currency,
    comment: commentText,
    pickup,
    delivery,
    extras,
    ret,
    client,
    filled,
    missing: MISSING_KEYS.filter((k) => missing.has(k)),
    confidence: conf === 'high' || conf === 'medium' || conf === 'low' ? conf : 'low',
    foreignPrice,
  };
}

/*
 * Буквы, которые на номере выглядят как латиница. Кириллица: диспетчер
 * набирает «АВС-123» в русской раскладке, а болгарские номера пишутся
 * этими буквами и официально. Греческие номера — только греческими
 * двойниками латиницы (ΑΒΕΖΗΙΚΜΝΟΡΤΥΧ).
 */
const LOOKALIKE: Record<string, string> = {
  А: 'A', В: 'B', Е: 'E', Ё: 'E', К: 'K', М: 'M', Н: 'H', О: 'O', Р: 'P', С: 'C', Т: 'T', У: 'Y', Х: 'X', І: 'I', Ј: 'J', Ѕ: 'S',
  Α: 'A', Β: 'B', Ε: 'E', Ζ: 'Z', Η: 'H', Ι: 'I', Κ: 'K', Μ: 'M', Ν: 'N', Ο: 'O', Ρ: 'P', Τ: 'T', Υ: 'Y', Χ: 'X',
};
const LOOKALIKE_RE = new RegExp(`[${Object.keys(LOOKALIKE).join('')}]`, 'g');

/*
 * Коды стран на номерах и наклейках — знаки Венской конвенции и ISO
 * 3166: все страны ЕС, ЕЭЗ и соседи, чьи машины ездят по региону.
 * «PL WX12345», «FIN ABC-123», «(D) HH-AB 1234», «GR ΙΚΒ-1234».
 * Снимаются, только если стоят отдельным словом перед номером.
 */
const PLATE_COUNTRY = new Set([
  /* ЕС: знак на машине и код ISO. */
  'A', 'AT', 'B', 'BE', 'BG', 'CY', 'CZ', 'D', 'DE', 'DK', 'E', 'ES', 'EST', 'EE', 'F', 'FR', 'FIN', 'FI',
  'GR', 'EL', 'H', 'HU', 'HR', 'I', 'IT', 'IRL', 'IE', 'L', 'LU', 'LT', 'LV', 'M', 'MT', 'NL', 'P', 'PT',
  'PL', 'RO', 'S', 'SE', 'SK', 'SLO', 'SI',
  /* ЕЭЗ, Швейцария, Британия. */
  'N', 'NO', 'IS', 'FL', 'LI', 'CH', 'GB', 'UK', 'NI',
  /* Соседи, чьи машины ездят по ЕС. */
  'UA', 'MD', 'BY', 'RUS', 'RU', 'SRB', 'RS', 'MNE', 'ME', 'BIH', 'BA', 'NMK', 'MK', 'AL', 'KS', 'TR', 'GE', 'AM', 'AZ', 'KZ',
]);

/**
 * Номер для сравнения: «abc-123», «ABC 123» и «ABC123» — одна машина.
 * Только буквы и цифры, в верхнем регистре, кириллические двойники
 * латинских букв заменены латиницей.
 */
export function plateKey(value: string | null | undefined): string {
  return (value ?? '')
    .toUpperCase()
    .replace(/[^\p{L}\p{N}]/gu, '')
    .replace(LOOKALIKE_RE, (ch) => LOOKALIKE[ch] ?? ch);
}

/**
 * Номер машины из заказа как его можно сравнить с парком: первый номер
 * сцепки («ABC-123/XYZ-987», «ABC-123 + XYZ-987» — тягач идёт первым)
 * и, отдельно, он же без кода страны впереди.
 */
export function plateCandidates(value: string | null | undefined): string[] {
  const first = (value ?? '').split(/\s*(?:[/+&,;]|\s-\s|\bja\b|\boch\b|\band\b|\sи\s)\s*/i)[0] ?? '';
  const words = first.replace(/[()]/g, ' ').trim().split(/\s+/).filter(Boolean);
  const out = [plateKey(first)];
  if (words.length > 1 && PLATE_COUNTRY.has(plateKey(words[0]))) out.push(plateKey(words.slice(1).join(' ')));
  return [...new Set(out.filter((k) => k.length >= 2))];
}

/** Машина парка, названная в заказе: сначала номер целиком, потом без кода страны. */
export function matchPlate<V extends { plate: string }>(value: string | null | undefined, vehicles: readonly V[]): V | null {
  for (const key of plateCandidates(value)) {
    const hit = vehicles.find((v) => plateKey(v.plate) === key);
    if (hit) return hit;
  }
  return null;
}

/** Есть ли в черновике хоть что-то, ради чего стоит открывать форму. */
export function draftIsEmpty(draft: OrderDraft): boolean {
  return !draft.pickup && !draft.delivery && !draft.ret && draft.extras.length === 0 && !draft.unitPlate && !draft.rate;
}

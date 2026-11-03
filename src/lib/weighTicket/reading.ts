/**
 * Весовой талон: что прочитано с фото и что из этого следует (3.11.2026).
 *
 * Модуль без сервера и без React: его зовут и серверное действие (разбор
 * ответа n8n), и формы водителя и диспетчера (проверки при правке полей),
 * и тесты (reading.test.mjs).
 *
 * Модели не верим в арифметике: веса пересчитываются из напечатанных
 * строк (gross_text…) с учётом единицы. Финские весы печатают и
 * «24 560 kg», и «24.560 kg» (точка — разделитель тысяч), и «24,56 t»
 * (запятая — десятичная). Перепутанный разделитель — ошибка в десять или
 * тысячу раз, ровно то, что талон и должен ловить.
 */

export type Confidence = 'high' | 'medium' | 'low';

export type TicketReading = {
  ticketNumber: string | null;
  /** YYYY-MM-DDTHH:MM или YYYY-MM-DD — местное время весов. */
  weighedAt: string | null;
  plates: string[];
  grossKg: number | null;
  tareKg: number | null;
  netKg: number | null;
  /** Единица, как напечатана: kg, t или не напечатана. */
  unit: 'kg' | 't' | null;
  material: string | null;
  materialCode: string | null;
  scaleName: string | null;
  customer: string | null;
  confidence: Confidence;
  notes: string | null;
};

/** Другая запись компании с тем же файлом или номером талона. */
export type DuplicatePhoto = { ticket_id: string; load_id: string | null; created_at: string; unloaded_at: string | null; job_name: string };
export type DuplicateTicket = {
  load_id: string;
  ticket_no: string;
  scale_site_id: string | null;
  scale_name: string | null;
  unloaded_at: string;
  net_kg: number | null;
  job_name: string;
};
export type Duplicates = { photo: DuplicatePhoto[]; ticket: DuplicateTicket[] };

/** Ответ чтения форме. status — что вышло с чтением; фото сохранено в любом случае. */
export type ReadResult =
  | {
      ok: true;
      ticketId: string;
      status: 'READ' | 'NOT_CONFIGURED' | 'FAILED';
      reading: TicketReading | null;
      duplicates: Duplicates;
    }
  | { ok: false; error: 'invalid' | 'denied' | 'failed' };

const MATERIAL_CODES = ['170504', '170506', '170503', '170107', '170302', '170904', 'SORA', 'MURSKE', 'HIEKKA', 'MULTA', 'LOUHE'];

const text = (value: unknown, max: number): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.replace(/\s+/g, ' ').trim();
  return trimmed ? trimmed.slice(0, max) : null;
};

/**
 * Напечатанное число → килограммы.
 *
 * kg: «24 560», «24.560», «24,560» с группами по три цифры — тысячи;
 * иначе запятая или точка — десятичная (бывает «24560,0»).
 * t: запятая или точка — десятичная; пробел — тысячи («1 024,5 t» не
 * встречается, но не ломается).
 * Без единицы: меньше 100 — тонны, иначе килограммы.
 */
export function parsePrintedWeight(raw: string | null | undefined, unit: 'kg' | 't' | null): number | null {
  if (typeof raw !== 'string') return null;
  const s = raw.replace(/[\s  ']/g, '').replace(/(kg|t|tn|tonnia)$/i, '');
  if (!/^\d+([.,]\d+)*$/.test(s)) return null;

  const grouped = /^\d{1,3}([.,]\d{3})+$/.test(s);
  const decimal = (value: string) => Number.parseFloat(value.replace(',', '.'));

  let kg: number;
  if (unit === 'kg') {
    kg = grouped ? Number.parseInt(s.replace(/[.,]/g, ''), 10) : decimal(s);
  } else if (unit === 't') {
    kg = decimal(s.replace(/[.,](?=.*[.,])/g, '')) * 1000;
  } else {
    const value = grouped ? Number.parseInt(s.replace(/[.,]/g, ''), 10) : decimal(s);
    kg = value < 100 ? value * 1000 : value;
  }
  return Number.isFinite(kg) && kg > 0 ? Math.round(kg) : null;
}

const kgOf = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) && value > 0 && value < 1_000_000 ? Math.round(value) : null;

/**
 * Ответ n8n → поля формы. Чужие и кривые поля отбрасываются: ответ
 * модели — данные, а не команда.
 */
export function sanitizeReading(raw: unknown): TicketReading | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const unit = r.unit === 'kg' || r.unit === 't' ? r.unit : null;

  /* Напечатанная строка надёжнее пересчёта модели; нет строки — берём её килограммы. */
  const weight = (textKey: string, kgKey: string) => parsePrintedWeight(r[textKey] as string | null, unit) ?? kgOf(r[kgKey]);

  const weighedAt = typeof r.weighed_at === 'string' && /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?$/.test(r.weighed_at.trim()) ? r.weighed_at.trim() : null;
  const plates = Array.isArray(r.plates)
    ? r.plates.map((p) => text(p, 20)).filter((p): p is string => p !== null).slice(0, 4)
    : [];
  const materialCode = typeof r.material_code === 'string' && MATERIAL_CODES.includes(r.material_code) ? r.material_code : null;
  const confidence: Confidence = r.confidence === 'high' || r.confidence === 'medium' ? r.confidence : 'low';

  return {
    ticketNumber: text(r.ticket_number, 60),
    weighedAt,
    plates,
    grossKg: weight('gross_text', 'gross_kg'),
    tareKg: weight('tare_text', 'tare_kg'),
    netKg: weight('net_text', 'net_kg'),
    unit,
    material: text(r.material, 80),
    materialCode,
    scaleName: text(r.scale_name, 120),
    customer: text(r.customer, 120),
    confidence,
    notes: text(r.notes, 300),
  };
}

/**
 * Брутто и тара для формы. Талон, где напечатаны брутто и нетто без тары,
 * — тара = брутто − нетто; нетто и тара без брутто — так же. Только нетто
 * — в форму не ложится (рейс хранит брутто и тару), это скажет проверка.
 */
export function formWeights(reading: Pick<TicketReading, 'grossKg' | 'tareKg' | 'netKg'>): { grossKg: number | null; tareKg: number | null } {
  const { grossKg, tareKg, netKg } = reading;
  if (grossKg && tareKg) return { grossKg, tareKg };
  if (grossKg && netKg && grossKg > netKg) return { grossKg, tareKg: grossKg - netKg };
  if (tareKg && netKg) return { grossKg: tareKg + netKg, tareKg };
  return { grossKg, tareKg };
}

/** Номер машины для сравнения: «ABC-123», «abc 123» и «ABC123» — одно. */
export function normPlate(value: string): string {
  return value.toUpperCase().replace(/[^0-9A-ZÅÄÖÜ]/g, '');
}

/** Номер талона для сравнения — как app.weigh_ticket_norm в базе. */
export function normTicket(value: string | null | undefined): string {
  return (value ?? '').toUpperCase().replace(/[^0-9A-ZÅÄÖÜ]/g, '');
}

const words = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFC')
    .split(/[^0-9a-zåäöüõšž]+/)
    .filter((w) => w.length >= 4 && !['vaaka', 'punnitus', 'kuitti', 'oy', 'ab'].includes(w));

/**
 * Весы из справочника по напечатанной шапке талона: «HSY Ämmässuo» →
 * «HSY Ämmässuo ekoteollisuuskeskus». Совпадение по словам от четырёх
 * букв; больше совпавших слов — лучше. Ничего — null, человек выберет.
 */
export function matchScaleSite<T extends { id: string; name: string; city?: string | null }>(name: string | null, sites: readonly T[]): T | null {
  if (!name) return null;
  const wanted = new Set(words(name));
  if (wanted.size === 0) return null;
  let best: T | null = null;
  let bestScore = 0;
  for (const site of sites) {
    const score = words(`${site.name} ${site.city ?? ''}`).filter((w) => wanted.has(w)).length;
    if (score > bestScore) {
      best = site;
      bestScore = score;
    }
  }
  return best;
}

/**
 * Время талона (местное время весов) → ISO. Пояс — как у дня на объекте
 * (Europe/Helsinki в базе). Без времени — null.
 */
export function weighedAtIso(weighedAt: string | null, timeZone = 'Europe/Helsinki'): string | null {
  if (!weighedAt || weighedAt.length < 16) return null;
  const asUtc = Date.parse(`${weighedAt}:00Z`);
  if (!Number.isFinite(asUtc)) return null;
  /* Смещение пояса в этот момент: то же время, показанное в поясе, минус UTC. */
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(new Date(asUtc));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '00';
  const shown = Date.parse(`${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}:00Z`);
  return new Date(asUtc - (shown - asUtc)).toISOString();
}

// ── Проверки ─────────────────────────────────────────────────────

export type TicketWarning =
  | { code: 'DUPLICATE_PHOTO'; at: string | null; job: string }
  | { code: 'DUPLICATE_TICKET'; ticketNo: string; at: string; job: string; scale: string | null }
  | { code: 'PLATE_MISMATCH'; read: string[]; expected: string[] }
  | { code: 'NET_MISMATCH'; grossKg: number; tareKg: number; netKg: number }
  | { code: 'NET_ONLY' }
  | { code: 'DECIMAL'; field: 'gross' | 'tare'; valueKg: number; suggestedKg: number }
  | { code: 'IMPLAUSIBLE'; field: 'gross' | 'tare' | 'net'; valueKg: number }
  | { code: 'OVER_PAYLOAD'; netKg: number; payloadKg: number }
  | { code: 'LOW_CONFIDENCE'; notes: string | null };

export type CheckInput = {
  /** Что сейчас в форме (после правки человеком). */
  grossKg: number | null;
  tareKg: number | null;
  ticketNo: string | null;
  scaleSiteId: string | null;
  /** Что прочитано с фото; null — фото не читалось. */
  reading: TicketReading | null;
  duplicates: Duplicates | null;
  /** Номера машины и прицепа этого рейса. */
  expectedPlates: string[];
  /** Предел массы сцепки и её тара, если известны (src/lib/fleet/mass.ts). */
  limitKg: number | null;
  comboTareKg: number | null;
};

/* Самосвал или сцепка: пустой — от 8 т, полный — до 80 т. Вне этого — не вес машины. */
const GROSS_RANGE = [8_000, 80_000] as const;
const TARE_RANGE = [6_000, 35_000] as const;

function inRange(kg: number, [low, high]: readonly [number, number]) {
  return kg >= low && kg <= high;
}

/**
 * Предупреждения по талону. Ничего не блокируют: человек видит и решает,
 * сохранять ли (форма просит второе нажатие).
 *
 * Порядок — от самого дорогого: повтор талона (двойная оплата), чужая
 * машина, арифметика, порядок величины, перегруз.
 */
export function ticketWarnings(input: CheckInput): TicketWarning[] {
  const out: TicketWarning[] = [];
  const { reading, duplicates } = input;

  for (const dup of duplicates?.photo ?? []) {
    out.push({ code: 'DUPLICATE_PHOTO', at: dup.unloaded_at ?? dup.created_at, job: dup.job_name });
    break;
  }

  const ticket = normTicket(input.ticketNo);
  if (ticket) {
    const same = (duplicates?.ticket ?? []).find(
      (dup) =>
        normTicket(dup.ticket_no) === ticket &&
        /* Разные весы — разные серии номеров. Весы неизвестны с одной из сторон — считаем повтором. */
        (!dup.scale_site_id || !input.scaleSiteId || dup.scale_site_id === input.scaleSiteId),
    );
    if (same) out.push({ code: 'DUPLICATE_TICKET', ticketNo: same.ticket_no, at: same.unloaded_at, job: same.job_name, scale: same.scale_name });
  }

  if (reading && reading.plates.length > 0 && input.expectedPlates.length > 0) {
    const expected = new Set(input.expectedPlates.map(normPlate));
    const foreign = reading.plates.filter((p) => !expected.has(normPlate(p)));
    if (foreign.length > 0) out.push({ code: 'PLATE_MISMATCH', read: foreign, expected: input.expectedPlates });
  }

  const { grossKg, tareKg } = input;
  if (reading?.netKg && reading.grossKg && reading.tareKg && Math.abs(reading.grossKg - reading.tareKg - reading.netKg) > 20) {
    out.push({ code: 'NET_MISMATCH', grossKg: reading.grossKg, tareKg: reading.tareKg, netKg: reading.netKg });
  }
  if (reading?.netKg && !reading.grossKg && !reading.tareKg && !grossKg && !tareKg) out.push({ code: 'NET_ONLY' });

  /*
   * Порядок величины. Верхняя граница — предел сцепки с запасом на
   * перегруз, нижняя — пустая машина. Вес вне границ, который ×10 или
   * ÷10 в них попадает, — почти наверняка сдвинутая запятая (2,45 т
   * вместо 24,5 т).
   */
  const grossRange: readonly [number, number] = [
    Math.max(GROSS_RANGE[0], input.comboTareKg ? Math.round(input.comboTareKg * 0.8) : 0),
    input.limitKg ? Math.round(input.limitKg * 1.3) : GROSS_RANGE[1],
  ];
  const magnitude = (field: 'gross' | 'tare', kg: number | null, range: readonly [number, number]) => {
    if (!kg || inRange(kg, range)) return;
    const fix = [kg * 10, kg / 10, kg * 1000, kg / 1000].find((v) => inRange(v, range));
    out.push(fix ? { code: 'DECIMAL', field, valueKg: kg, suggestedKg: Math.round(fix) } : { code: 'IMPLAUSIBLE', field, valueKg: kg });
  };
  magnitude('gross', grossKg, grossRange);
  magnitude('tare', tareKg, TARE_RANGE);

  if (grossKg && tareKg && grossKg <= tareKg) out.push({ code: 'IMPLAUSIBLE', field: 'net', valueKg: grossKg - tareKg });

  if (grossKg && tareKg && grossKg > tareKg && input.limitKg) {
    /* Грузоподъёмность сцепки: предел минус тара по техпаспортам, иначе минус тара с талона. */
    const payload = input.limitKg - (input.comboTareKg ?? tareKg);
    const net = grossKg - tareKg;
    if (payload > 0 && net > payload * 1.25) out.push({ code: 'OVER_PAYLOAD', netKg: net, payloadKg: payload });
  }

  if (reading && reading.confidence === 'low') out.push({ code: 'LOW_CONFIDENCE', notes: reading.notes });

  return out;
}

/**
 * Общие части XML-слоя eFTI: дерево элементов и его запись, даты в
 * форматах CL-020, нормализация текста под ограничения XSD и коды
 * справочников, которые мы используем.
 *
 * Схемы: Fintraffic platform-v1-schemas (semantic, eFTI Delegated Act
 * (EU) 2024/2024, v1.0). Копия — ./schemas/.
 */

import { escapeAttr, escapeText, stripInvalidXmlChars } from './escape';

// ── Пространства имён ──────────────────────────────────────────────────

export const NS = {
  /** Reusable Aggregate BIE — элементы набора и идентификаторов. */
  ram: 'urn:eu:move:eFTI:data:standard:ReusableAggregateBusinessInformationEntity:34',
  /** Unqualified Data Type — тут живёт DateTimeString. */
  udt: 'urn:eu:move:eFTI:data:standard:UnqualifiedDataType:34',
  uploadIdentifiers: 'http://efti.fi/v1/platform/upload-identifiers-request',
  cmdsResponse: 'http://efti.fi/v1/platform/cmds-response',
  followUp: 'http://efti.fi/v1/platform/follow-up-request',
} as const;

// ── Коды справочников ───────────────────────────────────────────────────

/** CL-037 (UNECE Rec. 19): 3 = автомобильный транспорт. */
export const TRANSPORT_MODE_ROAD = '3';

/**
 * CL-041 (UNECE Rec. 28): тип транспортного средства основного плеча.
 * 3100 = «Truck» (грузовой автомобиль; прицепы передаются отдельно как
 * transport equipment). Описаний CL-041 в пакете схем нет — код взят из
 * Rec. 28 и подлежит сверке с Fintraffic.
 */
export const TRANSPORT_MEANS_TYPE_TRUCK = '3100';

/** CL-058: 1 = есть опасный груз, 2 = нет (1a — есть, но с изъятием; модели изъятий у нас нет). */
export function dangerousGoodsCode(dangerous: boolean): '1' | '2' {
  return dangerous ? '1' : '2';
}

/**
 * CL-033 (UNECE 8053). В схемах прицепы и полуприцепы — «используемое»
 * оборудование (TE, SM), а контейнер (CN) допустим только как «перевозимое»
 * (CarriedAssociatedTransportEquipment / CarriedTransportEquipment…).
 */
export const EQUIPMENT_CATEGORY = {
  TRAILER: 'TE',
  SEMI_TRAILER: 'SM',
  CONTAINER: 'CN',
} as const;

/**
 * CL-029 (UNECE 3055) для schemeAgencyID, который XSD делает обязательным
 * у идентификаторов в наборе FTI010. Допустимые значения сильно сужены
 * схемой, поэтому выбор вынужденный — см. комментарии в cmds.ts.
 */
export const SCHEME_AGENCY = {
  /** Стороны (eFTI50/67/86): схема разрешает только 87 «Assigned by carrier». */
  party: '87',
  /** Номер машины (eFTI619): ZZZ «Mutually defined» — органа регистрации номеров в CL-029 нет. */
  vehiclePlate: 'ZZZ',
  /** Контейнер (eFTI449): 20 = BIC (ISO 6346). */
  container: '20',
  /**
   * Прицеп/полуприцеп (eFTI375): схема разрешает только 12 UIC, 20 BIC,
   * 501 ERA, 502 UIRR. Ближайшее для автоприцепа — 502 (UIRR ведёт коды
   * ILU для полуприцепов и сменных кузовов). Требует подтверждения Fintraffic.
   */
  trailer: '502',
} as const;

// ── Нормализация значений под XSD ───────────────────────────────────────

/** Текст (xs:string с maxLength): обрезка пробелов, схлопывание, обрезка по длине. Пусто → null. */
export function text(value: string | null | undefined, maxLength: number): string | null {
  if (value == null) return null;
  const clean = stripInvalidXmlChars(String(value)).replace(/\s+/g, ' ').trim();
  if (!clean) return null;
  const chars = Array.from(clean);
  return chars.length > maxLength ? chars.slice(0, maxLength).join('').trimEnd() : clean;
}

/**
 * Идентификатор (xs:token с maxLength). Длиннее предела — null:
 * обрезанный идентификатор хуже отсутствующего.
 */
export function token(value: string | null | undefined, maxLength: number): string | null {
  if (value == null) return null;
  const clean = stripInvalidXmlChars(String(value)).replace(/\s+/g, ' ').trim();
  if (!clean || Array.from(clean).length > maxLength) return null;
  return clean;
}

/** ISO 3166-1 alpha-2 (CL-017). Не код — null. */
export function country(value: string | null | undefined): string | null {
  if (!value) return null;
  const c = value.trim().toUpperCase();
  return /^[A-Z]{2}$/.test(c) ? c : null;
}

/** Десятичное число без экспоненты, не более `fraction` знаков после точки. */
export function decimal(value: number, fraction = 3): string {
  if (!Number.isFinite(value)) throw new Error('decimal: not a finite number');
  // totalDigits 16 у мер eFTI: 12 знаков целой части + 3 дробной с запасом.
  if (Math.abs(value) >= 1e12) throw new Error('decimal: out of range');
  const fixed = value.toFixed(fraction);
  return fixed.includes('.') ? fixed.replace(/\.?0+$/, '') : fixed;
}

// ── Даты (CL-020) ───────────────────────────────────────────────────────

/**
 * Часовой пояс страны. eFTI требует даты «в часовом поясе места» (погрузки,
 * принятия, доставки), а RAHTIS хранит моменты в UTC. Для стран с
 * несколькими поясами берём основной (материковый).
 */
const COUNTRY_TZ: Record<string, string> = {
  AL: 'Europe/Tirane', AT: 'Europe/Vienna', BA: 'Europe/Sarajevo', BE: 'Europe/Brussels',
  BG: 'Europe/Sofia', BY: 'Europe/Minsk', CH: 'Europe/Zurich', CY: 'Asia/Nicosia',
  CZ: 'Europe/Prague', DE: 'Europe/Berlin', DK: 'Europe/Copenhagen', EE: 'Europe/Tallinn',
  ES: 'Europe/Madrid', FI: 'Europe/Helsinki', FR: 'Europe/Paris', GB: 'Europe/London',
  GR: 'Europe/Athens', HR: 'Europe/Zagreb', HU: 'Europe/Budapest', IE: 'Europe/Dublin',
  IS: 'Atlantic/Reykjavik', IT: 'Europe/Rome', LI: 'Europe/Vaduz', LT: 'Europe/Vilnius',
  LU: 'Europe/Luxembourg', LV: 'Europe/Riga', MD: 'Europe/Chisinau', ME: 'Europe/Podgorica',
  MK: 'Europe/Skopje', MT: 'Europe/Malta', NL: 'Europe/Amsterdam', NO: 'Europe/Oslo',
  PL: 'Europe/Warsaw', PT: 'Europe/Lisbon', RO: 'Europe/Bucharest', RS: 'Europe/Belgrade',
  RU: 'Europe/Moscow', SE: 'Europe/Stockholm', SI: 'Europe/Ljubljana', SK: 'Europe/Bratislava',
  TR: 'Europe/Istanbul', UA: 'Europe/Kyiv',
};

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const ISO_DATETIME = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?(Z|[+-]\d{2}:?\d{2})$/;

type LocalParts = { date: string; time: string | null; offset: string | null };

/** Дата/время в часовом поясе страны места: YYYYMMDD, HHMM, ±HHMM. */
export function localParts(iso: string, placeCountry: string): LocalParts {
  const d = ISO_DATE.exec(iso);
  if (d) return { date: `${d[1]}${d[2]}${d[3]}`, time: null, offset: null };
  const m = ISO_DATETIME.exec(iso);
  const ms = m ? Date.parse(iso) : NaN;
  if (!m || Number.isNaN(ms)) throw new Error(`eFTI: not an ISO 8601 date-time with zone: ${iso}`);

  const tz = COUNTRY_TZ[placeCountry.toUpperCase()];
  if (tz) {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
      timeZoneName: 'longOffset',
    }).formatToParts(new Date(ms));
    const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
    const off = /^GMT([+-])(\d{2}):(\d{2})$/.exec(get('timeZoneName'));
    return {
      date: `${get('year')}${get('month')}${get('day')}`,
      time: `${get('hour')}${get('minute')}`,
      offset: off ? `${off[1]}${off[2]}${off[3]}` : '+0000',
    };
  }

  // Неизвестная страна — как записано во входной строке.
  const zone = m[7];
  const offset = zone === 'Z' ? '+0000' : zone.replace(':', '');
  return { date: `${m[1]}${m[2]}${m[3]}`, time: `${m[4]}${m[5]}`, offset };
}

/** CL-020 102 = CCYYMMDD. */
export function format102(iso: string, placeCountry: string): { format: '102'; value: string } {
  return { format: '102', value: localParts(iso, placeCountry).date };
}

/** CL-020 205 = CCYYMMDDHHMMZHHMM (Z — знак смещения); для голой даты — 102. */
export function format205(iso: string, placeCountry: string): { format: '102' | '205'; value: string } {
  const p = localParts(iso, placeCountry);
  if (!p.time || !p.offset) return { format: '102', value: p.date };
  return { format: '205', value: `${p.date}${p.time}${p.offset}` };
}

// ── Дерево элементов ────────────────────────────────────────────────────

export type XNode = {
  /** Имя с префиксом (ram:…, udt:…) или без него. */
  tag: string;
  attrs?: Record<string, string>;
  text?: string;
  kids?: XNode[];
  /**
   * Лист для фильтра подмножеств (BBIE eFTI): решение «оставить или нет»
   * принимается по пути до этого узла, его потомки (DateTimeString)
   * пишутся как есть.
   */
  leaf?: boolean;
};

/** Узел, если есть значение; иначе null (удобно для необязательных полей). */
export function leaf(tag: string, value: string | null, attrs?: Record<string, string>): XNode | null {
  return value == null ? null : { tag, text: value, attrs, leaf: true };
}

/** Агрегат: пустой (без потомков) — null. */
export function group(tag: string, kids: (XNode | null | undefined | false)[]): XNode | null {
  const list = kids.filter((k): k is XNode => !!k);
  return list.length ? { tag, kids: list } : null;
}

/** Дата-время eFTI: <tag><udt:DateTimeString format="…">…</udt:DateTimeString></tag>. */
export function dateTime(tag: string, v: { format: string; value: string } | null): XNode | null {
  if (!v) return null;
  return {
    tag,
    leaf: true,
    kids: [{ tag: 'udt:DateTimeString', attrs: { format: v.format }, text: v.value }],
  };
}

function localName(tag: string): string {
  const i = tag.indexOf(':');
  return i === -1 ? tag : tag.slice(i + 1);
}

/**
 * Запись узла. `keep(path)` решает судьбу листьев (path — локальные имена
 * от корня записи через «/», без самого корня); агрегат без оставшихся
 * потомков не пишется. Без `keep` пишется всё.
 */
export function render(node: XNode, keep?: (path: string) => boolean): string {
  const walk = (n: XNode, path: string, filtered: boolean): string | null => {
    if (filtered && n.leaf && keep && !keep(path)) return null;
    const childFiltered = filtered && !n.leaf;
    let inner = '';
    let anyKid = false;
    for (const k of n.kids ?? []) {
      const kp = path ? `${path}/${localName(k.tag)}` : localName(k.tag);
      const s = walk(k, kp, childFiltered);
      if (s !== null) {
        inner += s;
        anyKid = true;
      }
    }
    if (filtered && !n.leaf && n.kids && !anyKid) return null;
    const attrs = Object.entries(n.attrs ?? {})
      .map(([k, v]) => ` ${k}="${escapeAttr(v)}"`)
      .join('');
    const body = inner + (n.text != null ? escapeText(n.text) : '');
    return body ? `<${n.tag}${attrs}>${body}</${n.tag}>` : `<${n.tag}${attrs}/>`;
  };
  // Корень пишется всегда (даже пустым), фильтр — с его потомков.
  const attrs = Object.entries(node.attrs ?? {})
    .map(([k, v]) => ` ${k}="${escapeAttr(v)}"`)
    .join('');
  let inner = '';
  for (const k of node.kids ?? []) {
    const s = walk(k, localName(k.tag), keep !== undefined);
    if (s !== null) inner += s;
  }
  return inner ? `<${node.tag}${attrs}>${inner}</${node.tag}>` : `<${node.tag}${attrs}/>`;
}

export const XML_DECLARATION = '<?xml version="1.0" encoding="UTF-8"?>\n';

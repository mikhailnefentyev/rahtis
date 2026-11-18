/**
 * Минимальный безопасный разбор XML для входящих сообщений шлюза eFTI
 * (followUpRequest) и для генератора карты подмножеств.
 *
 * Без зависимостей и без «исполнения» документа:
 *  · DOCTYPE и любые объявления (<!ENTITY, <!ELEMENT …) — отказ (XXE,
 *    «billion laughs»);
 *  · ссылки на сущности — только пять встроенных XML и числовые &#…;;
 *  · внешние ресурсы не загружаются никогда;
 *  · ограничения на размер входа, глубину и число элементов.
 *
 * Не валидирующий: структуру проверяет вызывающий код (или XSD в тестах).
 */

export class XmlParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'XmlParseError';
  }
}

export type XmlElement = {
  /** Пространство имён элемента ('' — без пространства). */
  ns: string;
  /** Локальное имя без префикса. */
  local: string;
  /** Атрибуты без xmlns-объявлений; ключ — имя как в документе (без префикса, если его не было). */
  attrs: Record<string, string>;
  children: XmlElement[];
  /** Весь непосредственный текст элемента (включая CDATA), без потомков. */
  text: string;
};

export type ParseOptions = {
  /** Максимальная длина входа в символах (по умолчанию 25 млн). */
  maxLength?: number;
  maxDepth?: number;
  maxElements?: number;
};

const XML_NS = 'http://www.w3.org/XML/1998/namespace';

const NAME_START = /[A-Za-z_\u00C0-\uFFFF]/;
const NAME_CHAR = /[A-Za-z0-9_.\-\u00B7\u00C0-\uFFFF]/;

/** Разбирает документ и возвращает корневой элемент. Бросает XmlParseError. */
export function parseXml(input: string, opts: ParseOptions = {}): XmlElement {
  const maxLength = opts.maxLength ?? 25_000_000;
  const maxDepth = opts.maxDepth ?? 100;
  const maxElements = opts.maxElements ?? 500_000;

  if (typeof input !== 'string') throw new XmlParseError('input is not a string');
  if (input.length > maxLength) throw new XmlParseError('document too large');

  let s = input;
  if (s.charCodeAt(0) === 0xfeff) s = s.slice(1);

  let i = 0;
  let elements = 0;
  let root: XmlElement | null = null;
  const stack: { el: XmlElement; qname: string; scope: Map<string, string> }[] = [];
  let scope = new Map<string, string>([['xml', XML_NS]]);

  const fail = (msg: string): never => {
    throw new XmlParseError(`${msg} at offset ${i}`);
  };

  const readName = (): string => {
    const start = i;
    if (!NAME_START.test(s[i] ?? '')) fail('invalid name');
    i++;
    while (i < s.length && (NAME_CHAR.test(s[i]) || s[i] === ':')) i++;
    return s.slice(start, i);
  };

  const skipWs = () => {
    while (i < s.length && (s[i] === ' ' || s[i] === '\t' || s[i] === '\n' || s[i] === '\r')) i++;
  };

  const addText = (t: string) => {
    if (stack.length === 0) {
      if (t.trim() !== '') fail('text outside root element');
      return;
    }
    stack[stack.length - 1].el.text += t;
  };

  while (i < s.length) {
    const lt = s.indexOf('<', i);
    if (lt === -1) {
      addText(decodeText(s.slice(i), fail));
      i = s.length;
      break;
    }
    if (lt > i) addText(decodeText(s.slice(i, lt), fail));
    i = lt;

    if (s.startsWith('<?', i)) {
      const end = s.indexOf('?>', i + 2);
      if (end === -1) fail('unterminated processing instruction');
      i = end + 2;
      continue;
    }
    if (s.startsWith('<!--', i)) {
      const end = s.indexOf('-->', i + 4);
      if (end === -1) fail('unterminated comment');
      i = end + 3;
      continue;
    }
    if (s.startsWith('<![CDATA[', i)) {
      if (stack.length === 0) fail('CDATA outside root element');
      const end = s.indexOf(']]>', i + 9);
      if (end === -1) fail('unterminated CDATA');
      addText(s.slice(i + 9, end));
      i = end + 3;
      continue;
    }
    if (s.startsWith('<!', i)) {
      // <!DOCTYPE, <!ENTITY, <!ELEMENT … — никогда не принимаем.
      fail('DOCTYPE and markup declarations are not allowed');
    }
    if (s.startsWith('</', i)) {
      i += 2;
      const qname = readName();
      skipWs();
      if (s[i] !== '>') fail('malformed end tag');
      i++;
      const top = stack.pop();
      if (!top || top.qname !== qname) fail(`mismatched end tag </${qname}>`);
      scope = stack.length ? stack[stack.length - 1].scope : new Map([['xml', XML_NS]]);
      continue;
    }

    // Начальный тег.
    i++;
    const qname = readName();
    const rawAttrs: [string, string][] = [];
    let selfClosing = false;
    for (;;) {
      const before = i;
      skipWs();
      if (s[i] === '>') {
        i++;
        break;
      }
      if (s.startsWith('/>', i)) {
        i += 2;
        selfClosing = true;
        break;
      }
      if (i === before) fail('expected whitespace before attribute');
      const an = readName();
      skipWs();
      if (s[i] !== '=') fail('expected = after attribute name');
      i++;
      skipWs();
      const q = s[i];
      if (q !== '"' && q !== "'") fail('attribute value must be quoted');
      const end = s.indexOf(q, i + 1);
      if (end === -1) fail('unterminated attribute value');
      const raw = s.slice(i + 1, end);
      if (raw.includes('<')) fail('< in attribute value');
      if (rawAttrs.some(([n]) => n === an)) fail(`duplicate attribute ${an}`);
      rawAttrs.push([an, decodeText(raw, fail).replace(/[\t\n\r]/g, ' ')]);
      i = end + 1;
    }

    if (stack.length === 0 && root) fail('more than one root element');
    if (stack.length >= maxDepth) fail('document too deep');
    if (++elements > maxElements) fail('too many elements');

    let elScope = scope;
    const attrs: Record<string, string> = Object.create(null);
    for (const [an, av] of rawAttrs) {
      if (an === 'xmlns' || an.startsWith('xmlns:')) {
        if (elScope === scope) elScope = new Map(scope);
        elScope.set(an === 'xmlns' ? '' : an.slice(6), av);
      }
    }
    for (const [an, av] of rawAttrs) {
      if (an === 'xmlns' || an.startsWith('xmlns:')) continue;
      attrs[an] = av;
    }
    const colon = qname.indexOf(':');
    const prefix = colon === -1 ? '' : qname.slice(0, colon);
    const local = colon === -1 ? qname : qname.slice(colon + 1);
    const ns = elScope.get(prefix);
    if (ns === undefined) {
      if (prefix) fail(`undeclared namespace prefix ${prefix}`);
    }
    const el: XmlElement = { ns: ns ?? '', local, attrs, children: [], text: '' };

    if (stack.length) stack[stack.length - 1].el.children.push(el);
    else root = el;

    if (!selfClosing) {
      stack.push({ el, qname, scope: elScope });
      scope = elScope;
    }
  }

  if (stack.length) throw new XmlParseError(`unclosed element <${stack[stack.length - 1].qname}>`);
  if (!root) throw new XmlParseError('no root element');
  return root;
}

const PREDEFINED: Record<string, string> = { lt: '<', gt: '>', amp: '&', quot: '"', apos: "'" };

function decodeText(t: string, fail: (msg: string) => never): string {
  if (!t.includes('&')) return t;
  return t.replace(/&([^;&\s]{0,32});?/g, (m, body: string) => {
    if (!m.endsWith(';')) fail('bare & in text');
    if (body.startsWith('#x') || body.startsWith('#X')) {
      const code = /^[0-9a-fA-F]{1,6}$/.test(body.slice(2)) ? parseInt(body.slice(2), 16) : NaN;
      return fromCode(code, fail);
    }
    if (body.startsWith('#')) {
      const code = /^[0-9]{1,7}$/.test(body.slice(1)) ? parseInt(body.slice(1), 10) : NaN;
      return fromCode(code, fail);
    }
    const v = PREDEFINED[body];
    if (v === undefined) fail(`unknown entity &${body};`);
    return v;
  });
}

function fromCode(code: number, fail: (msg: string) => never): string {
  if (
    !Number.isInteger(code) ||
    code > 0x10ffff ||
    (code < 0x20 && code !== 0x9 && code !== 0xa && code !== 0xd) ||
    (code >= 0xd800 && code <= 0xdfff) ||
    code === 0xfffe ||
    code === 0xffff
  ) {
    fail('invalid character reference');
  }
  return String.fromCodePoint(code);
}

/** Дочерние элементы с данным пространством и локальным именем. */
export function childrenNamed(el: XmlElement, ns: string, local: string): XmlElement[] {
  return el.children.filter((c) => c.ns === ns && c.local === local);
}

/** Первый дочерний элемент с данным пространством и локальным именем. */
export function childNamed(el: XmlElement, ns: string, local: string): XmlElement | undefined {
  return el.children.find((c) => c.ns === ns && c.local === local);
}

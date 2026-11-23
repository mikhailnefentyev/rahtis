/**
 * Договор страны как список блоков (23.11.2026). Текст договора Эстонии и
 * Латвии собирается здесь, без React и без сервера: его проверяют тесты
 * (contractText.test.mjs), а печатает один компонент — CountryContractPdf.tsx.
 * Финский договор остаётся в ContractPdf.tsx и этим модулем не пользуется.
 */
import type { ContractPdfInput } from '../ContractPdf.tsx';

export type ContractBlock =
  /** Заголовок договора. */
  | { kind: 'title'; text: string }
  /** Оговорка о сохранении права собственности — крупнее остального текста, в рамке. */
  | { kind: 'notice'; text: string }
  /** Номер и дата под заголовком. */
  | { kind: 'meta'; text: string }
  /** Заголовок раздела. */
  | { kind: 'h'; text: string }
  /** Подзаголовок внутри раздела (4.1, 4.2…). */
  | { kind: 'sub'; text: string }
  | { kind: 'p'; text: string }
  /** Пункт перечня внутри абзаца: с отступом. */
  | { kind: 'li'; text: string }
  /** Строка таблицы «название — значение»; strong — жирная строка итога. */
  | { kind: 'kv'; k: string; v: string; strong?: boolean }
  /** Две стороны рядом; первая строка каждой — жирная. */
  | { kind: 'parties'; left: string[]; right: string[] }
  /** Места для подписей. */
  | { kind: 'sign'; left: string[]; right: string[] }
  /** Заголовок приложения. */
  | { kind: 'annex'; text: string }
  /** Таблица графика: шапка, строки, жирная строка итога. */
  | { kind: 'table'; head: string[]; rows: string[][]; foot: string[] };

export type ContractDocument = {
  /** Название документа в свойствах PDF. */
  title: string;
  author: string;
  /** Строка внизу каждой страницы. */
  footer: string;
  /** Страницы: договор, затем приложения. */
  pages: ContractBlock[][];
};

export type ContractTextBuilder = (d: ContractPdfInput) => ContractDocument;

/** Сумма без знака валюты: в тексте договора валюта названа словом («eurot», «EUR»). */
export const bare = (money: string) => money.replace(/[\s  ]*€[\s  ]*/g, '').trim();

export const BLANK = '______________';
export const LONG_BLANK = '______________________________';

export const p = (text: string): ContractBlock => ({ kind: 'p', text });
export const li = (text: string): ContractBlock => ({ kind: 'li', text });
export const h = (text: string): ContractBlock => ({ kind: 'h', text });
export const sub = (text: string): ContractBlock => ({ kind: 'sub', text });
export const kv = (k: string, v: string, strong = false): ContractBlock => ({ kind: 'kv', k, v, strong });

/** Весь текст документа одной строкой — для проверок в тестах. */
export function contractPlainText(doc: ContractDocument): string {
  const out: string[] = [];
  for (const page of doc.pages) {
    for (const b of page) {
      if (b.kind === 'kv') out.push(`${b.k}: ${b.v}`);
      else if (b.kind === 'parties' || b.kind === 'sign') out.push(...b.left, ...b.right);
      else if (b.kind === 'table') out.push(b.head.join(' | '), ...b.rows.map((r) => r.join(' | ')), b.foot.join(' | '));
      else out.push(b.text);
    }
  }
  return out.join('\n');
}

/*
 * Заказ из пересланного письма (6.11.2026): адрес, отправитель, подпись.
 *
 * Чистый модуль без '@/' — его гоняет node --test. Сеть и база — в
 * receive.ts.
 */

import { createHmac, timingSafeEqual } from 'node:crypto';

export const INBOX_PREFIX = 'orders-';
const TOKEN = /^[a-z0-9]{12,32}$/;

/** «Имя <a@b.fi>» или «a@b.fi» → «a@b.fi» в нижнем регистре; не адрес — ''. */
export function bareAddress(value: string): string {
  const angle = /<([^<>\s]+@[^<>\s]+)>/.exec(value);
  const raw = (angle ? angle[1] : value).trim().toLowerCase();
  return /^[^@\s<>,;"]+@[^@\s<>,;"]+\.[a-z]{2,}$/.test(raw) ? raw : '';
}

export function inboxAddress(token: string, domain: string): string {
  return `${INBOX_PREFIX}${token}@${domain.toLowerCase()}`;
}

/** Токен из первого получателя вида orders-<token>@<domain>; чужой домен и мусор — null. */
export function inboxToken(recipients: readonly string[], domain: string): string | null {
  const host = domain.trim().toLowerCase();
  for (const value of recipients) {
    const address = bareAddress(value);
    const at = address.lastIndexOf('@');
    if (at < 0 || address.slice(at + 1) !== host) continue;
    const local = address.slice(0, at);
    if (!local.startsWith(INBOX_PREFIX)) continue;
    const token = local.slice(INBOX_PREFIX.length);
    if (TOKEN.test(token)) return token;
  }
  return null;
}

/**
 * Письмо принимается только от входов компании и её дополнительных
 * адресов: иначе любой, узнавший адрес, подкладывал бы черновики.
 */
export function senderAllowed(from: string, members: readonly string[], extra: readonly string[]): boolean {
  const sender = bareAddress(from);
  if (!sender) return false;
  return [...members, ...extra].some((a) => bareAddress(a) === sender);
}

export type MailAuth = { spf?: string | null; dkim?: string | null; dmarc?: string | null } | null | undefined;

/**
 * Поле From подделать просто — нужна проверка домена отправителя.
 * DMARC fail — отказ; иначе нужен хотя бы один pass (SPF или DKIM).
 * Нет результатов вовсе (старые письма провайдера) — тоже отказ.
 */
export function senderAuthenticated(auth: MailAuth): boolean {
  if (!auth) return false;
  if (auth.dmarc === 'fail') return false;
  return auth.dmarc === 'pass' || auth.dkim === 'pass' || auth.spf === 'pass';
}

/** Список адресов из поля настройки: запятые, пробелы, строки. */
export function parseSenderList(input: string): { list: string[]; invalid: string[] } {
  const parts = input.split(/[\s,;]+/).map((s) => s.trim()).filter(Boolean);
  const list: string[] = [];
  const invalid: string[] = [];
  for (const part of parts) {
    const address = bareAddress(part);
    if (!address) invalid.push(part);
    else if (!list.includes(address)) list.push(address);
  }
  return { list, invalid };
}

/**
 * Подпись вебхука (Svix: заголовки svix-id, svix-timestamp,
 * svix-signature). Секрет whsec_<base64>; подпись — base64 HMAC-SHA256
 * от `${id}.${timestamp}.${body}`; в заголовке может быть несколько
 * «v1,<sig>» через пробел. Окно — 5 минут в обе стороны.
 */
export function verifySvix(input: {
  secret: string;
  id: string | null;
  timestamp: string | null;
  signature: string | null;
  body: string;
  now?: number;
  toleranceSec?: number;
}): boolean {
  const { id, timestamp, signature, body } = input;
  if (!id || !timestamp || !signature || !input.secret) return false;
  if (!/^\d{1,12}$/.test(timestamp)) return false;
  const now = Math.floor((input.now ?? Date.now()) / 1000);
  if (Math.abs(now - Number(timestamp)) > (input.toleranceSec ?? 300)) return false;

  const key = Buffer.from(input.secret.startsWith('whsec_') ? input.secret.slice(6) : input.secret, 'base64');
  if (key.length === 0) return false;
  const expected = createHmac('sha256', key).update(`${id}.${timestamp}.${body}`).digest();

  for (const part of signature.split(' ')) {
    const [version, value] = part.split(',', 2);
    if (version !== 'v1' || !value) continue;
    const given = Buffer.from(value, 'base64');
    if (given.length === expected.length && timingSafeEqual(given, expected)) return true;
  }
  return false;
}

export type AttachmentMeta = { id: string; filename: string; content_type: string; size: number };

export const ATTACHMENT_MAX_BYTES = 4 * 1024 * 1024;
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

/**
 * Разбору уходит один файл: первый PDF, иначе первый снимок. Больше 4 МБ
 * и прочие типы (doc, zip, exe) не берутся.
 */
export function pickAttachment<T extends AttachmentMeta>(list: readonly T[]): T | null {
  const fits = (a: T) => a.size > 0 && a.size <= ATTACHMENT_MAX_BYTES;
  const type = (a: T) => a.content_type.toLowerCase().split(';')[0].trim();
  return (
    list.find((a) => fits(a) && (type(a) === 'application/pdf' || a.filename.toLowerCase().endsWith('.pdf'))) ??
    list.find((a) => fits(a) && IMAGE_TYPES.includes(type(a))) ??
    null
  );
}

/** Текст письма для разбора: text, иначе html без разметки. */
export function mailText(input: { subject: string; text?: string | null; html?: string | null }, max = 30_000): string {
  let body = (input.text ?? '').trim();
  if (!body && input.html) {
    body = input.html
      .replace(/<(style|script|head)[^>]*>[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<br\s*\/?>|<\/(p|div|tr|li|h\d)>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/[ \t]+/g, ' ')
      .replace(/\n\s*\n+/g, '\n\n')
      .trim();
  }
  const subject = input.subject.trim();
  return (subject ? `Subject: ${subject}\n\n${body}` : body).slice(0, max);
}

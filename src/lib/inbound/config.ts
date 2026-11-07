import 'server-only';

import { resendApiKey } from '@/lib/email/config';
import { inboxAddress } from './email';

/**
 * Приём писем включён тремя переменными: INBOUND_EMAIL_DOMAIN (in.rahtis.eu),
 * RESEND_INBOUND_WEBHOOK_SECRET (whsec_… вебхука email.received) и
 * ключ API Resend с полным доступом (тело и вложения письма берутся через
 * API). Ключ — RESEND_INBOUND_API_KEY, а если его нет — RESEND_API_KEY:
 * ключ отправки обычно «только отправка», и чтение входящих ему закрыто,
 * поэтому для приёма заводится отдельный, а рабочая отправка не трогается.
 * Нет любой — адрес в кабинете не показывается, вебхук отвечает 503.
 */
export function inboundConfig(): { domain: string; secret: string; apiKey: string } | null {
  const domain = process.env.INBOUND_EMAIL_DOMAIN?.trim().toLowerCase();
  const secret = process.env.RESEND_INBOUND_WEBHOOK_SECRET?.trim();
  const apiKey = process.env.RESEND_INBOUND_API_KEY?.trim() || resendApiKey();
  if (!domain || !secret || !apiKey) return null;
  return { domain, secret, apiKey };
}

/** Адрес компании для показа; приём выключен — null. */
export function inboxAddressFor(token: string | null | undefined): string | null {
  const config = inboundConfig();
  return config && token ? inboxAddress(token, config.domain) : null;
}

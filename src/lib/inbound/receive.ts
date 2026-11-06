import 'server-only';

import { siteUrl } from '@/lib/config';
import { operatorInbox, sendEmail } from '@/lib/email';
import { orderEmailReceivedEmail } from '@/lib/email/templates/orderEmailReceived';
import { emailLocaleOf } from '@/lib/email/text';
import { isLocale } from '@/lib/i18n';
import { importHints, readOrderDraft } from '@/lib/orders/importServer';
import { createAdminClient } from '@/lib/supabase/admin';
import type { Json } from '@/types/database';
import { ATTACHMENT_MAX_BYTES, bareAddress, inboxToken, mailText, pickAttachment, senderAllowed, senderAuthenticated, type MailAuth } from './email';

/*
 * Приём пересланного письма (вебхук Resend email.received).
 *
 * accept — быстро, до ответа вебхуку: чей адрес, вправе ли отправитель,
 * не повтор ли. Строка PENDING пишется сразу: повтор вебхука упрётся в
 * (company_id, message_id). process — после ответа (after): тело и
 * вложение из API Resend, разбор n8n, черновик, подтверждение.
 * Тело письма и файл живут только в памяти этого запуска.
 */

/** Не больше писем на компанию за сутки: разбор стоит денег. */
const DAILY_LIMIT = 50;

export type ReceivedEvent = {
  type?: string;
  data?: {
    email_id?: string;
    from?: string;
    to?: string[];
    cc?: string[];
    received_for?: string[];
    message_id?: string;
    subject?: string;
    created_at?: string;
  };
};

type Target = {
  company_id: string;
  kind: 'SHIPPER' | 'CARRIER';
  country: string | null;
  language: string | null;
  own_access: boolean;
  allowed: string[];
  members: string[];
};

export type Accepted = { draftId: string; emailId: string; from: string; subject: string; target: Target };

const list = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);

/** null — письмо не наше или не принято (молча: отправителю ничего не сообщаем). */
export async function acceptInbound(event: ReceivedEvent, domain: string): Promise<Accepted | null> {
  if (event.type !== 'email.received' || !event.data?.email_id) return null;
  const data = event.data;
  const emailId = String(data.email_id);

  const token = inboxToken([...list(data.received_for), ...list(data.to), ...list(data.cc)], domain);
  if (!token) {
    console.warn('inbound: нет адреса orders-…, письмо пропущено', emailId);
    return null;
  }

  const admin = createAdminClient();
  const { data: raw, error } = await admin.rpc('inbound_order_target', { p_token: token });
  if (error) throw new Error(`inbound_order_target: ${error.message}`);
  const target = raw as Target | null;
  if (!target?.company_id) {
    console.warn('inbound: неизвестный или закрытый адрес, письмо пропущено', emailId);
    return null;
  }

  const from = bareAddress(String(data.from ?? ''));
  if (!senderAllowed(from, list(target.members), list(target.allowed))) {
    console.warn('inbound: отправитель не из компании, письмо пропущено', emailId, target.company_id);
    return null;
  }

  const since = new Date(Date.now() - 86_400_000).toISOString();
  const { count } = await admin
    .from('order_email_drafts')
    .select('id', { count: 'exact', head: true })
    .eq('company_id', target.company_id)
    .gte('created_at', since);
  if ((count ?? 0) >= DAILY_LIMIT) {
    console.warn('inbound: суточный предел компании, письмо пропущено', emailId, target.company_id);
    return null;
  }

  const subject = String(data.subject ?? '').replace(/\s+/g, ' ').trim().slice(0, 300);
  const messageId = String(data.message_id ?? '').trim().slice(0, 500) || `resend:${emailId}`;
  const { data: rows, error: insertError } = await admin
    .from('order_email_drafts')
    .upsert(
      {
        company_id: target.company_id,
        message_id: messageId,
        provider_email_id: emailId,
        from_address: from,
        subject,
        received_at: data.created_at && !Number.isNaN(Date.parse(data.created_at)) ? data.created_at : new Date().toISOString(),
      },
      { onConflict: 'company_id,message_id', ignoreDuplicates: true },
    )
    .select('id');
  if (insertError) throw new Error(`order_email_drafts: ${insertError.message}`);
  const draftId = rows?.[0]?.id;
  if (!draftId) {
    console.info('inbound: повтор письма, пропущено', emailId);
    return null;
  }

  return { draftId, emailId, from, subject, target };
}

async function resend<T>(path: string, apiKey: string): Promise<T> {
  const response = await fetch(`https://api.resend.com${path}`, {
    headers: { authorization: `Bearer ${apiKey}` },
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error(`Resend ${path}: HTTP ${response.status}`);
  return (await response.json()) as T;
}

type ReceivedEmail = {
  from?: string;
  subject?: string;
  text?: string | null;
  html?: string | null;
  authentication?: MailAuth;
  attachments?: { id: string; filename?: string; content_type?: string; size?: number }[];
};

type AttachmentList = {
  data?: { id: string; filename?: string; content_type?: string; size?: number; download_url?: string }[];
};

/** Файл по ссылке Resend, не больше предела — и по заголовку, и по факту. */
async function download(url: string): Promise<ArrayBuffer | null> {
  if (!url.startsWith('https://')) return null;
  const response = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  if (!response.ok) return null;
  const length = Number(response.headers.get('content-length') ?? 0);
  if (length > ATTACHMENT_MAX_BYTES) return null;
  const bytes = await response.arrayBuffer();
  return bytes.byteLength > ATTACHMENT_MAX_BYTES ? null : bytes;
}

export async function processInbound(accepted: Accepted, apiKey: string): Promise<void> {
  const admin = createAdminClient();
  const { draftId, emailId, target } = accepted;
  const carrier = target.kind === 'CARRIER';

  const finish = (status: 'PARSED' | 'FAILED', draft: Json | null = null) =>
    admin
      .from('order_email_drafts')
      .update({ status, draft, updated_at: new Date().toISOString() })
      .eq('id', draftId)
      .eq('status', 'PENDING');

  let parsed = false;
  /* Пока домен отправителя не проверен, письма как бы нет: ни черновика, ни ответа. */
  let authenticated = false;
  try {
    const email = await resend<ReceivedEmail>(`/emails/receiving/${encodeURIComponent(emailId)}`, apiKey);

    /* From подделывается легко: домен отправителя должен пройти проверку, и адрес — тот же, что в вебхуке. */
    if (!senderAuthenticated(email.authentication) || bareAddress(String(email.from ?? '')) !== accepted.from) {
      console.warn('inbound: проверка домена отправителя не пройдена, черновик удалён', emailId);
      await admin.from('order_email_drafts').delete().eq('id', draftId);
      return;
    }
    authenticated = true;

    if (!target.own_access) {
      await finish('FAILED');
    } else {
      let file: { name: string; mime: string; bytes: ArrayBuffer } | null = null;
      if ((email.attachments ?? []).length > 0) {
        const attachments = await resend<AttachmentList>(`/emails/receiving/${encodeURIComponent(emailId)}/attachments?limit=20`, apiKey);
        const meta = (attachments.data ?? []).map((a) => ({
          id: a.id,
          filename: a.filename ?? 'file',
          content_type: a.content_type ?? '',
          size: a.size ?? 0,
          download_url: a.download_url ?? '',
        }));
        const pick = pickAttachment(meta);
        const bytes = pick ? await download(pick.download_url) : null;
        if (pick && bytes) {
          const pdf = pick.content_type.toLowerCase().startsWith('application/pdf') || pick.filename.toLowerCase().endsWith('.pdf');
          file = { name: pick.filename, mime: pdf ? 'application/pdf' : pick.content_type.toLowerCase().split(';')[0].trim(), bytes };
        }
      }

      const text = mailText({ subject: accepted.subject, text: email.text, html: email.html });
      const { data: clients } = carrier
        ? await admin.from('companies').select('id, name, business_id').eq('client_of', target.company_id).limit(500)
        : { data: null };
      const places = await importHints(admin, {
        shipperIds: carrier ? (clients ?? []).map((c) => c.id) : [target.company_id],
      });

      const result = text.trim() || file
        ? await readOrderDraft({ text, file, carrier, country: target.country ?? 'FI', clients: clients ?? null, places })
        : ({ ok: false, reason: 'empty' } as const);
      if (result.ok) {
        parsed = true;
        await finish('PARSED', result.draft as unknown as Json);
      } else {
        console.warn('inbound: разбор не удался:', result.reason, emailId);
        await finish('FAILED');
      }
    }
  } catch (cause) {
    console.error('inbound: письмо не обработано:', cause instanceof Error ? cause.message : cause);
    if (!authenticated) {
      /* Отправитель не подтверждён — следов не оставляем и не отвечаем. */
      await admin.from('order_email_drafts').delete().eq('id', draftId);
      return;
    }
    await finish('FAILED');
  }

  /* Подтверждение отправителю — с ссылкой прямо на форму. */
  const locale = isLocale(target.language ?? '') ? (target.language as string) : 'fi';
  const path = carrier ? 'carrier/own' : 'shipper/orders';
  await sendEmail(
    orderEmailReceivedEmail({
      to: accepted.from,
      locale: emailLocaleOf(target.language),
      subject: accepted.subject,
      parsed,
      link: `${siteUrl()}/${locale}/${path}?new=1&email=${draftId}`,
      operatorEmail: operatorInbox(),
      companyId: target.company_id,
    }),
  );
}

import 'server-only';

import { siteUrl } from '@/lib/config';
import { todayInHelsinki } from '@/lib/dates';
import { operatorInbox, sendEmail } from '@/lib/email';
import { renderEmail, renderText } from '@/lib/email/layout';
import { emailLocaleOf, emailText } from '@/lib/email/text';
import { freightReminderContent, siteReminderText } from '@/lib/email/templates/trustQuickWins';
import { createFormat } from '@/lib/format';
import { createAdminClient } from '@/lib/supabase/admin';
import type { Json } from '@/types/database';
import { reminderAction } from './schedule';

export type InvoiceReminderResult = { checked: number; emails: number; collections: number; errors: string[] };

type Admin = ReturnType<typeof createAdminClient>;
type StepPatch = { reminder_1_at?: string; reminder_2_at?: string; collection_hint_at?: string };

/*
 * Ежедневный запуск (/api/reminders/certificates): неоплаченные счета
 * после срока. Письмо 1 — на следующий день, 2 — через 7 дней; на 14-й
 * день — уведомление перевозчику о взыскании и заготовка отметки «не
 * оплачен» по рейсу. Каждый шаг сначала отмечается в строке счёта
 * («где пусто») — второй параллельный запуск его не повторит.
 */
export async function sendInvoiceReminders(now: Date = new Date()): Promise<InvoiceReminderResult> {
  const result: InvoiceReminderResult = { checked: 0, emails: 0, collections: 0, errors: [] };
  const admin = createAdminClient();
  const today = todayInHelsinki(now);
  await freightReminders(admin, today, result);
  await siteReminders(admin, today, result);
  return result;
}

/** Отметить шаг в строке; true — отметили мы (никто не успел раньше). */
async function claim(
  admin: Admin,
  table: 'freight_invoices' | 'carrier_invoices',
  id: string,
  column: 'reminder_1_at' | 'reminder_2_at' | 'collection_hint_at',
  extra: StepPatch = {},
): Promise<boolean> {
  const stamp = new Date().toISOString();
  const patch: StepPatch = { ...extra, [column]: stamp };
  const { data, error } = await admin
    .from(table)
    .update(patch)
    .eq('id', id)
    .is(column, null)
    .is('paid_at', null)
    .select('id');
  return !error && (data?.length ?? 0) > 0;
}

/** Уведомление перевозчику в кабинете (код события — фразу собирает словарь). */
async function notifyCarrier(admin: Admin, companyId: string, params: Record<string, string>, link: string) {
  const { error } = await admin
    .from('notifications')
    .insert({ company_id: companyId, kind: 'BILLING', code: 'invoice.collection', params: params as Json, link });
  if (error) console.error('уведомление о взыскании не записано:', error.message);
}

async function freightReminders(admin: Admin, today: string, result: InvoiceReminderResult) {
  const { data: invoices, error } = await admin
    .from('freight_invoices')
    .select('*')
    .is('paid_at', null)
    .lt('due_on', today)
    .order('due_on')
    .limit(500);
  if (error) {
    if (error.code !== '42P01' && error.code !== 'PGRST205') result.errors.push(`freight: ${error.message}`);
    return;
  }
  if (!invoices || invoices.length === 0) return;

  const companyIds = [...new Set(invoices.flatMap((i) => [i.carrier_company_id, i.shipper_company_id]))];
  const [{ data: companies }, { data: orders }] = await Promise.all([
    admin.from('companies').select('id, name, legal_name, language, billing_email, contact_email').in('id', companyIds),
    admin.from('orders').select('id, ref').in('id', invoices.map((i) => i.order_id)),
  ]);
  const company = new Map((companies ?? []).map((c) => [c.id, c]));
  const refOf = new Map((orders ?? []).map((o) => [o.id, o.ref]));

  for (const inv of invoices) {
    result.checked += 1;
    const action = reminderAction(
      {
        dueOn: inv.due_on,
        paid: false,
        reminder1: Boolean(inv.reminder_1_at),
        reminder2: Boolean(inv.reminder_2_at),
        collectionHint: Boolean(inv.collection_hint_at),
      },
      today,
    );
    const carrier = company.get(inv.carrier_company_id);
    const shipper = company.get(inv.shipper_company_id);
    if (!carrier || !shipper) continue;
    const ref = refOf.get(inv.order_id) ?? '';

    if (action.email) {
      const stamp = new Date().toISOString();
      const ok = await claim(
        admin,
        'freight_invoices',
        inv.id,
        action.email === 2 ? 'reminder_2_at' : 'reminder_1_at',
        action.email === 2 && !inv.reminder_1_at ? { reminder_1_at: stamp } : {},
      );
      if (ok) {
        const locale = emailLocaleOf(shipper.language);
        const mail = emailText(locale);
        const f = createFormat(locale === 'fi' ? 'fi-FI' : 'en-GB');
        const carrierName = carrier.legal_name || carrier.name;
        const content = freightReminderContent(locale, {
          stage: action.email,
          carrier: carrierName,
          number: inv.number,
          dueOn: f.date(`${inv.due_on}T12:00:00Z`),
          amount: f.money(inv.amount_cents, inv.currency),
          orderRef: ref,
          link: `${siteUrl()}/${locale}/shipper/done#invoices`,
        });
        const operator = operatorInbox();
        const sent = await sendEmail({
          template: `freight_invoice.reminder_${action.email}`,
          to: inv.send_to,
          toName: shipper.name,
          /* Ответ на напоминание — перевозчику: долг его, не наш. */
          replyTo: carrier.billing_email || carrier.contact_email,
          subject: content.subject,
          text: renderText({ heading: content.heading, blocks: content.blocks, operatorEmail: operator, signature: mail.signature, neverAsk: mail.neverAsk }),
          html: renderEmail({
            heading: content.heading,
            preheader: content.preheader,
            blocks: content.blocks,
            operatorEmail: operator,
            tagline: mail.brandTagline,
            neverAsk: mail.neverAsk,
          }),
          companyId: inv.shipper_company_id,
        });
        if (sent.sent) result.emails += 1;
      }
    }

    if (action.collection && (await claim(admin, 'freight_invoices', inv.id, 'collection_hint_at'))) {
      result.collections += 1;
      await notifyCarrier(admin, inv.carrier_company_id, { number: inv.number, ref }, '/carrier/done');
      /* Заготовка отметки «не оплачен» — только если своей у перевозчика нет; он её правит. */
      const { data: existing } = await admin.from('direct_payment_reports').select('id').eq('order_id', inv.order_id).maybeSingle();
      if (!existing) {
        const { error: reportError } = await admin.from('direct_payment_reports').insert({
          order_id: inv.order_id,
          carrier_company_id: inv.carrier_company_id,
          shipper_company_id: inv.shipper_company_id,
          status: 'UNPAID',
          prefilled: true,
        });
        if (reportError && reportError.code !== '23505') result.errors.push(`${inv.id}: ${reportError.message}`);
      }
    }
  }
}

type Party = { name?: string; iban?: string; email?: string };

async function siteReminders(admin: Admin, today: string, result: InvoiceReminderResult) {
  const { data: invoices, error } = await admin
    .from('carrier_invoices')
    .select('id, company_id, job_id, number, reference, due_on, total_cents, currency, seller, sent_to, sent_at, reminder_1_at, reminder_2_at, collection_hint_at')
    .is('paid_at', null)
    .not('sent_at', 'is', null)
    .lt('due_on', today)
    .order('due_on')
    .limit(500);
  if (error) {
    if (error.code !== '42703') result.errors.push(`site: ${error.message}`);
    return;
  }
  if (!invoices || invoices.length === 0) return;

  const jobIds = [...new Set(invoices.map((i) => i.job_id).filter((id): id is string => Boolean(id)))];
  const { data: jobs } = jobIds.length
    ? await admin.from('site_jobs').select('id, name').in('id', jobIds)
    : { data: [] as { id: string; name: string }[] };
  const jobName = new Map((jobs ?? []).map((j) => [j.id, j.name]));
  const f = createFormat('fi-FI');

  for (const inv of invoices) {
    result.checked += 1;
    const action = reminderAction(
      {
        dueOn: inv.due_on,
        paid: false,
        reminder1: Boolean(inv.reminder_1_at),
        reminder2: Boolean(inv.reminder_2_at),
        collectionHint: Boolean(inv.collection_hint_at),
      },
      today,
    );
    const seller = (inv.seller ?? {}) as Party;

    if (action.email && inv.sent_to) {
      const stamp = new Date().toISOString();
      const ok = await claim(
        admin,
        'carrier_invoices',
        inv.id,
        action.email === 2 ? 'reminder_2_at' : 'reminder_1_at',
        action.email === 2 && !inv.reminder_1_at ? { reminder_1_at: stamp } : {},
      );
      if (ok) {
        const replyTo = seller.email ?? '';
        const content = siteReminderText({
          stage: action.email,
          seller: seller.name ?? '',
          number: inv.number,
          job: (inv.job_id && jobName.get(inv.job_id)) || '',
          dueOn: f.date(`${inv.due_on}T12:00:00Z`),
          amount: f.money(inv.total_cents, inv.currency),
          /* Счёт со снимка счёта: смена IBAN после выставления напоминание не меняет. */
          iban: seller.iban ?? null,
          reference: inv.reference,
          replyTo,
        });
        const sent = await sendEmail({
          template: `site_invoice.reminder_${action.email}`,
          to: inv.sent_to,
          replyTo: replyTo || null,
          subject: content.subject,
          text: content.text,
          companyId: inv.company_id,
        });
        if (sent.sent) result.emails += 1;
      }
    }

    if (action.collection && (await claim(admin, 'carrier_invoices', inv.id, 'collection_hint_at'))) {
      result.collections += 1;
      await notifyCarrier(admin, inv.company_id, { number: inv.number, ref: '' }, inv.job_id ? `/carrier/sites/${inv.job_id}` : '/carrier/sites');
    }
  }
}

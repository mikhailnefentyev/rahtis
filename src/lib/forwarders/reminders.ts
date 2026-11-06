import 'server-only';

import { siteUrl } from '@/lib/config';
import { operatorInbox } from '@/lib/email';
import { renderEmail, renderText, type EmailBlock } from '@/lib/email/layout';
import { emailLocaleOf, emailText } from '@/lib/email/text';
import { getDictionary, getI18n } from '@/lib/i18n';
import { notify } from '@/lib/notify';
import { createAdminClient } from '@/lib/supabase/admin';

export type ForwarderReminderResult = { checked: number; sent: number; errors: string[] };

/** Пороги напоминаний: за 30 и за 7 дней до конца полиса. */
const STAGES = [30, 7] as const;

/**
 * Письмо и уведомление экспедитору: заголовок, абзац и кнопка на /account.
 * Общая часть напоминаний и решений оператора.
 */
export async function notifyForwarder(input: {
  companyId: string;
  language: string | null;
  contactEmail: string | null;
  template: string;
  title: string;
  lead: string;
  button: string;
}): Promise<void> {
  const locale = emailLocaleOf(input.language);
  const mail = emailText(locale);
  const link = `${siteUrl()}/${locale}/account`;
  const operator = operatorInbox();
  const blocks: EmailBlock[] = [
    { kind: 'text', value: mail.greeting },
    { kind: 'text', value: input.lead },
    { kind: 'button', label: input.button, href: link },
  ];

  await notify({
    companyId: input.companyId,
    kind: 'MODERATION',
    title: input.title,
    body: input.lead,
    link: '/account',
    email: input.contactEmail
      ? {
          to: input.contactEmail,
          template: input.template,
          subject: `RAHTIS · ${input.title}`,
          text: renderText({ heading: input.title, blocks, operatorEmail: operator, signature: mail.signature, neverAsk: mail.neverAsk }),
          html: renderEmail({
            heading: input.title,
            preheader: input.lead,
            blocks,
            operatorEmail: operator,
            tagline: mail.brandTagline,
            neverAsk: mail.neverAsk,
          }),
        }
      : undefined,
  });
}

/**
 * Напоминания о конце полиса экспедитора: за 30 и за 7 дней.
 *
 * Зовёт ежедневный маршрут /api/reminders/certificates. Берётся
 * последний одобренный полис компании; если после него загружен полис с
 * более поздней датой (продление ждёт проверки или уже одобрено), не
 * напоминаем. Журнал forwarder_reminders привязан к дате окончания и
 * порогу: второй запуск в тот же день упрётся в первичный ключ.
 */
export async function sendForwarderReminders(now: Date = new Date()): Promise<ForwarderReminderResult> {
  const admin = createAdminClient();
  const today = now.toISOString().slice(0, 10);
  const horizon = new Date(now.getTime() + STAGES[0] * 86_400_000).toISOString().slice(0, 10);

  const { data: rows, error } = await admin
    .from('company_documents')
    .select('company_id, valid_until, uploaded_at')
    .eq('kind', 'FORWARDER_INSURANCE')
    .eq('review_status', 'APPROVED')
    .gte('valid_until', today)
    .lte('valid_until', horizon);
  if (error) return { checked: 0, sent: 0, errors: [error.message] };

  const result: ForwarderReminderResult = { checked: rows?.length ?? 0, sent: 0, errors: [] };
  if (!rows || rows.length === 0) return result;

  const companyIds = [...new Set(rows.map((r) => r.company_id))];
  const [{ data: companies }, { data: later }, { data: sentRows }] = await Promise.all([
    admin.from('companies').select('id, language, contact_email, shipper_role, status').in('id', companyIds),
    /* Продление: полис с датой позже, чем у напоминаемого, — в любом статусе, кроме отклонённого. */
    admin
      .from('company_documents')
      .select('company_id, valid_until')
      .eq('kind', 'FORWARDER_INSURANCE')
      .neq('review_status', 'REJECTED')
      .in('company_id', companyIds)
      .gt('valid_until', today),
    admin.from('forwarder_reminders').select('company_id, valid_until, stage').in('company_id', companyIds),
  ]);
  const byId = new Map((companies ?? []).map((c) => [c.id, c]));
  const sent = new Set((sentRows ?? []).map((r) => `${r.company_id}|${r.valid_until}|${r.stage}`));
  const latestDate = new Map<string, string>();
  for (const r of later ?? []) {
    if (r.valid_until && r.valid_until > (latestDate.get(r.company_id) ?? '')) latestDate.set(r.company_id, r.valid_until);
  }

  for (const row of rows) {
    const company = byId.get(row.company_id);
    if (!company || company.status !== 'ACTIVE' || company.shipper_role !== 'FORWARDER' || !row.valid_until) continue;
    if ((latestDate.get(row.company_id) ?? '') > row.valid_until) continue;

    const daysLeft = Math.round((Date.parse(`${row.valid_until}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000);
    const stage = daysLeft <= 7 ? 7 : 30;
    if (sent.has(`${row.company_id}|${row.valid_until}|${stage}`)) continue;

    /* Сначала журнал: второй параллельный запуск упрётся в первичный ключ. */
    const { error: logError } = await admin
      .from('forwarder_reminders')
      .insert({ company_id: row.company_id, valid_until: row.valid_until, stage });
    if (logError) {
      if (logError.code !== '23505') result.errors.push(logError.message);
      continue;
    }
    sent.add(`${row.company_id}|${row.valid_until}|${stage}`);

    const locale = emailLocaleOf(company.language);
    const [{ f }, t] = await Promise.all([getI18n(locale), getDictionary(locale)]);
    const date = f.date(`${row.valid_until}T12:00:00Z`);

    await notifyForwarder({
      companyId: company.id,
      language: company.language,
      contactEmail: company.contact_email,
      template: 'forwarder.expiring',
      title: t.forwarder.reminderTitle.replace('{date}', date),
      lead: t.forwarder.reminderLead.replace('{date}', date),
      button: t.forwarder.reminderButton,
    });
    result.sent += 1;
  }

  return result;
}

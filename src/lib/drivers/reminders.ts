import 'server-only';

import { siteUrl } from '@/lib/config';
import { daysFromToday, todayInHelsinki } from '@/lib/dates';
import { operatorInbox } from '@/lib/email';
import { certificateEmail } from '@/lib/email/templates/certificate';
import { emailLocaleOf } from '@/lib/email/text';
import { getDictionary, getI18n } from '@/lib/i18n';
import { notify } from '@/lib/notify';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Напоминания о сроках удостоверений водителей: за 6, 3 и 1 месяц.
 *
 * Зовёт база раз в день (app.run_certificate_reminders). На каждый
 * документ уходит только самая поздняя из наступивших ступеней:
 * документ, внесённый за три недели до конца, получает одно напоминание
 * «1M», а не три сразу. Журнал driver_certificate_reminders привязан к
 * дате окончания — продлили, и через пять лет всё начнётся заново.
 *
 * Водителю — строка во входящих (push уйдёт сам, триггером), перевозчику
 * — уведомление в кабинете и письмо. Истёкшие документы не напоминаются:
 * их видно красным в карточке.
 */

const STAGES = [
  { stage: '1M', days: 31 },
  { stage: '3M', days: 92 },
  { stage: '6M', days: 183 },
] as const;

export type ReminderResult = { checked: number; sent: number; errors: string[] };

export async function sendCertificateReminders(now: Date = new Date()): Promise<ReminderResult> {
  const admin = createAdminClient();
  const today = todayInHelsinki(now);
  const horizon = daysFromToday(STAGES[STAGES.length - 1].days, now);

  const { data: rows, error } = await admin
    .from('driver_certificates')
    .select('id, type, expires_at, driver_id, drivers!inner(full_name, status, company_id, companies!inner(id, language, contact_email, frozen_at))')
    .gte('expires_at', today)
    .lte('expires_at', horizon);

  if (error) return { checked: 0, sent: 0, errors: [error.message] };

  const { data: sentRows } = await admin
    .from('driver_certificate_reminders')
    .select('certificate_id, expires_at, stage')
    .in('certificate_id', (rows ?? []).map((row) => row.id));
  const sent = new Set((sentRows ?? []).map((r) => `${r.certificate_id}|${r.expires_at}|${r.stage}`));

  const result: ReminderResult = { checked: rows?.length ?? 0, sent: 0, errors: [] };
  const base = siteUrl();
  const operator = operatorInbox();

  for (const row of rows ?? []) {
    const driver = row.drivers;
    if (!driver || driver.status !== 'ACTIVE') continue;

    const daysLeft = Math.round((Date.parse(row.expires_at) - Date.parse(today)) / 86_400_000);
    const due = STAGES.find((s) => daysLeft <= s.days);
    if (!due) continue;

    /* Более поздняя ступень уже ушла — раннюю не досылаем. */
    const later = STAGES.slice(0, STAGES.indexOf(due) + 1);
    if (later.some((s) => sent.has(`${row.id}|${row.expires_at}|${s.stage}`))) continue;

    /* Сначала журнал: при гонке двух запусков второй упрётся в первичный ключ и ничего не отправит. */
    const { error: logError } = await admin
      .from('driver_certificate_reminders')
      .insert({ certificate_id: row.id, expires_at: row.expires_at, stage: due.stage });
    if (logError) {
      if (logError.code !== '23505') result.errors.push(logError.message);
      continue;
    }

    const { error: noteError } = await admin.from('driver_notifications').insert({
      driver_id: row.driver_id,
      code: 'certificate.expiring',
      params: { type: row.type, date: row.expires_at },
    });
    if (noteError) result.errors.push(noteError.message);

    const company = driver.companies;
    if (company && !company.frozen_at) {
      const locale = emailLocaleOf(company.language);
      const [{ f }, t] = await Promise.all([getI18n(locale), getDictionary(locale)]);
      const typeLabel = t.certificates.types[row.type];
      const expires = f.date(`${row.expires_at}T12:00:00Z`);
      const link = `${base}/${locale}/carrier/drivers/${row.driver_id}`;

      await notify({
        companyId: company.id,
        kind: 'DRIVER',
        title: `${driver.full_name}: ${typeLabel} — ${expires}`,
        link: `/carrier/drivers/${row.driver_id}`,
        email: company.contact_email
          ? certificateEmail({
              to: company.contact_email,
              companyId: company.id,
              locale,
              driverName: driver.full_name,
              typeLabel,
              expires,
              link,
              operatorEmail: operator,
            })
          : undefined,
      });
    }

    result.sent += 1;
  }

  return result;
}

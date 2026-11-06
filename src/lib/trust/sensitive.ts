import 'server-only';

import { APP, siteUrl } from '@/lib/config';
import { operatorInbox, sendEmail } from '@/lib/email';
import { renderEmail, renderText } from '@/lib/email/layout';
import { emailLocaleOf, emailText } from '@/lib/email/text';
import { sensitiveChangeContent } from '@/lib/email/templates/trustQuickWins';
import { createFormat } from '@/lib/format';
import { createAdminClient } from '@/lib/supabase/admin';
import { isSensitiveField } from './changes';

export type SensitiveDeliveryResult = { checked: number; sent: number; errors: string[] };

/**
 * Письма о смене счёта, почты и главного пользователя
 * (company_sensitive_changes, пишет триггер базы). Зовут сохранение
 * реквизитов — сразу после правки — и ежедневный запуск напоминаний:
 * так доходит и правка другим путём (оператор, база). Прежний адрес
 * стирается из записи, когда письмо ушло.
 */
export async function deliverSensitiveChanges(): Promise<SensitiveDeliveryResult> {
  const result: SensitiveDeliveryResult = { checked: 0, sent: 0, errors: [] };
  const admin = createAdminClient();
  const { data: rows, error } = await admin.rpc('sensitive_changes_pending', { p_limit: 50 });
  if (error) {
    /* До миграции функции нет — тихо пропускаем. */
    if (error.code !== 'PGRST202' && error.code !== '42883') result.errors.push(error.message);
    return result;
  }

  for (const row of rows ?? []) {
    result.checked += 1;
    /* Сначала отметка: второй параллельный запуск письмо не повторит. */
    const { data: claimed, error: claimError } = await admin
      .from('company_sensitive_changes')
      .update({ notified_at: new Date().toISOString(), notify_old_email: null })
      .eq('id', row.id)
      .is('notified_at', null)
      .select('id');
    if (claimError) {
      result.errors.push(`${row.id}: ${claimError.message}`);
      continue;
    }
    if (!claimed || claimed.length === 0 || !isSensitiveField(row.field)) continue;

    const locale = emailLocaleOf(row.company_language);
    const mail = emailText(locale);
    const f = createFormat(locale === 'fi' ? 'fi-FI' : 'en-GB');
    const who = row.actor_is_operator
      ? locale === 'fi'
        ? 'RAHTIS-tuki'
        : 'RAHTIS support'
      : (row.actor_name ?? (locale === 'fi' ? 'tuntematon käyttäjä' : 'an unknown user'));
    const content = sensitiveChangeContent(locale, {
      company: row.company_name,
      field: row.field,
      who,
      when: f.dateTime(row.changed_at),
      oldValue: row.old_value,
      newValue: row.new_value,
      support: APP.operator.email,
      link: `${siteUrl()}/${locale}/account`,
    });
    const operator = operatorInbox();
    const text = renderText({ heading: content.heading, blocks: content.blocks, operatorEmail: operator, signature: mail.signature, neverAsk: mail.neverAsk });
    const html = renderEmail({
      heading: content.heading,
      preheader: content.preheader,
      blocks: content.blocks,
      operatorEmail: operator,
      tagline: mail.brandTagline,
      neverAsk: mail.neverAsk,
    });

    /*
     * Остальным людям компании и на прежний адрес. Почта компании —
     * только когда меняли не её саму (новый адрес мог завести захватчик).
     */
    const recipients = new Set<string>();
    for (const email of row.member_emails ?? []) if (email) recipients.add(email.toLowerCase());
    if (row.notify_old_email) recipients.add(row.notify_old_email.toLowerCase());
    if (row.field !== 'CONTACT_EMAIL' && row.contact_email) recipients.add(row.contact_email.toLowerCase());

    for (const to of recipients) {
      const sent = await sendEmail({
        template: 'company.sensitive_changed',
        to,
        subject: content.subject,
        text,
        html,
        companyId: row.company_id,
      });
      if (sent.sent) result.sent += 1;
    }
  }
  return result;
}

/**
 * Отметки «счёт изменён»: компания → момент последней смены IBAN за 30
 * дней. Служебным ключом — вызывающая страница уже решила, что эти
 * компании зрителю контрагенты.
 */
export async function bankChangeMarks(companyIds: readonly (string | null | undefined)[]): Promise<Record<string, string>> {
  const ids = [...new Set(companyIds.filter((id): id is string => Boolean(id)))];
  if (ids.length === 0) return {};
  try {
    const { data, error } = await createAdminClient().rpc('bank_change_marks', { p_company_ids: ids });
    if (error) return {};
    return Object.fromEntries((data ?? []).map((r) => [r.company_id, r.changed_at]));
  } catch {
    return {};
  }
}

/** Момент последней смены IBAN компании (для задержки счетов объекта); нет — null. */
export async function lastIbanChange(companyId: string): Promise<string | null> {
  const { data } = await createAdminClient()
    .from('company_sensitive_changes')
    .select('changed_at')
    .eq('company_id', companyId)
    .eq('field', 'IBAN')
    .order('changed_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.changed_at ?? null;
}

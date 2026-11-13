import 'server-only';

import { siteUrl } from '@/lib/config';
import { todayInHelsinki } from '@/lib/dates';
import { operatorInbox } from '@/lib/email';
import { renderEmail, renderText, type EmailBlock } from '@/lib/email/layout';
import { emailLocaleOf, emailText } from '@/lib/email/text';
import { getDictionary, getI18n } from '@/lib/i18n';
import { notify } from '@/lib/notify';
import { createAdminClient } from '@/lib/supabase/admin';
import { DRIVER_STAGES, dueKey, dueStatus, reachedStages, SOON_DAYS, SOON_KM, type ReminderStage } from './status';

export type MaintenanceReminderResult = { checked: number; sent: number; companies: number; blocked: number; errors: string[] };

/**
 * Напоминания о сроках обслуживания.
 *
 * Зовёт ежедневный маршрут /api/reminders/certificates. Ступени: за 30,
 * 7 и 1 день, за 2000 и 500 км и при просрочке — из каждого ряда только
 * самая поздняя (src/lib/maintenance/status.ts). Журнал
 * maintenance_reminders привязан к сроку пункта: отметили «сделано» —
 * срок другой, и ступени начинаются заново.
 *
 * Перевозчику — одна сводка в день на компанию (в кабинет и письмом), а
 * не письмо на каждый пункт. Водителю машины — строка во входящих (push
 * уйдёт сам, триггером), но только когда близко или прошло: за месяц
 * водителю делать нечего.
 */
export async function sendMaintenanceReminders(now: Date = new Date()): Promise<MaintenanceReminderResult> {
  const admin = createAdminClient();
  const today = todayInHelsinki(now);

  /* Сначала — просроченный katsastus снимает машину с рейсов; о новых блокировках — сразу. */
  const blocked = await blockOverdueInspections();

  const { data: rows, error } = await admin.rpc('maintenance_due_candidates', { p_days: SOON_DAYS, p_km: SOON_KM });
  if (error) return { checked: 0, sent: 0, companies: 0, blocked: blocked.count, errors: [error.message, ...blocked.errors] };

  const result: MaintenanceReminderResult = { checked: rows?.length ?? 0, sent: 0, companies: 0, blocked: blocked.count, errors: [...blocked.errors] };
  if (!rows || rows.length === 0) return result;

  const { data: sentRows } = await admin
    .from('maintenance_reminders')
    .select('item_id, due_key, stage')
    .in('item_id', rows.map((r) => r.item_id));
  const sent = new Set((sentRows ?? []).map((r) => `${r.item_id}|${r.due_key}|${r.stage}`));

  type Due = (typeof rows)[number] & { stages: ReminderStage[]; daysLeft: number | null; kmLeft: number | null; overdue: boolean };
  const byCompany = new Map<string, Due[]>();

  for (const row of rows) {
    const status = dueStatus(row, today, row.current_km ?? null);
    const key = dueKey(row);
    const fresh = reachedStages(status).filter((stage) => !sent.has(`${row.item_id}|${key}|${stage}`));
    if (fresh.length === 0) continue;

    /* Сначала журнал: второй параллельный запуск упрётся в первичный ключ и ничего не отправит. */
    const { error: logError } = await admin
      .from('maintenance_reminders')
      .insert(fresh.map((stage) => ({ item_id: row.item_id, due_key: key, stage })));
    if (logError) {
      if (logError.code !== '23505') result.errors.push(logError.message);
      continue;
    }

    const due: Due = { ...row, stages: fresh, daysLeft: status.daysLeft, kmLeft: status.kmLeft, overdue: status.state === 'OVERDUE' };
    byCompany.set(row.company_id, [...(byCompany.get(row.company_id) ?? []), due]);

    /* Водителю — на его машину и только близкие ступени. */
    if (row.driver_id && row.vehicle_id && fresh.some((s) => DRIVER_STAGES.includes(s))) {
      const when = [row.next_due_on ? fiDate(row.next_due_on) : null, row.next_due_km != null ? `${spaced(row.next_due_km)} km` : null]
        .filter(Boolean)
        .join(' / ');
      const { error: noteError } = await admin.from('driver_notifications').insert({
        driver_id: row.driver_id,
        code: due.overdue ? 'maintenance.overdue' : 'maintenance.due',
        params: { plate: row.plate, kind: row.kind, title: row.title ?? '', when },
      });
      if (noteError) result.errors.push(noteError.message);
    }
    result.sent += 1;
  }

  if (byCompany.size === 0) return result;

  const { data: companies } = await admin
    .from('companies')
    .select('id, language, contact_email, frozen_at')
    .in('id', [...byCompany.keys()]);
  const base = siteUrl();
  const operator = operatorInbox();

  for (const company of companies ?? []) {
    const list = byCompany.get(company.id);
    if (!list || company.frozen_at) continue;

    const locale = emailLocaleOf(company.language);
    const [{ f, m }, t] = await Promise.all([getI18n(locale), getDictionary(locale)]);
    const s = t.maintenance;
    const label = (d: Due) => (d.kind === 'OTHER' && d.title ? d.title : (s.kinds[d.kind as keyof typeof s.kinds] ?? d.kind));
    const when = (d: Due) =>
      [
        d.next_due_on ? `${f.date(`${d.next_due_on}T12:00:00Z`)} (${d.daysLeft != null && d.daysLeft < 0 ? m('maintenance.daysOverdue', { days: -d.daysLeft }) : m('maintenance.inDays', { days: d.daysLeft ?? 0 })})` : null,
        d.next_due_km != null
          ? `${f.number(d.next_due_km)} km (${d.kmLeft != null && d.kmLeft <= 0 ? m('maintenance.kmOver', { km: f.number(-d.kmLeft) }) : d.kmLeft != null ? m('maintenance.kmLeft', { km: f.number(d.kmLeft) }) : '—'})`
          : null,
      ]
        .filter(Boolean)
        .join(' · ');

    list.sort((a, b) => Number(b.overdue) - Number(a.overdue) || (a.daysLeft ?? 9999) - (b.daysLeft ?? 9999));
    const overdue = list.filter((d) => d.overdue).length;
    const title = overdue > 0 ? m('maintenance.reminderOverdueTitle', { count: overdue }) : m('maintenance.reminderTitle', { count: list.length });
    const lines = list.map((d) => `${d.plate} · ${label(d)} — ${when(d)}`);
    const mail = emailText(locale);
    const blocks: EmailBlock[] = [
      { kind: 'text', value: mail.greeting },
      { kind: 'text', value: s.reminderLead },
      { kind: 'facts', rows: list.map((d) => [`${d.plate} · ${label(d)}`, when(d)] as [string, string]) },
      { kind: 'button', label: s.reminderButton, href: `${base}/${locale}/carrier/maintenance` },
      { kind: 'note', value: s.reminderNote },
    ];

    await notify({
      companyId: company.id,
      kind: 'FLEET',
      title,
      body: lines.join('\n').slice(0, 1000),
      link: '/carrier/maintenance',
      email: company.contact_email
        ? {
            to: company.contact_email,
            template: 'maintenance.due',
            subject: `RAHTIS · ${title}`,
            text: renderText({ heading: title, blocks, operatorEmail: operator, signature: mail.signature, neverAsk: mail.neverAsk }),
            html: renderEmail({
              heading: title,
              preheader: lines[0] ?? title,
              blocks,
              operatorEmail: operator,
              tagline: mail.brandTagline,
              neverAsk: mail.neverAsk,
            }),
          }
        : undefined,
    });
    result.companies += 1;
  }

  return result;
}

/**
 * Машины с просроченным katsastus — вне работы (в Финляндии такая машина
 * в ajokielto). База ставит ограничение один раз на срок и возвращает
 * только новые; перевозчику — уведомление с тем, как снять ограничение.
 */
async function blockOverdueInspections(): Promise<{ count: number; errors: string[] }> {
  const admin = createAdminClient();
  const { data: rows, error } = await admin.rpc('maintenance_sync_downtime');
  if (error) return { count: 0, errors: [error.message] };
  if (!rows || rows.length === 0) return { count: 0, errors: [] };

  const { data: companies } = await admin
    .from('companies')
    .select('id, language, contact_email, frozen_at')
    .in('id', [...new Set(rows.map((r) => r.company_id))]);
  const operator = operatorInbox();

  for (const company of companies ?? []) {
    if (company.frozen_at) continue;
    const own = rows.filter((r) => r.company_id === company.id);
    const locale = emailLocaleOf(company.language);
    const [{ f, m }, t] = await Promise.all([getI18n(locale), getDictionary(locale)]);
    const s = t.maintenance.downtime;
    const plates = own.map((r) => r.plate).join(', ');
    const title = m('maintenance.inspectionBlockedTitle', { plates });
    const mail = emailText(locale);
    const blocks: EmailBlock[] = [
      { kind: 'text', value: mail.greeting },
      { kind: 'text', value: s.inspectionBlockedLead },
      { kind: 'facts', rows: own.map((r) => [r.plate, `${s.dueWas} ${f.date(`${r.due_on}T12:00:00Z`)}`] as [string, string]) },
      { kind: 'button', label: t.maintenance.reminderButton, href: `${siteUrl()}/${locale}/carrier/maintenance` },
      { kind: 'note', value: s.inspectionBlockedNote },
    ];
    await notify({
      companyId: company.id,
      kind: 'FLEET',
      title,
      body: s.inspectionBlockedLead,
      link: '/carrier/maintenance',
      email: company.contact_email
        ? {
            to: company.contact_email,
            template: 'maintenance.blocked',
            subject: `RAHTIS · ${title}`,
            text: renderText({ heading: title, blocks, operatorEmail: operator, signature: mail.signature, neverAsk: mail.neverAsk }),
            html: renderEmail({ heading: title, preheader: s.inspectionBlockedLead, blocks, operatorEmail: operator, tagline: mail.brandTagline, neverAsk: mail.neverAsk }),
          }
        : undefined,
    });
  }
  return { count: rows.length, errors: [] };
}

/** Дата водителю — нейтрально, без языка: 20.11.2026. */
function fiDate(iso: string): string {
  const [y, mo, d] = iso.split('-');
  return `${Number(d)}.${Number(mo)}.${y}`;
}

function spaced(n: number): string {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

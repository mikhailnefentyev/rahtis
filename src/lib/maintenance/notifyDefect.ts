import 'server-only';

import { siteUrl } from '@/lib/config';
import { operatorInbox } from '@/lib/email';
import { renderEmail, renderText, type EmailBlock } from '@/lib/email/layout';
import { emailLocaleOf, emailText } from '@/lib/email/text';
import { getDictionary, getI18n } from '@/lib/i18n';
import { notify } from '@/lib/notify';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Новый дефект от водителя — перевозчику сразу: в кабинет и письмом.
 *
 * Строку читает служебный ключ по идентификатору, который только что
 * вернула функция базы под сессией водителя, — чужой дефект сюда не
 * попадёт. «Ехать нельзя» стоит первым словом заголовка: его видно в
 * списке уведомлений и в теме письма, не открывая.
 */
export async function notifyCarrierOfDefect(defectId: string): Promise<void> {
  const admin = createAdminClient();
  const { data: defect } = await admin
    .from('vehicle_defects')
    .select('id, company_id, vehicle_id, trailer_id, driver_id, area, severity, description, reported_at')
    .eq('id', defectId)
    .maybeSingle();
  if (!defect) return;

  const [{ data: company }, { data: vehicle }, { data: trailer }, { data: driver }] = await Promise.all([
    admin.from('companies').select('id, language, contact_email, frozen_at').eq('id', defect.company_id).maybeSingle(),
    defect.vehicle_id ? admin.from('vehicles').select('plate').eq('id', defect.vehicle_id).maybeSingle() : Promise.resolve({ data: null }),
    defect.trailer_id ? admin.from('trailers').select('plate').eq('id', defect.trailer_id).maybeSingle() : Promise.resolve({ data: null }),
    defect.driver_id ? admin.from('drivers').select('full_name').eq('id', defect.driver_id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  if (!company || company.frozen_at) return;

  const plate = vehicle?.plate ?? trailer?.plate ?? '—';
  const assetId = defect.vehicle_id ?? defect.trailer_id;
  const locale = emailLocaleOf(company.language);
  const [{ m, f }, t] = await Promise.all([getI18n(locale), getDictionary(locale)]);
  const s = t.maintenance;
  const area = s.defects.areas[defect.area as keyof typeof s.defects.areas] ?? defect.area;
  const unsafe = defect.severity === 'UNSAFE';
  const title = m(unsafe ? 'maintenance.defectUnsafeTitle' : 'maintenance.defectTitle', { plate, area });
  const who = driver?.full_name ?? '—';
  const link = `/carrier/maintenance/${assetId}`;

  const mail = emailText(locale);
  const blocks: EmailBlock[] = [
    { kind: 'text', value: mail.greeting },
    { kind: 'text', value: defect.description },
    {
      kind: 'facts',
      rows: [
        [s.defects.reportedBy, who],
        [s.defects.reportedAt, f.dateTime(defect.reported_at)],
        [s.defects.severity, s.defects.severities[defect.severity as 'CAN_DRIVE' | 'UNSAFE']],
      ],
    },
    { kind: 'button', label: s.defects.open, href: `${siteUrl()}/${locale}${link}` },
    /* Дефект «ехать нельзя» на машине сам снимает её с рейсов (vehicle_downtime). */
    ...(unsafe && defect.vehicle_id ? [{ kind: 'note' as const, value: s.downtime.defectBlockedNote }] : []),
  ];

  await notify({
    companyId: company.id,
    kind: 'FLEET',
    title,
    body: `${who}: ${defect.description}${unsafe && defect.vehicle_id ? `
${s.downtime.defectBlockedNote}` : ''}`.slice(0, 1000),
    link,
    email: company.contact_email
      ? {
          to: company.contact_email,
          template: 'maintenance.defect',
          subject: `RAHTIS · ${title}`,
          text: renderText({ heading: title, blocks, operatorEmail: operatorInbox(), signature: mail.signature, neverAsk: mail.neverAsk }),
          html: renderEmail({
            heading: title,
            preheader: defect.description.slice(0, 120),
            blocks,
            operatorEmail: operatorInbox(),
            tagline: mail.brandTagline,
            neverAsk: mail.neverAsk,
          }),
        }
      : undefined,
  });
}

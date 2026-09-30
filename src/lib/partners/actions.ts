'use server';

import { createHash, randomBytes } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { siteUrl } from '@/lib/config';
import { operatorInbox, sendEmail } from '@/lib/email';
import { shipperInviteEmail } from '@/lib/email/templates/shipperInvite';
import { isValidBusinessId } from '@/lib/format';
import { getDictionary } from '@/lib/i18n';
import { getViewer } from '@/lib/auth/viewer';
import { isLocale, type Locale, defaultLocale } from '@/lib/i18n';
import { createClient } from '@/lib/supabase/server';

/**
 * Постоянная работа: согласие перевозчика и пул машин заказчика.
 *
 * Проверки — в функциях базы (set_shipper_link, pool_add_vehicle):
 * машина должна быть знакомой, а согласие — действующим. Здесь только
 * вызов и пересборка страниц.
 */

function toLocale(value: FormDataEntryValue | null): Locale {
  const raw = String(value ?? '');
  return isLocale(raw) ? raw : defaultLocale;
}

/** Перевозчик разрешает или отзывает прямые заказы от заказчика. */
export async function setShipperLinkAction(formData: FormData): Promise<void> {
  const locale = toLocale(formData.get('locale'));

  const viewer = await getViewer();
  if (viewer.status !== 'ready' || viewer.role !== 'CARRIER') throw new Error('forbidden');

  const supabase = await createClient();
  await supabase.rpc('set_shipper_link', {
    p_shipper_id: String(formData.get('shipper_id') ?? ''),
    p_allow: formData.get('allow') === '1',
  });

  revalidatePath(`/${locale}/carrier/partners`);
}

/** Заказчик добавляет знакомую машину в постоянные или убирает её. */
export async function poolVehicleAction(formData: FormData): Promise<void> {
  const locale = toLocale(formData.get('locale'));

  const viewer = await getViewer();
  if (viewer.status !== 'ready' || viewer.role !== 'SHIPPER') throw new Error('forbidden');

  const supabase = await createClient();
  const vehicleId = String(formData.get('vehicle_id') ?? '');

  await supabase.rpc(formData.get('add') === '1' ? 'pool_add_vehicle' : 'pool_remove_vehicle', {
    p_vehicle_id: vehicleId,
  });

  revalidatePath(`/${locale}/shipper/vehicles`);
  revalidatePath(`/${locale}/shipper/orders`);
}

/* ── Пригласить своего заказчика ───────────────────────────────── */

export type InviteShipperState = { error: string | null; sentTo: string | null };

/**
 * Перевозчик приглашает клиента. Ссылка одноразовая по смыслу: в базе —
 * только её SHA-256, по ней заявка узнаёт, кто пригласил. Язык письма
 * выбирает перевозчик: он знает, на каком языке пишет его клиент.
 */
export async function inviteShipperAction(
  _previous: InviteShipperState,
  formData: FormData,
): Promise<InviteShipperState> {
  const locale = toLocale(formData.get('locale'));
  const t = await getDictionary(locale);

  const viewer = await getViewer();
  if (viewer.status !== 'ready' || viewer.role !== 'CARRIER' || !viewer.company) {
    return { error: t.error.forbidden, sentTo: null };
  }

  const name = String(formData.get('name') ?? '').trim().slice(0, 200);
  const businessId = String(formData.get('business_id') ?? '').trim();
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const language = String(formData.get('language') ?? 'fi') === 'en' ? 'en' : 'fi';

  if (!name || !isValidBusinessId(businessId) || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return { error: t.partners.inviteInvalid, sentTo: null };
  }

  const token = randomBytes(32).toString('hex');
  const hash = createHash('sha256').update(token).digest('hex');

  const supabase = await createClient();
  const { error } = await supabase.rpc('carrier_invite_shipper', {
    p_name: name,
    p_business_id: businessId,
    p_email: email,
    p_token_hash: hash,
  });
  if (error) {
    return { error: error.code === '55001' ? t.partners.inviteTooMany : t.partners.inviteFailed, sentTo: null };
  }

  const result = await sendEmail(
    shipperInviteEmail({
      to: email,
      carrierName: viewer.company.name,
      link: `${siteUrl()}/${language}/apply?invite=${token}`,
      operatorEmail: operatorInbox(),
      locale: language,
    }),
  );
  if (result.outboxId === null) return { error: t.partners.inviteFailed, sentTo: null };

  revalidatePath(`/${locale}/carrier/partners`);
  return { error: null, sentTo: email };
}

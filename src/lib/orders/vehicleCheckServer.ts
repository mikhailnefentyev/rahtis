import 'server-only';

import { siteUrl } from '@/lib/config';
import { operatorInbox, sendEmail } from '@/lib/email';
import { renderEmail, renderText, type EmailBlock } from '@/lib/email/layout';
import { emailLocaleOf, emailText } from '@/lib/email/text';
import { getDictionary } from '@/lib/i18n';
import { createAdminClient } from '@/lib/supabase/admin';
import type { createClient } from '@/lib/supabase/server';
import type { Json } from '@/types/database';
import { reasonLines, vehicleVerdict, type VehicleCheckResult, type VehicleCheckView, type VehicleReason } from './vehicleCheck';

/*
 * «Та ли машина приехала» (6.11.2026): сверка после отметки первой
 * погрузки. Данные — функцией базы под сессией отметившего (права как у
 * отметки), решение — здесь (чистый vehicleCheck.ts), запись — служебным
 * ключом: ни телефон, ни кабинет не могут записать себе «OK».
 */

type Supabase = Awaited<ReturnType<typeof createClient>>;

type Evidence = {
  order_id: string;
  stop_id: string;
  ref: string;
  shipper_company_id: string;
  carrier_company_id: string | null;
  source: 'DRIVER' | 'CARRIER';
  completed_at: string;
  stop_lat: number | null;
  stop_lon: number | null;
  expected_plate: string | null;
  expected_trailer: string | null;
  gps_lat: number | null;
  gps_lon: number | null;
  gps_at: string | null;
  assigned_driver_id: string | null;
  actual_driver_id: string | null;
  driver_change_recorded: boolean;
};

const clip = (value: string | null | undefined) => (value ?? '').trim().slice(0, 32) || null;

/**
 * Сверка после отметки точки. Не первая погрузка или сверка уже есть —
 * база вернёт пусто, и ничего не происходит. Ошибка здесь отметку не
 * отменяет: точка уже пройдена.
 */
export async function recordVehicleCheck(
  supabase: Supabase,
  stopId: string,
  reported: { plate?: string | null; trailer?: string | null } = {},
): Promise<void> {
  try {
    const { data, error } = await supabase.rpc('vehicle_check_evidence', { p_stop_id: stopId });
    if (error || !data) return;
    const e = data as unknown as Evidence;

    const result = vehicleVerdict({
      expectedPlate: e.expected_plate,
      reportedPlate: clip(reported.plate),
      expectedTrailer: e.expected_trailer,
      reportedTrailer: clip(reported.trailer),
      stop: e.stop_lat != null && e.stop_lon != null ? { lat: e.stop_lat, lon: e.stop_lon } : null,
      gps: e.gps_lat != null && e.gps_lon != null && e.gps_at ? { lat: e.gps_lat, lon: e.gps_lon, at: e.gps_at } : null,
      completedAt: e.completed_at,
      assignedDriverId: e.assigned_driver_id,
      actualDriverId: e.actual_driver_id,
      driverChangeRecorded: e.driver_change_recorded,
    });

    const { data: id, error: recordError } = await createAdminClient().rpc('record_vehicle_check', {
      p_check: {
        stop_id: e.stop_id,
        source: e.source,
        expected_plate: e.expected_plate,
        reported_plate: clip(reported.plate),
        expected_trailer: e.expected_trailer,
        reported_trailer: clip(reported.trailer),
        gps_distance_m: result.gpsDistanceM,
        gps_seen_at: result.gpsSeenAt,
        driver_matches: result.driverMatches,
        verdict: result.verdict,
        reasons: result.reasons,
      } as unknown as Json,
    });
    if (recordError) {
      console.error('сверка машины не записана:', recordError.message);
      return;
    }
    /* Уведомления в кабинетах ставит база; письмо — заказчику, только новой сверке. */
    if (id && result.verdict === 'MISMATCH') await emailShipper(e, result);
  } catch (cause) {
    console.error('сверка машины не прошла:', cause instanceof Error ? cause.message : cause);
  }
}

async function emailShipper(e: Evidence, result: VehicleCheckResult): Promise<void> {
  const admin = createAdminClient();
  const { data: shipper } = await admin
    .from('companies')
    .select('id, contact_email, language, client_of')
    .eq('id', e.shipper_company_id)
    .maybeSingle();
  /* Клиент перевозчика без входа — писать некому (как app.notify_event). */
  if (!shipper?.contact_email || shipper.client_of) return;

  const locale = emailLocaleOf(shipper.language);
  const [t, mail] = [await getDictionary(locale), emailText(locale)];
  const tv = t.vehicleCheck;
  const heading = tv.emailSubject.replace('{ref}', e.ref);
  const blocks: EmailBlock[] = [
    { kind: 'text', value: mail.greeting },
    { kind: 'text', value: tv.lead },
    ...reasonLines(result.reasons, tv).map((value): EmailBlock => ({ kind: 'text', value: `• ${value}` })),
    { kind: 'button', label: tv.open, href: `${siteUrl()}/${locale}/shipper/orders#order-${e.order_id}` },
  ];
  const operator = operatorInbox();

  await sendEmail({
    template: 'order.vehicle_mismatch',
    to: shipper.contact_email,
    subject: `RAHTIS · ${heading}`,
    text: renderText({ heading, blocks, operatorEmail: operator, signature: mail.signature, neverAsk: mail.neverAsk }),
    html: renderEmail({ heading, preheader: tv.lead, blocks, operatorEmail: operator, tagline: mail.brandTagline, neverAsk: mail.neverAsk }),
    companyId: shipper.id,
  });
}

/** Сверки по заказам — для карточек обеих сторон. RLS: стороны рейса. До миграции — пусто. */
export async function loadVehicleChecks(supabase: Supabase, orderIds: readonly string[]): Promise<Record<string, VehicleCheckView>> {
  const result: Record<string, VehicleCheckView> = {};
  if (orderIds.length === 0) return result;
  const { data, error } = await supabase
    .from('vehicle_checks')
    .select('id, order_id, verdict, reasons, shipper_confirmed_at, shipper_reason, carrier_confirmed_at, carrier_reason, created_at')
    .in('order_id', [...orderIds])
    .order('created_at');
  if (error) return result;
  for (const c of data ?? []) {
    result[c.order_id] = {
      id: c.id,
      verdict: c.verdict as VehicleCheckView['verdict'],
      reasons: (Array.isArray(c.reasons) ? c.reasons : []) as unknown as VehicleReason[],
      shipperConfirmedAt: c.shipper_confirmed_at,
      shipperReason: c.shipper_reason,
      carrierConfirmedAt: c.carrier_confirmed_at,
      carrierReason: c.carrier_reason,
    };
  }
  return result;
}

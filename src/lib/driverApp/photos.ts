import 'server-only';

import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

/**
 * Снимки рейса для экрана водителя — с короткими подписанными ссылками.
 *
 * Список отдаёт driver_trip_photos под сессией водителя: только его рейс.
 * Ссылки подписывает служебный ключ — политики хранилища водителя не
 * знают, — но только на те пути, что вернула функция. Живут десять
 * минут: экран задания открыт недолго, а ссылка, пока жива, действует в
 * обход политик.
 */
export type TripPhoto = {
  id: string;
  stopId: string | null;
  kind: string;
  phase: 'PICKUP' | 'DELIVERY' | null;
  subject: string | null;
  angle: string | null;
  signerName: string | null;
  capturedAt: string;
  url: string | null;
};

export async function getTripPhotos(orderId: string): Promise<TripPhoto[]> {
  const supabase = await createClient();
  const { data } = await supabase.rpc('driver_trip_photos', { p_order_id: orderId });
  const rows = data ?? [];
  if (rows.length === 0) return [];

  const { data: signed } = await createAdminClient()
    .storage.from('trip-docs')
    .createSignedUrls(
      rows.map((r) => r.storage_path),
      600,
    );

  const urlOf = new Map((signed ?? []).map((s) => [s.path, s.signedUrl]));

  return rows.map((r) => ({
    id: r.id,
    stopId: r.stop_id,
    kind: r.kind,
    phase: r.phase,
    subject: r.subject,
    angle: r.angle,
    signerName: r.signer_name,
    capturedAt: r.captured_at,
    url: urlOf.get(r.storage_path) ?? null,
  }));
}

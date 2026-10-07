import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Badge, Card, CardBody, Mono } from '@/components/ui';
import { orderStatusTone } from '@/components/ui/tone';
import { getI18n, isLocale } from '@/lib/i18n';
import { stopTitle } from '@/lib/orders/haul';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const { t } = await getI18n(locale);
  return { title: t.track.title, robots: { index: false, follow: false } };
}

/**
 * Ход своего рейса перевозчика для его клиента — без входа, по ссылке.
 *
 * Ссылка — случайный токен из 256 бит, выдаётся только у своих рейсов.
 * Показывается то, что клиенту нужно знать о своей перевозке: кто везёт,
 * статус и точки маршрута со временем прибытия и выполнения. Телефона
 * водителя, его координат и цены здесь нет.
 */
export default async function TrackPage({ params }: { params: Promise<{ locale: string; token: string }> }) {
  const { locale, token } = await params;
  if (!isLocale(locale)) notFound();
  const { t, m, f } = await getI18n(locale);

  const valid = /^[0-9a-f]{64}$/.test(token);
  const admin = createAdminClient();
  const { data: order } = valid
    ? await admin
        .from('orders')
        .select('id, ref, status, haul_kind, trailer_plate, assigned_company_id, updated_at')
        .eq('track_token', token)
        .maybeSingle()
    : { data: null };

  if (!order) {
    return (
      <main className="mx-auto w-full max-w-2xl px-5 py-16">
        <h1 className="text-xl font-semibold tracking-tight">{t.track.title}</h1>
        <p className="mt-3 text-[13px] text-ink-muted">{t.track.notFound}</p>
      </main>
    );
  }

  const [{ data: carrier }, { data: stops }] = await Promise.all([
    order.assigned_company_id
      ? admin.from('companies').select('name').eq('id', order.assigned_company_id).single()
      : Promise.resolve({ data: null }),
    admin
      .from('order_stops')
      .select('id, role, place_name, company_name, city, scheduled_date, scheduled_time, eta_at, arrived_at, completed_at')
      .eq('order_id', order.id)
      .order('sequence'),
  ]);

  const time = (iso: string) => `${f.date(iso)} ${new Date(iso).toLocaleTimeString(t.meta.intl, { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Helsinki' })}`;

  return (
    <main className="mx-auto w-full max-w-2xl px-5 py-10">
      <p className="label-micro">{t.track.title}</p>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <Mono className="text-lg">{order.ref}</Mono>
        <Badge tone={orderStatusTone[order.status]}>{t.orderStatus[order.status]}</Badge>
      </div>
      {carrier?.name && (
        <p className="mt-2 text-[13px] text-ink-muted">
          {t.track.carrier}: <span className="font-semibold text-ink">{carrier.name}</span>
          {order.trailer_plate ? ` · ${order.trailer_plate}` : ''}
        </p>
      )}

      <Card className="mt-6">
        <CardBody>
          <p className="label-micro mb-3">{t.track.route}</p>
          <ol className="flex flex-col gap-4">
            {(stops ?? []).map((s) => (
              <li key={s.id} className="flex flex-col gap-0.5 border-l-2 border-line pl-3">
                <span className="text-[13px] font-semibold">{stopTitle(t, s.role, order.haul_kind)}</span>
                <span className="text-[13px] text-ink-muted">
                  {[s.place_name || s.company_name, s.city].filter(Boolean).join(', ')}
                </span>
                <span className="text-xs text-ink-dim">
                  {s.completed_at
                    ? `${t.track.completed} ${time(s.completed_at)}`
                    : s.arrived_at
                      ? `${t.track.arrived} ${time(s.arrived_at)}`
                      : s.eta_at
                        ? `${t.track.eta} ${time(s.eta_at)}`
                        : s.scheduled_date
                          ? `${t.track.planned} ${f.date(s.scheduled_date)}${s.scheduled_time ? ` ${s.scheduled_time.slice(0, 5)}` : ''}`
                          : ''}
                </span>
              </li>
            ))}
          </ol>
        </CardBody>
      </Card>

      {carrier?.name && <p className="mt-6 text-xs text-ink-dim">{m('track.questions', { carrier: carrier.name })}</p>}
    </main>
  );
}

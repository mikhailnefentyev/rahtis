import { notFound } from 'next/navigation';
import { getDriver } from '@/lib/driverApp/session';
import { isLocale } from '@/lib/i18n';
import { driverLocaleOf, getDriverI18n } from '@/lib/driverApp/i18n';
import { createClient } from '@/lib/supabase/server';
import { PlacesMap, type Place } from './PlacesMap';
import type { Tables } from '@/types/database';

const PAGE = 1000;
type PlaceRow = Omit<Tables<'driver_places'>, 'updated_at' | 'created_at'>;

/**
 * Kartta — заправки, стоянки, душ и сервис для водителя.
 *
 * Справочник на 520+ точек в FI/SE/NO/DK (data/driver-places). Приходит
 * целиком одним запросом на языке водителя: так список и карточки
 * работают без связи из закэшированной страницы, а без сети не видна
 * только подложка карты.
 */
export default async function DriverMap({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const [driver, { t }, driverLocale, supabase] = await Promise.all([
    getDriver(),
    getDriverI18n(locale),
    driverLocaleOf(locale),
    createClient(),
  ]);
  if (!driver) return null;

  /*
   * Постранично: база отдаёт не больше 1000 строк за запрос, а точек с
   * Прибалтикой, Польшей и Германией больше — без страниц хвост списка
   * молча пропадал бы с карты.
   */
  const data: PlaceRow[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data: page } = await supabase
      .from('driver_places')
      .select('id, country, kinds, name_fi, name_en, network, address, lat, lon, approx, hours_fi, hours_en, phone, free, secured, sauna, warning, details')
      .order('id')
      .range(from, from + PAGE - 1);
    data.push(...(page ?? []));
    if (!page || page.length < PAGE) break;
  }

  /* Точки переведены на финский и английский: финну финский, остальным английский. */
  const fi = driverLocale === 'fi';
  const places: Place[] = (data ?? []).map((p) => ({
    id: p.id,
    country: p.country,
    kinds: p.kinds,
    name: fi ? p.name_fi : p.name_en,
    network: p.network,
    address: p.address,
    lat: p.lat,
    lon: p.lon,
    approx: p.approx,
    hours: fi ? p.hours_fi : p.hours_en,
    phone: p.phone,
    free: p.free,
    secured: p.secured,
    sauna: p.sauna,
    warning: p.warning,
    details: ((p.details ?? []) as Array<{ k: string; fi: string; en: string }>).map((d) => ({
      k: d.k,
      text: fi ? d.fi : d.en,
    })),
  }));

  return (
    <main className="flex flex-col gap-3">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{t.driverApp.map}</h1>
      </header>
      <PlacesMap places={places} />
      <p className="text-xs leading-relaxed text-ink-dim">{t.places.source}</p>
    </main>
  );
}

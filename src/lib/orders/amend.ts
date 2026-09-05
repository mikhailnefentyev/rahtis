'use server';

import { revalidatePath } from 'next/cache';
import { getViewer } from '@/lib/auth/viewer';
import { getDictionary, isLocale, type Locale, defaultLocale } from '@/lib/i18n';
import { computeRouteAction } from '@/lib/routing/actions';
import {
  cityOf,
  hasCoordinates,
  stopFieldFlags,
  tonnesToKg,
  type FieldReader,
} from '@/lib/orders/stopFields';
import { createClient } from '@/lib/supabase/server';
import type { StopRole } from '@/types/db';

/**
 * Живая корректировка маршрута (ТЗ §8).
 *
 * Пока рейс идёт, заказчик меняет непройденные точки, вставляет новые и
 * убирает отменённые. Каждое действие пишет строку в журнал изменений —
 * этим оно и отличается от обычного сохранения формы, и поэтому идёт
 * через функции базы, а не через update по политике.
 *
 * Здесь же остаётся то, чего база сделать не может: пересчёт маршрута.
 * Правка стирает линию, посчитанную по прежним точкам, а новую считает
 * TomTom — ключ к нему серверный, и вызов принадлежит этому слою.
 */

export type AmendState = { error: string | null; saved: boolean };

const idle: AmendState = { error: null, saved: false };

function toLocale(value: FormDataEntryValue | null): Locale {
  const raw = String(value ?? '');
  return isLocale(raw) ? raw : defaultLocale;
}

const str = (form: FormData, key: string): string => String(form.get(key) ?? '').trim();

/** Правит маршрут только заказчик — тот же, кто заказ опубликовал. */
async function guard(locale: Locale): Promise<string | null> {
  const viewer = await getViewer();
  if (viewer.status !== 'ready' || viewer.role !== 'SHIPPER') {
    return (await getDictionary(locale)).error.forbidden;
  }
  return null;
}

/**
 * Превращает отказ базы в понятный текст.
 *
 * Сообщения кода 55000 показываются как есть: их пишет та же функция,
 * которая знает, почему отказала, — «точка уже пройдена», «рейс уже не
 * идёт». Заменить их одной общей фразой значило бы отнять у заказчика
 * единственную подсказку, что делать дальше.
 */
async function explain(
  locale: Locale,
  code: string | undefined,
  message: string | undefined,
): Promise<string> {
  const t = await getDictionary(locale);

  if (code === '42501') return t.amend.notYours;
  if (code === '55000') return message ?? t.amend.failed;

  return t.amend.failed;
}

/* ── Сборка правки из формы ─────────────────────────────────────── */

/**
 * Поля точки, которые заказчик мог тронуть.
 *
 * Набор берётся по роли из той же матрицы, по которой форма решает, что
 * показывать: поле, которого на экране не было, не должно приехать в
 * патч пустым и стереть то, что в точке записано.
 *
 * Адрес собирается отдельно — см. readAddress.
 */
function readFields(read: FieldReader, role: StopRole): Record<string, string> {
  const flags = stopFieldFlags(role);

  const patch: Record<string, string> = {
    scheduled_date: read('date'),
    scheduled_time: read('time'),
    note: read('note'),
  };

  if (flags.placeName) patch.place_name = read('place_name');
  if (flags.company) patch.company_name = read('company');
  if (flags.contact) {
    patch.contact_name = read('contact');
    patch.contact_phone = read('phone');
  }
  if (flags.cargo) {
    /* Тонны формы в килограммы базы — как и при публикации. */
    patch.cargo_weight_kg = tonnesToKg(read('weight'))?.toString() ?? '';
    patch.seal_required = read('seal');
  }
  if (flags.consignee) patch.consignee = read('consignee');
  if (flags.externalRef) patch.external_ref = read('ref');
  if (flags.trailerState) patch.trailer_loaded = read('trailer_loaded');

  return patch;
}

/**
 * Адрес и всё, что приезжает вместе с ним.
 *
 * Три исхода, и различать их обязательно:
 *
 *   'untouched' — строка та же, что была. Ключей адреса в патче нет.
 *     Иначе пустые скрытые поля координат — а они пусты всегда, пока
 *     человек не выбрал новую подсказку, — обнулили бы координаты точки,
 *     которую никто не двигал, и маршрут потерял бы её ни за что.
 *
 *   'nowhere' — адрес переписан, но координат нет: подсказку не выбрали.
 *     Раньше координаты в этом случае стирались, точка выпадала из
 *     расчёта, и правка проходила. Выглядело это так, будто изменился
 *     только адрес, а на деле рейс терял точку: маршрут пересчитать
 *     нечем, линия остаётся от прежних точек, метки нет. Теперь это
 *     отказ — то же правило, что и при публикации.
 *
 *   иначе — новый адрес с координатами, patch как раньше.
 */
type AddressPatch = 'untouched' | 'nowhere' | Record<string, string>;

function readAddress(read: FieldReader, before: string): AddressPatch {
  const address = read('address');
  if (!address || address === before) return 'untouched';

  const lat = read('address_lat');
  const lon = read('address_lon');
  if (!hasCoordinates({ lat, lon })) return 'nowhere';

  return {
    address,
    city: cityOf(read),
    country: read('address_country'),
    lat,
    lon,
    geocode_score: read('address_score'),
  };
}

const reader =
  (formData: FormData, prefix: string): FieldReader =>
  (field) =>
    str(formData, `${prefix}_${field}`);

/* ── Пересчёт маршрута ──────────────────────────────────────────── */

type Client = Awaited<ReturnType<typeof createClient>>;

/**
 * Считает маршрут заново и кладёт на место стёртого правкой.
 *
 * Неудача расчёта проходит молча. Правка уже записана и уже уехала
 * перевозчику; ронять её из-за того, что не ответил чужой сервис, значит
 * поставить карту выше маршрута.
 *
 * А вот посчитать нечем — не молчание, а стирание. Прежняя линия была
 * проложена по точкам, одной из которых в рейсе больше нет, и оставить
 * её значит показывать заказчику и водителю маршрут, который никуда не
 * ведёт. Пустая карта честнее нарисованной неправды.
 *
 * Дойти до стирания стало трудно: адрес без координат больше не
 * принимается ни при публикации, ни при правке. Остаются заказы,
 * созданные до этого правила, — у них координат нет и не будет, пока
 * заказчик не переберёт точки руками.
 */
async function refreshRoute(supabase: Client, orderId: string, locale: Locale): Promise<void> {
  const { data: stops } = await supabase
    .from('order_stops')
    .select('lat,lon,country,role')
    .eq('order_id', orderId)
    .order('sequence');

  const complete =
    stops !== null && stops.length >= 2 && stops.every((s) => s.lat !== null && s.lon !== null);

  if (!complete) {
    await clearRoute(supabase, orderId);
    return;
  }

  const points = stops.map((s) => ({ lat: s.lat as number, lon: s.lon as number }));

  /*
   * Профиль грузовика — по стране забора, как и при публикации. Пустая
   * страна у точек, созданных до появления колонки, даёт умолчание: то
   * же поведение, что было до этой правки.
   */
  const country = stops.find((s) => s.role === 'PICKUP')?.country ?? 'FI';
  const route = await computeRouteAction(points, country, locale);
  if (!route.ok) return;

  await supabase.rpc('store_route', {
    p_order_id: orderId,
    p_route: {
      geometry: route.geometry,
      bounds: route.bounds,
      fingerprint: route.fingerprint,
      km: String(route.km),
      legs: route.legs,
    },
  });
}

/**
 * Убирает линию, переставшую соответствовать точкам.
 *
 * Отдельной функции в базе для этого нет и не нужно: store_route берёт
 * каждое поле через nullif, поэтому пустой объект обнуляет геометрию,
 * границы, отпечаток и посчитанный пробег одним вызовом. Права при этом
 * проверяет та же функция и тем же способом, что при записи маршрута, —
 * второй путь к тем же колонкам не заводится.
 *
 * distance_km store_route не трогает никогда, и здесь это ровно то, что
 * нужно: ставка согласована, линия — нет.
 */
async function clearRoute(supabase: Client, orderId: string): Promise<void> {
  await supabase.rpc('store_route', { p_order_id: orderId, p_route: {} });
}

/* ── Действия ───────────────────────────────────────────────────── */

/**
 * Правка существующей точки.
 *
 * Патч уезжает целиком, со всеми полями роли: что из этого на самом деле
 * изменилось, решает база, сравнивая с тем, что в точке записано. Считать
 * разницу здесь значило бы сравнивать с копией, показанной в форме, — а
 * она устарела ровно настолько, сколько форма была открыта.
 */
export async function amendStopAction(
  _previous: AmendState,
  formData: FormData,
): Promise<AmendState> {
  const locale = toLocale(formData.get('locale'));

  const forbidden = await guard(locale);
  if (forbidden) return { error: forbidden, saved: false };

  const role = str(formData, 'role') as StopRole;
  const read = reader(formData, 'stop');

  const address = readAddress(read, str(formData, 'address_before'));
  if (address === 'nowhere') {
    return { error: (await getDictionary(locale)).routing.addressRequired, saved: false };
  }

  const patch = {
    ...readFields(read, role),
    ...(address === 'untouched' ? {} : address),
  };

  const supabase = await createClient();
  const orderId = str(formData, 'order_id');

  const { data, error } = await supabase.rpc('amend_stop', {
    p_stop_id: str(formData, 'stop_id'),
    p_patch: patch,
  });

  if (error) return { error: await explain(locale, error.code, error.message), saved: false };

  /*
   * Пересчёт нужен, только когда точка переехала.
   *
   * Признак того, что правка состоялась, — заполненный changes, а не сам
   * ответ. Функция возвращает SQL NULL, когда менять было нечего, но
   * PostgREST разворачивает NULL-композит в объект из одних null, и
   * проверка на пустоту ответа считала бы состоявшейся любую правку.
   */
  if (data?.changes && 'address' in patch) await refreshRoute(supabase, orderId, locale);

  revalidatePath(`/${locale}`, 'layout');
  return { ...idle, saved: true };
}

/** Новая загрузка или выгрузка перед указанной точкой. */
export async function addStopAction(
  _previous: AmendState,
  formData: FormData,
): Promise<AmendState> {
  const locale = toLocale(formData.get('locale'));

  const forbidden = await guard(locale);
  if (forbidden) return { error: forbidden, saved: false };

  const role = str(formData, 'role') as StopRole;
  const read = reader(formData, 'stop');

  /* У новой точки адрес новый по определению — сравнивать не с чем. */
  const address = readAddress(read, '');
  if (address === 'nowhere' || address === 'untouched') {
    return { error: (await getDictionary(locale)).routing.addressRequired, saved: false };
  }

  const supabase = await createClient();
  const orderId = str(formData, 'order_id');

  const { error } = await supabase.rpc('add_stop', {
    p_before_stop_id: str(formData, 'before_stop_id'),
    p_stop: {
      role,
      ...readFields(read, role),
      ...address,
    },
  });

  if (error) return { error: await explain(locale, error.code, error.message), saved: false };

  await refreshRoute(supabase, orderId, locale);

  revalidatePath(`/${locale}`, 'layout');
  return { ...idle, saved: true };
}

/** Убрать непройденную точку из маршрута. */
export async function removeStopAction(
  _previous: AmendState,
  formData: FormData,
): Promise<AmendState> {
  const locale = toLocale(formData.get('locale'));

  const forbidden = await guard(locale);
  if (forbidden) return { error: forbidden, saved: false };

  const supabase = await createClient();
  const orderId = str(formData, 'order_id');

  const { error } = await supabase.rpc('remove_stop', {
    p_stop_id: str(formData, 'stop_id'),
  });

  if (error) return { error: await explain(locale, error.code, error.message), saved: false };

  await refreshRoute(supabase, orderId, locale);

  revalidatePath(`/${locale}`, 'layout');
  return { ...idle, saved: true };
}

/**
 * Перевозчик отметил, что видел изменения.
 *
 * Единственное действие этого модуля, доступное не заказчику, — потому
 * что подтверждает не тот, кто правил, а тот, кому правка адресована.
 * Права проверяет база: отметить может только назначенный перевозчик.
 */
export async function acknowledgeAmendmentsAction(formData: FormData): Promise<void> {
  const locale = toLocale(formData.get('locale'));

  const viewer = await getViewer();
  if (viewer.status !== 'ready' || viewer.role !== 'CARRIER') return;

  const supabase = await createClient();
  await supabase.rpc('acknowledge_amendments', {
    p_order_id: str(formData, 'order_id'),
  });

  revalidatePath(`/${locale}`, 'layout');
}

'use server';

import { dispatchPublishedOrder, notifyDirectOrder, wasPublished } from '@/lib/orders/dispatch';
import { revalidateOrder } from '@/lib/orders/revalidate';
import { getViewer } from '@/lib/auth/viewer';
import { getDictionary, isLocale, type Locale, defaultLocale } from '@/lib/i18n';
import { createClient } from '@/lib/supabase/server';

export type MatchingState = { error: string | null };

function toLocale(value: FormDataEntryValue | null): Locale {
  const raw = String(value ?? '');
  return isLocale(raw) ? raw : defaultLocale;
}

/**
 * Превращает код ошибки из базы в понятный текст.
 *
 * Все отказы матчинга — это гонки: пока человек смотрел на экран, срок
 * вышел, места заняли или заказ забрал другой. Показывать код или
 * английское сообщение Postgres здесь бессмысленно.
 */
async function explain(locale: Locale, code: string | undefined, message: string | undefined) {
  const t = await getDictionary(locale);

  if (code === '23505') return t.matching.alreadyTaken;
  /*
   * 55001 — своя ошибка take_order: груза больше, чем берёт тягач с
   * таким числом осей. Отдельный код, а не разбор текста: сообщение из
   * базы содержит килограммы и по-русски, а перевозчику нужно сказать,
   * какая машина подойдёт.
   */
  if (code === '55001') return t.fleet.tooHeavy;
  /*
   * 55002 — контейнер не встал на шасси. Свой код, а не общий 55000, по
   * той же причине, что и вес: перевозчику нужно понять, что дело в
   * машине, а не в занятом заказе, и выбрать другую.
   */
  if (code === '55002') return t.matching.noChassis;
  /*
   * 55003 — машина не того класса или кузова не хватает по метрам. Свой
   * код по той же причине: перевозчику нужно понять, что дело в машине,
   * а не в занятом заказе, и выбрать другую.
   */
  if (code === '55003') return t.matching.wrongClass;
  if (code === '55000' && message?.includes('Мест нет')) return t.matching.noSlotsLeft;
  if (code === '55000') return t.matching.tooLate;

  return t.matching.failed;
}

/** «Беру» — отклик перевозчика конкретной машиной. */
export async function takeOrderAction(
  _previous: MatchingState,
  formData: FormData,
): Promise<MatchingState> {
  const locale = toLocale(formData.get('locale'));

  const viewer = await getViewer();
  if (viewer.status !== 'ready' || viewer.role !== 'CARRIER') {
    return { error: (await getDictionary(locale)).error.forbidden };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc('take_order', {
    p_order_id: String(formData.get('order_id') ?? ''),
    p_vehicle_id: String(formData.get('vehicle_id') ?? ''),
  });

  revalidateOrder(locale);

  return { error: error ? await explain(locale, error.code, error.message) : null };
}

/** Выбор заказчиком одного отклика из трёх. */
export async function chooseOfferAction(formData: FormData): Promise<void> {
  const locale = toLocale(formData.get('locale'));

  const supabase = await createClient();
  await supabase.rpc('choose_offer', { p_offer_id: String(formData.get('offer_id') ?? '') });

  revalidateOrder(locale);
}

/** Подтверждение работы выбранным перевозчиком. */
export async function confirmOrderAction(formData: FormData): Promise<void> {
  const locale = toLocale(formData.get('locale'));

  const supabase = await createClient();
  await supabase.rpc('confirm_order', { p_order_id: String(formData.get('order_id') ?? '') });

  revalidateOrder(locale);
}

/**
 * Откат до старта: доступен обеим сторонам (ТЗ §6).
 *
 * После прямого назначения откат — первый выход заказа на общий стол, и
 * перевозчики страны забора получают его письмом, как новую публикацию.
 * Уведомления в кабинеты пишет триггер; здесь только почтовый дубль.
 */
export async function cancelOrderAction(formData: FormData): Promise<void> {
  const locale = toLocale(formData.get('locale'));
  const orderId = String(formData.get('order_id') ?? '');

  const published = await wasPublished(orderId);

  const supabase = await createClient();
  const { data } = await supabase.rpc('cancel_order', { p_order_id: orderId });

  if (!published && data?.status === 'OPEN') await dispatchPublishedOrder(orderId);

  revalidateOrder(locale);
}

export type DirectState = { error: string | null; done: boolean };

/**
 * Заказ со стола, на который ещё никто не откликнулся, — знакомой машине.
 *
 * Ошибки те же, что у публикации напрямую: машина перестала быть
 * знакомой, не выходит на рейсы или не подходит заказу. Плюс гонка:
 * пока заказчик выбирал машину, на заказ откликнулись.
 */
export async function directAssignAction(
  _previous: DirectState,
  formData: FormData,
): Promise<DirectState> {
  const locale = toLocale(formData.get('locale'));
  const t = await getDictionary(locale);

  const viewer = await getViewer();
  if (viewer.status !== 'ready' || viewer.role !== 'SHIPPER') {
    return { error: t.error.forbidden, done: false };
  }

  const orderId = String(formData.get('order_id') ?? '');
  const vehicleId = String(formData.get('vehicle_id') ?? '');
  if (!vehicleId) return { error: t.direct.chooseVehicle, done: false };

  const supabase = await createClient();
  const { error } = await supabase.rpc('direct_assign_order', {
    p_order_id: orderId,
    p_vehicle_id: vehicleId,
  });

  if (error) {
    const message =
      error.code === '42501'
        ? t.direct.notKnown
        : error.code === '55004'
          ? t.direct.unavailable
          : error.code === '55001' || error.code === '55002' || error.code === '55003'
            ? t.direct.notFit
            : error.code === '55000'
              ? t.direct.hasOffers
              : t.matching.failed;
    return { error: message, done: false };
  }

  await notifyDirectOrder(orderId);

  revalidateOrder(locale);
  return { error: null, done: true };
}

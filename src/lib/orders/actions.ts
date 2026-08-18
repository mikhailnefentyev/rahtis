'use server';

import { revalidatePath } from 'next/cache';
import { getViewer } from '@/lib/auth/viewer';
import { getDictionary, isLocale, type Locale } from '@/lib/i18n';
import { createClient } from '@/lib/supabase/server';
import { tonnesToKg } from '@/lib/orders/stopFields';
import type { StopRole } from '@/types/db';

export type PublishState = { error: string | null; ref: string | null };

function toLocale(value: FormDataEntryValue | null): Locale {
  const raw = String(value ?? '');
  return isLocale(raw) ? raw : 'ru';
}

const str = (form: FormData, key: string): string =>
  String(form.get(key) ?? '').trim();

/** Евро из формы в центы: деньги в системе целые (см. lib/config.ts). */
function toCents(value: string): number | null {
  const normalised = value.replace(/\s/g, '').replace(',', '.');
  const euros = Number.parseFloat(normalised);
  return Number.isFinite(euros) && euros > 0 ? Math.round(euros * 100) : null;
}

type StopInput = {
  role: StopRole;
  place_kind?: string;
  place_name?: string;
  company_name?: string;
  address: string;
  city: string;
  contact_name?: string;
  contact_phone?: string;
  scheduled_date?: string;
  scheduled_time?: string;
  external_ref?: string;
  returns_loaded?: boolean;
  note?: string;
  booking_ref?: string;
  cargo_weight_kg?: string;
  consignee?: string;
  seal_required?: boolean;
};

/** Читает одно поле точки. Для доп.точек — по позиции в массиве. */
type FieldReader = (field: string) => string;

/**
 * Пломба приходит списком из трёх значений, а не флажком: у повторяемых
 * точек снятый флажок не отправляется вовсе и сбил бы позиции в массиве.
 * Пустая строка означает «про пломбу не сказали» — это не «не нужна».
 */
function toSeal(value: string): boolean | undefined {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return undefined;
}

/**
 * Одна точка маршрута из полей формы.
 *
 * Поля собираются все подряд, без оглядки на роль: что из них вообще
 * применимо, решают ограничения базы (миграция stop_details) — здесь
 * повторять ту же матрицу значило бы завести второй источник правды.
 * Форма неприменимые поля просто не показывает и присылает пустыми.
 */
function readStop(read: FieldReader, role: StopRole): StopInput {
  return {
    role,
    place_kind: read('place_kind'),
    place_name: read('place_name'),
    company_name: read('company'),
    address: read('address'),
    city: read('city'),
    contact_name: read('contact'),
    contact_phone: read('phone').replace(/[\s-]/g, ''),
    scheduled_date: read('date'),
    scheduled_time: read('time'),
    external_ref: read('ref'),
    note: read('note'),
    booking_ref: read('booking_ref'),
    /* Тонны формы в килограммы базы: вес хранится целым, как и деньги. */
    cargo_weight_kg: tonnesToKg(read('weight'))?.toString(),
    consignee: read('consignee'),
    seal_required: toSeal(read('seal')),
  };
}

/**
 * Собирает точки маршрута из полей формы.
 *
 * Доп.точек может быть сколько угодно, поэтому их поля приходят массивами
 * с одинаковыми именами — форма добавляет и убирает блоки, а порядок
 * сохраняется порядком элементов в FormData. Форма обязана присылать
 * каждое поле для каждой доп.точки, в том числе пустым: пропуск сдвинул
 * бы все последующие точки на одну позицию.
 */
function collectStops(formData: FormData): StopInput[] {
  const stops: StopInput[] = [];

  const single =
    (prefix: string): FieldReader =>
    (field) =>
      str(formData, `${prefix}_${field}`);

  stops.push(readStop(single('pickup'), 'PICKUP'));

  /* Доп.точки идут между забором и выгрузкой — так их и читают в кабине. */
  const extraRoles = formData.getAll('extra_role').map(String);
  const columns = new Map<string, string[]>();
  const atIndex =
    (index: number): FieldReader =>
    (field) => {
      const key = `extra_${field}`;
      if (!columns.has(key)) columns.set(key, formData.getAll(key).map(String));
      return columns.get(key)![index]?.trim() ?? '';
    };

  extraRoles.forEach((role, index) => {
    stops.push(readStop(atIndex(index), role === 'EXTRA_UNLOAD' ? 'EXTRA_UNLOAD' : 'EXTRA_LOAD'));
  });

  stops.push(readStop(single('delivery'), 'DELIVERY'));

  if (formData.get('has_continuation') === 'on') {
    stops.push(readStop(single('cont'), 'CONTINUATION'));
  }

  if (formData.get('has_return') === 'on') {
    stops.push({
      ...readStop(single('ret'), 'TRAILER_RETURN'),
      returns_loaded: formData.get('ret_loaded') === 'on',
    });
  }

  return stops;
}

/**
 * Публикация заказа.
 *
 * Заказ и его точки пишутся одним вызовом create_order: они лежат в разных
 * таблицах, а половина маршрута без второй половины — состояние, которого
 * быть не должно.
 */
export async function publishOrderAction(
  _previous: PublishState,
  formData: FormData,
): Promise<PublishState> {
  const locale = toLocale(formData.get('locale'));
  const t = await getDictionary(locale);

  const viewer = await getViewer();
  if (viewer.status !== 'ready' || viewer.role !== 'SHIPPER' || !viewer.company) {
    return { error: t.error.forbidden, ref: null };
  }
  if (viewer.company.status !== 'ACTIVE') {
    return { error: t.orderForm.needActive, ref: null };
  }

  const rateCents = toCents(str(formData, 'rate'));
  const distance = Number.parseInt(str(formData, 'distance_km').replace(/\D/g, ''), 10);

  if (!rateCents || !Number.isFinite(distance) || distance <= 0) {
    return { error: t.validation.positiveNumber, ref: null };
  }

  const supabase = await createClient();

  const { data, error } = await supabase.rpc('create_order', {
    p_order: {
      order_type: str(formData, 'order_type'),
      shipper_ref: str(formData, 'shipper_ref'),
      trailer: str(formData, 'trailer'),
      distance_km: String(distance),
      rate_cents: String(rateCents),
      comment: str(formData, 'comment'),
    },
    p_stops: collectStops(formData),
    p_publish: true,
  });

  if (error || !data) {
    /* 55000 — компания не активна; остальное показываем общим текстом. */
    return {
      error: error?.code === '55000' ? t.orderForm.needActive : t.orderForm.failed,
      ref: null,
    };
  }

  revalidatePath(`/${locale}/shipper`, 'layout');
  return { error: null, ref: data.ref };
}

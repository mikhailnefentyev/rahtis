'use server';

import { revalidatePath } from 'next/cache';
import { getViewer } from '@/lib/auth/viewer';
import { getDictionary, isLocale, type Locale } from '@/lib/i18n';
import { createClient } from '@/lib/supabase/server';
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
};

/**
 * Собирает точки маршрута из полей формы.
 *
 * Доп.точек может быть сколько угодно, поэтому их поля приходят массивами
 * с одинаковыми именами — форма добавляет и убирает блоки, а порядок
 * сохраняется порядком элементов в FormData.
 */
function collectStops(formData: FormData): StopInput[] {
  const stops: StopInput[] = [];

  stops.push({
    role: 'PICKUP',
    place_kind: str(formData, 'pickup_place_kind'),
    place_name: str(formData, 'pickup_place_name'),
    address: str(formData, 'pickup_address'),
    city: str(formData, 'pickup_city'),
    scheduled_date: str(formData, 'pickup_date'),
    scheduled_time: str(formData, 'pickup_time'),
  });

  /* Доп.точки идут между забором и выгрузкой — так их и читают в кабине. */
  const extraRoles = formData.getAll('extra_role').map(String);
  const extraCompanies = formData.getAll('extra_company').map(String);
  const extraAddresses = formData.getAll('extra_address').map(String);
  const extraCities = formData.getAll('extra_city').map(String);
  const extraDates = formData.getAll('extra_date').map(String);
  const extraTimes = formData.getAll('extra_time').map(String);

  extraRoles.forEach((role, index) => {
    stops.push({
      role: role === 'EXTRA_UNLOAD' ? 'EXTRA_UNLOAD' : 'EXTRA_LOAD',
      company_name: extraCompanies[index]?.trim(),
      address: extraAddresses[index]?.trim() ?? '',
      city: extraCities[index]?.trim() ?? '',
      scheduled_date: extraDates[index]?.trim(),
      scheduled_time: extraTimes[index]?.trim(),
    });
  });

  stops.push({
    role: 'DELIVERY',
    company_name: str(formData, 'delivery_company'),
    address: str(formData, 'delivery_address'),
    city: str(formData, 'delivery_city'),
    contact_name: str(formData, 'delivery_contact'),
    contact_phone: str(formData, 'delivery_phone').replace(/[\s-]/g, ''),
    scheduled_date: str(formData, 'delivery_date'),
    scheduled_time: str(formData, 'delivery_time'),
  });

  if (formData.get('has_continuation') === 'on') {
    stops.push({
      role: 'CONTINUATION',
      company_name: str(formData, 'cont_company'),
      address: str(formData, 'cont_address'),
      city: str(formData, 'cont_city'),
      external_ref: str(formData, 'cont_ref'),
      scheduled_date: str(formData, 'cont_date'),
      scheduled_time: str(formData, 'cont_time'),
    });
  }

  if (formData.get('has_return') === 'on') {
    stops.push({
      role: 'TRAILER_RETURN',
      place_name: str(formData, 'ret_place'),
      address: str(formData, 'ret_address'),
      city: str(formData, 'ret_city'),
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

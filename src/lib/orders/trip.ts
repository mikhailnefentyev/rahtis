'use server';

import { revalidateOrder, revalidateOrderFinished } from '@/lib/orders/revalidate';
import { getViewer } from '@/lib/auth/viewer';
import { getDictionary, isLocale, type Locale, defaultLocale } from '@/lib/i18n';
import { createClient } from '@/lib/supabase/server';
import { refineEtaAfter } from '@/lib/orders/eta';
import { operationsLocalToIso } from '@/lib/dates';

/**
 * Отметки прохождения рейса.
 *
 * Отмечает перевозчик из кабинета. У водителя веб-кабинета нет — по ТЗ §7
 * он общается с платформой через WhatsApp-агента, и на Этапе 8 сюда же
 * будет ходить n8n от его имени. Функции базы для этого и рассчитаны:
 * одна точка, одно необязательное описание повреждения, — поэтому
 * появление агента не потребует переделки.
 */

export type TripState = { error: string | null };

function toLocale(value: FormDataEntryValue | null): Locale {
  const raw = String(value ?? '');
  return isLocale(raw) ? raw : defaultLocale;
}

/**
 * Превращает код отказа в понятный текст.
 *
 * Все отказы здесь — про порядок и права: точка не та, рейс уже не идёт,
 * заказ не ваш. Показывать сообщение Postgres бессмысленно, а общее «что-то
 * пошло не так» не подсказывает, что делать.
 */
async function explain(locale: Locale, code: string | undefined, message: string | undefined) {
  const t = await getDictionary(locale);

  if (code === '42501') return t.trip.notYours;
  if (code === '55000' && message?.includes('по порядку')) return t.trip.outOfOrder;
  /*
   * Текст ошибки базы — по-русски, для разработчика: на экран финскому
   * пользователю он не идёт (прогон 26.09.2026). Причина остаётся в журнале.
   */
  if (code === '55000') {
    console.warn('[orders] отказ 55000:', message);
    return t.trip.failed;
  }

  return t.trip.failed;
}

async function guard(locale: Locale) {
  const viewer = await getViewer();
  if (viewer.status !== 'ready' || viewer.role !== 'CARRIER') {
    return (await getDictionary(locale)).error.forbidden;
  }
  return null;
}

/**
 * Координата из формы.
 *
 * Мусор равен отсутствию: база всё равно проверит своими правилами, а
 * здесь важно только не превратить пустую строку в ноль — нуль-остров в
 * Гвинейском заливе выглядит как исправная координата.
 */
function readPosition(formData: FormData): { lat: number; lon: number; accuracyM: number | null } | null {
  const lat = Number.parseFloat(String(formData.get('lat') ?? ''));
  const lon = Number.parseFloat(String(formData.get('lon') ?? ''));
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;

  const accuracy = Number.parseInt(String(formData.get('accuracy_m') ?? ''), 10);
  return { lat, lon, accuracyM: Number.isFinite(accuracy) ? accuracy : null };
}

/** «Пройдена» — с описанием повреждения, если оно есть. */
export async function completeStopAction(
  _previous: TripState,
  formData: FormData,
): Promise<TripState> {
  const locale = toLocale(formData.get('locale'));

  const forbidden = await guard(locale);
  if (forbidden) return { error: forbidden };

  /*
   * Координата нажатия приходит скрытыми полями: её спрашивает у
   * браузера сама панель, перед отправкой формы. Сюда она попадает
   * строкой, как всё из формы, и разбирается настолько мягко, насколько
   * возможно — отметка не должна сорваться из-за неудачного замера.
   */
  const position = readPosition(formData);

  const stopId = String(formData.get('stop_id') ?? '');

  const supabase = await createClient();
  const { error } = await supabase.rpc('complete_stop', {
    p_stop_id: stopId,
    p_damage_note: String(formData.get('damage_note') ?? '').trim() || undefined,
    p_lat: position?.lat,
    p_lon: position?.lon,
    p_accuracy_m: position?.accuracyM ?? undefined,
  });

  /*
   * Оценку по маршруту следующей точке база уже поставила; здесь она
   * уточняется пробками до перерисовки, чтобы заказчик и перевозчик
   * сразу видели одну и ту же цифру.
   */
  if (!error) await refineEtaAfter(supabase, stopId);

  revalidateOrder(locale);

  return { error: error ? await explain(locale, error.code, error.message) : null };
}

/**
 * Перевозчик сам называет время прибытия на следующую точку.
 *
 * Время вводится по Хельсинки — как смены водителей и как всё время на
 * платформе: оценку показывают по Хельсинки, и ввод по поясу устройства
 * дал бы у водителя в Стокгольме цифру на час раньше сказанной.
 */
export async function setStopEtaAction(
  _previous: TripState,
  formData: FormData,
): Promise<TripState> {
  const locale = toLocale(formData.get('locale'));

  const forbidden = await guard(locale);
  if (forbidden) return { error: forbidden };

  const t = await getDictionary(locale);
  const eta = operationsLocalToIso(String(formData.get('eta') ?? ''));
  if (!eta) return { error: t.trip.etaInvalid };

  const supabase = await createClient();
  const { error } = await supabase.rpc('set_stop_eta', {
    p_stop_id: String(formData.get('stop_id') ?? ''),
    p_eta: eta,
    p_source: 'CARRIER',
  });

  revalidateOrder(locale);

  if (error?.code === '22023') return { error: t.trip.etaInvalid };
  if (error?.code === '55000') return { error: t.trip.etaLocked };
  return { error: error ? await explain(locale, error.code, error.message) : null };
}

/** Снятие отметки с последней пройденной точки: ошибочные нажатия неизбежны. */
export async function uncompleteStopAction(formData: FormData): Promise<void> {
  const locale = toLocale(formData.get('locale'));

  if (await guard(locale)) return;

  const supabase = await createClient();
  await supabase.rpc('uncomplete_stop', {
    p_stop_id: String(formData.get('stop_id') ?? ''),
  });

  revalidateOrder(locale);
}

/* ── Документы рейса (ТЗ §9) ───────────────────────────────────── */

const BUCKET = 'trip-docs';
const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];

const DOCUMENT_KINDS = ['CMR', 'LOADING_PHOTO', 'UNLOADING_PHOTO', 'DAMAGE_PHOTO'] as const;
type DocumentKind = (typeof DOCUMENT_KINDS)[number];

/**
 * Загрузка документа рейса.
 *
 * Файл идёт через сервер, а не напрямую в Storage — по той же причине,
 * что у документов компании: при прямой загрузке обрыв между записью
 * файла и записью строки оставил бы объект, о котором база не знает.
 * Здесь неудачная вставка убирает загруженный файл.
 *
 * Оба шага выполняются клиентом пользователя, поэтому политики Storage и
 * RLS проверяются по-настоящему — секретный ключ тут не участвует.
 */
export async function uploadTripDocumentAction(
  _previous: TripState,
  formData: FormData,
): Promise<TripState> {
  const locale = toLocale(formData.get('locale'));
  const t = await getDictionary(locale);

  const forbidden = await guard(locale);
  if (forbidden) return { error: forbidden };

  const viewer = await getViewer();
  const orderId = String(formData.get('order_id') ?? '');
  const kind = String(formData.get('kind') ?? '') as DocumentKind;

  if (!DOCUMENT_KINDS.includes(kind)) return { error: t.documents.uploadFailed };

  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) return { error: t.validation.required };
  if (file.size > MAX_BYTES) return { error: t.documents.tooLarge };
  if (!ALLOWED_TYPES.includes(file.type)) return { error: t.documents.wrongType };

  /*
   * Первый сегмент пути — идентификатор заказа: по нему политики Storage
   * решают, сторона ли вызывающий этому рейсу. Имя обезличивается
   * префиксом, чтобы две загрузки с одинаковым именем не столкнулись.
   */
  const safeName = file.name.replace(/[^\w.\-]+/g, '_').slice(-80);
  const path = `${orderId}/${kind}/${crypto.randomUUID()}-${safeName}`;

  const supabase = await createClient();

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });

  if (uploadError) return { error: t.documents.uploadFailed };

  const stopId = String(formData.get('stop_id') ?? '');

  const { error: insertError } = await supabase.from('order_documents').insert({
    order_id: orderId,
    stop_id: stopId || null,
    kind,
    storage_path: path,
    file_name: file.name.slice(-120),
    mime_type: file.type,
    size_bytes: file.size,
    uploaded_by: viewer.status === 'ready' ? viewer.userId : null,
  });

  if (insertError) {
    /* Запись не удалась — файл без неё бесполезен, убираем. */
    await supabase.storage.from(BUCKET).remove([path]);
    return { error: t.documents.uploadFailed };
  }

  revalidateOrderFinished(locale);
  return { error: null };
}

/**
 * Ссылка на документ рейса — на пять минут.
 *
 * Выписывает клиент пользователя, а не секретный ключ: политики Storage
 * проверяются ещё раз в момент выдачи, и заказчик чужого рейса ссылку не
 * получит, даже зная путь.
 */
export async function tripDocumentUrlAction(storagePath: string): Promise<string | null> {
  const viewer = await getViewer();
  if (viewer.status !== 'ready') return null;

  const supabase = await createClient();
  const { data } = await supabase.storage.from(BUCKET).createSignedUrl(storagePath, 300);

  return data?.signedUrl ?? null;
}

/** Закрытие рейса: все точки пройдены и приложен CMR. */
export async function closeOrderAction(
  _previous: TripState,
  formData: FormData,
): Promise<TripState> {
  const locale = toLocale(formData.get('locale'));

  const forbidden = await guard(locale);
  if (forbidden) return { error: forbidden };

  const supabase = await createClient();
  const { error } = await supabase.rpc('close_order', {
    p_order_id: String(formData.get('order_id') ?? ''),
  });

  revalidateOrderFinished(locale);

  return { error: error ? await explain(locale, error.code, error.message) : null };
}

'use server';

import { revalidatePath } from 'next/cache';
import { getViewer } from '@/lib/auth/viewer';
import { getDictionary, isLocale, type Locale, defaultLocale } from '@/lib/i18n';
import { createClient } from '@/lib/supabase/server';

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
  if (code === '55000') return message ?? t.trip.failed;

  return t.trip.failed;
}

async function guard(locale: Locale) {
  const viewer = await getViewer();
  if (viewer.status !== 'ready' || viewer.role !== 'CARRIER') {
    return (await getDictionary(locale)).error.forbidden;
  }
  return null;
}

/** «Пройдена» — с описанием повреждения, если оно есть. */
export async function completeStopAction(
  _previous: TripState,
  formData: FormData,
): Promise<TripState> {
  const locale = toLocale(formData.get('locale'));

  const forbidden = await guard(locale);
  if (forbidden) return { error: forbidden };

  const supabase = await createClient();
  const { error } = await supabase.rpc('complete_stop', {
    p_stop_id: String(formData.get('stop_id') ?? ''),
    p_damage_note: String(formData.get('damage_note') ?? '').trim() || undefined,
  });

  revalidatePath(`/${locale}/carrier`, 'layout');

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

  revalidatePath(`/${locale}/carrier`, 'layout');
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

  revalidatePath(`/${locale}`, 'layout');
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

  revalidatePath(`/${locale}`, 'layout');

  return { error: error ? await explain(locale, error.code, error.message) : null };
}

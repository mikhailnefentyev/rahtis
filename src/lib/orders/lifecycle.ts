'use server';

import { revalidatePath } from 'next/cache';
import { getViewer } from '@/lib/auth/viewer';
import { getDictionary, isLocale, type Locale, defaultLocale } from '@/lib/i18n';
import { createClient } from '@/lib/supabase/server';

/**
 * Что делать, когда всё пошло не так.
 *
 * До сих пор у заказа был один способ уйти из работы — доехать. Заказ,
 * опубликованный по ошибке, висел на столе; перевозчик со сломанной
 * машиной не мог отказаться; заказчик, увидевший неверный километраж, не
 * мог исправить ни цену, ни заказ.
 *
 * Четыре действия закрывают это, и все четыре пишут в журнал заказа —
 * тот же, в котором живут правки маршрута. Одна лента на все события
 * рейса, а не три: спор о том, почему рейс сорвался и откуда взялась
 * сумма, разбирается по одной странице.
 *
 * Права проверяют функции базы, а не эти обёртки: они security definer,
 * и проверка в приложении была бы вторым источником правды, который
 * однажды разойдётся с первым.
 */

export type LifecycleState = { error: string | null; done: boolean };

const idle: LifecycleState = { error: null, done: false };

function toLocale(value: FormDataEntryValue | null): Locale {
  const raw = String(value ?? '');
  return isLocale(raw) ? raw : defaultLocale;
}

const str = (form: FormData, key: string): string => String(form.get(key) ?? '').trim();

/**
 * Отказ базы человеческим языком.
 *
 * Сообщения кода 55000 показываются как есть: их пишет та же функция,
 * которая знает, почему отказала, — «выполненный рейс снять нельзя», «к
 * заказу приложены документы». Заменить их общей фразой значило бы
 * отнять единственную подсказку, что делать дальше.
 */
async function explain(
  locale: Locale,
  code: string | undefined,
  message: string | undefined,
): Promise<string> {
  const t = await getDictionary(locale);

  if (code === '42501') return t.lifecycle.notAllowed;
  if (code === 'P0002') return t.lifecycle.notFound;
  if (code === '55000') return message ?? t.lifecycle.failed;

  return t.lifecycle.failed;
}

/* ── Снятие заказа ──────────────────────────────────────────────── */

/**
 * Заказ уходит из работы совсем.
 *
 * Не то же, что откат (cancelOrderAction): откат возвращает заказ на
 * стол — «пусть возьмёт другой», — а снятие означает «везти не надо».
 * Две кнопки, а не одна: заказчик, нажавший «отмена» с намерением снять
 * груз, получил бы его обратно на стол и новые отклики.
 */
export async function withdrawOrderAction(
  _previous: LifecycleState,
  formData: FormData,
): Promise<LifecycleState> {
  const locale = toLocale(formData.get('locale'));

  const viewer = await getViewer();
  if (viewer.status !== 'ready') {
    return { error: (await getDictionary(locale)).error.forbidden, done: false };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc('withdraw_order', {
    p_order_id: str(formData, 'order_id'),
    p_reason: str(formData, 'reason'),
  });

  if (error) return { error: await explain(locale, error.code, error.message), done: false };

  revalidatePath(`/${locale}`, 'layout');
  return { ...idle, done: true };
}

/* ── Отказ перевозчика ──────────────────────────────────────────── */

/**
 * Перевозчик отказывается от взятого рейса.
 *
 * Куда уйдёт заказ, решает база по состоянию груза: нетронутый рейс
 * возвращается на стол, начатый снимается. Приложение этого не выбирает
 * и не показывает выбор — иначе перевозчик решал бы за заказчика, можно
 * ли ещё передать рейс другому.
 */
export async function abandonOrderAction(
  _previous: LifecycleState,
  formData: FormData,
): Promise<LifecycleState> {
  const locale = toLocale(formData.get('locale'));

  const viewer = await getViewer();
  if (viewer.status !== 'ready' || viewer.role !== 'CARRIER') {
    return { error: (await getDictionary(locale)).error.forbidden, done: false };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc('abandon_order', {
    p_order_id: str(formData, 'order_id'),
    p_reason: str(formData, 'reason'),
  });

  if (error) return { error: await explain(locale, error.code, error.message), done: false };

  revalidatePath(`/${locale}`, 'layout');
  return { ...idle, done: true };
}

/* ── Пересчёт пробега и цены ────────────────────────────────────── */

/**
 * Новый пробег и подтянувшаяся за ним ставка.
 *
 * Оба числа приходят из формы, потому что заказчик их видел: экран
 * показывает «было 836 км / 900 €, стало 937 км / 1008 €», и в базу
 * едет ровно то, что человек принял. Пересчитать здесь заново значило бы
 * записать не то, что было показано.
 *
 * Ставку заказчик может и переписать: подсказка предлагает цену по
 * прежней €/км, но последнее слово о деньгах остаётся за тем, кто платит.
 */
export async function repriceOrderAction(
  _previous: LifecycleState,
  formData: FormData,
): Promise<LifecycleState> {
  const locale = toLocale(formData.get('locale'));
  const t = await getDictionary(locale);

  const viewer = await getViewer();
  if (viewer.status !== 'ready') {
    return { error: t.error.forbidden, done: false };
  }

  const km = Number.parseInt(str(formData, 'distance_km').replace(/\D/g, ''), 10);
  const euros = Number.parseFloat(str(formData, 'rate').replace(/\s/g, '').replace(',', '.'));

  if (!Number.isFinite(km) || km <= 0 || !Number.isFinite(euros) || euros <= 0) {
    return { error: t.validation.positiveNumber, done: false };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc('reprice_order', {
    p_order_id: str(formData, 'order_id'),
    p_distance_km: km,
    p_rate_cents: Math.round(euros * 100),
  });

  if (error) return { error: await explain(locale, error.code, error.message), done: false };

  revalidatePath(`/${locale}`, 'layout');
  return { ...idle, done: true };
}

/* ── Удаление ───────────────────────────────────────────────────── */

/**
 * Настоящее удаление, только оператором.
 *
 * Нужно для пробных и ошибочных заказов, которые иначе копятся в базе
 * навсегда. Границы — в базе: удаляется только то, по чему ничего не
 * произошло. Снятый заказ остаётся снятым; удаление означает, что заказа
 * не было вовсе.
 */
export async function deleteOrderAction(
  _previous: LifecycleState,
  formData: FormData,
): Promise<LifecycleState> {
  const locale = toLocale(formData.get('locale'));

  const viewer = await getViewer();
  if (viewer.status !== 'ready' || viewer.role !== 'ADMIN') {
    return { error: (await getDictionary(locale)).error.forbidden, done: false };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc('delete_order', {
    p_order_id: str(formData, 'order_id'),
  });

  if (error) return { error: await explain(locale, error.code, error.message), done: false };

  revalidatePath(`/${locale}`, 'layout');
  return { ...idle, done: true };
}

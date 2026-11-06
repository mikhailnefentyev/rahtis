'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { stopTimeZone } from '@/lib/country';
import type { Locale } from '@/lib/i18n';
import { getViewerI18n } from '@/lib/i18n/viewer';
import { isDelivered } from '@/lib/track/documents';
import { trackEta, vehicleFix } from '@/lib/track/eta';
import type { Json } from '@/types/database';
import { ASK_KINDS, autoAnswerLang, hasLiveData, isLate, localParts, type AskKind, type AutoFacts, type AutoStop } from './autoAnswer';
import { autoAnswerText } from './autoFormat';
import { CHAT_LANGS, type Chat } from './langs';
import { translateMessage } from './translate';

/** Сколько недостающих переводов делать за одно чтение: дальше — следующим опросом. */
const TRANSLATE_PER_LOAD = 5;

/**
 * Переписка рейса. Права решает база (order_chat): участник рейса, а
 * оператор — только при претензии. Действия общие для кабинета и
 * приложения водителя: сессия у обоих своя, роль база выводит сама.
 *
 * lang — язык читателя. Чужие сообщения без перевода на него
 * переводятся здесь же и сохраняются: язык водителя часто нигде не
 * записан (берётся из браузера), и при отправке сайт его не знал.
 */
export async function loadChatAction(orderId: string, lang?: string): Promise<Chat | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('order_chat', { p_order_id: orderId });
  if (error || !data) return null;
  const chat = data as unknown as Chat;

  if (lang && (CHAT_LANGS as readonly string[]).includes(lang)) {
    const missing = chat.messages
      .filter(
        (m) => !m.mine && !m.quick_code && m.author_role !== 'AUTO' && m.source_lang !== lang && !m.translations?.[lang],
      )
      .slice(-TRANSLATE_PER_LOAD);

    if (missing.length > 0) {
      const admin = createAdminClient();
      await Promise.all(
        missing.map(async (message) => {
          const result = await translateMessage(message.body, [lang]);
          if (!result?.source) return;
          const text = result.translations[lang as keyof typeof result.translations] ?? null;
          /* Язык совпал с исходным — переводить нечего, но язык запоминается, чтобы не спрашивать снова. */
          if (!text && result.source !== lang) return;
          await admin.rpc('merge_message_translation', {
            p_id: message.id,
            p_lang: lang,
            p_text: text ?? '',
            p_source: result.source,
          });
          message.source_lang = message.source_lang ?? result.source;
          if (text && result.source !== lang) message.translations = { ...message.translations, [lang]: text };
        }),
      );
    }
  }

  return chat;
}

export type PostResult = { error: 'closed' | 'tooMany' | 'forbidden' | 'failed' | null };

/**
 * Сообщение и его перевод на известные языки сторон. Перевод ждётся
 * (до 15 с), чтобы собеседник сразу увидел текст на своём языке; не
 * вышло — останется оригинал, а недостающее доделает чтение.
 */
export async function postChatAction(orderId: string, body: string, quick: string | null): Promise<PostResult> {
  const text = body.trim().slice(0, 1000);
  if (!text) return { error: 'failed' };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('post_order_message', {
    p_order_id: orderId,
    p_body: text,
    p_quick: quick ?? undefined,
  });
  if (error || !data) {
    if (error?.code === '55000') return { error: 'closed' };
    if (error?.code === '55001') return { error: 'tooMany' };
    if (error?.code === '42501') return { error: 'forbidden' };
    return { error: 'failed' };
  }

  const posted = data as { id: number; langs: string[] | null };
  if (!quick) {
    const result = await translateMessage(text, posted.langs ?? []);
    if (result) {
      const translations = Object.fromEntries(
        Object.entries(result.translations).filter(([lang]) => lang !== result.source),
      );
      await createAdminClient()
        .from('order_messages')
        .update({ source_lang: result.source, translations: translations as Json })
        .eq('id', posted.id);
    }
  }

  return { error: null };
}

export type AskResult = { error: PostResult['error']; id?: number; previous?: boolean };

/**
 * «Где машина?» — вопрос и сразу автоответ из данных рейса.
 *
 * withQuestion: кнопка пишет и сам вопрос; подсказка под свободным
 * текстом — только ответ (вопрос уже ушёл сообщением). Права и частоту
 * решает база (ask_order_status): ответ этому же человеку за 5 минут —
 * возвращается прежний. Ответ пишется служебным ключом на языке
 * спросившего; данных нет — база уведомляет диспетчера перевозчика.
 */
export async function askChatAction(
  orderId: string,
  kind: AskKind,
  lang: string,
  withQuestion: boolean,
): Promise<AskResult> {
  if (!(ASK_KINDS as readonly string[]).includes(kind)) return { error: 'failed' };
  const locale = autoAnswerLang(lang) as Locale;
  const { t, f } = await getViewerI18n(locale);

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('ask_order_status', {
    p_order_id: orderId,
    p_kind: kind,
    p_body: withQuestion ? t.chatAuto.ask[kind] : undefined,
  });
  if (error || !data) {
    if (error?.code === '55000') return { error: 'closed' };
    if (error?.code === '42501') return { error: 'forbidden' };
    return { error: 'failed' };
  }
  const asked = data as { role: 'SHIPPER' | 'CARRIER'; previous: number | null };
  if (asked.previous) return { error: null, id: asked.previous, previous: true };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'forbidden' };

  const facts = await orderFacts(orderId, kind, asked.role);
  if (!facts) return { error: 'failed' };

  const { data: id, error: postError } = await createAdminClient().rpc('post_order_auto_answer', {
    p_order_id: orderId,
    p_user_id: user.id,
    p_role: asked.role,
    p_body: autoAnswerText(facts, t, f),
    p_lang: locale,
    p_facts: facts as unknown as Json,
    p_notify: !hasLiveData(facts),
  });
  if (postError || id == null) return { error: 'failed' };
  return { error: null, id: Number(id) };
}

/**
 * Факты рейса — то же, что видно на странице отслеживания: этапы,
 * оценка прибытия (GPS превращается только во время), без позиции.
 * Позиции у провайдера не запрашиваются (PRIVACY, GPS 29.10).
 */
async function orderFacts(orderId: string, kind: AskKind, asker: AutoFacts['asker']): Promise<AutoFacts | null> {
  const admin = createAdminClient();
  const [{ data: order }, { data: stopRows }] = await Promise.all([
    admin
      .from('orders')
      .select('status, haul_kind, assigned_company_id, assigned_vehicle_id, assigned_driver_id')
      .eq('id', orderId)
      .maybeSingle(),
    admin
      .from('order_stops')
      .select(
        'role, city, country, lat, lon, scheduled_date, scheduled_time, eta_at, eta_source, eta_updated_at, arrived_at, completed_at',
      )
      .eq('order_id', orderId)
      .order('sequence'),
  ]);
  if (!order) return null;
  const stops = stopRows ?? [];

  const toStop = (s: (typeof stops)[number] | null | undefined): AutoStop | null =>
    s
      ? {
          role: s.role,
          city: s.city,
          country: s.country,
          date: s.scheduled_date,
          time: s.scheduled_time,
          arrivedAt: s.arrived_at,
          completedAt: s.completed_at,
        }
      : null;

  const now = Date.now();
  const delivered = isDelivered(order.status, stops);
  const active = !delivered && (order.status === 'IN_PROGRESS' || order.status === 'AWAIT_DRIVER');
  const next = stops.find((s) => !s.completed_at) ?? null;
  const lastDone = [...stops].reverse().find((s) => s.completed_at) ?? null;
  const pickup = stops.find((s) => s.role === 'PICKUP') ?? stops[0] ?? null;

  const fix =
    active && order.status === 'IN_PROGRESS'
      ? await vehicleFix(order.assigned_vehicle_id, order.assigned_company_id)
      : null;
  const eta = active && next && !next.arrived_at ? await trackEta(next, fix, now) : null;

  return {
    kind,
    asker,
    status: order.status,
    haulKind: order.haul_kind,
    assigned: Boolean(order.assigned_vehicle_id || order.assigned_driver_id),
    delivered,
    pickup: toStop(pickup),
    lastDone: toStop(lastDone),
    next: delivered ? null : toStop(next),
    eta:
      eta && next
        ? {
            at: eta.at,
            late: isLate(localParts(eta.at, stopTimeZone(next.country)), {
              date: next.scheduled_date,
              time: next.scheduled_time,
            }),
          }
        : null,
  };
}

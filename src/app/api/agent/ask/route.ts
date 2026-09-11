import { getViewer } from '@/lib/auth/viewer';
import { deliverDispatch, prepareDispatch } from '@/lib/agent/dispatch';
import { createClient } from '@/lib/supabase/server';

/**
 * Вопрос агенту и ответ на него — одним запросом.
 *
 * Раньше переписка шла через серверное действие: вопрос записывался,
 * страница перерисовывалась целиком, ответ приходил в базу отдельным
 * обращением воркфлоу, и лента добирала его опросом. Три перерисовки на
 * одно сообщение — отсюда и рывки, и потерянная прокрутка.
 *
 * Здесь круг замкнут: пишем вопрос, ждём воркфлоу, забираем ответ,
 * который он успел записать, и отдаём всё браузеру. Страница при этом не
 * перерисовывается вовсе — лента дорисовывает сообщения сама.
 *
 * Почему не звать воркфлоу прямо из браузера, как это делают чаты на
 * витринах: там бот отвечает на вопросы о ценах, а наш читает заказы,
 * ставки и суммы к выплате. Открытый вебхук означал бы, что данные
 * компании достаёт любой, кто узнал адрес. Подпись и одноразовый пропуск
 * остаются на месте — быстрым круг делает не отказ от них, а то, что
 * ответ возвращается тем же запросом.
 */

type Message = {
  id: string;
  sender: string;
  body: string;
  created_at: string;
};

const HISTORY_LIMIT = 100;

export async function POST(request: Request) {
  const viewer = await getViewer();
  /*
   * У оператора компании нет, и это не изъян профиля, а его роль: Aivomaa
   * присутствует в системе посредником, а не стороной сделки. Прежняя
   * проверка требовала компанию у всех и закрывала оператору вход в
   * собственного помощника.
   */
  if (viewer.status !== 'ready' || (!viewer.company && viewer.role !== 'ADMIN')) {
    return Response.json({ error: 'forbidden' }, { status: 403 });
  }

  let payload: { text?: string; conversation_id?: string };
  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: 'malformed json' }, { status: 400 });
  }

  const text = String(payload.text ?? '').trim();
  if (!text) return Response.json({ error: 'text is required' }, { status: 400 });

  const supabase = await createClient();

  /* Аудитория треда — роль спрашивающего: она решает, какой воркфлоу ответит. */
  let conversationId = String(payload.conversation_id ?? '');

  if (!conversationId) {
    const { data, error } = await supabase
      .from('conversations')
      /* Тред оператора без компании: так же требует ограничение базы. */
      .insert({ company_id: viewer.company?.id ?? null, audience: viewer.role })
      .select('id')
      .single();

    if (error || !data) {
      /* Журнал маршрута читает машина, поэтому по-английски. */
      console.error('conversation not created:', error?.message);
      return Response.json({ error: 'conversation not created' }, { status: 500 });
    }
    conversationId = data.id;
  }

  const { data: mine, error: writeError } = await supabase
    .from('messages')
    .insert({
      conversation_id: conversationId,
      sender: 'USER',
      sender_user_id: viewer.userId,
      body: text.slice(0, 8000),
    })
    .select('id, sender, body, created_at')
    .single();

  if (writeError || !mine) {
    console.error('message not stored:', writeError?.message);
    return Response.json({ error: 'message not stored' }, { status: 500 });
  }

  /*
   * Ответ воркфлоу ждём здесь, а не после ответа страницы: браузер уже
   * показал вопрос и рисует «агент думает», ждать ему не больно. Зато
   * ответ приходит вместе с этим запросом, без второго круга.
   */
  const delivery = await prepareDispatch(conversationId, mine.id);
  if (delivery) await deliverDispatch(delivery);

  const { data: answers } = await supabase
    .from('messages')
    .select('id, sender, body, created_at')
    .eq('conversation_id', conversationId)
    .gt('created_at', mine.created_at)
    .order('created_at')
    .limit(HISTORY_LIMIT);

  const { data: conversation } = await supabase
    .from('conversations')
    .select('pending_since')
    .eq('id', conversationId)
    .maybeSingle();

  return Response.json({
    conversation_id: conversationId,
    messages: [mine, ...((answers ?? []) as Message[])],
    /* Воркфлоу мог не успеть: тогда лента дождётся ответа опросом. */
    pending: Boolean(conversation?.pending_since),
  });
}

/**
 * Что появилось в треде после указанного момента.
 *
 * Нужно на случай, когда воркфлоу не уложился в отведённое время: ответ
 * придёт позже, и лента должна его забрать, не перерисовывая страницу.
 */
export async function GET(request: Request) {
  const viewer = await getViewer();
  if (viewer.status !== 'ready' || (!viewer.company && viewer.role !== 'ADMIN')) {
    return Response.json({ error: 'forbidden' }, { status: 403 });
  }

  const url = new URL(request.url);
  const conversationId = url.searchParams.get('conversation') ?? '';
  const after = url.searchParams.get('after') ?? '';

  if (!conversationId || !after) {
    return Response.json({ error: 'conversation and after are required' }, { status: 400 });
  }

  const supabase = await createClient();

  /* Чужой тред сюда не проходит: строки отбирает RLS, а не эта проверка. */
  const { data: messages } = await supabase
    .from('messages')
    .select('id, sender, body, created_at')
    .eq('conversation_id', conversationId)
    .gt('created_at', after)
    .order('created_at')
    .limit(HISTORY_LIMIT);

  const { data: conversation } = await supabase
    .from('conversations')
    .select('pending_since')
    .eq('id', conversationId)
    .maybeSingle();

  return Response.json({
    messages: (messages ?? []) as Message[],
    pending: Boolean(conversation?.pending_since),
  });
}

/**
 * Стереть переписку целиком.
 *
 * Правило, кому можно, живёт в базе: функция сверяет компанию треда с
 * компанией спрашивающего и отказывает, пока помощник отвечает. Здесь
 * только проверка входа — повторять правило в двух местах значит
 * однажды их развести.
 */
export async function DELETE(request: Request) {
  const viewer = await getViewer();
  if (viewer.status !== 'ready' || (!viewer.company && viewer.role !== 'ADMIN')) {
    return Response.json({ error: 'forbidden' }, { status: 403 });
  }

  const url = new URL(request.url);
  const conversationId = url.searchParams.get('conversation') ?? '';
  if (!conversationId) {
    return Response.json({ error: 'conversation is required' }, { status: 400 });
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc('delete_conversation', {
    p_conversation_id: conversationId,
  });

  if (error) {
    /* 55000 — помощник ещё отвечает: это не сбой, а «позже». */
    const status = error.code === '55000' ? 409 : error.code === '42501' ? 403 : 400;
    return Response.json({ error: error.code ?? 'failed', detail: error.message }, { status });
  }

  return Response.json({ ok: true });
}

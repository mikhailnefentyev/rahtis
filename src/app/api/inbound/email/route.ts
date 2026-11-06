import { after } from 'next/server';
import { verifySvix } from '@/lib/inbound/email';
import { inboundConfig } from '@/lib/inbound/config';
import { acceptInbound, processInbound, type ReceivedEvent } from '@/lib/inbound/receive';
import { recordIncident } from '@/lib/incidents/record';

/**
 * Вебхук Resend «email.received»: письмо на orders-<token>@in.rahtis.eu.
 *
 * Без подписи (svix-*) — 401. Принятое письмо — 200 сразу, разбор идёт
 * после ответа (after): Resend ждёт ответа секунды, а PDF модель читает
 * до минуты. Чужие адреса и отправители — тоже 200: повторять нечего, а
 * по коду ответа не должно быть видно, существует ли адрес.
 */
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

/* Событие — метаданные без тела письма; больше 256 КБ быть не должно. */
const MAX_EVENT_BYTES = 256 * 1024;

export async function POST(request: Request) {
  const config = inboundConfig();
  if (!config) return Response.json({ error: 'inbound email is not configured' }, { status: 503 });

  const declared = Number(request.headers.get('content-length') ?? 0);
  if (declared > MAX_EVENT_BYTES) return Response.json({ error: 'too large' }, { status: 413 });
  const body = await request.text();
  if (body.length > MAX_EVENT_BYTES) return Response.json({ error: 'too large' }, { status: 413 });

  const signed = verifySvix({
    secret: config.secret,
    id: request.headers.get('svix-id'),
    timestamp: request.headers.get('svix-timestamp'),
    signature: request.headers.get('svix-signature'),
    body,
  });
  if (!signed) return Response.json({ error: 'invalid signature' }, { status: 401 });

  let event: ReceivedEvent;
  try {
    event = JSON.parse(body) as ReceivedEvent;
  } catch {
    return Response.json({ error: 'bad json' }, { status: 400 });
  }

  try {
    const accepted = await acceptInbound(event, config.domain);
    if (accepted) {
      after(() =>
        processInbound(accepted, config.apiKey).catch((error: unknown) =>
          recordIncident({ source: 'route', error, path: '/api/inbound/email' }),
        ),
      );
    }
    return Response.json({ ok: true });
  } catch (error) {
    /* База не ответила — 500, Resend повторит; повтор не задвоит черновик (Message-ID). */
    await recordIncident({ source: 'route', error, path: '/api/inbound/email' });
    return Response.json({ error: 'failed' }, { status: 500 });
  }
}

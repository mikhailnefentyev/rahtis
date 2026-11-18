import { isCountry, isUuidV4, problem, proxyAuthorized } from '@/lib/efti/gateAuth';
import { parseFollowUpRequest } from '@/lib/efti/xml/followUp';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Сообщение инспектора перевозчику (v1PostFollowUp, FTI025). По правилу
 * шлюза оно ссылается на предшествующий запрос данных (uilQueryRequestId)
 * — без такого запроса в нашем журнале сообщение не принимается.
 */
const MAX_BODY = 256 * 1024;

export async function POST(request: Request, { params }: { params: Promise<{ datasetId: string }> }) {
  if (!proxyAuthorized(request)) return problem(401, 'Unauthorized');
  const { datasetId } = await params;
  const requestId = request.headers.get('x-request-id');
  const country = request.headers.get('x-requester-trade-party-country');
  const queryId = new URL(request.url).searchParams.get('uilQueryRequestId');

  const admin = createAdminClient();
  const log = (status: number, dataset: string | null) =>
    admin.from('efti_requests').insert({
      kind: 'FOLLOW_UP',
      dataset_id: dataset,
      request_id: requestId,
      requester_country: country,
      http_status: status,
    });

  if (!isUuidV4(datasetId) || !isUuidV4(requestId) || !isCountry(country) || !isUuidV4(queryId)) {
    await log(400, null);
    return problem(400, 'Bad request');
  }

  const { data: earlier } = await admin
    .from('efti_requests')
    .select('id')
    .eq('kind', 'DATASET')
    .eq('dataset_id', datasetId)
    .eq('request_id', queryId)
    .eq('http_status', 200)
    .limit(1)
    .maybeSingle();
  if (!earlier) {
    await log(404, null);
    return problem(404, 'Not found', 'No dataset request with this uilQueryRequestId');
  }

  const raw = await request.text();
  if (raw.length > MAX_BODY) {
    await log(413, datasetId);
    return problem(413, 'Payload too large');
  }
  let message: string;
  try {
    message = parseFollowUpRequest(raw).message;
  } catch {
    await log(400, datasetId);
    return problem(400, 'Bad request', 'Invalid followUpRequest');
  }

  await admin.from('efti_follow_ups').insert({
    dataset_id: datasetId,
    query_request_id: queryId,
    requester_country: country,
    message: message.slice(0, 10_000),
  });
  await log(200, datasetId);
  return new Response(null, { status: 200 });
}

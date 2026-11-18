import { loadConsignment } from '@/lib/efti/consignment';
import { isCountry, isUuidV4, problem, proxyAuthorized, xml } from '@/lib/efti/gateAuth';
import { buildCmdsResponse, unknownSubsetIds } from '@/lib/efti/xml/cmds';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Запрос инспектора через шлюз (v1GetCMDS): данные перевозки — только
 * запрошенные части набора (subsetId). Шлюз ждёт ответ не дольше 60 с.
 * Каждый запрос пишется в журнал (2025/2243 ст. 3).
 */
export const maxDuration = 30;

export async function GET(request: Request, { params }: { params: Promise<{ datasetId: string }> }) {
  if (!proxyAuthorized(request)) return problem(401, 'Unauthorized');
  const { datasetId } = await params;
  const requestId = request.headers.get('x-request-id');
  const country = request.headers.get('x-requester-trade-party-country');
  const subsetIds = [
    ...new Set(
      new URL(request.url).searchParams
        .getAll('subsetId')
        .flatMap((v) => v.split(','))
        .map((v) => v.trim())
        .filter(Boolean),
    ),
  ];

  const admin = createAdminClient();
  const log = (status: number, dataset: string | null) =>
    admin.from('efti_requests').insert({
      kind: 'DATASET',
      dataset_id: dataset,
      request_id: requestId,
      requester_country: country,
      subset_ids: subsetIds,
      http_status: status,
    });

  if (!isUuidV4(datasetId) || !isUuidV4(requestId) || !isCountry(country) || subsetIds.length === 0) {
    await log(400, null);
    return problem(400, 'Bad request', 'datasetId, X-Request-ID, X-Requester-Trade-Party-Country and subsetId are required');
  }

  /* Неизвестные части набора — 409 UNKNOWN_SUBSET (CL-068), как ждёт шлюз. */
  const unknown = unknownSubsetIds(subsetIds);
  if (unknown.length > 0) {
    await log(409, null);
    return problem(409, 'UNKNOWN_SUBSET', unknown.join(','));
  }

  const { data: dataset } = await admin.from('efti_datasets').select('id, order_id, status').eq('id', datasetId).maybeSingle();
  if (!dataset || dataset.status === 'ARCHIVED') {
    await log(404, dataset?.id ?? null);
    return problem(404, 'Not found');
  }

  const loaded = await loadConsignment(dataset.order_id, dataset.id);
  if (!loaded.ok) {
    await log(404, dataset.id);
    return problem(404, 'Not found', loaded.reason);
  }

  const body = buildCmdsResponse(loaded.consignment, subsetIds);
  await log(200, dataset.id);
  return xml(body);
}

import { withApi } from '@/lib/api/handler';
import { knownVehicles } from '@/lib/api/lifecycle';

/** GET /api/v1/vehicles — знакомые машины для прямого назначения. */
export const dynamic = 'force-dynamic';

export const GET = withApi('READ', async (ctx) => Response.json(await knownVehicles(ctx)));

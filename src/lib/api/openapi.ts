import { WEBHOOK_EVENTS } from './events';

/**
 * Описание API заказчиков в OpenAPI 3.1 — отдаётся по /api/v1/openapi.json.
 *
 * Программист заказчика загружает его в Postman, Insomnia или генератор
 * клиента и получает запросы и типы без переписки с нами. Страница
 * /[locale]/api-docs — то же самое словами, с примерами.
 *
 * Описание следует за кодом: поля — как в orders.ts и create.ts, коды
 * ошибок — как в handler.ts. Меняется ответ — меняется и этот файл.
 */

const STATUS = ['DRAFT', 'OPEN', 'REQUESTED', 'AWAIT_DRIVER', 'IN_PROGRESS', 'DONE', 'CANCELLED'];
const ROLES = ['PICKUP', 'DELIVERY', 'EXTRA_LOAD', 'EXTRA_UNLOAD', 'TRAILER_RETURN'];
const EVENTS: readonly string[] = WEBHOOK_EVENTS;

const nullable = (type: string, extra: Record<string, unknown> = {}) => ({ type: [type, 'null'], ...extra });
const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });
const json = (schema: unknown) => ({ 'application/json': { schema } });

const errorResponse = (description: string) => ({ description, content: json(ref('Error')) });

const COMMON_ERRORS = {
  '401': errorResponse('Missing, malformed, unknown or revoked key.'),
  '429': {
    description: 'More than 60 requests per minute with this key.',
    headers: { 'Retry-After': { schema: { type: 'integer' }, description: 'Seconds to wait.' } },
    content: json(ref('Error')),
  },
  '500': errorResponse('Unexpected error. The request was not completed.'),
};

const refParam = {
  name: 'ref',
  in: 'path',
  required: true,
  description: 'Order number, e.g. RS-2026-0142.',
  schema: { type: 'string', pattern: '^[A-Za-z]{2}-\\d{4}-\\d{3,6}$' },
};

const idempotencyHeader = {
  name: 'Idempotency-Key',
  in: 'header',
  required: false,
  description:
    'Any unique string up to 100 characters. A retry with the same key and body within 24 hours returns the first response with the header Idempotent-Replayed: true instead of acting twice.',
  schema: { type: 'string', maxLength: 100 },
};

export function openApi(serverUrl: string) {
  return {
    openapi: '3.1.0',
    info: {
      title: 'RAHTIS Shipper API',
      version: '1.0.0',
      description:
        'Read and create your company\'s orders on RAHTIS and receive webhooks when they change. Keys are issued in the cabinet (API tab). A key from a test company starts with rhs_test_ and only sees the test environment; responses then carry Rahtis-Environment: test.',
    },
    servers: [{ url: `${serverUrl}/api/v1` }],
    security: [{ bearer: [] }],
    tags: [
      { name: 'Orders', description: 'Read access: any key.' },
      { name: 'Write', description: 'Requires a key with write access.' },
    ],
    paths: {
      '/orders': {
        get: {
          tags: ['Orders'],
          summary: 'List orders',
          operationId: 'listOrders',
          description:
            'Sorted by updated_at ascending. For synchronisation store the updated_at of the last order you processed and pass it as updated_since next time, following next_cursor until it is null.',
          parameters: [
            { name: 'status', in: 'query', description: 'Comma-separated statuses.', schema: { type: 'string' }, example: 'OPEN,IN_PROGRESS' },
            { name: 'updated_since', in: 'query', description: 'ISO 8601 timestamp; only orders changed after it.', schema: { type: 'string', format: 'date-time' } },
            { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100, default: 50 } },
            { name: 'cursor', in: 'query', description: 'next_cursor from the previous page.', schema: { type: 'string' } },
          ],
          responses: {
            '200': {
              description: 'A page of orders.',
              content: json({
                type: 'object',
                required: ['data', 'next_cursor'],
                properties: {
                  data: { type: 'array', items: ref('OrderSummary') },
                  next_cursor: nullable('string'),
                },
              }),
            },
            '400': errorResponse('Invalid status, updated_since, limit or cursor.'),
            ...COMMON_ERRORS,
          },
        },
        post: {
          tags: ['Write'],
          summary: 'Create an order',
          operationId: 'createOrder',
          description:
            'Publishes the order to the RAHTIS desk, as the order form does. Every stop needs a precise location: send location { lat, lon }, or an address with a house number that the geocoder recognises exactly in the given city. Distance is calculated as a truck route. Carriers are notified after creation.',
          parameters: [idempotencyHeader],
          requestBody: { required: true, content: json(ref('OrderInput')) },
          responses: {
            '201': { description: 'Order created.', content: json(ref('Order')) },
            '400': errorResponse('The body is not valid JSON or a required field is missing. See error.details.'),
            '403': errorResponse('Read-only key, inactive company, or the current terms are not accepted in the cabinet.'),
            '409': errorResponse('The same Idempotency-Key is still being processed.'),
            '422': errorResponse('A stop could not be located, no truck route exists, a business rule rejected the order, or the Idempotency-Key was used with another body. See error.details.'),
            ...COMMON_ERRORS,
          },
        },
      },
      '/orders/{ref}': {
        get: {
          tags: ['Orders'],
          summary: 'Get an order',
          operationId: 'getOrder',
          parameters: [refParam],
          responses: {
            '200': { description: 'The order with stops, progress and vehicle.', content: json(ref('Order')) },
            '404': errorResponse('No order with this number in your company.'),
            ...COMMON_ERRORS,
          },
        },
      },
      '/orders/{ref}/events': {
        get: {
          tags: ['Orders'],
          summary: 'Order timeline',
          operationId: 'getOrderEvents',
          description: 'Status changes and stop arrivals/completions, oldest first.',
          parameters: [refParam],
          responses: {
            '200': {
              description: 'Timeline.',
              content: json({
                type: 'object',
                properties: { ref: { type: 'string' }, data: { type: 'array', items: ref('TimelineEvent') } },
              }),
            },
            '404': errorResponse('No order with this number in your company.'),
            ...COMMON_ERRORS,
          },
        },
      },
      '/orders/{ref}/documents': {
        get: {
          tags: ['Orders'],
          summary: 'Order documents',
          operationId: 'getOrderDocuments',
          description: 'CMR and trip photos. Each url is a signed link valid for 5 minutes; request the list again for fresh links.',
          parameters: [refParam],
          responses: {
            '200': {
              description: 'Documents.',
              content: json({
                type: 'object',
                properties: { ref: { type: 'string' }, data: { type: 'array', items: ref('Document') } },
              }),
            },
            '404': errorResponse('No order with this number in your company.'),
            ...COMMON_ERRORS,
          },
        },
      },
      '/orders/{ref}/withdraw': {
        post: {
          tags: ['Write'],
          summary: 'Withdraw an order',
          operationId: 'withdrawOrder',
          description: 'Cancels the order. A completed order cannot be withdrawn.',
          parameters: [refParam, idempotencyHeader],
          requestBody: {
            required: false,
            content: json({ type: 'object', properties: { reason: { type: 'string', maxLength: 500 } } }),
          },
          responses: {
            '200': { description: 'Withdrawn; the updated order.', content: json(ref('Order')) },
            '403': errorResponse('Read-only key.'),
            '404': errorResponse('No order with this number in your company.'),
            '409': errorResponse('Already withdrawn, completed, or the same Idempotency-Key is still being processed.'),
            ...COMMON_ERRORS,
          },
        },
      },
    },
    webhooks: Object.fromEntries(
      [...EVENTS, 'ping'].map((event) => [
        event,
        {
          post: {
            summary: event,
            operationId: `webhook_${event.replace('.', '_')}`,
            description:
              'POSTed to your URL. Verify Rahtis-Signature before trusting the body: t=<unix seconds>,v1=<hex HMAC-SHA256 of "<t>.<raw body>" with your signing secret>. Reject t older than 5 minutes. Respond 2xx within 10 seconds; otherwise the delivery is retried after 1, 5, 15 and 60 minutes, then 3, 6, 12 and 24 hours. Redirects are not followed.',
            parameters: [
              { name: 'Rahtis-Event', in: 'header', schema: { type: 'string', const: event } },
              { name: 'Rahtis-Delivery', in: 'header', description: 'Same as body id; use it to ignore repeats.', schema: { type: 'string', format: 'uuid' } },
              { name: 'Rahtis-Signature', in: 'header', schema: { type: 'string' }, example: 't=1700000000,v1=35495024f4ef3f94e5a93e22221544c4b75e9a42300cd965ab81cb85cd994e91' },
            ],
            requestBody: { content: json(ref('WebhookEvent')) },
            responses: { '2XX': { description: 'Received.' } },
          },
        },
      ]),
    ),
    components: {
      securitySchemes: {
        bearer: { type: 'http', scheme: 'bearer', description: 'Authorization: Bearer rhs_live_… (or rhs_test_…)' },
      },
      schemas: {
        Error: {
          type: 'object',
          required: ['error'],
          properties: {
            error: {
              type: 'object',
              required: ['code', 'message'],
              properties: {
                code: { enum: ['unauthorized', 'forbidden', 'rate_limited', 'not_found', 'bad_request', 'unprocessable', 'conflict', 'internal'] },
                message: { type: 'string' },
                details: {
                  type: 'array',
                  items: { type: 'object', properties: { field: { type: 'string' }, issue: { type: 'string' } } },
                },
              },
            },
          },
        },
        Money: {
          type: 'object',
          properties: {
            amount: { type: 'string', example: '300.00' },
            currency: { const: 'EUR' },
            vat_included: { const: false },
          },
        },
        Location: { type: 'object', required: ['lat', 'lon'], properties: { lat: { type: 'number' }, lon: { type: 'number' } } },
        OrderSummary: {
          allOf: [
            ref('OrderFields'),
            {
              type: 'object',
              properties: {
                route: { type: 'object', properties: { from: nullable('string'), to: nullable('string') } },
              },
            },
          ],
        },
        OrderFields: {
          type: 'object',
          properties: {
            ref: { type: 'string', example: 'RS-2026-0142' },
            shipper_ref: nullable('string', { description: 'Your own reference.' }),
            status: { enum: STATUS },
            order_type: { enum: ['TRAILER_SWAP', 'ROUND_TRIP', 'ONE_WAY'] },
            haul_kind: { enum: ['TRAILER', 'CONTAINER', 'VAN', 'TRUCK'] },
            container_feet: nullable('integer'),
            ldm: nullable('number'),
            trailer: nullable('string'),
            trailer_plate: nullable('string'),
            distance_km: { type: 'integer' },
            rate: ref('Money'),
            comment: nullable('string'),
            dispatch: nullable('string'),
            created_at: { type: 'string', format: 'date-time' },
            published_at: nullable('string', { format: 'date-time' }),
            deadline_at: nullable('string', { format: 'date-time' }),
            closed_at: nullable('string', { format: 'date-time' }),
            updated_at: { type: 'string', format: 'date-time' },
          },
        },
        Order: {
          allOf: [
            ref('OrderFields'),
            {
              type: 'object',
              properties: {
                stops: { type: 'array', items: ref('Stop') },
                progress: {
                  type: 'object',
                  properties: { stops_total: { type: 'integer' }, stops_completed: { type: 'integer' } },
                },
                vehicle: {
                  description: 'Once a carrier has taken the order.',
                  oneOf: [
                    { type: 'null' },
                    {
                      type: 'object',
                      properties: {
                        plate: { type: 'string' },
                        make: nullable('string'),
                        euro_class: nullable('string'),
                        axles: nullable('integer'),
                        driver_name: nullable('string'),
                        driver_languages: { type: 'array', items: { type: 'string' } },
                        carrier_rating: nullable('number'),
                      },
                    },
                  ],
                },
              },
            },
          ],
        },
        Stop: {
          type: 'object',
          properties: {
            sequence: { type: 'integer' },
            role: { enum: ROLES },
            place_name: nullable('string'),
            company_name: nullable('string'),
            address: { type: 'string' },
            city: { type: 'string' },
            country: nullable('string'),
            location: { oneOf: [{ type: 'null' }, ref('Location')] },
            scheduled_date: nullable('string', { format: 'date' }),
            scheduled_time: nullable('string', { example: '08:00' }),
            eta_at: nullable('string', { format: 'date-time' }),
            arrived_at: nullable('string', { format: 'date-time' }),
            completed_at: nullable('string', { format: 'date-time' }),
            trailer_loaded: nullable('boolean'),
            cargo_weight_kg: nullable('integer'),
            consignee: nullable('string'),
            contact: {
              oneOf: [{ type: 'null' }, { type: 'object', properties: { name: nullable('string'), phone: nullable('string') } }],
            },
            external_ref: nullable('string'),
            seal_required: nullable('boolean'),
            note: nullable('string'),
            damage_note: nullable('string'),
          },
        },
        TimelineEvent: {
          type: 'object',
          required: ['at', 'type'],
          properties: {
            at: { type: 'string', format: 'date-time' },
            type: { enum: ['status', 'stop_arrived', 'stop_completed'] },
            from: { enum: [...STATUS, null], description: 'type=status' },
            to: { enum: STATUS, description: 'type=status' },
            sequence: { type: 'integer', description: 'type=stop_*' },
            role: { enum: ROLES, description: 'type=stop_*' },
            city: { type: 'string', description: 'type=stop_*' },
          },
        },
        Document: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            kind: { type: 'string' },
            phase: nullable('string'),
            subject: nullable('string'),
            angle: nullable('string'),
            stop_sequence: nullable('integer'),
            file_name: nullable('string'),
            mime_type: nullable('string'),
            size_bytes: nullable('integer'),
            signer_name: nullable('string'),
            created_at: { type: 'string', format: 'date-time' },
            captured_at: nullable('string', { format: 'date-time' }),
            url: nullable('string', { format: 'uri' }),
            url_expires_at: { type: 'string', format: 'date-time' },
          },
        },
        OrderInput: {
          type: 'object',
          required: ['order_type', 'rate', 'stops'],
          properties: {
            order_type: { enum: ['TRAILER_SWAP', 'ROUND_TRIP', 'ONE_WAY'] },
            haul_kind: { enum: ['TRAILER', 'CONTAINER', 'VAN', 'TRUCK'], default: 'TRAILER' },
            rate: {
              type: 'object',
              required: ['amount'],
              properties: { amount: { type: 'number', exclusiveMinimum: 0, description: 'Euros, VAT excluded.' }, currency: { const: 'EUR' } },
            },
            shipper_ref: { type: 'string', maxLength: 100 },
            trailer: { type: 'string', maxLength: 120, description: 'Trailer description, e.g. "Curtainsider 13.6 m".' },
            trailer_plate: {
              type: 'string',
              maxLength: 20,
              description: 'Trailer registration number (TRAILER) or ISO 6346 container number (CONTAINER). Required for both.',
            },
            container_feet: { type: 'integer', description: 'Required for CONTAINER.' },
            ldm: { type: 'number', description: 'Loading metres. Required for VAN and TRUCK.' },
            comment: { type: 'string', maxLength: 2000 },
            stops: { type: 'array', minItems: 2, maxItems: 20, items: ref('StopInput') },
          },
          example: {
            order_type: 'ONE_WAY',
            shipper_ref: 'PO-4471',
            rate: { amount: 300 },
            trailer: 'Curtainsider 13.6 m',
            trailer_plate: 'ABC-123',
            stops: [
              { role: 'PICKUP', address: 'Satamatie 1', city: 'Hanko', country: 'FI', location: { lat: 59.8208, lon: 22.9565 }, scheduled_date: '2026-10-05', cargo_weight_kg: 20000 },
              { role: 'DELIVERY', address: 'Tikkurilantie 10', city: 'Vantaa', country: 'FI', company_name: 'Vastaanottaja Oy', scheduled_date: '2026-10-05' },
            ],
          },
        },
        StopInput: {
          type: 'object',
          required: ['role', 'address', 'city'],
          properties: {
            role: { enum: ROLES },
            address: { type: 'string', maxLength: 200 },
            city: { type: 'string', maxLength: 100 },
            country: { type: 'string', minLength: 2, maxLength: 2, description: 'ISO 3166-1 alpha-2.' },
            location: {
              allOf: [ref('Location')],
              description: 'Recommended. Without it the address must contain a house number recognised exactly in the given city.',
            },
            place_kind: { enum: ['PORT', 'TERMINAL', 'PARKING', 'ADDRESS'] },
            place_name: { type: 'string', maxLength: 120 },
            company_name: { type: 'string', maxLength: 120, description: 'Required on DELIVERY stops.' },
            scheduled_date: { type: 'string', format: 'date' },
            scheduled_time: { type: 'string', pattern: '^([01]\\d|2[0-3]):[0-5]\\d$' },
            cargo_weight_kg: { type: 'integer', exclusiveMinimum: 0, description: 'Where cargo is loaded.' },
            consignee: { type: 'string', maxLength: 200 },
            contact: { type: 'object', properties: { name: { type: 'string' }, phone: { type: 'string' } } },
            external_ref: { type: 'string', maxLength: 100 },
            trailer_loaded: { type: 'boolean' },
            seal_required: { type: 'boolean' },
            note: { type: 'string', maxLength: 1000 },
          },
        },
        WebhookEvent: {
          type: 'object',
          required: ['id', 'type', 'created_at', 'data'],
          properties: {
            id: { type: 'string', format: 'uuid' },
            type: { enum: [...EVENTS, 'ping'] },
            created_at: { type: 'string', format: 'date-time' },
            data: {
              type: 'object',
              description: 'Order number and what changed. Fetch GET /orders/{ref} for the full order.',
              properties: {
                ref: { type: 'string' },
                shipper_ref: nullable('string'),
                status: { enum: STATUS },
                previous_status: { enum: STATUS },
                stop: {
                  type: 'object',
                  properties: { sequence: { type: 'integer' }, role: { enum: ROLES }, city: { type: 'string' }, completed_at: { type: 'string', format: 'date-time' } },
                },
                document: {
                  type: 'object',
                  properties: { id: { type: 'string', format: 'uuid' }, kind: { type: 'string' }, phase: nullable('string'), created_at: { type: 'string', format: 'date-time' } },
                },
              },
            },
          },
        },
      },
    },
  };
}

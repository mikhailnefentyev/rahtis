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
const AMENDMENT_KINDS = ['STOP_ADDED', 'STOP_CHANGED', 'STOP_REMOVED', 'ORDER_REPRICED', 'ORDER_CANCELLED', 'ORDER_RELEASED'];
const CLAIM_KINDS = ['CARGO_DAMAGE', 'SHORTAGE', 'DOWNTIME', 'DEVIATION', 'OTHER'];
const CLAIM_STATUSES = ['OPEN', 'IN_REVIEW', 'RESOLVED', 'REJECTED'];

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

const sequenceParam = {
  name: 'sequence',
  in: 'path',
  required: true,
  description: 'Stop sequence number from the order (0 is the first stop).',
  schema: { type: 'integer', minimum: 0 },
};

const claimParam = {
  name: 'claim_ref',
  in: 'path',
  required: true,
  description: 'Claim number, e.g. CL-RS-2026-0142-1.',
  schema: { type: 'string', pattern: '^CL-[A-Za-z]{2}-\\d{4}-\\d{3,6}-\\d{1,3}$' },
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
      version: '1.1.0',
      description:
        'Work with your company\'s orders on RAHTIS from start to finish: create orders, choose offers or assign known vehicles, follow the trip with arrivals, stop confirmations, photos and their positions, amend the route in progress, rate the carrier, handle claims, and receive webhooks when anything changes. Webhooks are delivered in parallel and may arrive out of order: order them by created_at. Keys are issued in the cabinet (API tab). A key from a test company starts with rhs_test_ and only sees the test environment; responses then carry Rahtis-Environment: test.',
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
      '/orders/{ref}/offers': {
        get: {
          tags: ['Orders'],
          summary: 'Carrier offers',
          operationId: 'getOrderOffers',
          description: 'Vehicles offered for the order, as in the cabinet. The carrier\'s name is not shown when Aivomaa Oy is your contracting party.',
          parameters: [refParam],
          responses: {
            '200': {
              description: 'Offers.',
              content: json({ type: 'object', properties: { ref: { type: 'string' }, data: { type: 'array', items: ref('Offer') } } }),
            },
            '404': errorResponse('No order with this number in your company.'),
            ...COMMON_ERRORS,
          },
        },
      },
      '/orders/{ref}/offers/{id}/choose': {
        post: {
          tags: ['Write'],
          summary: 'Choose an offer',
          operationId: 'chooseOffer',
          parameters: [refParam, { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }, idempotencyHeader],
          responses: {
            '200': { description: 'The order with the chosen vehicle.', content: json(ref('Order')) },
            '404': errorResponse('No such order or offer.'),
            '409': errorResponse('Offers can no longer be chosen in the order\'s current status.'),
            ...COMMON_ERRORS,
          },
        },
      },
      '/vehicles': {
        get: {
          tags: ['Orders'],
          summary: 'Known vehicles',
          operationId: 'listKnownVehicles',
          description: 'Vehicles that have driven for you and can be assigned directly. Carrier bank details and driver contacts are not included.',
          responses: {
            '200': { description: 'Vehicles.', content: json({ type: 'object', properties: { data: { type: 'array', items: ref('KnownVehicle') } } }) },
            ...COMMON_ERRORS,
          },
        },
      },
      '/orders/{ref}/assign': {
        post: {
          tags: ['Write'],
          summary: 'Assign a known vehicle',
          operationId: 'assignVehicle',
          description: 'Direct assignment of an order on the desk that has no offers yet. The carrier and driver are notified.',
          parameters: [refParam, idempotencyHeader],
          requestBody: {
            required: true,
            content: json({ type: 'object', required: ['vehicle_id'], properties: { vehicle_id: { type: 'string', format: 'uuid' } } }),
          },
          responses: {
            '200': { description: 'The assigned order.', content: json(ref('Order')) },
            '403': errorResponse('The vehicle is not among your known vehicles.'),
            '404': errorResponse('No order with this number in your company.'),
            '409': errorResponse('The order already has offers, is not on the desk, the vehicle is unavailable, or its carrier has not accepted the current terms.'),
            '422': errorResponse('The vehicle does not fit the order.'),
            ...COMMON_ERRORS,
          },
        },
      },
      '/orders/{ref}/unassign': {
        post: {
          tags: ['Write'],
          summary: 'Cancel the assignment',
          operationId: 'unassign',
          description: 'Before the trip starts: the carrier is released and the order returns to the desk.',
          parameters: [refParam, idempotencyHeader],
          responses: {
            '200': { description: 'The order, back on the desk.', content: json(ref('Order')) },
            '404': errorResponse('No order with this number in your company.'),
            '409': errorResponse('The trip has already started.'),
            ...COMMON_ERRORS,
          },
        },
      },
      '/orders/{ref}/amendments': {
        get: {
          tags: ['Orders'],
          summary: 'Route amendments',
          operationId: 'getOrderAmendments',
          parameters: [refParam],
          responses: {
            '200': {
              description: 'Amendments, oldest first.',
              content: json({ type: 'object', properties: { ref: { type: 'string' }, data: { type: 'array', items: ref('Amendment') } } }),
            },
            '404': errorResponse('No order with this number in your company.'),
            ...COMMON_ERRORS,
          },
        },
      },
      '/orders/{ref}/stops': {
        post: {
          tags: ['Write'],
          summary: 'Add a stop to a trip in progress',
          operationId: 'addStop',
          description: 'An extra loading or unloading. The truck route and distance are recalculated; use POST /orders/{ref}/reprice to adjust the rate.',
          parameters: [refParam, idempotencyHeader],
          requestBody: { required: true, content: json(ref('NewStop')) },
          responses: {
            '200': { description: 'The order with the new stop.', content: json(ref('Order')) },
            '404': errorResponse('No such order or stop.'),
            '409': errorResponse('The trip is not in progress.'),
            '422': errorResponse('The stop could not be located, or a rule rejected it. See error.details.'),
            ...COMMON_ERRORS,
          },
        },
      },
      '/orders/{ref}/stops/{sequence}': {
        patch: {
          tags: ['Write'],
          summary: 'Amend a stop in a trip in progress',
          operationId: 'amendStop',
          description: 'The carrier is notified of the change. A completed stop cannot be changed.',
          parameters: [refParam, sequenceParam, idempotencyHeader],
          requestBody: { required: true, content: json(ref('StopPatch')) },
          responses: {
            '200': { description: 'The amended order.', content: json(ref('Order')) },
            '404': errorResponse('No such order or stop.'),
            '409': errorResponse('The trip is not in progress, or the stop is already completed.'),
            '422': errorResponse('A field is invalid or the new place could not be located. See error.details.'),
            ...COMMON_ERRORS,
          },
        },
        delete: {
          tags: ['Write'],
          summary: 'Remove a stop from a trip in progress',
          operationId: 'removeStop',
          description: 'Pickup and trailer return cannot be removed, nor a completed stop.',
          parameters: [refParam, sequenceParam],
          responses: {
            '200': { description: 'The order without the stop.', content: json(ref('Order')) },
            '404': errorResponse('No such order or stop.'),
            '409': errorResponse('The trip is not in progress, or the stop is already completed.'),
            '422': errorResponse('This stop cannot be removed.'),
            ...COMMON_ERRORS,
          },
        },
      },
      '/orders/{ref}/reprice': {
        post: {
          tags: ['Write'],
          summary: 'Change the rate',
          operationId: 'repriceOrder',
          description: 'distance_km defaults to the truck route calculated after the latest amendments.',
          parameters: [refParam, idempotencyHeader],
          requestBody: {
            required: true,
            content: json({
              type: 'object',
              required: ['rate'],
              properties: {
                rate: { type: 'object', required: ['amount'], properties: { amount: { type: 'number', exclusiveMinimum: 0 } } },
                distance_km: { type: 'integer', exclusiveMinimum: 0 },
              },
            }),
          },
          responses: {
            '200': { description: 'The repriced order.', content: json(ref('Order')) },
            '404': errorResponse('No order with this number in your company.'),
            '409': errorResponse('The order is completed or withdrawn.'),
            ...COMMON_ERRORS,
          },
        },
      },
      '/orders/{ref}/rating': {
        post: {
          tags: ['Write'],
          summary: 'Rate the carrier',
          operationId: 'rateOrder',
          description: 'After the trip is closed. Rating again replaces the previous rating.',
          parameters: [refParam, idempotencyHeader],
          requestBody: {
            required: true,
            content: json({
              type: 'object',
              required: ['score'],
              properties: { score: { type: 'integer', minimum: 1, maximum: 5 }, comment: { type: 'string', maxLength: 1000 } },
            }),
          },
          responses: {
            '200': { description: 'The order with your rating.', content: json(ref('Order')) },
            '404': errorResponse('No order with this number in your company.'),
            '409': errorResponse('The trip is not closed yet or has no carrier.'),
            ...COMMON_ERRORS,
          },
        },
      },
      '/claims': {
        get: {
          tags: ['Orders'],
          summary: 'List claims',
          operationId: 'listClaims',
          description: 'Claims filed by your company and against it, newest first (up to 200).',
          parameters: [{ name: 'status', in: 'query', description: 'Comma-separated statuses.', schema: { type: 'string' }, example: 'OPEN,IN_REVIEW' }],
          responses: {
            '200': { description: 'Claims.', content: json({ type: 'object', properties: { data: { type: 'array', items: ref('Claim') } } }) },
            '400': errorResponse('Invalid status.'),
            ...COMMON_ERRORS,
          },
        },
        post: {
          tags: ['Write'],
          summary: 'File a claim',
          operationId: 'fileClaim',
          description: 'For a trip in progress or completed. The other party and the operator are notified by email.',
          parameters: [idempotencyHeader],
          requestBody: { required: true, content: json(ref('ClaimInput')) },
          responses: {
            '201': { description: 'The filed claim.', content: json(ref('ClaimDetail')) },
            '400': errorResponse('A required field is missing. See error.details.'),
            '404': errorResponse('No such order or stop.'),
            '409': errorResponse('The trip is not in progress or completed.'),
            ...COMMON_ERRORS,
          },
        },
      },
      '/claims/{claim_ref}': {
        get: {
          tags: ['Orders'],
          summary: 'Get a claim',
          operationId: 'getClaim',
          parameters: [claimParam],
          responses: {
            '200': { description: 'The claim with its messages and attachments.', content: json(ref('ClaimDetail')) },
            '404': errorResponse('No such claim for your company.'),
            ...COMMON_ERRORS,
          },
        },
      },
      '/claims/{claim_ref}/comments': {
        post: {
          tags: ['Write'],
          summary: 'Add a message to a claim',
          operationId: 'commentClaim',
          parameters: [claimParam, idempotencyHeader],
          requestBody: {
            required: true,
            content: json({ type: 'object', required: ['body'], properties: { body: { type: 'string', maxLength: 5000 } } }),
          },
          responses: {
            '201': { description: 'The claim with the new message.', content: json(ref('ClaimDetail')) },
            '404': errorResponse('No such claim for your company.'),
            '409': errorResponse('The claim is closed.'),
            ...COMMON_ERRORS,
          },
        },
      },
      '/claims/{claim_ref}/attachments': {
        post: {
          tags: ['Write'],
          summary: 'Attach a file to a claim',
          operationId: 'attachToClaim',
          parameters: [claimParam],
          requestBody: {
            required: true,
            content: {
              'multipart/form-data': {
                schema: {
                  type: 'object',
                  required: ['file'],
                  properties: {
                    file: { type: 'string', format: 'binary', description: 'PDF, JPEG, PNG or WebP, up to 10 MB.' },
                    note: { type: 'string', maxLength: 5000 },
                  },
                },
              },
            },
          },
          responses: {
            '201': { description: 'The claim with the new attachment.', content: json(ref('ClaimDetail')) },
            '404': errorResponse('No such claim for your company.'),
            '409': errorResponse('The claim is closed.'),
            '422': errorResponse('The file is too large or of an unsupported type.'),
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
            waiting: {
              type: 'object',
              description:
                'Waiting-time surcharge, fixed when the trip is closed. Each loading and unloading stop has one free hour, counted from arrival but not before the agreed time; an excess of at least 15 minutes is charged at EUR 45 excl. VAT per hour begun. Only for orders where Aivomaa Oy is your contracting party.',
              properties: {
                amount: { type: 'string', example: '45.00' },
                currency: { const: 'EUR' },
                vat_included: { const: false },
                lines: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      stop_sequence: { type: 'integer' },
                      role: { enum: ROLES },
                      city: nullable('string'),
                      started_at: { type: 'string', format: 'date-time' },
                      completed_at: { type: 'string', format: 'date-time' },
                      minutes: { type: 'integer' },
                      hours: { type: 'integer' },
                      amount: { type: 'string' },
                    },
                  },
                },
              },
            },
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
                  properties: {
                    stops_total: { type: 'integer' },
                    stops_arrived: { type: 'integer' },
                    stops_completed: { type: 'integer' },
                  },
                },
                rating: {
                  description: 'Your rating of the carrier, once given (POST /orders/{ref}/rating).',
                  oneOf: [
                    { type: 'null' },
                    {
                      type: 'object',
                      properties: { score: { type: 'integer', minimum: 1, maximum: 5 }, comment: nullable('string'), rated_at: { type: 'string', format: 'date-time' } },
                    },
                  ],
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
            eta: {
              description: 'Estimated arrival, recalculated with traffic after each completed stop.',
              oneOf: [
                { type: 'null' },
                {
                  type: 'object',
                  properties: {
                    at: { type: 'string', format: 'date-time' },
                    source: { enum: ['ROUTE', 'TRAFFIC', 'CARRIER'] },
                    updated_at: { type: 'string', format: 'date-time' },
                  },
                },
              ],
            },
            arrival: {
              description: 'When and where the driver marked arrival at this stop.',
              oneOf: [{ type: 'null' }, ref('StopEvent')],
            },
            completion: {
              description: 'When and where the driver marked this stop as done.',
              oneOf: [{ type: 'null' }, ref('StopEvent')],
            },
          },
        },
        StopEvent: {
          type: 'object',
          properties: {
            at: { type: 'string', format: 'date-time' },
            position: { oneOf: [{ type: 'null' }, ref('Position')] },
          },
        },
        Position: {
          type: 'object',
          description:
            'One point from the driver\'s device at that moment (not continuous tracking). distance_m is the distance to the stop address and is what tells whether the driver was there.',
          properties: {
            lat: { type: 'number' },
            lon: { type: 'number' },
            accuracy_m: nullable('integer', { description: 'Device-reported accuracy; only for stop completion.' }),
            distance_m: nullable('integer'),
          },
        },
        TimelineEvent: {
          type: 'object',
          required: ['at', 'type'],
          properties: {
            at: { type: 'string', format: 'date-time' },
            type: { enum: ['status', 'stop_arrived', 'stop_completed', 'document', 'amendment'] },
            from: { enum: [...STATUS, null], description: 'type=status' },
            to: { enum: STATUS, description: 'type=status' },
            sequence: nullable('integer', { description: 'type=stop_*, document, amendment' }),
            role: { enum: ROLES, description: 'type=stop_*' },
            city: { type: 'string', description: 'type=stop_*' },
            document_id: { type: 'string', format: 'uuid', description: 'type=document' },
            amendment_id: { type: 'integer', description: 'type=amendment' },
            kind: { type: 'string', description: 'type=document or amendment' },
            stop_label: nullable('string', { description: 'type=amendment' }),
          },
        },
        Document: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            kind: { enum: ['CMR', 'LOADING_PHOTO', 'UNLOADING_PHOTO', 'DAMAGE_PHOTO'] },
            damage: { type: 'boolean', description: 'kind is DAMAGE_PHOTO.' },
            phase: nullable('string'),
            subject: { enum: ['TRAILER', 'CARGO', 'SEAL', 'DOCUMENT', 'OTHER', 'SIGNATURE', null], description: 'What is on the photo.' },
            angle: nullable('string'),
            stop_sequence: nullable('integer'),
            file_name: nullable('string'),
            mime_type: nullable('string'),
            size_bytes: nullable('integer'),
            signer_name: nullable('string'),
            created_at: { type: 'string', format: 'date-time' },
            captured_at: nullable('string', { format: 'date-time' }),
            captured_position: {
              description: 'Where the photo was taken, with distance to the stop address.',
              oneOf: [{ type: 'null' }, ref('Position')],
            },
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
            consignee: { type: 'string', maxLength: 200, description: 'Only on EXTRA_LOAD stops: who the extra cargo is for.' },
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
                  description: 'order.stop_arrived, order.stop_completed, order.eta_changed',
                  properties: {
                    sequence: { type: 'integer' },
                    role: { enum: ROLES },
                    city: { type: 'string' },
                    arrived_at: { type: 'string', format: 'date-time' },
                    completed_at: { type: 'string', format: 'date-time' },
                    eta_at: { type: 'string', format: 'date-time' },
                    previous_eta_at: nullable('string', { format: 'date-time' }),
                    source: { enum: ['ROUTE', 'TRAFFIC', 'CARRIER'] },
                  },
                },
                document: {
                  type: 'object',
                  description: 'document.added',
                  properties: { id: { type: 'string', format: 'uuid' }, kind: { type: 'string' }, phase: nullable('string'), created_at: { type: 'string', format: 'date-time' } },
                },
                offer: {
                  type: 'object',
                  description: 'offer.received — see GET /orders/{ref}/offers',
                  properties: { id: { type: 'string', format: 'uuid' }, origin: { enum: ['DESK', 'DIRECT'] }, created_at: { type: 'string', format: 'date-time' } },
                },
                amendment: {
                  type: 'object',
                  description: 'order.amended — see GET /orders/{ref}/amendments',
                  properties: {
                    id: { type: 'integer' },
                    kind: { enum: AMENDMENT_KINDS },
                    stop_sequence: nullable('integer'),
                    created_at: { type: 'string', format: 'date-time' },
                  },
                },
                claim_ref: { type: 'string', description: 'claim.updated' },
                order_ref: { type: 'string', description: 'claim.updated' },
                change: { enum: ['CREATED', 'COMMENT', 'STATUS', 'ATTACHMENT'], description: 'claim.updated' },
                at: { type: 'string', format: 'date-time', description: 'claim.updated' },
              },
            },
          },
        },
        Offer: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            variant_no: { type: 'integer' },
            chosen: { type: 'boolean' },
            assigned: { type: 'boolean' },
            created_at: { type: 'string', format: 'date-time' },
            vehicle: {
              type: 'object',
              properties: {
                plate: { type: 'string' },
                make: nullable('string'),
                euro_class: nullable('string'),
                axles: nullable('integer'),
                base_city: nullable('string'),
                driver_name: nullable('string'),
                driver_languages: { type: 'array', items: { type: 'string' } },
                carrier_rating: nullable('number'),
              },
            },
          },
        },
        Amendment: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            kind: { enum: AMENDMENT_KINDS },
            stop_sequence: nullable('integer'),
            stop_role: { enum: [...ROLES, null] },
            stop_label: nullable('string'),
            changes: { type: 'object', description: 'Changed fields: { field: { from, to } }.', additionalProperties: true },
            created_at: { type: 'string', format: 'date-time' },
            acknowledged_at: nullable('string', { format: 'date-time', description: 'When the carrier confirmed it saw the change.' }),
          },
        },
        KnownVehicle: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid', description: 'Use as vehicle_id in POST /orders/{ref}/assign.' },
            plate: { type: 'string' },
            make: nullable('string'),
            vehicle_class: { enum: ['TRACTOR', 'VAN', 'TRUCK'] },
            euro_class: nullable('string'),
            axles: nullable('integer'),
            payload_kg: nullable('integer'),
            ldm: nullable('number'),
            container_feet: nullable('array', { items: { type: 'integer' } }),
            driver_name: nullable('string'),
            carrier_name: nullable('string'),
            direct_billing: { type: 'boolean', description: 'The carrier invoices you directly for direct jobs.' },
            carrier_rating: nullable('number'),
            trips_with_you: { type: 'integer' },
            last_trip_at: nullable('string', { format: 'date-time' }),
            available: { type: 'boolean' },
            busy: { type: 'boolean' },
          },
        },
        StopPatch: {
          type: 'object',
          description:
            'Only the fields you send are changed; null clears a field. Changing address or location needs a precise place: send location, or an address with a house number recognised in the city.',
          properties: {
            place_name: nullable('string'),
            company_name: nullable('string'),
            address: { type: 'string' },
            city: { type: 'string' },
            location: ref('Location'),
            contact: { type: 'object', properties: { name: { type: 'string' }, phone: { type: 'string' } } },
            scheduled_date: nullable('string', { format: 'date' }),
            scheduled_time: nullable('string', { pattern: '^([01]\\d|2[0-3]):[0-5]\\d$' }),
            external_ref: nullable('string'),
            note: nullable('string'),
            cargo_weight_kg: nullable('integer'),
            consignee: nullable('string', { description: 'Only on EXTRA_LOAD stops.' }),
            seal_required: nullable('boolean'),
            trailer_loaded: nullable('boolean'),
          },
        },
        NewStop: {
          allOf: [
            ref('StopPatch'),
            {
              type: 'object',
              required: ['role', 'before_sequence', 'address', 'city'],
              properties: {
                role: { enum: ['EXTRA_LOAD', 'EXTRA_UNLOAD'] },
                before_sequence: { type: 'integer', description: 'The new stop is inserted before this one; not before the pickup.' },
              },
            },
          ],
        },
        Claim: {
          type: 'object',
          properties: {
            ref: { type: 'string', example: 'CL-RS-2026-0142-1' },
            order_ref: { type: 'string' },
            stop_sequence: nullable('integer'),
            kind: { enum: CLAIM_KINDS },
            status: { enum: CLAIM_STATUSES },
            direction: { enum: ['filed', 'received'], description: 'Filed by your company, or against it.' },
            filed_by_role: { enum: ['SHIPPER', 'CARRIER', 'ADMIN'] },
            description: nullable('string'),
            amount: { oneOf: [{ type: 'null' }, ref('Money')] },
            resolution: nullable('string'),
            resolved_at: nullable('string', { format: 'date-time' }),
            created_at: { type: 'string', format: 'date-time' },
            updated_at: { type: 'string', format: 'date-time' },
          },
        },
        ClaimDetail: {
          allOf: [
            ref('Claim'),
            {
              type: 'object',
              properties: {
                events: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      at: { type: 'string', format: 'date-time' },
                      kind: { enum: ['CREATED', 'COMMENT', 'STATUS', 'ATTACHMENT'] },
                      author_role: { type: 'string' },
                      body: nullable('string'),
                      status_from: { enum: [...CLAIM_STATUSES, null] },
                      status_to: { enum: [...CLAIM_STATUSES, null] },
                      attachment_id: nullable('string', { format: 'uuid' }),
                    },
                  },
                },
                attachments: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      id: { type: 'string', format: 'uuid' },
                      file_name: { type: 'string' },
                      mime_type: { type: 'string' },
                      size_bytes: { type: 'integer' },
                      author_role: { type: 'string' },
                      created_at: { type: 'string', format: 'date-time' },
                      url: nullable('string', { format: 'uri', description: 'Signed link, valid 5 minutes.' }),
                      url_expires_at: { type: 'string', format: 'date-time' },
                    },
                  },
                },
              },
            },
          ],
        },
        ClaimInput: {
          type: 'object',
          required: ['order_ref', 'kind', 'description'],
          properties: {
            order_ref: { type: 'string' },
            kind: { enum: CLAIM_KINDS },
            description: { type: 'string', minLength: 10, maxLength: 5000 },
            stop_sequence: { type: 'integer', description: 'The stop the claim is about, if any.' },
            amount: { type: 'object', properties: { amount: { type: 'number', minimum: 0 } }, description: 'Claimed amount in euros.' },
          },
        },
      },
    },
  };
}

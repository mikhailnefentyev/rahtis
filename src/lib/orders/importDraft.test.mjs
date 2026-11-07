/*
 * Черновик заказа из письма: ответ модели → значения формы. Запуск: npm test.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cleanDate, cleanTime, matchClient, matchPlate, normalizeDraft, plateCandidates, plateKey } from './importDraft.ts';

/* Упрощённая проверка вместо ISO 6346 — тестам нужна только развилка. */
const isValidContainer = (v) => v === 'MSCU1234566';
const today = '2026-11-03';

const stop = (over) => ({
  kind: 'PICKUP', place_name: null, company: null, street: null, postal_code: null, city: null, country: null,
  date: null, time_from: null, time_to: null, contact_name: null, contact_phone: null, reference: null, weight_kg: null, note: null,
  ...over,
});

test('даты и время: только существующие', () => {
  assert.equal(cleanDate('2026-11-04'), '2026-11-04');
  assert.equal(cleanDate('2026-02-31'), '');
  assert.equal(cleanDate('4.11.2026'), '');
  assert.equal(cleanTime('8:00'), '08:00');
  assert.equal(cleanTime('24:00'), '');
});

test('экспресс: забор и доставка, вес в тонны, окно времени в указания', () => {
  const draft = normalizeDraft(
    {
      haul_kind: 'SEMI', unit_number: null, ldm: 13.6, weight_kg: 18500, price: 640, currency: 'EUR',
      stops: [
        stop({ kind: 'LOAD', company: 'Metsä Oy', street: 'Tehtaankatu 1', postal_code: '44100', city: 'Äänekoski', country: 'FI', date: '2026-11-04', time_from: '07:00', time_to: '15:00', reference: 'PO-77' }),
        stop({ kind: 'UNLOAD', company: 'Satama Oy', street: 'Satamakatu 1', postal_code: '10900', city: 'Hanko', date: '2026-11-05' }),
      ],
      missing: ['client'], confidence: 'high',
    },
    { isValidContainer, today },
  );
  assert.equal(draft.haulKind, 'SEMI');
  assert.equal(draft.pickup.address.text, 'Tehtaankatu 1, 44100 Äänekoski');
  assert.equal(draft.pickup.weight, '18,5');
  assert.equal(draft.pickup.time, '07:00');
  assert.match(draft.pickup.note, /07:00–15:00/);
  assert.match(draft.pickup.note, /Ref PO-77/);
  assert.equal(draft.delivery.company, 'Satama Oy');
  assert.equal(draft.ldm, '13,6');
  assert.equal(draft.rate, '640');
  assert.ok(draft.filled.includes('pickup.address'));
  /* client — только для своего рейса: заказчику модель его не навязывает. */
  assert.deepEqual(draft.missing, []);
});

test('перецеп: забор, действия, отцепка; прошедшая дата не подставляется', () => {
  const draft = normalizeDraft(
    {
      haul_kind: 'TRAILER', unit_number: 'abc 123',
      stops: [
        stop({ kind: 'PICKUP', place_name: 'Vuosaaren satama', city: 'Helsinki', date: '2026-11-01' }),
        stop({ kind: 'UNLOAD', company: 'K-Market', street: 'Kauppakatu 3', city: 'Lahti', reference: 'D-1' }),
        stop({ kind: 'DROP', street: 'Terminaalitie 5', city: 'Kerava' }),
      ],
      confidence: 'medium',
    },
    { isValidContainer, today },
  );
  assert.equal(draft.unitPlate, 'ABC123');
  assert.equal(draft.pickup.address.text, 'Vuosaaren satama, Helsinki');
  assert.equal(draft.pickup.date, '');
  assert.equal(draft.extras.length, 1);
  assert.equal(draft.extras[0].role, 'EXTRA_UNLOAD');
  assert.equal(draft.extras[0].stop.ref, '');
  assert.equal(draft.ret.address.city, 'Kerava');
  assert.ok(draft.missing.includes('pickupDate'));
  assert.ok(draft.missing.includes('rate'));
});

test('контейнер с неверной контрольной цифрой не подставляется; цена в чужой валюте — в список', () => {
  const draft = normalizeDraft(
    { haul_kind: 'CONTAINER', unit_number: 'MSCU1234567', container_feet: 40, price: 5000, currency: 'SEK', stops: [] },
    { isValidContainer, today },
  );
  assert.equal(draft.unitPlate, '');
  assert.ok(draft.missing.includes('unit'));
  assert.equal(draft.containerFeet, '40');
  assert.equal(draft.rate, '');
  assert.equal(draft.currency, null);
  assert.equal(draft.foreignPrice, '5000 SEK');
});

test('свой рейс перевозчика: цена в валюте письма подставляется вместе с валютой', () => {
  const currencies = ['EUR', 'SEK', 'NOK', 'DKK', 'PLN'];
  const sek = normalizeDraft(
    { haul_kind: 'TRUCK', price: 5000, currency: 'sek', stops: [] },
    { isValidContainer, today, clients: [], currencies },
  );
  assert.equal(sek.rate, '5000');
  assert.equal(sek.currency, 'SEK');
  assert.equal(sek.foreignPrice, null);
  assert.ok(!sek.missing.includes('rate'));

  /* Валюта не из наших — как раньше, в список «проверьте». */
  const usd = normalizeDraft(
    { haul_kind: 'TRUCK', price: 900, currency: 'USD', stops: [] },
    { isValidContainer, today, clients: [], currencies },
  );
  assert.equal(usd.rate, '');
  assert.equal(usd.foreignPrice, '900 USD');

  /* Евро без названной валюты — евро. */
  const eur = normalizeDraft({ haul_kind: 'TRUCK', price: 480, stops: [] }, { isValidContainer, today });
  assert.equal(eur.rate, '480');
  assert.equal(eur.currency, 'EUR');
});

test('тип не назван — догадка и пометка', () => {
  const draft = normalizeDraft({ unit_number: 'MSCU1234566', stops: [] }, { isValidContainer, today });
  assert.equal(draft.haulKind, 'CONTAINER');
  assert.ok(draft.missing.includes('haulKind'));
});

test('клиент перевозчика: по Y-tunnus, по имени без формы собственности, иначе новый', () => {
  const clients = [
    { id: 'c1', name: 'Kuljetus Virtanen Oy', business_id: '1234567-8' },
    { id: 'c2', name: 'Puutavara Ab', business_id: null },
  ];
  assert.equal(matchClient('Whatever', '1234567-8', clients), 'c1');
  assert.equal(matchClient('PUUTAVARA', '', clients), 'c2');
  assert.equal(matchClient('Uusi Asiakas Oy', '', clients), null);

  const draft = normalizeDraft(
    { haul_kind: 'TRUCK', customer: { name: 'Uusi Asiakas Oy', business_id: '7654321-0', email: 'Tilaus@Asiakas.fi' }, stops: [] },
    { isValidContainer, today, clients },
  );
  assert.deepEqual(draft.client, { id: null, name: 'Uusi Asiakas Oy', email: 'tilaus@asiakas.fi', businessId: '7654321-0' });
});

test('машина из заказа: номер тягача берётся, номер прицепа на его месте — нет', () => {
  const semi = normalizeDraft(
    {
      haul_kind: 'SEMI', unit_number: null, vehicle_plate: 'abc-123',
      stops: [stop({ kind: 'LOAD', city: 'Vuosaari', date: '2026-11-04' }), stop({ kind: 'UNLOAD', city: 'Tampere', date: '2026-11-04' })],
      missing: [], confidence: 'high',
    },
    { isValidContainer, today },
  );
  assert.equal(semi.vehiclePlate, 'ABC-123');
  assert.ok(semi.filled.includes('vehicle'));

  const swap = normalizeDraft(
    {
      haul_kind: 'TRAILER', unit_number: 'XYZ-987', vehicle_plate: 'XYZ 987',
      stops: [stop({ kind: 'PICKUP', city: 'Vuosaari', date: '2026-11-04' })],
      missing: [], confidence: 'high',
    },
    { isValidContainer, today },
  );
  assert.equal(swap.unitPlate, 'XYZ-987');
  assert.equal(swap.vehiclePlate, '');

  const none = normalizeDraft({ haul_kind: 'SEMI', stops: [], missing: [], confidence: 'low' }, { isValidContainer, today });
  assert.equal(none.vehiclePlate, '');
});

test('номер для сравнения: пробелы, дефисы и регистр не важны', () => {
  assert.equal(plateKey('abc-123'), 'ABC123');
  assert.equal(plateKey(' ABC 123 '), 'ABC123');
  assert.equal(plateKey('ÅÄÖ-1'), 'ÅÄÖ1');
  assert.equal(plateKey(null), '');
});

test('номера разных стран находят машину парка', () => {
  const fleet = [
    { id: 'fi', plate: 'ABC-123' },
    { id: 'se', plate: 'ABC 12D' },
    { id: 'ee', plate: '123 ABC' },
    { id: 'lv', plate: 'AB-1234' },
    { id: 'pl', plate: 'WX 12345' },
    { id: 'de', plate: 'HH-AB 1234' },
    { id: 'de2', plate: 'MÜ-X 77' },
    { id: 'no', plate: 'AB 12345' },
    { id: 'dk', plate: 'CD 12 345' },
  ];
  const hit = (s) => matchPlate(s, fleet)?.id ?? null;
  assert.equal(hit('abc123'), 'fi');
  assert.equal(hit('FIN ABC-123'), 'fi');
  assert.equal(hit('(FIN) ABC 123'), 'fi');
  assert.equal(hit('АВС-123'), 'fi'); // кириллица
  assert.equal(hit('ABC-123 / XYZ-987'), 'fi'); // сцепка: тягач первым
  assert.equal(hit('ABC-123 + XYZ-987'), 'fi');
  assert.equal(hit('ABC-123 ja XYZ-987'), 'fi');
  assert.equal(hit('АВС-123 и XYZ-987'), 'fi');
  assert.equal(hit('S ABC12D'), 'se');
  assert.equal(hit('EST 123ABC'), 'ee');
  assert.equal(hit('LV AB1234'), 'lv');
  assert.equal(hit('PL WX12345'), 'pl');
  assert.equal(hit('D HH AB 1234'), 'de');
  assert.equal(hit('mü-x 77'), 'de2');
  assert.equal(hit('N AB12345'), 'no');
  assert.equal(hit('DK CD12345'), 'dk');
  assert.equal(hit('ZZZ-999'), null);
  assert.equal(hit(''), null);
});

test('код страны не съедает сам номер', () => {
  /* «S-AB 123» (Штутгарт) — код города, не страны: слитно с номером, не снимается. */
  assert.deepEqual(plateCandidates('S-AB 123'), ['SAB123']);
  assert.deepEqual(plateCandidates('S AB 123'), ['SAB123', 'AB123']);
});

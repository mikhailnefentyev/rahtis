/*
 * Рейс → документ SIIRTO. Запуск: npm test.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildShippingDocument, splitAddress, treatmentFields } from './document.ts';

const base = (over = {}) => ({
  required: true,
  country: 'FI',
  materialCode: '170504',
  hazardous: false,
  materialName: 'Maa- ja kiviaines',
  contaminated: true,
  netKg: 18450,
  day: '2026-11-09',
  unloadedAt: '2026-11-09T10:42:00.000Z',
  plates: ['ABC-123', 'XYZ-987'],
  job: {
    name: 'Työmaa Vantaa', address: 'Tikkurilantie 10, 01300 Vantaa',
    customerName: 'Rakennus Oy', customerBusinessId: '1234567-8', customerStreet: 'Katu 1', customerPostalCode: '00100', customerCity: 'Helsinki', customerCountry: 'FI',
    contactName: 'Matti Työnjohtaja', contactPhone: '+358401234567', contactEmail: 'matti@rakennus.fi',
    treatmentCode: null, hazardCodes: [], hazardComposition: null,
  },
  carrier: { name: 'Kuljetus Oy', businessId: '7654321-0', street: 'Tie 2', postalCode: '02100', city: 'Espoo' },
  driver: { name: 'Kalle Kuski', phone: '+358409876543', email: null },
  receiver: {
    name: 'Maankaatopaikka X', address: 'Kaatopaikantie 5, 01530 Vantaa', city: 'Vantaa', postalCode: null,
    operatorName: 'Vastaanotto Oy', operatorBusinessId: '1111111-1', contactName: 'Vaaka', contactPhone: '+35850111', treatmentCode: 'R5.3',
  },
  ...over,
});

test('загрязнённый грунт: полный документ', () => {
  const r = buildShippingDocument(base());
  assert.equal(r.ok, true);
  const b = r.body;
  assert.equal(b.wasteHolderCompany.businessId, '1234567-8');
  assert.deepEqual(b.origin.address, { streetAddress: 'Tikkurilantie 10', postalCode: '01300' });
  assert.deepEqual(b.destination.address, { streetAddress: 'Kaatopaikantie 5', postalCode: '01530' });
  assert.equal(b.registrationCodesForTransport, 'ABC-123, XYZ-987');
  assert.equal(b.wastes[0].quantity, 18.45);
  assert.equal(b.wastes[0].recoveryCode, 'R5.3');
  assert.equal(b.wastes[0].disposalCode, null);
  assert.equal(b.wastes[0].wasteTypeCode, '1');
  assert.match(b.wastes[0].description, /PIMA/);
  assert.equal(b.carrierContact.phoneNumber, '+358409876543');
});

test('чистый грунт и не Финляндия — в реестр не идёт', () => {
  assert.deepEqual(buildShippingDocument(base({ required: false })), { ok: false, missing: ['notRequired'] });
  assert.deepEqual(buildShippingDocument(base({ country: 'EE' })), { ok: false, missing: ['notFinland'] });
});

test('чего не хватает — списком', () => {
  const r = buildShippingDocument(base({
    netKg: null,
    receiver: { ...base().receiver, operatorBusinessId: null, contactPhone: '' },
    job: { ...base().job, contactPhone: null, customerBusinessId: '123', address: 'Työmaa' },
  }));
  assert.equal(r.ok, false);
  assert.deepEqual(r.missing.sort(), ['holderBusinessId', 'holderContact', 'receiverCompany', 'receiverContact', 'siteAddress', 'weight'].sort());
});

test('опасный грунт: свойства, состав, упаковка, D-код с объекта', () => {
  const job = { ...base().job, treatmentCode: 'D1', hazardCodes: ['HP14'], hazardComposition: 'Öljyhiilivedyt' };
  const r = buildShippingDocument(base({ materialCode: '170503', hazardous: true, job }));
  assert.equal(r.ok, true);
  const w = r.body.wastes[0];
  assert.deepEqual([w.wasteTypeCode, w.packagingTypeCode, w.physicalStateCode, w.disposalCode, w.recoveryCode], ['3', '8', '2', 'D1', null]);
  assert.deepEqual(w.hazardousProperties, ['HP14']);
  assert.deepEqual(buildShippingDocument(base({ materialCode: '170503', hazardous: true })).missing, ['hazard']);
});

test('адрес и коды переработки', () => {
  assert.deepEqual(splitAddress('Satamakaari 18, 00980 Helsinki'), { streetAddress: 'Satamakaari 18', postalCode: '00980' });
  assert.deepEqual(splitAddress('Satamakaari 18', '00980'), { streetAddress: 'Satamakaari 18', postalCode: '00980' });
  assert.equal(splitAddress('Satamakaari 18'), null);
  assert.deepEqual(treatmentFields('r13'), { recoveryCode: 'R13', disposalCode: null });
  assert.deepEqual(treatmentFields('D15'), { recoveryCode: null, disposalCode: 'D15' });
});

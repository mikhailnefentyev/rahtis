/*
 * eFTI FTI004: идентификаторы для реестра шлюза + проверка по XSD. Запуск: npm test.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SCHEMAS, validate } from './testSupport.mjs';
import { sampleConsignment } from './fixture.mjs';

const { buildUploadIdentifierRequest } = await import('./upload.ts');

async function assertValid(xml) {
  const r = await validate(xml, SCHEMAS.upload);
  assert.deepEqual(r.errors, []);
  assert.equal(r.valid, true);
}

test('полный набор идентификаторов проходит XSD', async () => {
  const xml = buildUploadIdentifierRequest(sampleConsignment());
  await assertValid(xml);
  assert.match(xml, /^<\?xml version="1.0" encoding="UTF-8"\?>\n<uploadIdentifierRequest xmlns="http:\/\/efti.fi\/v1\/platform\/upload-identifiers-request"/);
});

test('значения: даты в поясе места, коды справочников', () => {
  const xml = buildUploadIdentifierRequest(sampleConsignment());
  // Принятие 07:15Z → 09:15 Хельсинки, формат 205.
  assert.match(xml, /<ram:CarrierAcceptanceDateParameterScope><ram:SpecifiedDateTime><udt:DateTimeString format="205">202611180915\+0200</);
  assert.match(xml, /<ram:CarrierAcceptanceCountryParameterScope><ram:CountryID>FI</);
  // Доставка 23:30Z → 00:30 19.11 в Стокгольме (+01:00), только 102.
  assert.match(xml, /<ram:DeliveryDateParameterScope><ram:SpecifiedDateTime><udt:DateTimeString format="102">20261119</);
  assert.match(xml, /<ram:DeliveryCountryParameterScope><ram:CountryID>SE</);
  assert.match(xml, /<ram:DangerousGoodsIndicationParameterCode>2</);
  assert.match(xml, /<ram:MainCarriageTransportMeansIDParameterScope><ram:ID>ABC-123</);
  assert.match(xml, /<ram:TransportModeParameterCode>3</);
  assert.match(xml, /<ram:TransportMeansParameterCode>3100</);
  assert.match(xml, /<ram:TransportMeansRegistrationCountryParameterScope><ram:CountryID>FI</);
  assert.match(xml, /<ram:UsedTransportEquipmentIDParameterScope><ram:ID>XYZ-987</);
  assert.match(xml, /<ram:TransportEquipmentCategoryParameterCode>SM</);
  assert.match(xml, /<ram:CarriedTransportEquipmentIDParameterScope><ram:ID>MSCU1234565</);
  assert.match(xml, /<ram:CarriedTransportEquipmentCategoryCodeParameterScope><ram:TransportEquipmentCategoryParameterCode>CN</);
});

test('без доставки — нет даты и страны доставки', async () => {
  const c = sampleConsignment();
  c.delivery = null;
  const xml = buildUploadIdentifierRequest(c);
  await assertValid(xml);
  assert.doesNotMatch(xml, /DeliveryDate|DeliveryCountry/);
});

test('опасный груз → 1; летнее время → +0300', async () => {
  const c = sampleConsignment();
  c.dangerousGoods = true;
  c.carrierAcceptance = { at: '2026-07-01T21:30:00Z', country: 'FI' };
  const xml = buildUploadIdentifierRequest(c);
  await assertValid(xml);
  assert.match(xml, /<ram:DangerousGoodsIndicationParameterCode>1</);
  assert.match(xml, /format="205">202607020030\+0300</);
});

test('без оборудования и дат мест — только обязательный минимум, XSD ок', async () => {
  const c = sampleConsignment();
  c.equipment = [];
  c.loading.at = null;
  c.unloading.at = null;
  const xml = buildUploadIdentifierRequest(c);
  await assertValid(xml);
  assert.doesNotMatch(xml, /Equipment|LoadingDate|UnloadingDate/);
});

test('обычный прицеп → TE; несколько единиц — по порядку', async () => {
  const c = sampleConsignment();
  c.equipment = [
    { id: 'TRL-2', category: 'TRAILER', country: 'SE', sequence: 2 },
    { id: 'TRL-1', category: 'TRAILER', country: 'FI', sequence: 1 },
  ];
  const xml = buildUploadIdentifierRequest(c);
  await assertValid(xml);
  assert.match(xml, /<ram:UsedTransportEquipmentIDParameterScope><ram:ID>TRL-1<\/ram:ID><ram:ID>TRL-2</);
  assert.match(xml, /<ram:TransportEquipmentCategoryParameterCode>TE</);
  assert.doesNotMatch(xml, /CarriedTransportEquipment/);
});

test('спецсимволы в номере экранируются, документ остаётся валидным', async () => {
  const c = sampleConsignment();
  c.vehicle.plate = 'A&B<1>"';
  const xml = buildUploadIdentifierRequest(c);
  await assertValid(xml);
  assert.match(xml, /<ram:ID>A&amp;B&lt;1&gt;"<\/ram:ID>/);
});

test('номер длиннее 17 символов не пишется (а не обрезается)', async () => {
  const c = sampleConsignment();
  c.vehicle.plate = 'X'.repeat(18);
  const xml = buildUploadIdentifierRequest(c);
  await assertValid(xml);
  assert.doesNotMatch(xml, /MainCarriageTransportMeansIDParameterScope/);
});

test('дата без зоны — ошибка, а не тихая подмена', () => {
  const c = sampleConsignment();
  c.carrierAcceptance.at = '2026-11-18T09:15:00';
  assert.throws(() => buildUploadIdentifierRequest(c), /ISO 8601/);
});

test('валидатор действительно ловит ошибки схемы', async () => {
  const c = sampleConsignment();
  c.vehicle.country = 'FI';
  const bad = buildUploadIdentifierRequest(c).replace(
    '<ram:TransportModeParameterCode>3<',
    '<ram:TransportModeParameterCode>9<',
  );
  const r = await validate(bad, SCHEMAS.upload);
  assert.equal(r.valid, false);
});

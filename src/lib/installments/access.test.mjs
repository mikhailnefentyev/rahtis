/*
 * Рассрочка техники: кому открыт раздел и какую машину можно выставить.
 * Запуск: npm test.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEAL_STATUSES,
  TERMINATION_REASONS,
  dealBadgeTone,
  dealBilled,
  dealHasContract,
  canBuyInstallments,
  canSellInstallments,
  catalogTabShown,
  installmentCabinet,
  installmentDealLink,
  installmentsBase,
  installmentsAvailable,
  parseSaleVehicle,
  saleVehicleEditable,
  saleVehicleHasCargo,
  saleVehicleSellable,
  isTerminationReason,
  vatModeAllowedForNew,
  vehicleSellable,
} from './access.ts';

test('раздел рассрочки — компаниям открытых стран реестра (Финляндия; с 23.11.2026 — Эстония, Латвия, Швеция и Дания)', () => {
  for (const country of ['FI', 'EE', 'LV', 'SE', 'DK']) assert.equal(installmentsAvailable(country), true, country);
  for (const country of ['LT', 'NO', 'PL', 'RO', '', null, undefined]) {
    assert.equal(installmentsAvailable(country), false);
  }
});

test('на продажу — своя машина: не купленная в рассрочку до выплаты и не проданная', () => {
  assert.equal(vehicleSellable(null), true);
  assert.equal(vehicleSellable(undefined), true);
  assert.equal(vehicleSellable('OWNED'), true);
  assert.equal(vehicleSellable('HELD'), false);
  assert.equal(vehicleSellable('SOLD'), false);
});

test('ежедневное задание ведёт только сделку в рассрочке — прекращённую не трогает', () => {
  assert.equal(dealBilled('ACTIVE'), true);
  for (const status of ['TERMINATED', 'PAID_OFF', 'CANCELLED', 'AGREED', 'NEGOTIATING', '', null, undefined]) {
    assert.equal(dealBilled(status), false, String(status));
  }
});

test('прекращённая сделка: статус в общем списке, договор доступен, значок — красный', () => {
  assert.ok(DEAL_STATUSES.includes('TERMINATED'));
  for (const status of ['AGREED', 'ACTIVE', 'PAID_OFF', 'TERMINATED']) assert.equal(dealHasContract(status), true, status);
  for (const status of ['NEGOTIATING', 'CANCELLED', null]) assert.equal(dealHasContract(status), false, String(status));
  assert.equal(dealBadgeTone('TERMINATED'), 'danger');
  assert.equal(dealBadgeTone('ACTIVE'), 'ok');
  assert.equal(dealBadgeTone('CANCELLED'), 'neutral');
  /* У каждого статуса есть цвет. */
  for (const status of DEAL_STATUSES) assert.ok(['ok', 'warn', 'info', 'danger', 'neutral'].includes(dealBadgeTone(status)));
});

test('причина прекращения — только две, как в базе', () => {
  assert.deepEqual([...TERMINATION_REASONS], ['REPOSSESSED', 'AGREEMENT']);
  assert.equal(isTerminationReason('REPOSSESSED'), true);
  assert.equal(isTerminationReason('AGREEMENT'), true);
  for (const value of ['repossessed', 'CANCELLED', '', null, undefined, 1]) assert.equal(isTerminationReason(value), false);
});

test('новое объявление и предложение — только с обычным НДС', () => {
  assert.equal(vatModeAllowedForNew('STANDARD'), true);
  for (const mode of ['MARGIN', 'EXEMPT', 'NONE', '', null, undefined]) assert.equal(vatModeAllowedForNew(mode), false);
});

/* Решение 23.11.2026: продаёт любая проверенная финская компания, покупает только перевозчик. */

const party = (over = {}) => ({ kind: 'SHIPPER', country: 'FI', status: 'ACTIVE', owner: true, ...over });

test('продавать может главный в проверенной компании открытой страны, любого вида — без лицензии и страховки', () => {
  assert.equal(canSellInstallments(party()), true);
  assert.equal(canSellInstallments(party({ kind: 'CARRIER' })), true);
  /* Эстония, Латвия, Швеция и Дания открыты с 23.11.2026. */
  assert.equal(canSellInstallments(party({ country: 'EE' })), true);
  assert.equal(canSellInstallments(party({ country: 'LV', kind: 'CARRIER' })), true);
  assert.equal(canSellInstallments(party({ country: 'SE' })), true);
  assert.equal(canSellInstallments(party({ country: 'DK', kind: 'CARRIER' })), true);
  /* Не проверена оператором, из закрытой страны, не главный, оператор платформы — нет. */
  assert.equal(canSellInstallments(party({ status: 'PENDING' })), false);
  assert.equal(canSellInstallments(party({ status: 'REJECTED' })), false);
  assert.equal(canSellInstallments(party({ country: 'NO' })), false);
  assert.equal(canSellInstallments(party({ owner: false })), false);
  assert.equal(canSellInstallments(party({ kind: 'ADMIN' })), false);
  assert.equal(canSellInstallments(party({ kind: null })), false);
});

test('покупать может только перевозчик с действующими документами', () => {
  assert.equal(canBuyInstallments(party({ kind: 'CARRIER', documentsOk: true })), true);
  assert.equal(canBuyInstallments(party({ kind: 'CARRIER', documentsOk: false })), false);
  /* Компания без парка не покупает, даже если документы почему-то есть. */
  assert.equal(canBuyInstallments(party({ kind: 'SHIPPER', documentsOk: true })), false);
  assert.equal(canBuyInstallments(party({ kind: 'CARRIER', documentsOk: true, status: 'PENDING' })), false);
  assert.equal(canBuyInstallments(party({ kind: 'CARRIER', documentsOk: true, country: 'NO' })), false);
  assert.equal(canBuyInstallments(party({ kind: 'CARRIER', documentsOk: true, owner: false })), false);
  /* Перевозчик с истёкшими документами продавать может, покупать — нет. */
  assert.equal(canSellInstallments(party({ kind: 'CARRIER' })), true);
});

test('раздел у каждой компании в своём кабинете: ссылки строятся от вида компании', () => {
  assert.equal(installmentsBase('CARRIER'), '/carrier/installments');
  assert.equal(installmentsBase('SHIPPER'), '/shipper/installments');
  assert.equal(installmentDealLink('CARRIER', 'abc'), '/carrier/installments/abc');
  assert.equal(installmentDealLink('SHIPPER', 'abc'), '/shipper/installments/abc');
  assert.equal(installmentCabinet('CARRIER'), 'CARRIER');
  assert.equal(installmentCabinet('SHIPPER'), 'SHIPPER');
  for (const kind of ['ADMIN', '', null, undefined]) assert.equal(installmentCabinet(kind), null);
});

test('каталог — только перевозчику: компании без парка вкладка не нужна', () => {
  assert.equal(catalogTabShown('CARRIER'), true);
  for (const kind of ['SHIPPER', 'ADMIN', null, undefined]) assert.equal(catalogTabShown(kind), false);
});

test('карточка машины на продажу: выставить — одобренную и не проданную, править — не на проверке и без объявления', () => {
  assert.equal(saleVehicleSellable({ access: 'APPROVED', sold_deal_id: null }), true);
  assert.equal(saleVehicleSellable({ access: 'APPROVED', sold_deal_id: 'd1' }), false);
  for (const access of ['DRAFT', 'PENDING', 'REJECTED']) assert.equal(saleVehicleSellable({ access, sold_deal_id: null }), false, access);
  assert.equal(saleVehicleEditable({ access: 'DRAFT', sold_deal_id: null }, false), true);
  assert.equal(saleVehicleEditable({ access: 'REJECTED', sold_deal_id: null }, false), true);
  assert.equal(saleVehicleEditable({ access: 'APPROVED', sold_deal_id: null }, false), true);
  assert.equal(saleVehicleEditable({ access: 'APPROVED', sold_deal_id: null }, true), false);
  assert.equal(saleVehicleEditable({ access: 'PENDING', sold_deal_id: null }, false), false);
  assert.equal(saleVehicleEditable({ access: 'APPROVED', sold_deal_id: 'd1' }, false), false);
});

test('данные машины на продажу: те же пределы, что у машины парка', () => {
  const base = { plate: ' abc-123 ', make: ' Volvo FH 500 ', vehicleClass: 'TRACTOR', euroClass: 'EURO_6', axles: '3', payloadKg: '', ldm: '' };
  assert.deepEqual(parseSaleVehicle(base), {
    plate: 'ABC-123', make: 'Volvo FH 500', vehicleClass: 'TRACTOR', euroClass: 'EURO_6', axles: 3, payloadKg: null, ldm: null,
  });
  /* У тягача и самосвала грузоподъёмность не хранится, даже если её ввели. */
  assert.equal(parseSaleVehicle({ ...base, payloadKg: '9000', ldm: '7' }).payloadKg, null);
  /* Грузовик и фургон — с грузоподъёмностью и погрузочными метрами. */
  assert.deepEqual(parseSaleVehicle({ ...base, vehicleClass: 'TRUCK', payloadKg: '12 000', ldm: '7,2' }), {
    plate: 'ABC-123', make: 'Volvo FH 500', vehicleClass: 'TRUCK', euroClass: 'EURO_6', axles: 3, payloadKg: 12000, ldm: 7.2,
  });
  assert.equal(parseSaleVehicle({ ...base, vehicleClass: 'TRUCK' }), null);
  assert.equal(parseSaleVehicle({ ...base, vehicleClass: 'VAN', axles: '2', payloadKg: '3600', ldm: '4' }), null);
  assert.ok(parseSaleVehicle({ ...base, vehicleClass: 'VAN', axles: '2', payloadKg: '1200', ldm: '4' }));
  /* Самосвал — от трёх осей. */
  assert.equal(parseSaleVehicle({ ...base, vehicleClass: 'TIPPER', axles: '2' }), null);
  assert.ok(parseSaleVehicle({ ...base, vehicleClass: 'TIPPER', axles: '4' }));
  /* Номер, марка, класс, эко-класс, оси. */
  assert.equal(parseSaleVehicle({ ...base, plate: 'AB' }), null);
  assert.equal(parseSaleVehicle({ ...base, plate: 'ÄÖ-123' }), null);
  assert.equal(parseSaleVehicle({ ...base, make: 'V' }), null);
  assert.equal(parseSaleVehicle({ ...base, vehicleClass: 'BUS' }), null);
  assert.equal(parseSaleVehicle({ ...base, euroClass: 'EURO_3' }), null);
  assert.equal(parseSaleVehicle({ ...base, axles: '6' }), null);
  assert.equal(parseSaleVehicle({ ...base, axles: '2.5' }), null);
  assert.equal(saleVehicleHasCargo('VAN'), true);
  assert.equal(saleVehicleHasCargo('TRACTOR'), false);
});

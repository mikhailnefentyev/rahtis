/*
 * Пример EftiConsignment для тестов XML-слоя eFTI (вымышленные данные).
 * Возвращает новую копию при каждом вызове — тесты могут её менять.
 */

/** @returns {import('../types').EftiConsignment} */
export function sampleConsignment() {
  return {
    datasetId: '3f2b8c1e-5d4a-4e6f-9a7b-1c2d3e4f5a6b',
    reference: 'R-2026-001234',
    // 07:15 UTC = 09:15 в Хельсинки (зима, +02:00).
    carrierAcceptance: { at: '2026-11-18T07:15:00.000Z', country: 'FI' },
    delivery: { at: '2026-11-18T23:30:00.000Z', country: 'SE' },
    dangerousGoods: false,
    consignor: {
      name: 'Esimerkki Logistiikka Oy',
      id: '1234567-8',
      street: 'Teollisuuskatu 5',
      postcode: '00510',
      city: 'Helsinki',
      country: 'FI',
    },
    consignee: {
      name: 'Exempel AB',
      id: '556677-8899',
      street: 'Hamngatan 1',
      postcode: '111 47',
      city: 'Stockholm',
      country: 'SE',
    },
    carrier: {
      name: 'Kuljetus & Rahti <Testi> Oy',
      id: '7654321-0',
      street: 'Satamatie 12',
      postcode: '20100',
      city: 'Turku',
      country: 'FI',
    },
    loading: {
      street: 'Teollisuuskatu 5',
      postcode: '00510',
      city: 'Helsinki',
      country: 'FI',
      at: '2026-11-18T07:15:00.000Z',
    },
    unloading: {
      street: 'Hamngatan 1',
      postcode: '111 47',
      city: 'Stockholm',
      country: 'SE',
      at: '2026-11-18T23:30:00.000Z',
    },
    vehicle: { plate: 'ABC-123', country: 'FI' },
    equipment: [
      { id: 'XYZ-987', category: 'SEMI_TRAILER', country: 'FI', sequence: 1 },
      { id: 'MSCU1234565', category: 'CONTAINER', country: 'FI', sequence: 2 },
    ],
    goods: [
      { description: 'Paperirullia', grossWeightKg: 18250.5, packages: 24 },
      { description: 'Lavoja', grossWeightKg: 500, packages: null },
    ],
  };
}

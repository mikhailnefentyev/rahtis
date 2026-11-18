/*
 * eFTI FTI010: ответ с набором данных, фильтр подмножеств, проверка по XSD. Запуск: npm test.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SCHEMAS, validate } from './testSupport.mjs';
import { sampleConsignment } from './fixture.mjs';

const { buildCmdsResponse, consignmentKids, unknownSubsetIds, FULL_SUBSET } = await import('./cmds.ts');
const { render } = await import('./common.ts');
const { parseXml } = await import('./parse.ts');
const { MAPPED_PATHS, ALL_SUBSET_IDS, subsetsOfPath } = await import('./subsetMap.ts');
const { PATHS } = await import('./subsets.gen.mjs');

async function assertValid(xml) {
  const r = await validate(xml, SCHEMAS.cmds);
  assert.deepEqual(r.errors, []);
  assert.equal(r.valid, true);
}

/** Пути всех листов, которые cmds.ts пишет для данного набора. */
function leafPaths(c) {
  const paths = [];
  render({ tag: 'consignment', kids: consignmentKids(c) }, (p) => {
    paths.push(p);
    return true;
  });
  return paths;
}

test('весь набор (full) проходит XSD', async () => {
  await assertValid(buildCmdsResponse(sampleConsignment(), [FULL_SUBSET]));
});

test('каждое подмножество CL-056 даёт валидный документ', async () => {
  const c = sampleConsignment();
  const docs = ALL_SUBSET_IDS.map((id) => buildCmdsResponse(c, [id]));
  assert.equal(docs.length, 183);
  const r = await validate(docs, SCHEMAS.cmds);
  assert.deepEqual(r.errors, []);
  assert.equal(r.valid, true);
});

test('каждый записываемый лист есть в карте подмножеств, карта = PATHS генератора', () => {
  const paths = new Set(leafPaths(sampleConsignment()));
  for (const p of paths) assert.ok(subsetsOfPath(p), `нет в карте: ${p}`);
  assert.deepEqual([...MAPPED_PATHS].sort(), [...PATHS].sort());
  // Фикстура покрывает все пути карты — иначе часть карты не проверена XSD.
  assert.deepEqual([...paths].sort(), [...MAPPED_PATHS].sort());
});

/** Пути листов в готовом XML (разбором, а не через фильтр). */
function pathsInXml(xml) {
  const root = parseXml(xml);
  const consignment = root.children[0];
  const mapped = new Set(MAPPED_PATHS);
  const found = new Set();
  const walk = (el, path) => {
    for (const k of el.children) {
      const p = path ? `${path}/${k.local}` : k.local;
      if (mapped.has(p)) found.add(p);
      else walk(k, p);
    }
  };
  walk(consignment, '');
  return found;
}

test('фильтр: в ответе ровно листы запрошенных подмножеств', () => {
  const all = new Set(leafPaths(sampleConsignment()));
  for (const ids of [['FI01'], ['EU01'], ['PT01'], ['LT02', 'SE03'], ['EU02', 'FI04', 'DE01']]) {
    const got = pathsInXml(buildCmdsResponse(sampleConsignment(), ids));
    const expected = [...all].filter((p) => subsetsOfPath(p).some((s) => ids.includes(s)));
    assert.deepEqual([...got].sort(), expected.sort(), ids.join(','));
  }
});

test('FI01: ключевые элементы есть, PackageQuantity (только PT01) — нет', () => {
  const xml = buildCmdsResponse(sampleConsignment(), ['FI01']);
  assert.match(xml, /<ram:CarrierAcceptanceDateTime>/);
  assert.match(xml, /<ram:ConsignorTradeParty>/);
  assert.match(xml, /<ram:UsedLogisticsTransportMeans><ram:TypeCode>3100</);
  assert.doesNotMatch(xml, /PackageQuantity/);
});

test('PT01 добавляет PackageQuantity; объединение подмножеств', () => {
  const pt = buildCmdsResponse(sampleConsignment(), ['PT01']);
  assert.match(pt, /<ram:PackageQuantity>24</);
  const both = buildCmdsResponse(sampleConsignment(), ['FI01', 'PT01']);
  assert.match(both, /<ram:PackageQuantity>24</);
  assert.match(both, /<ram:UsedLogisticsTransportMeans><ram:TypeCode>/);
});

test('пустой или неизвестный набор подмножеств → пустой consignment (валидный)', async () => {
  for (const ids of [[], ['XX99']]) {
    const xml = buildCmdsResponse(sampleConsignment(), ids);
    assert.match(xml, /<consignment\/><\/cmdsResponse>$/);
    await assertValid(xml);
  }
  assert.deepEqual(unknownSubsetIds(['FI01', 'XX99', FULL_SUBSET, 'EU05a']), ['XX99']);
});

test('ограничения схемы: длинные имена обрезаются, длинные ID пропускаются', async () => {
  const c = sampleConsignment();
  c.consignor.name = 'Erittäin Pitkä Yritysnimi Logistiikka ja Kuljetus Oy Ab';
  c.consignor.id = 'FI12345678901234567890';
  c.goods = [{ description: 'x'.repeat(600), grossWeightKg: 1e6 / 3, packages: null }];
  const xml = buildCmdsResponse(c, [FULL_SUBSET]);
  await assertValid(xml);
  assert.match(xml, /<ram:ConsignorTradeParty><ram:Name>Erittäin Pitkä Yritysnimi Logistiik<\/ram:Name>/);
  assert.match(xml, /<ram:GrossWeightMeasure unitCode="KGM">333333.333</);
  assert.doesNotMatch(xml, /PackageQuantity|TransportLogisticsPackage/);
});

test('минимальный набор: без доставки, оборудования, дат мест — валиден', async () => {
  const c = sampleConsignment();
  c.delivery = null;
  c.equipment = [];
  c.loading.at = null;
  c.unloading.at = null;
  c.goods = [{ description: '', grossWeightKg: null, packages: null }];
  const xml = buildCmdsResponse(c, [FULL_SUBSET]);
  await assertValid(xml);
  assert.doesNotMatch(xml, /Delivery|ConsigneeReceipt|UtilizedLogisticsTransportEquipment|NatureIdentification|GrossWeight/);
});

test('только контейнер → перевозимое оборудование без «используемого» номера', async () => {
  const c = sampleConsignment();
  c.equipment = [{ id: 'MSCU1234565', category: 'CONTAINER', country: 'FI', sequence: 1 }];
  const xml = buildCmdsResponse(c, [FULL_SUBSET]);
  await assertValid(xml);
  assert.match(
    xml,
    /<ram:UtilizedLogisticsTransportEquipment><ram:CarriedAssociatedTransportEquipment><ram:ID schemeAgencyID="20">MSCU1234565</,
  );
});

test('язык описания груза настраивается', async () => {
  const xml = buildCmdsResponse(sampleConsignment(), [FULL_SUBSET], { goodsLanguageId: 'en' });
  await assertValid(xml);
  assert.match(xml, /<ram:Identification languageID="en">/);
});

test('валидатор ловит ошибки схемы и в ответе', async () => {
  const bad = buildCmdsResponse(sampleConsignment(), [FULL_SUBSET]).replace('unitCode="KGM"', 'unitCode="LBR"');
  assert.equal((await validate(bad, SCHEMAS.cmds)).valid, false);
});

/*
 * Генератор карты подмножеств eFTI для cmds.ts → subsetMap.ts.
 *
 * Источник — «eFTI XM SubMap» из пакета схем Fintraffic
 * (platform-v1-schemas.zip → move.eu/Semantic XML Schemas/eFTI XM SubMap/
 * eFTIXMa_urn_eu_move_eFTI_data_standard_ReusableAggregateBusinessInformationEntity_34.xsd).
 * В нём у каждого xs:element есть аннотации <eFTI_subset>EU01</eFTI_subset>…:
 * в каких подмножествах (CL-056: EU01…, FI01…, всего 183) элемент участвует.
 *
 * Карта строится только для путей, которые реально пишет cmds.ts (PATHS
 * ниже; тест сверяет, что каждый лист ответа есть в карте). Путь —
 * локальные имена элементов от SupplyChainConsignment.
 *
 * Запуск (файл SubMap лежит вне репозитория, 1,5 МБ):
 *   node src/lib/efti/xml/subsets.gen.mjs "<путь к eFTIXMa_…ReusableAggregate…_34.xsd>"
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseXml } from './parse.ts';

const PARTY = ['ID', 'Name', 'PostalTradeAddress/PostcodeCode', 'PostalTradeAddress/StreetName', 'PostalTradeAddress/CityName', 'PostalTradeAddress/CountryID'];
const ADDRESS = ['PostcodeCode', 'StreetName', 'CityName', 'CountryID'];
const MOVE = 'MainCarriageLogisticsTransportMovement';
const EQ = 'UtilizedLogisticsTransportEquipment';

export const PATHS = [
  'CarrierAcceptanceDateTime',
  'GrossWeightMeasure',
  'PackageQuantity',
  ...PARTY.map((p) => `ConsignorTradeParty/${p}`),
  ...PARTY.map((p) => `ConsigneeTradeParty/${p}`),
  ...PARTY.map((p) => `CarrierTradeParty/${p}`),
  'CarrierAcceptanceLogisticsLocation/PostalTradeAddress/CountryID',
  'ConsigneeReceiptLogisticsLocation/PostalTradeAddress/CountryID',
  'TransportContractReferencedDocument/ID',
  'DeliveryTransportEvent/ActualOccurrenceDateTime',
  `${EQ}/ID`,
  `${EQ}/CategoryCode`,
  `${EQ}/SequenceNumeric`,
  `${EQ}/CarriedAssociatedTransportEquipment/ID`,
  `${EQ}/CarriedAssociatedTransportEquipment/CategoryCode`,
  `${EQ}/CarriedAssociatedTransportEquipment/SequenceNumeric`,
  `${EQ}/RegistrationTradeCountry/ID`,
  `${MOVE}/ModeCode`,
  `${MOVE}/LoadingTransportEvent/ActualOccurrenceDateTime`,
  ...ADDRESS.map((a) => `${MOVE}/LoadingTransportEvent/OccurrenceLogisticsLocation/PostalTradeAddress/${a}`),
  `${MOVE}/UnloadingTransportEvent/ActualOccurrenceDateTime`,
  ...ADDRESS.map((a) => `${MOVE}/UnloadingTransportEvent/OccurrenceLogisticsLocation/PostalTradeAddress/${a}`),
  `${MOVE}/UsedLogisticsTransportMeans/TypeCode`,
  `${MOVE}/UsedLogisticsTransportMeans/ID`,
  `${MOVE}/UsedLogisticsTransportMeans/RegistrationTradeCountry/ID`,
  'TransportLogisticsPackage/ItemQuantity',
  'NatureIdentificationTransportCargo/Identification',
];

const XS = 'http://www.w3.org/2001/XMLSchema';

function main() {
  const src = process.argv[2];
  if (!src) {
    console.error('usage: node subsets.gen.mjs <eFTIXMa RABIE xsd>');
    process.exit(2);
  }
  const schema = parseXml(readFileSync(src, 'utf8'));
  /** complexType name → Map(element name → { type, subsets }) */
  const types = new Map();
  const collect = (node, out) => {
    for (const k of node.children) {
      if (k.ns === XS && k.local === 'element') {
        const subsets = [];
        const ann = k.children.find((a) => a.local === 'annotation');
        const doc = ann?.children.find((d) => d.local === 'documentation');
        for (const s of doc?.children ?? []) if (s.local === 'eFTI_subset') subsets.push(s.text.trim());
        out.set(k.attrs.name, { type: (k.attrs.type ?? '').replace(/^ram:/, ''), subsets });
      } else if (k.ns === XS && (k.local === 'sequence' || k.local === 'choice')) {
        collect(k, out);
      }
    }
  };
  for (const ct of schema.children) {
    if (ct.ns === XS && ct.local === 'complexType') {
      const els = new Map();
      collect(ct, els);
      types.set(ct.attrs.name, els);
    }
  }

  const all = new Set();
  const byPath = {};
  for (const path of PATHS) {
    let type = 'SupplyChainConsignmentType';
    let prev = null;
    let subsets = null;
    for (const name of path.split('/')) {
      const el = types.get(type)?.get(name);
      if (!el) throw new Error(`${path}: no element ${name} in ${type}`);
      if (prev && el.subsets.some((s) => !prev.has(s))) {
        throw new Error(`${path}: ${name} has subsets outside its parent — filter rule would be wrong`);
      }
      prev = new Set(el.subsets);
      subsets = el.subsets;
      type = el.type;
    }
    subsets.forEach((s) => all.add(s));
    byPath[path] = [...new Set(subsets)].sort();
  }
  for (const els of types.values()) for (const el of els.values()) el.subsets.forEach((s) => all.add(s));

  const sets = [];
  const index = {};
  for (const [path, list] of Object.entries(byPath)) {
    const key = list.join(' ');
    let i = sets.indexOf(key);
    if (i === -1) i = sets.push(key) - 1;
    index[path] = i;
  }

  const out = `/* Сгенерировано subsets.gen.mjs из eFTI XM SubMap (Fintraffic platform-v1-schemas). Не править вручную. */

/** Все идентификаторы подмножеств CL-056, встречающиеся в SubMap. */
export const ALL_SUBSET_IDS: readonly string[] = ${JSON.stringify([...all].sort())};

/** Наборы подмножеств (через пробел); SUBSETS_BY_PATH ссылается на них по индексу. */
const SETS: readonly string[] = ${JSON.stringify(sets, null, 2)};

/** Путь листа от SupplyChainConsignment → индекс в SETS. */
const INDEX: Record<string, number> = ${JSON.stringify(index, null, 2)};

/** Подмножества, в которые входит лист по пути; неизвестный путь — undefined. */
export function subsetsOfPath(path: string): readonly string[] | undefined {
  const i = INDEX[path];
  return i === undefined ? undefined : SETS[i].split(' ');
}

/** Все пути, для которых есть карта. */
export const MAPPED_PATHS: readonly string[] = Object.keys(INDEX);
`;
  const target = fileURLToPath(new URL('./subsetMap.ts', import.meta.url));
  writeFileSync(target, out);
  console.log(`wrote ${target}: ${PATHS.length} paths, ${sets.length} distinct sets, ${all.size} subset ids`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();

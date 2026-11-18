/**
 * FTI010 — ответ платформы на запрос набора данных (GET
 * /v1/consignments/{datasetId}?subsetId=…; тело cmdsResponse по
 * platform-api-for-gate/v1-cmds-response.xsd, внутри consignment типа
 * SupplyChainConsignmentType из семантической схемы FTI010).
 *
 * ПОДМНОЖЕСТВА. Инспектор получает только элементы запрошенных
 * подмножеств (CL-056: EU01…EU06, FI01…FI04 и национальные — всего 183).
 * Принадлежность элементов подмножествам берётся из аннотаций
 * <eFTI_subset> схемы «eFTI XM SubMap»; для путей, которые мы пишем, она
 * заранее выгружена в subsetMap.ts (генератор subsets.gen.mjs). Правило:
 *   · лист (BBIE: значение вместе с атрибутами и DateTimeString) остаётся,
 *     если его подмножества пересекаются с запрошенными;
 *   · агрегат пишется, только если в нём остался хотя бы один лист
 *     (в SubMap подмножества агрегата всегда покрывают подмножества
 *     потомков — генератор это проверяет);
 *   · «full» — весь набор без фильтра (служебное значение, не из CL-056);
 *   · неизвестные идентификаторы игнорируются; unknownSubsetIds() даёт
 *     маршруту возможность ответить UNKNOWN_SUBSET (CL-068, 409).
 * Ограничение: карта есть только для элементов, которые мы пишем; новый
 * элемент требует дописать путь в subsets.gen.mjs и перегенерировать карту
 * (тест упадёт, если путь не в карте).
 *
 * ВЫНУЖДЕННЫЕ РЕШЕНИЯ ПО СХЕМЕ FTI010:
 *   · ID сторон обязателен с schemeAgencyID, а схема разрешает только 87
 *     («Assigned by carrier») и не более 17 символов; длиннее — ID не пишем;
 *   · номер машины — schemeAgencyID ZZZ; прицепа — 502 (единственно
 *     близкое из разрешённых 12/20/501/502); контейнера — 20 (BIC);
 *   · контейнер (CN) по схеме — только «перевозимое» оборудование, поэтому
 *     он вкладывается в первый прицеп (или в пустую запись оборудования);
 *   · текстовые поля ограничены 35 символами (имя, улица, город) —
 *     обрезаются; описание груза — до 512 символов с обязательным languageID;
 *   · EftiPlace.at пишется как фактическое время погрузки/разгрузки
 *     (ActualOccurrenceDateTime), т. к. идентификаторы FTI004 тоже требуют
 *     фактических дат; признак опасного груза в FTI010 отдельного элемента
 *     не имеет (без описания ADR не пишется).
 */

import {
  EQUIPMENT_CATEGORY,
  NS,
  SCHEME_AGENCY,
  TRANSPORT_MEANS_TYPE_TRUCK,
  TRANSPORT_MODE_ROAD,
  XML_DECLARATION,
  country,
  dateTime,
  decimal,
  format102,
  format205,
  group,
  leaf,
  render,
  text,
  token,
  type XNode,
} from './common';
import { ALL_SUBSET_IDS, subsetsOfPath } from './subsetMap';
import type { EftiConsignment, EftiEquipment, EftiParty, EftiPlace } from '../types';

/** Служебный идентификатор «весь набор». */
export const FULL_SUBSET = 'full';

export type CmdsOptions = {
  /** Язык описания груза (CL-063, обязателен для eFTI699). По умолчанию 'fi'. */
  goodsLanguageId?: string;
};

/** Идентификаторы, которых нет в CL-056 (и не «full»). */
export function unknownSubsetIds(subsetIds: string[]): string[] {
  const known = new Set(ALL_SUBSET_IDS);
  return subsetIds.filter((id) => id !== FULL_SUBSET && !known.has(id));
}

/** XML ответа GET /v1/consignments/{datasetId} только с запрошенными подмножествами. */
export function buildCmdsResponse(c: EftiConsignment, subsetIds: string[], opts: CmdsOptions = {}): string {
  const requested = new Set(subsetIds.map((s) => s.trim()).filter(Boolean));
  const full = requested.has(FULL_SUBSET);
  const keep = (path: string): boolean => {
    if (full) return true;
    const subsets = subsetsOfPath(path);
    if (!subsets) throw new Error(`eFTI: no subset mapping for ${path}`);
    return subsets.some((s) => requested.has(s));
  };

  const consignment: XNode = { tag: 'consignment', kids: consignmentKids(c, opts) };
  const body = render(consignment, keep);
  const open = `<cmdsResponse xmlns="${NS.cmdsResponse}" xmlns:ram="${NS.ram}" xmlns:udt="${NS.udt}">`;
  return `${XML_DECLARATION}${open}${body}</cmdsResponse>`;
}

/** Полный набор без фильтра — для тестов и отладки. */
export function consignmentKids(c: EftiConsignment, opts: CmdsOptions = {}): XNode[] {
  const used = c.equipment.filter((e) => e.category !== 'CONTAINER').sort(bySequence);
  const carried = c.equipment.filter((e) => e.category === 'CONTAINER').sort(bySequence);

  const weights = c.goods.map((g) => g.grossWeightKg).filter((w): w is number => typeof w === 'number' && w > 0);
  const packages = c.goods.map((g) => g.packages).filter((p): p is number => Number.isInteger(p) && (p as number) > 0);
  const description = text(c.goods.map((g) => g.description).filter(Boolean).join('; '), 512);

  const kids: (XNode | null)[] = [
    dateTime('ram:CarrierAcceptanceDateTime', format205(c.carrierAcceptance.at, c.carrierAcceptance.country)),
    weights.length
      ? leaf('ram:GrossWeightMeasure', decimal(weights.reduce((a, b) => a + b, 0)), { unitCode: 'KGM' })
      : null,
    packages.length ? leaf('ram:PackageQuantity', String(packages.reduce((a, b) => a + b, 0))) : null,
    party('ram:ConsignorTradeParty', c.consignor),
    party('ram:ConsigneeTradeParty', c.consignee),
    party('ram:CarrierTradeParty', c.carrier),
    group('ram:CarrierAcceptanceLogisticsLocation', [
      group('ram:PostalTradeAddress', [leaf('ram:CountryID', country(c.carrierAcceptance.country))]),
    ]),
    c.delivery &&
      group('ram:ConsigneeReceiptLogisticsLocation', [
        group('ram:PostalTradeAddress', [leaf('ram:CountryID', country(c.delivery.country))]),
      ]),
    group('ram:TransportContractReferencedDocument', [leaf('ram:ID', token(c.reference, 17))]),
    c.delivery &&
      group('ram:DeliveryTransportEvent', [
        dateTime('ram:ActualOccurrenceDateTime', format102(c.delivery.at, c.delivery.country)),
      ]),
    ...equipment(used, carried),
    group('ram:MainCarriageLogisticsTransportMovement', [
      leaf('ram:ModeCode', TRANSPORT_MODE_ROAD),
      event('ram:LoadingTransportEvent', c.loading, true),
      event('ram:UnloadingTransportEvent', c.unloading, false),
      group('ram:UsedLogisticsTransportMeans', [
        leaf('ram:TypeCode', TRANSPORT_MEANS_TYPE_TRUCK),
        idLeaf('ram:ID', token(c.vehicle.plate, 17), SCHEME_AGENCY.vehiclePlate),
        group('ram:RegistrationTradeCountry', [leaf('ram:ID', country(c.vehicle.country))]),
      ]),
    ]),
    ...packages.map((p) => group('ram:TransportLogisticsPackage', [leaf('ram:ItemQuantity', String(p))])),
    description
      ? group('ram:NatureIdentificationTransportCargo', [
          leaf('ram:Identification', description, { languageID: opts.goodsLanguageId ?? 'fi' }),
        ])
      : null,
  ];
  return kids.filter((k): k is XNode => !!k);
}

function idLeaf(tag: string, value: string | null, schemeAgencyID: string): XNode | null {
  return leaf(tag, value, { schemeAgencyID });
}

function party(tag: string, p: EftiParty): XNode | null {
  return group(tag, [
    idLeaf('ram:ID', token(p.id, 17), SCHEME_AGENCY.party),
    leaf('ram:Name', text(p.name, 35)),
    address(p),
  ]);
}

function address(a: { street: string | null; postcode: string | null; city: string | null; country: string }) {
  return group('ram:PostalTradeAddress', [
    leaf('ram:PostcodeCode', token(a.postcode, 17)),
    leaf('ram:StreetName', text(a.street, 35)),
    leaf('ram:CityName', text(a.city, 35)),
    leaf('ram:CountryID', country(a.country)),
  ]);
}

function event(tag: string, place: EftiPlace, loading: boolean): XNode | null {
  // Погрузка допускает 205 (с временем), разгрузка по схеме — только 102.
  const at = place.at ? (loading ? format205 : format102)(place.at, place.country) : null;
  return group(tag, [
    dateTime('ram:ActualOccurrenceDateTime', at),
    group('ram:OccurrenceLogisticsLocation', [address(place)]),
  ]);
}

function equipment(used: EftiEquipment[], carried: EftiEquipment[]): (XNode | null)[] {
  const carriedNodes = carried.map((e) =>
    group('ram:CarriedAssociatedTransportEquipment', [
      idLeaf('ram:ID', token(e.id, 17), SCHEME_AGENCY.container),
      leaf('ram:CategoryCode', EQUIPMENT_CATEGORY[e.category]),
      leaf('ram:SequenceNumeric', sequence(e)),
    ]),
  );
  if (!used.length) return carriedNodes.length ? [group('ram:UtilizedLogisticsTransportEquipment', carriedNodes)] : [];
  return used.map((e, i) =>
    group('ram:UtilizedLogisticsTransportEquipment', [
      idLeaf('ram:ID', token(e.id, 17), SCHEME_AGENCY.trailer),
      leaf('ram:CategoryCode', EQUIPMENT_CATEGORY[e.category]),
      leaf('ram:SequenceNumeric', sequence(e)),
      ...(i === 0 ? carriedNodes : []),
      group('ram:RegistrationTradeCountry', [leaf('ram:ID', country(e.country))]),
    ]),
  );
}

function bySequence(a: EftiEquipment, b: EftiEquipment): number {
  return a.sequence - b.sequence;
}

function sequence(e: EftiEquipment): string | null {
  return Number.isInteger(e.sequence) && e.sequence >= 0 ? String(e.sequence) : null;
}

/**
 * FTI004 — идентификаторы набора для реестра шлюза (PUT
 * /v1/consignments/{datasetId}, тело uploadIdentifierRequest по
 * gate-api-for-platform/v1-upload-identifier-request.xsd).
 *
 * Состав — Implementing Reg. (EU) 2024/1942, ст. 11(3):
 *   · принятие груза перевозчиком: дата (eFTI39→2032) и страна (eFTI146→2180);
 *   · фактическая доставка: дата (eFTI188→2038) и страна получения
 *     (eFTI162→2181) — только если доставка уже была;
 *   · признак опасного груза (eFTI1855→2182, CL-058);
 *   · транспортное средство основного плеча: номер (eFTI618→2183), вид
 *     транспорта (eFTI581→2185, CL-037 «3»), тип (eFTI617→2186, CL-041),
 *     страна регистрации (eFTI620→2191);
 *   · погрузка и разгрузка: даты (eFTI583/596) и страны (eFTI908/917);
 *   · используемое оборудование (прицепы): номер, категория, страна
 *     регистрации, порядковый номер (eFTI374/378/578/987);
 *   · перевозимое оборудование (контейнеры): номер, категория, порядковый
 *     номер (eFTI448/450/1000).
 *
 * Даты — в часовом поясе страны места; там, где схема разрешает,
 * формат 205 (с временем и смещением), иначе 102.
 */

import {
  EQUIPMENT_CATEGORY,
  NS,
  TRANSPORT_MEANS_TYPE_TRUCK,
  TRANSPORT_MODE_ROAD,
  XML_DECLARATION,
  country,
  dangerousGoodsCode,
  dateTime,
  format102,
  format205,
  group,
  leaf,
  render,
  token,
  type XNode,
} from './common';
import type { EftiConsignment, EftiEquipment } from '../types';

/** XML тела PUT /v1/consignments/{datasetId}. */
export function buildUploadIdentifierRequest(c: EftiConsignment): string {
  const scope = (name: string, kids: (XNode | null)[]) => group(`ram:${name}ParameterScope`, kids);
  const countryScope = (name: string, value: string | null) => scope(name, [leaf('ram:CountryID', country(value))]);

  const used = c.equipment.filter((e) => e.category !== 'CONTAINER').sort(bySequence);
  const carried = c.equipment.filter((e) => e.category === 'CONTAINER').sort(bySequence);

  const message: XNode = {
    tag: 'message',
    kids: [
      scope('CarrierAcceptanceDate', [
        dateTime('ram:SpecifiedDateTime', format205(c.carrierAcceptance.at, c.carrierAcceptance.country)),
      ]),
      countryScope('CarrierAcceptanceCountry', c.carrierAcceptance.country),
      c.delivery && scope('DeliveryDate', [dateTime('ram:SpecifiedDateTime', format102(c.delivery.at, c.delivery.country))]),
      c.delivery && countryScope('DeliveryCountry', c.delivery.country),
      scope('DangerousGoodsIndicationCode', [
        leaf('ram:DangerousGoodsIndicationParameterCode', dangerousGoodsCode(c.dangerousGoods)),
      ]),
      scope('MainCarriageTransportMeansID', [leaf('ram:ID', token(c.vehicle.plate, 17))]),
      scope('MainCarriageModeCode', [leaf('ram:TransportModeParameterCode', TRANSPORT_MODE_ROAD)]),
      scope('MainCarriageTransportMeansTypeCode', [leaf('ram:TransportMeansParameterCode', TRANSPORT_MEANS_TYPE_TRUCK)]),
      countryScope('TransportMeansRegistrationCountry', c.vehicle.country),
      c.loading.at &&
        scope('MainCarriageLoadingDate', [dateTime('ram:SpecifiedDateTime', format205(c.loading.at, c.loading.country))]),
      countryScope('MainCarriageLoadingCountry', c.loading.country),
      c.unloading.at &&
        scope('MainCarriageUnloadingDate', [
          dateTime('ram:SpecifiedDateTime', format102(c.unloading.at, c.unloading.country)),
        ]),
      countryScope('MainCarriageUnloadingCountry', c.unloading.country),
      scope('UsedTransportEquipmentID', used.map((e) => leaf('ram:ID', token(e.id, 17)))),
      scope(
        'UsedTransportEquipmentCategoryCode',
        used.map((e) => leaf('ram:TransportEquipmentCategoryParameterCode', EQUIPMENT_CATEGORY[e.category])),
      ),
      scope('UsedTransportEquipmentRegistrationCountry', used.map((e) => leaf('ram:CountryID', country(e.country)))),
      scope('UsedTransportEquipmentSequenceNumber', used.map((e) => leaf('ram:SequenceNumeric', sequence(e)))),
      scope('CarriedTransportEquipmentID', carried.map((e) => leaf('ram:ID', token(e.id, 17)))),
      scope(
        'CarriedTransportEquipmentCategoryCode',
        carried.map((e) => leaf('ram:TransportEquipmentCategoryParameterCode', EQUIPMENT_CATEGORY[e.category])),
      ),
      scope('CarriedTransportEquipmentSequenceNumber', carried.map((e) => leaf('ram:SequenceNumeric', sequence(e)))),
    ].filter((k): k is XNode => !!k),
  };

  const root: XNode = {
    tag: 'uploadIdentifierRequest',
    attrs: { xmlns: NS.uploadIdentifiers, 'xmlns:ram': NS.ram, 'xmlns:udt': NS.udt },
    kids: [message],
  };
  return XML_DECLARATION + render(root);
}

function bySequence(a: EftiEquipment, b: EftiEquipment): number {
  return a.sequence - b.sequence;
}

function sequence(e: EftiEquipment): string | null {
  return Number.isInteger(e.sequence) && e.sequence >= 0 ? String(e.sequence) : null;
}

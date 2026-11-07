/**
 * Рейс самосвала → документ реестра SIIRTO (API v4, CreateOrUpdateShippingDocument).
 *
 * Один рейс — один документ, после приёма: дата получения обязательна.
 * Сначала проверка: чего не хватает для реестра (контакт заказчика,
 * данные пункта приёмки, вес, код переработки…). Неполный документ не
 * уходит — человек видит, что дописать, а не ошибку реестра.
 *
 * Коды — из справочников koodistot.suomi.fi (jttj):
 *   toiminta 3 — строительство; jätteentyyppi 1 — неопасный, 3 — опасный;
 *   kuljetustapa 1 — автодорога; pakkaustapa 8 — насыпью;
 *   jätteen olomuoto 2 — твёрдое.
 *
 * Модуль чистый: тесты на node без сборки.
 */

export type SiirtoMissing =
  | 'notRequired'
  | 'notFinland'
  | 'holderBusinessId'
  | 'holderAddress'
  | 'holderContact'
  | 'siteAddress'
  | 'receiver'
  | 'receiverCompany'
  | 'receiverAddress'
  | 'receiverContact'
  | 'driverPhone'
  | 'weight'
  | 'treatment'
  | 'hazard';

export type SiirtoInput = {
  required: boolean;
  country: string;
  materialCode: string;
  hazardous: boolean;
  /** Название груза по-фински («Maa- ja kiviaines»). */
  materialName: string;
  contaminated: boolean;
  netKg: number | null;
  /** День рейса (YYYY-MM-DD) и время выгрузки (ISO). */
  day: string;
  unloadedAt: string;
  plates: string[];
  job: {
    name: string;
    address: string | null;
    customerName: string;
    customerBusinessId: string | null;
    customerStreet: string | null;
    customerPostalCode: string | null;
    customerCity: string | null;
    customerCountry: string | null;
    contactName: string | null;
    contactPhone: string | null;
    contactEmail: string | null;
    treatmentCode: string | null;
    hazardCodes: string[];
    hazardComposition: string | null;
  };
  carrier: { name: string; businessId: string | null; street: string | null; postalCode: string | null; city: string | null };
  driver: { name: string; phone: string | null; email: string | null };
  receiver: {
    name: string;
    address: string | null;
    city: string | null;
    postalCode: string | null;
    operatorName: string | null;
    operatorBusinessId: string | null;
    contactName: string | null;
    contactPhone: string | null;
    treatmentCode: string | null;
  } | null;
};

type Address = { streetAddress: string; postalCode: string };

const Y_TUNNUS = /^\d{7}-\d$/;
const blank = (s: string | null | undefined): boolean => !s || !s.trim();

/**
 * Адрес строкой («Satamakaari 18, 00980 Helsinki») → улица и индекс.
 * Отдельный индекс (поле пункта) важнее найденного в строке.
 */
export function splitAddress(text: string | null | undefined, postalCode?: string | null): Address | null {
  const raw = (text ?? '').trim();
  if (!raw) return null;
  const found = /\b(\d{5})\b/.exec(raw);
  const postal = (postalCode ?? '').trim() || found?.[1] || '';
  const street = raw.split(',')[0].replace(/\b\d{5}\b.*$/, '').trim();
  return street && postal ? { streetAddress: street, postalCode: postal } : null;
}

/** «R5.3» → recoveryCode, «D1» → disposalCode. */
export function treatmentFields(code: string): { recoveryCode: string | null; disposalCode: string | null } {
  const c = code.trim().toUpperCase();
  return c.startsWith('R') ? { recoveryCode: c, disposalCode: null } : { recoveryCode: null, disposalCode: c };
}

export type SiirtoResult = { ok: true; body: Record<string, unknown> } | { ok: false; missing: SiirtoMissing[] };

export function buildShippingDocument(input: SiirtoInput): SiirtoResult {
  if (input.country !== 'FI') return { ok: false, missing: ['notFinland'] };
  if (!input.required) return { ok: false, missing: ['notRequired'] };

  const missing: SiirtoMissing[] = [];
  const { job, receiver } = input;

  const holderForeign = (job.customerCountry ?? 'FI') !== 'FI';
  if (!holderForeign && !Y_TUNNUS.test((job.customerBusinessId ?? '').trim())) missing.push('holderBusinessId');
  const holderAddress = blank(job.customerStreet) || blank(job.customerPostalCode)
    ? null
    : { streetAddress: job.customerStreet!.trim(), postalCode: job.customerPostalCode!.trim() };
  if (!holderAddress) missing.push('holderAddress');
  if (blank(job.contactName) || blank(job.contactPhone)) missing.push('holderContact');

  const origin = splitAddress(job.address);
  if (!origin) missing.push('siteAddress');

  let destination: Address | null = null;
  if (!receiver) {
    missing.push('receiver');
  } else {
    if (blank(receiver.operatorName) || !Y_TUNNUS.test((receiver.operatorBusinessId ?? '').trim())) missing.push('receiverCompany');
    destination = splitAddress(receiver.address, receiver.postalCode);
    if (!destination) missing.push('receiverAddress');
    if (blank(receiver.contactName) || blank(receiver.contactPhone)) missing.push('receiverContact');
  }

  if (blank(input.driver.phone)) missing.push('driverPhone');
  if (input.netKg === null || input.netKg <= 0) missing.push('weight');
  const treatment = (job.treatmentCode ?? receiver?.treatmentCode ?? '').trim();
  if (!/^(R|D)\d{1,2}(\.\d)?$/i.test(treatment)) missing.push('treatment');
  if (input.hazardous && (job.hazardCodes.length === 0 || blank(job.hazardComposition))) missing.push('hazard');

  if (missing.length > 0) return { ok: false, missing };

  const company = (name: string, businessId: string | null, address: Address | null, foreign: { country: string; text: string } | null) => ({
    name: name.trim(),
    businessId: foreign ? null : (businessId ?? '').trim(),
    foreignBusinessId: foreign ? (businessId ?? '').trim() || null : null,
    isOrganizationWithoutBusinessId: false,
    address: foreign ? null : address,
    foreignAddress: foreign ? { countryISO2: foreign.country, addressField: foreign.text } : null,
  });

  const carrierAddress = splitAddress(input.carrier.street, input.carrier.postalCode);
  const description = `${input.materialName}${input.contaminated ? ' – pilaantunut maa-aines (PIMA)' : ''}`.slice(0, 500);

  return {
    ok: true,
    body: {
      wasteHolderCompany: company(
        job.customerName,
        job.customerBusinessId,
        holderAddress,
        holderForeign
          ? { country: job.customerCountry!, text: [job.customerStreet, job.customerPostalCode, job.customerCity].filter(Boolean).join(', ') }
          : null,
      ),
      wasteHolderHouseHold: null,
      carrier: company(input.carrier.name, input.carrier.businessId, carrierAddress, null),
      consignee: company(receiver!.operatorName!, receiver!.operatorBusinessId, destination, null),
      consigneeHouseHold: null,
      wasteHolderContact: { name: job.contactName!.trim(), phoneNumber: job.contactPhone!.trim(), email: job.contactEmail?.trim().slice(0, 100) || null },
      carrierContact: { name: input.driver.name.trim(), phoneNumber: input.driver.phone!.trim(), email: input.driver.email?.trim().slice(0, 100) || null },
      consigneeContact: { name: receiver!.contactName!.trim(), phoneNumber: receiver!.contactPhone!.trim(), email: null },
      /* Дата отправки — день рейса (время необязательно), получения — момент выгрузки. */
      dispatchDate: input.day,
      receivedDate: input.unloadedAt,
      origin: { address: origin, location: null },
      destination: { address: destination, location: null },
      transportTypeCode: '1',
      transportTypeDescription: null,
      registrationCodesForTransport: input.plates.filter(Boolean).join(', ') || null,
      documentOriginator: 'RAHTIS',
      documentVersion: '1',
      wastes: [
        {
          /* В справочнике реестра опасные коды со звёздочкой: 170503*. */
          loWCode: input.hazardous ? `${input.materialCode.replace(/\*$/, '')}*` : input.materialCode,
          quantity: Math.round(input.netKg!) / 1000,
          quantityUnit: 'Tonnes',
          description,
          composition: input.hazardous ? job.hazardComposition!.trim() : null,
          hazardousProperties: input.hazardous ? job.hazardCodes : [],
          packagingTypeCode: input.hazardous ? '8' : null,
          packagingTypeDescription: null,
          physicalStateCode: input.hazardous ? '2' : null,
          physicalStateDescription: null,
          popCodes: [],
          codeOfOrigin: '3',
          codeOfOriginDescription: null,
          wasteTypeCode: input.hazardous ? '3' : '1',
          wasteOilTypeCode: null,
          shippedToLaboratoryForAnalysis: false,
          ...treatmentFields(treatment),
          recoveryDescription: null,
          disposalDescription: null,
          sludgeHoldingTankTypeCode: null,
          sludgeHoldingTankTypeDescription: null,
        },
      ],
    },
  };
}

/** Коды переработки, которые встречаются у грунта и строительных отходов (выбор на объекте). */
export const TREATMENT_CODES = ['R5.2', 'R5.3', 'R5.4', 'R5.5', 'R10', 'R12.2', 'R13', 'D1', 'D5', 'D15'] as const;

/** Опасные свойства HP1–HP15 (jäteasetus, liite 3). */
export const HAZARD_CODES = ['HP1', 'HP2', 'HP3', 'HP4', 'HP5', 'HP6', 'HP7', 'HP8', 'HP9', 'HP10', 'HP11', 'HP12', 'HP13', 'HP14', 'HP15'] as const;

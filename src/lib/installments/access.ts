/**
 * Раздел «Продажа техники в рассрочку» — только для финских компаний
 * (22.11.2026): договор по финскому закону о рассрочке и финскому НДС.
 * Пункт меню у остальных скрыт (CabinetShell), а по прямой ссылке
 * каталог и формы открывались и кончались общей ошибкой. Страницы
 * раздела сверяются с этим правилом; сделку её стороны видят всегда.
 * Без зависимостей: читают страницы и тесты.
 */
export function installmentsAvailable(country: string | null | undefined): boolean {
  return country === 'FI';
}

/** Машину можно выставить на продажу: не купленная в рассрочку до выплаты и не проданная (как app.vehicle_sellable). */
export function vehicleSellable(installmentRole: string | null | undefined): boolean {
  return installmentRole == null || installmentRole === 'OWNED';
}

/**
 * Статусы сделки в одном месте (22.11.2026): TERMINATED — продавец записал
 * прекращение сделки в рассрочке (забрал машину или стороны договорились).
 */
export const DEAL_STATUSES = ['NEGOTIATING', 'AGREED', 'ACTIVE', 'PAID_OFF', 'CANCELLED', 'TERMINATED'] as const;
export type DealStatus = (typeof DEAL_STATUSES)[number];

/** Причины прекращения — те же, что принимает terminate_installment_deal. */
export const TERMINATION_REASONS = ['REPOSSESSED', 'AGREEMENT'] as const;
export type TerminationReason = (typeof TERMINATION_REASONS)[number];

export function isTerminationReason(value: unknown): value is TerminationReason {
  return typeof value === 'string' && (TERMINATION_REASONS as readonly string[]).includes(value);
}

/**
 * Ведёт ли ежедневное задание сделку: счета взносов, напоминания и сигнал
 * о пороге — только пока сделка в рассрочке. Прекращённую (TERMINATED),
 * выплаченную и отменённую задание не трогает.
 */
export function dealBilled(status: string | null | undefined): boolean {
  return status === 'ACTIVE';
}

/** Договор и счета доступны сторонам и после выплаты, и после прекращения сделки. */
export function dealHasContract(status: string | null | undefined): boolean {
  return status === 'AGREED' || status === 'ACTIVE' || status === 'PAID_OFF' || status === 'TERMINATED';
}

/** Цвет значка статуса сделки — один для списка и страницы сделки. */
export function dealBadgeTone(status: string | null | undefined): 'ok' | 'warn' | 'info' | 'danger' | 'neutral' {
  if (status === 'AGREED' || status === 'ACTIVE') return 'ok';
  if (status === 'NEGOTIATING') return 'warn';
  if (status === 'PAID_OFF') return 'info';
  if (status === 'TERMINATED') return 'danger';
  return 'neutral';
}

/** В кабинете сделка всегда с обычным НДС (решение 22.11.2026); другие режимы — только у старых строк. */
export const CABINET_VAT_MODE = 'STANDARD';

export function vatModeAllowedForNew(mode: string | null | undefined): boolean {
  return mode === CABINET_VAT_MODE;
}

/*
 * Решение владельца 23.11.2026: продавать технику в рассрочку может любая
 * проверенная финская компания, зарегистрированная в RAHTIS, покупать —
 * только перевозчик. Ниже — кому что открыто и где у компании раздел.
 * База проверяет то же сама (app.installment_seller_ok,
 * app.installment_company_ok); эти функции — для страниц и ссылок.
 */

/** Кабинеты, в которых есть раздел: перевозчика и компании без парка. */
export type InstallmentCabinet = 'CARRIER' | 'SHIPPER';

export function installmentCabinet(kind: string | null | undefined): InstallmentCabinet | null {
  return kind === 'CARRIER' || kind === 'SHIPPER' ? kind : null;
}

/**
 * Путь раздела в кабинете компании, без языка: '/carrier/installments' или
 * '/shipper/installments'. Ссылки страниц, уведомлений и обновление страниц
 * после действия строятся от него — сторона сделки открывает её у себя.
 */
export function installmentsBase(kind: string | null | undefined): string {
  return kind === 'CARRIER' ? '/carrier/installments' : '/shipper/installments';
}

/** Ссылка на сделку для уведомления компании этого вида (без языка). */
export function installmentDealLink(kind: string | null | undefined, dealId: string): string {
  return `${installmentsBase(kind)}/${dealId}`;
}

type InstallmentPartyFacts = {
  kind: string | null | undefined;
  country: string | null | undefined;
  /** Статус компании: ACTIVE — прошла проверку оператора. */
  status: string | null | undefined;
  /** Главный в компании (не диспетчер). */
  owner: boolean;
};

/** Продавец: главный в проверенной финской компании любого вида; лицензия и страховка не нужны. */
export function canSellInstallments(party: InstallmentPartyFacts): boolean {
  return party.owner && installmentCabinet(party.kind) !== null && party.status === 'ACTIVE' && installmentsAvailable(party.country);
}

/** Покупатель — как раньше: главный в действующем финском перевозчике с лицензией и страховкой. */
export function canBuyInstallments(party: InstallmentPartyFacts & { documentsOk: boolean }): boolean {
  return party.kind === 'CARRIER' && party.documentsOk && canSellInstallments(party);
}

/** Каталог нужен только тому, кто может покупать по виду компании: у компании без парка вкладки нет. */
export function catalogTabShown(kind: string | null | undefined): boolean {
  return kind === 'CARRIER';
}

/** Карточку машины на продажу можно выставить: одобрена оператором и не продана (как app.sale_vehicle_sellable). */
export function saleVehicleSellable(vehicle: { access: string; sold_deal_id: string | null }): boolean {
  return vehicle.access === 'APPROVED' && vehicle.sold_deal_id == null;
}

/** Карточку можно править: не на проверке, не продана и без живого объявления (как save_equipment_sale_vehicle). */
export function saleVehicleEditable(vehicle: { access: string; sold_deal_id: string | null }, hasLiveListing: boolean): boolean {
  return vehicle.access !== 'PENDING' && vehicle.sold_deal_id == null && !hasLiveListing;
}

export const SALE_VEHICLE_CLASSES = ['TRACTOR', 'TRUCK', 'VAN', 'TIPPER'] as const;
export type SaleVehicleClass = (typeof SALE_VEHICLE_CLASSES)[number];
export const SALE_EURO_CLASSES = ['EURO_4', 'EURO_5', 'EURO_6'] as const;
export type SaleEuroClass = (typeof SALE_EURO_CLASSES)[number];

/** Грузоподъёмность и погрузочные метры есть только у фургона и грузовика (как у машины парка). */
export function saleVehicleHasCargo(vehicleClass: string | null | undefined): boolean {
  return vehicleClass === 'VAN' || vehicleClass === 'TRUCK';
}

export type SaleVehicleInput = {
  plate: string;
  make: string;
  vehicleClass: SaleVehicleClass;
  euroClass: SaleEuroClass;
  axles: number;
  payloadKg: number | null;
  ldm: number | null;
};

/**
 * Карточка машины на продажу из формы; null — что-то не так. Те же
 * пределы, что в базе (equipment_sale_vehicles): из карточки при передаче
 * создаётся машина в парке покупателя, поэтому правила — как у машины парка.
 */
export function parseSaleVehicle(raw: {
  plate: string;
  make: string;
  vehicleClass: string;
  euroClass: string;
  axles: string;
  payloadKg: string;
  ldm: string;
}): SaleVehicleInput | null {
  const plate = raw.plate.replace(/\s+/g, '').toUpperCase();
  const make = raw.make.trim();
  if (!/^[A-Z0-9-]{4,12}$/.test(plate) || make.length < 2 || make.length > 80) return null;
  if (!(SALE_VEHICLE_CLASSES as readonly string[]).includes(raw.vehicleClass)) return null;
  if (!(SALE_EURO_CLASSES as readonly string[]).includes(raw.euroClass)) return null;
  const vehicleClass = raw.vehicleClass as SaleVehicleClass;
  const axles = Number(raw.axles);
  if (!Number.isInteger(axles) || axles < (vehicleClass === 'TIPPER' ? 3 : 2) || axles > 5) return null;
  let payloadKg: number | null = null;
  let ldm: number | null = null;
  if (saleVehicleHasCargo(vehicleClass)) {
    const payload = Number(raw.payloadKg.replace(/\s/g, ''));
    const metres = Number(raw.ldm.replace(/\s/g, '').replace(',', '.'));
    const maxPayload = vehicleClass === 'VAN' ? 3500 : 26000;
    if (!raw.payloadKg.trim() || !Number.isInteger(payload) || payload < 100 || payload > maxPayload) return null;
    if (!raw.ldm.trim() || !Number.isFinite(metres)) return null;
    /* В базе один знак после запятой. */
    const rounded = Math.round(metres * 10) / 10;
    if (rounded <= 0 || rounded > 20) return null;
    payloadKg = payload;
    ldm = rounded;
  }
  return { plate, make, vehicleClass, euroClass: raw.euroClass as SaleEuroClass, axles, payloadKg, ldm };
}

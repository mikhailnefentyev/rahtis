/**
 * Данные одной перевозки для eFTI (17–18.11.2026, этап А — тестовый шлюз
 * Fintraffic).
 *
 * Общий вход для XML-слоя (src/lib/efti/xml/*): из заказа RAHTIS
 * собирается EftiConsignment (src/lib/efti/consignment.ts), а XML-слой
 * превращает его в сообщения eFTI:
 *   · FTI004 — набор идентификаторов для реестра шлюза (uploadIdentifierRequest);
 *   · FTI010 — ответ на запрос инспектора (cmdsResponse), только
 *     запрошенные части набора.
 *
 * Без импортов из приложения: модуль читают сервер и тесты.
 * Даты — ISO 8601 с часовым поясом; страны — ISO 3166-1 alpha-2.
 */

export type EftiParty = {
  name: string;
  /** Y-tunnus, VAT или иной номер регистрации — как есть. */
  id: string | null;
  street: string | null;
  postcode: string | null;
  city: string | null;
  country: string;
};

export type EftiPlace = {
  street: string | null;
  postcode: string | null;
  city: string | null;
  country: string;
  /** Плановое или фактическое время, ISO 8601. */
  at: string | null;
};

export type EftiGoodsItem = {
  /** Описание груза свободным текстом (пока одно на заказ). */
  description: string;
  grossWeightKg: number | null;
  packages: number | null;
};

export type EftiEquipment = {
  /** Номер прицепа или контейнера. */
  id: string;
  /** Категория по справочнику eFTI (прицеп, полуприцеп, контейнер). */
  category: 'TRAILER' | 'SEMI_TRAILER' | 'CONTAINER';
  country: string;
  sequence: number;
};

export type EftiConsignment = {
  /** UUIDv4, наш идентификатор набора данных (datasetId в UIL). */
  datasetId: string;
  /** Номер заказа RAHTIS — ссылка для людей. */
  reference: string;
  /** Когда и где перевозчик принял груз (eFTI39, eFTI146). */
  carrierAcceptance: { at: string; country: string };
  /** Фактическая доставка (eFTI188, eFTI162); есть — набор становится «inactive». */
  delivery: { at: string; country: string } | null;
  dangerousGoods: boolean;
  consignor: EftiParty;
  consignee: EftiParty;
  carrier: EftiParty;
  loading: EftiPlace;
  unloading: EftiPlace;
  vehicle: { plate: string; country: string };
  equipment: EftiEquipment[];
  goods: EftiGoodsItem[];
};

import type { Database, Tables } from './database';

/**
 * Короткие имена для типов схемы.
 *
 * database.ts генерируется и перезаписывается целиком — руками его не
 * правят. Всё, что удобно писать коротко, живёт здесь.
 */

export type PartyRole = Database['public']['Enums']['party_role'];
export type CompanyStatus = Database['public']['Enums']['company_status'];
export type VehicleAccess = Database['public']['Enums']['vehicle_access'];
export type EuroClass = Database['public']['Enums']['euro_class'];
export type DocumentKind = Database['public']['Enums']['document_kind'];

export type Company = Tables<'companies'>;
export type Profile = Tables<'profiles'>;
export type CompanyEvent = Tables<'company_events'>;
export type Vehicle = Tables<'vehicles'>;
export type CompanyDocument = Tables<'company_documents'>;

export type OrderType = Database['public']['Enums']['order_type'];
export type OrderStatus = Database['public']['Enums']['order_status'];
export type StopRole = Database['public']['Enums']['stop_role'];
export type PlaceKind = Database['public']['Enums']['place_kind'];

export type Order = Tables<'orders'>;

/** Документ рейса: CMR, фото загрузки, выгрузки, повреждения (ТЗ §9). */
export type TripDocument = Tables<'order_documents'>;
export type TripDocumentKind = Database['public']['Enums']['trip_document_kind'];

/**
 * Заказ глазами заказчика.
 *
 * Колонки назначения (assigned_company_id, assigned_vehicle_id,
 * chosen_offer_id) сюда не входят: грант их заказчику не отдаёт, потому
 * что его контрагент — Aivomaa, а не перевозчик (ТЗ §1). Тип это
 * отражает, чтобы попытка прочитать исполнителя из заказа не собралась.
 */
export type ShipperOrder = Omit<
  Order,
  'assigned_company_id' | 'assigned_vehicle_id' | 'chosen_offer_id' | 'shipper_company_id' | 'shipper_company_kind' | 'updated_at' | 'created_by' | 'route_computed_at' | 'route_fingerprint'
>;
export type OrderStop = Tables<'order_stops'>;

/** Что возвращает public.company_readiness — гейт стола заказов. */
export type CompanyReadiness = Database['public']['Functions']['company_readiness']['Returns'][number];

/** Строка стола: заказ с маршрутом, но без контактов получателя. */
export type DeskOrder = Database['public']['Functions']['desk_orders']['Returns'][number];

/**
 * Отклик глазами заказчика: машина, компания и рейтинг, без телефона
 * водителя (ТЗ §14).
 *
 * Поле rating переопределено на nullable. Генератор типов выводит его из
 * сигнатуры функции как numeric и о null не знает, а оценок в системе
 * пока нет вовсе — они появятся на Этапе 7. Без переопределения код
 * считал бы, что рейтинг есть всегда.
 */
export type ShipperOffer = Omit<
  Database['public']['Functions']['offers_for_shipper']['Returns'][number],
  'rating' | 'plate' | 'driver_name'
> & {
  rating: number | null;
  /* Появляются только у назначенной машины — до выбора это опознавательный признак. */
  plate: string | null;
  driver_name: string | null;
};

/**
 * Точка маршрута в том виде, в каком её отдаёт стол.
 *
 * Это не OrderStop: contact_name и contact_phone функция desk_orders не
 * возвращает вовсе, и тип обязан это отражать — иначе компонент напишет
 * stop.contact_phone, получит undefined и никто не заметит.
 */
export type DeskStop = {
  id: string;
  sequence: number;
  role: StopRole;
  place_kind: PlaceKind | null;
  place_name: string | null;
  company_name: string | null;
  address: string;
  city: string;
  scheduled_date: string | null;
  scheduled_time: string | null;
  external_ref: string | null;
  trailer_loaded: boolean | null;
  note: string | null;
  /*
   * Бронь, вес и пломба нужны перевозчику до взятия заказа: по ним он
   * решает, пройдёт ли машина по массе и успеет ли к окну на терминале.
   * Получателя (consignee) здесь нет — третье лицо, как и контакты.
   */
  booking_ref: string | null;
  cargo_weight_kg: number | null;
  seal_required: boolean | null;
  /* Координаты нужны, чтобы поставить точку на карту. */
  lat: number | null;
  lon: number | null;
  leg_distance_m: number | null;
};

/** Языки водителя. Набор совпадает с ограничением vehicles_languages_known. */
export const DRIVER_LANGUAGES = [
  'FI',
  'SV',
  'EN',
  'RU',
  'ET',
  'NO',
  'DA',
  'DE',
  'PL',
  'LT',
  'LV',
] as const;

/** Роли, у которых есть компания. У ADMIN её нет. */
export type CompanyRole = Exclude<PartyRole, 'ADMIN'>;

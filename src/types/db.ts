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
export type OrderStop = Tables<'order_stops'>;

/** Что возвращает public.company_readiness — гейт стола заказов. */
export type CompanyReadiness = Database['public']['Functions']['company_readiness']['Returns'][number];

/** Строка стола: заказ с маршрутом, но без контактов получателя. */
export type DeskOrder = Database['public']['Functions']['desk_orders']['Returns'][number];

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
  returns_loaded: boolean | null;
  note: string | null;
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

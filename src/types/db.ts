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

/** Что возвращает public.company_readiness — гейт стола заказов. */
export type CompanyReadiness = Database['public']['Functions']['company_readiness']['Returns'][number];

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

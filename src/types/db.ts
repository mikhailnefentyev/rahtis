import type { Database, Tables } from './database';

/**
 * Короткие имена для типов схемы.
 *
 * database.ts генерируется и перезаписывается целиком — руками его не
 * правят. Всё, что удобно писать коротко, живёт здесь.
 */

export type PartyRole = Database['public']['Enums']['party_role'];
export type CompanyStatus = Database['public']['Enums']['company_status'];

export type Company = Tables<'companies'>;
export type Profile = Tables<'profiles'>;
export type CompanyEvent = Tables<'company_events'>;

/** Роли, у которых есть компания. У ADMIN её нет. */
export type CompanyRole = Exclude<PartyRole, 'ADMIN'>;

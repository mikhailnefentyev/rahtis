/**
 * Тексты договоров стран, кроме Финляндии (23.11.2026): какой сборщик у
 * шаблона, на каком языке печатать числа и как назвать файл. Финский
 * шаблон (FI_OSAMAKSU) — отдельный компонент ContractPdf.tsx. Модуль без
 * зависимостей от сервера: его читают contractTemplates.ts и тесты.
 */
import type { InstallmentContractId } from '../countries.ts';
import type { ContractTextBuilder } from './blocks.ts';
import { eeContractText } from './ee.ts';
import { lvContractText } from './lv.ts';

export type CountryContractId = Exclude<InstallmentContractId, 'FI_OSAMAKSU'>;

export type CountryContract = {
  build: ContractTextBuilder;
  /** Язык чисел и сумм в договоре. */
  intl: string;
  /** Начало имени файла договора. */
  filePrefix: string;
};

export const COUNTRY_CONTRACTS: Record<CountryContractId, CountryContract> = {
  EE_JARELMAKS: { build: eeContractText, intl: 'et-EE', filePrefix: 'Jarelmaksuleping' },
  LV_NOMAKSA: { build: lvContractText, intl: 'lv-LV', filePrefix: 'Nomaksas-ligums' },
};

/** Шаблоны, у которых договор есть: финский компонент и тексты стран. Для проверки реестра стран. */
export function contractTemplateExists(id: string | null | undefined): boolean {
  return id === 'FI_OSAMAKSU' || (Boolean(id) && Object.prototype.hasOwnProperty.call(COUNTRY_CONTRACTS, id as string));
}

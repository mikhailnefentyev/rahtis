import 'server-only';

import type { ReactElement } from 'react';
import type { DocumentProps } from '@react-pdf/renderer';
import { contractInput, type LoadedDeal } from './contract';
import { ContractPdf } from './ContractPdf';
import { installmentCountryEntry, type InstallmentContractId } from './countries';

/**
 * Шаблоны договора по странам (23.11.2026). Какой шаблон у страны — в
 * реестре countries.ts (contract); здесь — чем его собрать. Сейчас шаблон
 * один: финский договор по закону о рассрочке (ContractPdf.tsx), он не
 * менялся. Новая страна — новый компонент договора и запись в TEMPLATES.
 */
type ContractTemplate = {
  /** Собранный договор сделки; null — у сделки ещё нет номера или сторон. */
  render: (deal: LoadedDeal) => { document: ReactElement<DocumentProps>; number: string; filename: string } | null;
};

const TEMPLATES: Record<InstallmentContractId, ContractTemplate> = {
  FI_OSAMAKSU: {
    render: (deal) => {
      const input = contractInput(deal);
      return input ? { document: ContractPdf(input), number: input.number, filename: `Osamaksusopimus-${input.number}.pdf` } : null;
    },
  },
};

/**
 * Шаблон договора сделки — по стране продавца. Берётся из записи страны,
 * даже если раздел в ней потом закрыли: договор уже заключённой сделки
 * должен оставаться доступным сторонам.
 */
export function contractTemplate(country: string | null | undefined): ContractTemplate | null {
  const id = installmentCountryEntry(country)?.contract;
  return id ? TEMPLATES[id] : null;
}

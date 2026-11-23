import 'server-only';

import type { ReactElement } from 'react';
import type { DocumentProps } from '@react-pdf/renderer';
import { contractInput, type LoadedDeal } from './contract';
import { ContractPdf } from './ContractPdf';
import { CountryContractPdf } from './CountryContractPdf';
import { COUNTRY_CONTRACTS, type CountryContractId } from './contractText';
import { installmentCountryEntry, type InstallmentContractId } from './countries';

/**
 * Шаблоны договора по странам (23.11.2026). Какой шаблон у страны — в
 * реестре countries.ts (contract); здесь — чем его собрать.
 *   · FI_OSAMAKSU — финский договор по закону о рассрочке (ContractPdf.tsx),
 *     он не менялся.
 *   · EE_JARELMAKS, LV_NOMAKSA — тексты contractText/ee.ts и lv.ts, печатает
 *     CountryContractPdf.tsx: числа на языке договора, даты «дд.мм.гггг» по
 *     часовому поясу страны.
 *   · SE_AVBETALNING, DK_KREDITKOEB — тексты contractText/se.ts и dk.ts тем
 *     же компонентом: суммы в кронах, у Швеции даты «ГГГГ-ММ-ДД».
 *   · LT_ISSIMOKETINAI, DE_RATENKAUF — contractText/lt.ts и de.ts (23.11.2026):
 *     у Литвы даты «ГГГГ-ММ-ДД».
 * Номер первого документа в договоре — только если это счёт с НДС: у Литвы
 * первый документ — предварительный счёт, а номер счёта с НДС появится в день
 * передачи, поэтому в договоре прочерк (contract.ts).
 * Новая страна — текст договора в contractText/ и запись в COUNTRY_CONTRACTS.
 */
type ContractTemplate = {
  /** Собранный договор сделки; null — у сделки ещё нет номера или сторон. */
  render: (deal: LoadedDeal) => { document: ReactElement<DocumentProps>; number: string; filename: string } | null;
};

function countryTemplate(id: CountryContractId): ContractTemplate {
  const contract = COUNTRY_CONTRACTS[id];
  return {
    render: (deal) => {
      const input = contractInput(deal, { intl: contract.intl, paddedDates: true, isoDates: contract.isoDates });
      /*
       * Тексты Эстонии и Латвии написаны для обычного НДС: другого режима в
       * кабинете нет (решение 22.11.2026), а варианты шаблона для маржи и
       * освобождения в исследовании не подтверждены. Сделка с другим режимом
       * договора не получает — лучше 404, чем неверный текст о налоге.
       */
      if (!input || input.vatMode !== 'STANDARD') return null;
      /* Швеция (23.11.2026): в договоре нет варианта с процентами — сделка с процентами договора не получает. */
      if (contract.interest === false && input.ratePercent) return null;
      return {
        document: CountryContractPdf(contract.build(input)),
        number: input.number,
        filename: `${contract.filePrefix}-${input.number}.pdf`,
      };
    },
  };
}

const TEMPLATES: Record<InstallmentContractId, ContractTemplate> = {
  FI_OSAMAKSU: {
    render: (deal) => {
      const input = contractInput(deal);
      return input ? { document: ContractPdf(input), number: input.number, filename: `Osamaksusopimus-${input.number}.pdf` } : null;
    },
  },
  EE_JARELMAKS: countryTemplate('EE_JARELMAKS'),
  LV_NOMAKSA: countryTemplate('LV_NOMAKSA'),
  SE_AVBETALNING: countryTemplate('SE_AVBETALNING'),
  DK_KREDITKOEB: countryTemplate('DK_KREDITKOEB'),
  LT_ISSIMOKETINAI: countryTemplate('LT_ISSIMOKETINAI'),
  DE_RATENKAUF: countryTemplate('DE_RATENKAUF'),
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

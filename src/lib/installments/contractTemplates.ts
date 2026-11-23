import 'server-only';

import type { ReactElement } from 'react';
import type { DocumentProps } from '@react-pdf/renderer';
import { contractInput, type LoadedDeal } from './contract';
import { ContractPdf } from './ContractPdf';
import { CountryContractPdf } from './CountryContractPdf';
import { COUNTRY_CONTRACT_VERSIONS } from './contractText';
import { dealContractVersion, type ContractVersionId, type PinnedContract } from './contractVersions';
import { installmentCountryEntry } from './countries';

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
 *   · PL_RATY, RO_RATE — contractText/pl.ts и ro.ts (23.11.2026): номер счёта
 *     продавца в KSeF / RO e-Factura платформе неизвестен — строка от руки.
 * Номер первого документа в договоре — только если это счёт с НДС: у Литвы
 * первый документ — предварительный счёт, а номер счёта с НДС появится в день
 * передачи, поэтому в договоре прочерк (contract.ts).
 * Новая страна — текст договора в contractText/ и запись в COUNTRY_CONTRACTS.
 *
 * Версии (24.11.2026): договор печатается той версией шаблона, что записана в
 * сделке при согласии, — правка шаблона подписанный договор не меняет. Как
 * добавить новую версию — contractVersions.ts.
 */
type ContractTemplate = {
  /** Собранный договор сделки; null — у сделки ещё нет номера или сторон. */
  render: (deal: LoadedDeal) => { document: ReactElement<DocumentProps>; number: string; filename: string } | null;
};

type CountryVersionId = Exclude<ContractVersionId, `FI_OSAMAKSU@${string}`>;

/*
 * Версия печатается мелко внизу каждой страницы договора (24.11.2026): по ней
 * видно, каким текстом шаблона собран договор. Остальной текст договора
 * версия не меняет.
 */
function countryTemplate(version: CountryVersionId): ContractTemplate {
  const contract = COUNTRY_CONTRACT_VERSIONS[version];
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
        document: CountryContractPdf(contract.build(input), version),
        number: input.number,
        filename: `${contract.filePrefix}-${input.number}.pdf`,
      };
    },
  };
}

/**
 * Финский договор по версиям (24.11.2026): версия 2026-11-23 — ContractPdf.tsx.
 * Новая версия финского текста — копия компонента и запись здесь.
 */
const FI_RENDERERS: Record<Extract<ContractVersionId, `FI_OSAMAKSU@${string}`>, ContractTemplate> = {
  'FI_OSAMAKSU@2026-11-23': {
    render: (deal) => {
      const input = contractInput(deal);
      return input
        ? { document: ContractPdf(input, 'FI_OSAMAKSU@2026-11-23'), number: input.number, filename: `Osamaksusopimus-${input.number}.pdf` }
        : null;
    },
  },
};

/* Тип требует сборщик у каждой версии каждого шаблона (contractVersions.ts). */
const RENDERERS: Record<ContractVersionId, ContractTemplate> = {
  ...FI_RENDERERS,
  ...(Object.fromEntries(
    (Object.keys(COUNTRY_CONTRACT_VERSIONS) as CountryVersionId[]).map((id) => [id, countryTemplate(id)]),
  ) as Record<CountryVersionId, ContractTemplate>),
};

/**
 * Договор сделки (24.11.2026) — той версией шаблона, что записана при
 * согласии (installment_deals.contract_template, contract_version), даже
 * если шаблон страны с тех пор сменился. Не записана (переговоры, строка до
 * миграции) — текущая версия шаблона страны продавца. Шаблон страны берётся
 * из её записи, даже если раздел в ней потом закрыли: договор уже заключённой
 * сделки должен оставаться доступным сторонам.
 */
export function dealContract(deal: LoadedDeal): ReturnType<ContractTemplate['render']> {
  const version = dealContractVersion(deal.deal as PinnedContract, installmentCountryEntry(deal.seller.country)?.contract);
  return version ? RENDERERS[version].render(deal) : null;
}

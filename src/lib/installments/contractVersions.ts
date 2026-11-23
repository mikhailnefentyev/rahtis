/**
 * Версии шаблонов договора (24.11.2026).
 *
 * Раньше PDF договора собирался при каждом скачивании из текущего шаблона:
 * поменяли текст шаблона — поменялся и договор уже подписанной сделки. Теперь
 * у каждого шаблона явные версии, а сделка при согласии запоминает шаблон и
 * версию (installment_deals.contract_template и contract_version; их ставит
 * база в accept_installment_terms, миграция 20261203100000). Страница договора
 * печатает именно записанную версию.
 *
 * Версия — дата текста «ГГГГ-ММ-ДД»; полное имя — «ШАБЛОН@ВЕРСИЯ», например
 * FI_OSAMAKSU@2026-11-23. Оно печатается мелко внизу каждой страницы договора.
 * Тексты, действовавшие до 24.11.2026, — версия 2026-11-23 всех шаблонов;
 * сделки, согласованные раньше, миграция записала на неё же.
 *
 * КАК ИЗМЕНИТЬ ТЕКСТ ДОГОВОРА (24.11.2026):
 *   1. Старый текст НЕ правится и НЕ удаляется, пока есть сделки на его версии
 *      (а по сделкам AGREED, ACTIVE, PAID_OFF и TERMINATED договор нужен
 *      сторонам всегда). Скопируйте модуль текста под именем с датой новой
 *      версии (например, contractText/ee.2027-02-01.ts) и правьте копию; у
 *      финского договора — копия ContractPdf.tsx.
 *   2. Допишите дату новой версии В КОНЕЦ списка шаблона ниже: последняя
 *      версия — текущая, её получают новые сделки.
 *   3. Свяжите версию с текстом: у шаблонов стран — запись в
 *      COUNTRY_CONTRACT_VERSIONS (contractText/index.ts), у финского — в
 *      FI_RENDERERS (contractTemplates.ts). Без этого проект не соберётся:
 *      тип ContractVersionId требует сборщик у каждой версии.
 *   4. Новой миграцией обновите app.installment_contract_current — текущая
 *      версия шаблона в базе; расхождение ловит тест contractVersions.test.mjs.
 *
 * Без зависимостей от приложения: читают сервер, страница договора и тесты.
 */
import type { InstallmentContractId } from './countries.ts';

/** Версии каждого шаблона по порядку; последняя — текущая. */
export const CONTRACT_TEMPLATE_VERSIONS = {
  FI_OSAMAKSU: ['2026-11-23'],
  EE_JARELMAKS: ['2026-11-23'],
  LV_NOMAKSA: ['2026-11-23'],
  SE_AVBETALNING: ['2026-11-23'],
  DK_KREDITKOEB: ['2026-11-23'],
  LT_ISSIMOKETINAI: ['2026-11-23'],
  DE_RATENKAUF: ['2026-11-23'],
  PL_RATY: ['2026-11-23'],
  RO_RATE: ['2026-11-23'],
} as const satisfies Record<InstallmentContractId, readonly [string, ...string[]]>;

type Versions = typeof CONTRACT_TEMPLATE_VERSIONS;

/** Полное имя версии: «ШАБЛОН@ГГГГ-ММ-ДД». У каждой — свой сборщик текста. */
export type ContractVersionId = { [T in InstallmentContractId]: `${T}@${Versions[T][number]}` }[InstallmentContractId];

/** Сделка с шаблоном и версией, записанными при согласии (до миграции 20261203100000 — без них). */
export type PinnedContract = { contract_template?: string | null; contract_version?: string | null };

const isTemplate = (id: string): id is InstallmentContractId => Object.prototype.hasOwnProperty.call(CONTRACT_TEMPLATE_VERSIONS, id);

/** Текущая версия шаблона — её получает сделка при согласии. */
export function currentContractVersion(template: InstallmentContractId): ContractVersionId {
  const list: readonly string[] = CONTRACT_TEMPLATE_VERSIONS[template];
  return `${template}@${list[list.length - 1]}` as ContractVersionId;
}

/** Известна ли такая версия шаблона (есть ли у неё текст). */
export function contractVersionKnown(template: string, version: string): boolean {
  return isTemplate(template) && (CONTRACT_TEMPLATE_VERSIONS[template] as readonly string[]).includes(version);
}

/**
 * Какую версию договора печатать для сделки (24.11.2026):
 *   · записанную при согласии — всегда её, даже если шаблон страны с тех пор
 *     сменился; неизвестная версия (текст удалили по ошибке) — null: лучше
 *     404, чем договор с другим текстом;
 *   · ничего не записано (сделка ещё в переговорах или строка до миграции) —
 *     текущую версию шаблона страны.
 * countryTemplate — шаблон из записи страны продавца (countries.ts).
 */
export function dealContractVersion(deal: PinnedContract, countryTemplate: InstallmentContractId | null | undefined): ContractVersionId | null {
  const template = deal.contract_template ?? null;
  const version = deal.contract_version ?? null;
  if (template || version) {
    return template && version && contractVersionKnown(template, version) ? (`${template}@${version}` as ContractVersionId) : null;
  }
  return countryTemplate ? currentContractVersion(countryTemplate) : null;
}

/** Шаблон из полного имени версии. */
export function templateOfVersion(id: ContractVersionId): InstallmentContractId {
  return id.slice(0, id.indexOf('@')) as InstallmentContractId;
}

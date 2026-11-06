/**
 * Журнал изменений правил площадки (страница /rules). Статичный список:
 * правило меняется миграцией и выкладкой, а не из админки. Новая запись —
 * сверху; summaryKey — ключ в словаре rules (текст на всех языках).
 * Изменения объявляются за 30 дней (TERMS 1, «Palvelun säännöt»).
 */
export type RuleVersion = {
  version: string;
  published: string;
  effective: string;
  summaryKey: 'v20261106';
};

export const RULE_VERSIONS: readonly RuleVersion[] = [
  { version: '2026-11-06', published: '2026-11-06', effective: '2026-11-06', summaryKey: 'v20261106' },
];

/** Дата последней правки — для «Päivitetty» и карты сайта. */
export const RULES_UPDATED = RULE_VERSIONS[0].published;

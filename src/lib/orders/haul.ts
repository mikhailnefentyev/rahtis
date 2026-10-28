import type { Dictionary } from '@/lib/i18n/dictionaries';
import type { Database } from '@/types/database';
import type { StopRole } from '@/types/db';

export type HaulKind = Database['public']['Enums']['haul_kind'];

/**
 * Все единицы списком — для сверки того, что пришло из формы.
 *
 * Перечисление в базе и этот массив обязаны совпадать, и лучше бы им
 * совпадать автоматически; генератор типов отдаёт только тип, поэтому
 * список выписан руками, а рядом стоит `satisfies` — он и уронит сборку,
 * если в базе появится пятая единица, а здесь нет.
 */
export const HAUL_KINDS = ['TRAILER', 'CONTAINER', 'VAN', 'TRUCK', 'SEMI', 'TIPPER'] as const satisfies readonly HaulKind[];

/**
 * Стройка (TIPPER): самосвальная работа в тоннах и кубах, цена по часам,
 * рейсам или тоннам. Конфигурации — как в базе (orders_tipper_config):
 * самосвал, кассетник с прицепом, тягач с самосвальным полуприцепом.
 */
export const TIPPER_CONFIGS = ['TRUCK', 'CASSETTE', 'SEMI'] as const;
export type TipperConfig = (typeof TIPPER_CONFIGS)[number];
export const SITE_PRICINGS = ['HOUR', 'LOAD', 'TONNE'] as const;
export type SitePricingKind = (typeof SITE_PRICINGS)[number];

export function isTipperConfig(value: unknown): value is TipperConfig {
  return typeof value === 'string' && (TIPPER_CONFIGS as readonly string[]).includes(value);
}
export function isSitePricing(value: unknown): value is SitePricingKind {
  return typeof value === 'string' && (SITE_PRICINGS as readonly string[]).includes(value);
}

/**
 * Полный полуприцеп (PPV-yhdistelmä) в экспресс-доставке: 13,6 м, до 30 т.
 * Пометки — те же, что в базе (orders_semi_features, trailers_semi_features).
 * Пусто — обычный полуприцеп.
 */
export const SEMI_FEATURES = ['MEGA', 'SIDE_LOADING', 'TOP_LOADING', 'LIFTING_ROOF'] as const;
export type SemiFeature = (typeof SEMI_FEATURES)[number];
export const SEMI_LDM = 13.6;

export function isSemiFeature(value: unknown): value is SemiFeature {
  return typeof value === 'string' && (SEMI_FEATURES as readonly string[]).includes(value);
}

/**
 * Подходит ли класс машины виду заказа — грубый фильтр списков машин.
 * Размер, пометки и конфигурацию проверяет база при отклике.
 */
export function vehicleClassFits(haulKind: HaulKind, vehicleClass: string): boolean {
  if (haulKind === 'TIPPER') return vehicleClass === 'TIPPER' || vehicleClass === 'TRACTOR';
  if (haulNeedsTractor(haulKind)) return vehicleClass === 'TRACTOR';
  return vehicleClass === 'VAN' || vehicleClass === 'TRUCK';
}

/** Какой машиной возят: тягач — перецеп, контейнер и полный полуприцеп; фургон и грузовик — свой экспресс. */
export function haulNeedsTractor(haulKind: HaulKind): boolean {
  return haulKind === 'TRAILER' || haulKind === 'CONTAINER' || haulKind === 'SEMI';
}

/**
 * Есть ли у рейса единица, которую забирают и возвращают.
 *
 * То же правило, что app.haul_carries_unit в базе, и по той же причине
 * записано одним местом: от этого вопроса зависят подписи точек, состав
 * секций формы, обязательность номера единицы и форма рейса. Семь
 * проверок «haul_kind === 'TRAILER' || …» разошлись бы на первой правке.
 */
/**
 * Потолок груза у экспресса — то, что машина класса реально везёт, а не
 * её полная масса: фургон 3,5 т берёт 1–1,5 т, грузовик 26 т — около
 * 15 т (решение владельца 26.10.2026). Груз тяжелее висел бы на столе
 * без единого отклика (прогон 12.10.2026: фургон с грузом 5 т).
 * У прицепа и контейнера потолок общий — 76 т, его держит форма точки.
 */
export const HAUL_MAX_CARGO_KG: Partial<Record<HaulKind, number>> = { VAN: 1500, TRUCK: 15000, SEMI: 30000 };

export function carriesUnit(haulKind: HaulKind): boolean {
  return haulKind === 'TRAILER' || haulKind === 'CONTAINER';
}

/**
 * Названия точек, зависящие от того, что тянут.
 *
 * Ролей у точки шесть, а различаются между полуприцепом и контейнером
 * ровно две: забор единицы и её возврат. Загрузка и выгрузка называются
 * одинаково — груз кладут в оба, — поэтому общий словарь ролей остаётся
 * общим, а различия живут отдельно.
 *
 * Функция, а не тернарник на месте вызова: тех мест семь, и правило
 * «какие роли зависят от единицы» должно быть записано один раз. Иначе
 * третий тип единицы придётся искать по семи файлам.
 *
 * Умолчание TRAILER не заглушка: у заказов, созданных до появления
 * контейнеров, haul_kind именно такой, и подставлять его руками на каждом
 * вызове значило бы просить об этом и следующего, кто напишет новый
 * экран.
 */
export function stopTitle(
  t: Dictionary,
  role: StopRole,
  haulKind: HaulKind = 'TRAILER',
): string {
  if (role === 'PICKUP') return t.haul[haulKind].stopPickup;
  if (role === 'TRAILER_RETURN') return t.haul[haulKind].stopReturn;

  return t.stopKind[role];
}

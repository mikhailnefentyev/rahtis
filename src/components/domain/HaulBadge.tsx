'use client';

import { Badge } from '@/components/ui';
import { carriesUnit, type HaulKind } from '@/lib/orders/haul';
import { useI18n } from '@/lib/i18n/provider';

/**
 * Чем выполняется рейс и какого размера единица.
 *
 * Один компонент на три экрана — стол, кабинет перевозчика, кабинет
 * заказчика, — потому что это первое, на что смотрит перевозчик, решая,
 * его это заказ или нет. Три похожие вёрстки разошлись бы на первой же
 * правке, и на одном экране контейнер отличался бы от полуприцепа
 * сильнее, чем на другом.
 *
 * Длина стоит в том же бейдже, а не отдельным полем ниже: «Kontti» без
 * размера не отвечает на вопрос, подойдёт ли машина, а именно этот
 * вопрос здесь и задают. У полуприцепа размера нет, и бейдж короче — это
 * само по себе различие, заметное боковым зрением.
 *
 * Полуприцеп тоже помечается, хотя он и умолчание. Бейдж, появляющийся
 * только у контейнеров, читался бы как пометка «необычный заказ», тогда
 * как это просто другая единица.
 */
export function HaulBadge({
  haulKind,
  containerFeet,
  ldm,
  className,
}: {
  haulKind: HaulKind;
  containerFeet: number | null;
  /** Погрузочные метры экспресса. У перецепа и контейнера их нет. */
  ldm?: number | string | null;
  className?: string;
}) {
  const { t, m } = useI18n();

  const container = haulKind === 'CONTAINER';
  const express = !carriesUnit(haulKind);

  /*
   * Размер — в том же бейдже, а не полем ниже.
   *
   * «Kontti» без длины и «Pakettiauto» без метров не отвечают на вопрос,
   * подойдёт ли машина, а именно этот вопрос здесь и задают.
   */
  const size = container
    ? containerFeet && m('order.containerSize', { feet: containerFeet })
    : express
      ? ldm && `${String(ldm).replace('.', ',')} ldm`
      : null;

  return (
    <Badge tone={container || express ? 'info' : 'neutral'} className={className}>
      {size ? `${t.haulKind[haulKind]} · ${size}` : t.haulKind[haulKind]}
    </Badge>
  );
}

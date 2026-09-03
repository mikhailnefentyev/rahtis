'use client';

import { Badge } from '@/components/ui';
import { useI18n } from '@/lib/i18n/provider';
import type { Database } from '@/types/database';

type HaulKind = Database['public']['Enums']['haul_kind'];

/**
 * Что тянут: полуприцеп или контейнер, и какой длины.
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
  className,
}: {
  haulKind: HaulKind;
  containerFeet: number | null;
  className?: string;
}) {
  const { t, m } = useI18n();

  const container = haulKind === 'CONTAINER';

  return (
    <Badge tone={container ? 'info' : 'neutral'} className={className}>
      {container && containerFeet
        ? `${t.haulKind.CONTAINER} · ${m('order.containerSize', { feet: containerFeet })}`
        : t.haulKind[haulKind]}
    </Badge>
  );
}

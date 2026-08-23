/**
 * Столбчатая диаграмма.
 *
 * Разметкой, а не библиотекой: это десяток прямоугольников, а любая
 * chart-библиотека стоит десятки килобайт в бандле. Заодно столбики
 * работают без JS и нормально печатаются.
 *
 * Высота считается от наибольшего значения, а не от нуля шкалы: у недели
 * с одним рейсом и у недели с десятью разница должна быть видна, а
 * абсолютные суммы всё равно читаются подписью, а не линейкой.
 *
 * Пустой столбец рисуется полоской в один пиксель, а не пропуском. Иначе
 * восемь колонок с двумя значениями выглядят как две соседние недели,
 * хотя между ними месяц простоя.
 */

export type BarPoint = {
  value: number;
  /** Подпись под столбцом. Короткая: их восемь в ряд. */
  label: string;
  /** Что показать при наведении: полное значение с единицей. */
  title: string;
};

export function Bars({ points, className }: { points: BarPoint[]; className?: string }) {
  const max = Math.max(...points.map((point) => point.value), 1);

  return (
    <div className={className ? `pulse-bars ${className}` : 'pulse-bars'}>
      {points.map((point) => (
        <div key={point.label} className="pulse-bars__col" title={point.title}>
          <div className="pulse-bars__track">
            <div
              className="pulse-bars__bar"
              data-zero={point.value === 0 ? '' : undefined}
              style={{
                height: `${point.value === 0 ? 1 : Math.max(4, (point.value / max) * 100)}%`,
              }}
            />
          </div>
          <span className="pulse-bars__label">{point.label}</span>
        </div>
      ))}
    </div>
  );
}

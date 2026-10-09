import type { ReactNode } from 'react';

/**
 * Марка RAHTIS со знаком ®.
 *
 * Словесный знак RAHTIS зарегистрирован в PRH (Suomi), поэтому ® стоит
 * везде, где показана марка; оговорка «в Финляндии» — сноской в подвале
 * главной. Знак — верхний индекс справа от картинки, цвет берёт от
 * родителя: на тёмной панели кабинета он светлый, на светлых страницах тёмный.
 */
export function Registered({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <span className={`brand-reg ${className}`}>
      {children}
      <span className="trademark" aria-hidden="true">
        ®
      </span>
    </span>
  );
}

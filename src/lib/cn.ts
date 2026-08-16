import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Склеивает классы и разрешает конфликты Tailwind в пользу последнего.
 *
 * Без twMerge `cn('px-3', 'px-5')` оставил бы оба класса, а победил бы тот,
 * что стоит раньше в собранном CSS — то есть результат зависел бы от порядка
 * сборки, а не от порядка аргументов. Это ломает главный приём кита:
 * переопределить отступ компонента через проп className.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

import type { DriverMessageKey, DriverPack } from '../../driver';

/**
 * Тренажёр и сертификаты на языках приложения водителя.
 *
 * Отдельными файлами, а не внутри пакетов языков: полторы сотни строк
 * тренажёра заслонили бы в пакете экраны рейса. Пакет подключает свой
 * файл целиком. Переводы требуют проверки носителем (TODO: tarkistettava).
 */
export type TrainingPack = Pick<DriverPack, 'training' | 'certificates'> & {
  msg: Record<Extract<DriverMessageKey, `training.${string}`>, string>;
};

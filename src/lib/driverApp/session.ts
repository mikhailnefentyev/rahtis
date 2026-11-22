import 'server-only';

import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';

/**
 * Кто водитель в приложении.
 *
 * Водитель — пользователь без профиля, и getViewer считает его «сиротой»:
 * кабинета у него нет. Здесь другая проверка — строка drivers с его
 * auth_user_id, которую отдаёт driver_me. Пусто — вход не привязан или
 * водителя архивировали.
 */
export type DriverMe = {
  id: string;
  full_name: string;
  phone: string;
  languages: string[];
  /** Выбранный язык приложения; NULL — по языку телефона. */
  app_language: string | null;
  company_name: string;
  /** Страна перевозчика — пояс времени смены и уведомлений. */
  company_country: string | null;
  /** Рабочая валюта компании (driver_me, с 5.11.2026). */
  company_currency?: string | null;
  vehicle_id: string | null;
  plate: string | null;
  /** Марка и класс машины — для фото на главном экране (с 21.11.2026; до миграции — нет). */
  vehicle_make?: string | null;
  vehicle_class?: string | null;
  shift: {
    id: string;
    started_at: string;
    break_started_at: string | null;
    break_minutes: number;
  } | null;
  unread: number;
};

export const getDriver = cache(async (): Promise<DriverMe | null> => {
  const supabase = await createClient();

  /*
   * Без отдельного auth.getUser() (22.11.2026): это был лишний поход к
   * серверу входа на каждом экране приложения. Токен уже проверен в proxy
   * (updateSession), а driver_me выполняет база под этим же токеном:
   * подпись проверяет она сама, и без входа или без привязанного водителя
   * ответ пустой.
   */
  const { data } = await supabase.rpc('driver_me');
  return (data as DriverMe | null) ?? null;
});

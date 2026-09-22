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
  vehicle_id: string | null;
  plate: string | null;
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

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase.rpc('driver_me');
  return (data as DriverMe | null) ?? null;
});

import 'server-only';

import type { PostgrestError } from '@supabase/supabase-js';
import { recordIncident } from '@/lib/incidents/record';
import { createAdminClient } from '@/lib/supabase/admin';
import type { Database } from '@/types/database';

/**
 * Вызовы функций агента водителя.
 *
 * Тонкий слой поверх трёх функций базы: разобрать телефон, позвать,
 * перевести отказ базы в понятный машине код. Никакой логики прав здесь
 * нет и быть не должно — она вся внутри функций, где её нельзя обойти,
 * забыв позвать проверку.
 */

export type StopRole = Database['public']['Enums']['stop_role'];

/** Телефон обязателен и приходит только из тела запроса, никогда из адреса. */
export function readPhone(body: unknown): string | null {
  if (!body || typeof body !== 'object') return null;
  const value = (body as { phone?: unknown }).phone;
  if (typeof value !== 'string') return null;

  const trimmed = value.trim();
  /* Нормализацию делает база — одна и та же для обеих сторон сравнения. */
  return trimmed.length >= 6 && trimmed.length <= 32 ? trimmed : null;
}

export function readText(body: unknown, field: string, max: number): string | null {
  if (!body || typeof body !== 'object') return null;
  const value = (body as Record<string, unknown>)[field];
  if (typeof value !== 'string') return null;

  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : null;
}

const ROLES: StopRole[] = [
  'PICKUP',
  'DELIVERY',
  'EXTRA_LOAD',
  'EXTRA_UNLOAD',
  'CONTINUATION',
  'TRAILER_RETURN',
];

export function readRole(body: unknown): StopRole | null {
  const raw = readText(body, 'expect', 20);
  return raw && (ROLES as string[]).includes(raw) ? (raw as StopRole) : null;
}

/**
 * Отказ базы в вид, пригодный для воркфлоу.
 *
 * Коды, а не тексты: тексты в базе русские и меняются при первой же
 * переформулировке, а на них будет завязана ветка в n8n. Тот же урок,
 * что в разборе админских ошибок.
 */
export type DriverFailure = { status: number; code: string; message: string };

export function explain(error: PostgrestError): DriverFailure {
  switch (error.code) {
    case 'P0002':
      return { status: 404, code: 'no_active_trip', message: error.message };
    case '55001':
      return { status: 409, code: 'wrong_stage', message: error.message };
    case '55000':
      return { status: 409, code: 'not_possible', message: error.message };
    case '22023':
      return { status: 400, code: 'bad_request', message: error.message };
    default:
      return { status: 500, code: 'failed', message: error.message };
  }
}

type Rpc = Database['public']['Functions'];

async function call<K extends 'driver_active_trips' | 'driver_complete_next_stop' | 'driver_escalate'>(
  fn: K,
  args: Rpc[K]['Args'],
  path: string,
) {
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc(fn, args);

  if (error) {
    /*
     * В журнал уходит только неожиданное. Отсутствие рейса и «точка не
     * та» — это нормальная работа: водитель спросил не вовремя, агент
     * не понял фразу. Писать их как сбои значит утопить настоящие
     * поломки в шуме.
     */
    if (!['P0002', '55000', '55001', '22023'].includes(error.code ?? '')) {
      void recordIncident({ source: 'agent', path, error });
    }
    return { data: null, failure: explain(error) };
  }

  return { data, failure: null };
}

export async function activeTrips(phone: string) {
  return call('driver_active_trips', { p_phone: phone }, '/api/driver/context');
}

export async function completeNextStop(phone: string, expect: StopRole | null, damage: string | null) {
  return call(
    'driver_complete_next_stop',
    {
      p_phone: phone,
      p_expect: expect ?? undefined,
      p_damage_note: damage ?? undefined,
    },
    '/api/driver/step',
  );
}

export async function escalate(phone: string, question: string) {
  return call(
    'driver_escalate',
    { p_phone: phone, p_question: question },
    '/api/driver/escalate',
  );
}

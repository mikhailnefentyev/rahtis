import 'server-only';

import { createClient } from '@/lib/supabase/server';
import type { HaulKind } from '@/lib/orders/haul';
import type { OrderStatus, OrderType, StopRole } from '@/types/db';

/**
 * Задания водителя — то, что отдаёт driver_tasks. Денег здесь нет по
 * построению: функция их не выбирает.
 */

export type DriverStop = {
  id: string;
  sequence: number;
  role: StopRole;
  place_kind: string | null;
  place_name: string | null;
  company_name: string | null;
  address: string;
  city: string;
  country: string | null;
  lat: number | null;
  lon: number | null;
  scheduled_date: string | null;
  scheduled_time: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  external_ref: string | null;
  trailer_loaded: boolean | null;
  seal_required: boolean | null;
  cargo_weight_kg: number | null;
  consignee: string | null;
  note: string | null;
  completed_at: string | null;
  damage_note: string | null;
};

export type DriverTask = {
  id: string;
  ref: string;
  status: OrderStatus;
  direct: boolean;
  deadline_at: string | null;
  order_type: OrderType;
  haul_kind: HaulKind;
  container_feet: number | null;
  ldm: number | null;
  trailer: string | null;
  trailer_plate: string | null;
  distance_km: number | null;
  comment: string | null;
  shipper_name: string;
  plate: string | null;
  closed_at: string | null;
  stops: DriverStop[];
};

export async function getDriverTasks(): Promise<DriverTask[]> {
  const supabase = await createClient();
  const { data } = await supabase.rpc('driver_tasks');
  return (data ?? []) as unknown as DriverTask[];
}

/** Следующая непройденная точка — по ней строится главная кнопка задания. */
export function nextStop(task: DriverTask): DriverStop | null {
  return task.stops.find((s) => !s.completed_at) ?? null;
}

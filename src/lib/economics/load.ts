import 'server-only';

import { payoutCents, COMMISSION_BPS, subscriptionLadderCents } from '@/lib/config';
import { buildDriverReport } from '@/lib/drivers/report';
import { invoiceLines, type InvoiceDay } from '@/lib/sites/invoice';
import { dayMinutes } from '@/lib/sites/work';
import { createAdminClient } from '@/lib/supabase/admin';
import type { createClient } from '@/lib/supabase/server';
import { vehicleEconomics, type EconomicsInput, type VehicleFinance } from './profit';

/**
 * Данные доходности компании за месяцы: рейсы, работа на объектах,
 * топливо, зарплаты по сменам, карточки машин и журнал расходов — под
 * сессией перевозчика (RLS), считает profit.ts.
 */

type Supabase = Awaited<ReturnType<typeof createClient>>;

const zone = 'Europe/Helsinki';
const dateFormat = new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' });
const localDate = (iso: string) => dateFormat.format(new Date(iso));

/* Абонемент: средняя цена за машину месяца по числу машин, у которых был доход (первая бесплатна). */
function ladderUnits(revenue: EconomicsInput['revenue'], months: string[]): Record<string, number> {
  const worked = new Map<string, Set<string>>();
  for (const r of revenue) {
    if (r.cents <= 0) continue;
    const set = worked.get(r.month) ?? new Set<string>();
    set.add(r.vehicleId);
    worked.set(r.month, set);
  }
  const out: Record<string, number> = {};
  for (const m of months) {
    const n = worked.get(m)?.size ?? 0;
    if (n > 0) out[m] = Math.round(subscriptionLadderCents(n) / n);
  }
  return out;
}

export function monthRange(last: string, count: number): string[] {
  const [y, m] = last.split('-').map(Number);
  const out: string[] = [];
  for (let back = count - 1; back >= 0; back -= 1) {
    const d = new Date(Date.UTC(y, m - 1 - back, 1));
    out.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`);
  }
  return out;
}

const endOf = (month: string) => {
  const [y, m] = month.split('-').map(Number);
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
};

export async function loadEconomics(supabase: Supabase, company: { id: string; partnership: string | null }, months: string[]) {
  const from = `${months[0]}-01`;
  const to = endOf(months[months.length - 1]);
  const sinceIso = `${from}T00:00:00Z`;
  /* С запасом в сутки: месяц — по местной дате, запрос — в UTC. */
  const untilIso = new Date(Date.parse(`${to}T00:00:00Z`) + 2 * 86_400_000).toISOString();
  const inRange = (date: string) => date >= from && date <= to;

  /*
   * Заказы — служебным клиентом: перевозчику колонки orders открыты
   * выборочно (без waiting_cents, assigned_vehicle_id и др.), и запрос
   * под сессией молча возвращал пусто. Фильтр — только заказы этой
   * компании (assigned_company_id), компания — из проверенной сессии.
   */
  const admin = createAdminClient();
  const [{ data: vehicles }, { data: orders }, { data: fuel }, { data: finance }, { data: costs }, { data: settings }, { data: jobs }] =
    await Promise.all([
      supabase.from('vehicles').select('id, plate, make').eq('company_id', company.id).order('plate'),
      admin
        .from('orders')
        .select('id, rate_cents, commission_bps, waiting_cents, contract_party, closed_at, updated_at, assigned_vehicle_id')
        .eq('assigned_company_id', company.id)
        .eq('status', 'DONE')
        .gte('closed_at', new Date(Date.parse(sinceIso) - 86_400_000).toISOString())
        .lt('closed_at', untilIso)
        .limit(5000),
      supabase
        .from('fuel_entries')
        .select('vehicle_id, filled_at, amount_cents')
        .eq('company_id', company.id)
        .gte('filled_at', new Date(Date.parse(sinceIso) - 86_400_000).toISOString())
        .lt('filled_at', untilIso)
        .limit(10000),
      supabase.from('vehicle_finance').select('*').eq('company_id', company.id),
      supabase.from('vehicle_costs').select('id, vehicle_id, spent_on, category, amount_cents, note, supplier').eq('company_id', company.id).gte('spent_on', from).lte('spent_on', to).order('spent_on', { ascending: false }),
      supabase.from('company_economics').select('employer_cost_bps').eq('company_id', company.id).maybeSingle(),
      supabase.from('site_jobs').select('id, pricing, rate_cents').eq('company_id', company.id),
    ]);

  const vehicleIds = new Set((vehicles ?? []).map((v) => v.id));

  /* Рейсы: машина — назначенная заказу, иначе из отклика перевозчика. */
  const orderIds = (orders ?? []).filter((o) => !o.assigned_vehicle_id).map((o) => o.id);
  const { data: offers } = orderIds.length
    ? await admin.from('order_offers').select('order_id, vehicle_id').eq('carrier_company_id', company.id).in('order_id', orderIds.slice(0, 1000))
    : { data: [] };
  const offerVehicle = new Map((offers ?? []).map((o) => [o.order_id, o.vehicle_id]));

  const revenue: EconomicsInput['revenue'] = [];
  for (const o of orders ?? []) {
    const vehicleId = o.assigned_vehicle_id ?? offerVehicle.get(o.id);
    const at = o.closed_at ?? o.updated_at;
    if (!vehicleId || !vehicleIds.has(vehicleId) || !at) continue;
    const date = localDate(at);
    if (!inRange(date)) continue;
    const rate = o.rate_cents ?? 0;
    const own = o.contract_party === 'CARRIER';
    revenue.push({
      vehicleId,
      month: date.slice(0, 7),
      cents: (own ? rate : payoutCents(rate, o.commission_bps ?? COMMISSION_BPS)) + (o.waiting_cents ?? 0),
      kind: own ? 'OWN' : 'PLATFORM',
    });
  }

  /* Объекты: строки счёта по дням машины — как в счёте клиенту. */
  if ((jobs ?? []).length) {
    const { data: days } = await supabase
      .from('site_days')
      .select('id, job_id, day, vehicle_id, arrived_at, ended_at, buffer_minutes')
      .in('job_id', (jobs ?? []).map((j) => j.id))
      .gte('day', from)
      .lte('day', to)
      .limit(5000);
    const dayIds = (days ?? []).map((d) => d.id);
    const { data: loads } = dayIds.length
      ? await supabase.from('site_loads').select('day_id, unloaded_at, net_kg').in('day_id', dayIds.slice(0, 2000))
      : { data: [] };
    const loadsOf = new Map<string, { unloaded_at: string | null; net_kg: number | null }[]>();
    for (const l of loads ?? []) loadsOf.set(l.day_id, [...(loadsOf.get(l.day_id) ?? []), l]);
    const jobOf = new Map((jobs ?? []).map((j) => [j.id, j]));
    for (const d of days ?? []) {
      const job = jobOf.get(d.job_id);
      if (!job || !d.vehicle_id || !vehicleIds.has(d.vehicle_id) || !d.arrived_at) continue;
      const dl = loadsOf.get(d.id) ?? [];
      const invoiceDay: InvoiceDay = {
        day: d.day,
        driver: '',
        plate: '',
        minutes:
          dayMinutes({ arrivedAt: d.arrived_at, endedAt: d.ended_at, bufferMinutes: d.buffer_minutes, unloads: dl.map((l) => l.unloaded_at).filter((x): x is string => !!x) }) ?? 0,
        loads: dl.length,
        netKg: dl.reduce((s, l) => s + (l.net_kg ?? 0), 0),
      } as InvoiceDay;
      const [line] = invoiceLines(job.pricing, job.rate_cents, [invoiceDay]);
      if (line) revenue.push({ vehicleId: d.vehicle_id, month: d.day.slice(0, 7), cents: line.amountCents, kind: 'SITE' });
    }
  }

  /* Зарплата: ориентировочная по дням водителя, день — на машину его смены. */
  const [report, { data: shifts }] = await Promise.all([
    buildDriverReport({ from, to }).catch(() => null),
    supabase.from('driver_shifts').select('driver_id, started_at, vehicle_id').gte('started_at', sinceIso).lt('started_at', untilIso).limit(10000),
  ]);
  const vehicleOfDay = new Map<string, string>();
  for (const s of shifts ?? []) {
    if (s.vehicle_id && vehicleIds.has(s.vehicle_id)) vehicleOfDay.set(`${s.driver_id}|${localDate(s.started_at)}`, s.vehicle_id);
  }
  const pay: EconomicsInput['pay'] = [];
  let unassignedPay = 0;
  for (const entry of report?.entries ?? []) {
    for (const day of entry.summary.days) {
      if (!day.amountCents || !inRange(day.date)) continue;
      const vehicleId = vehicleOfDay.get(`${entry.driver.id}|${day.date}`);
      if (vehicleId) pay.push({ vehicleId, month: day.date.slice(0, 7), cents: day.amountCents });
      else unassignedPay += day.amountCents;
    }
  }

  const fuelRows: EconomicsInput['fuel'] = [];
  for (const f of fuel ?? []) {
    if (!f.amount_cents || !vehicleIds.has(f.vehicle_id)) continue;
    const date = localDate(f.filled_at);
    if (inRange(date)) fuelRows.push({ vehicleId: f.vehicle_id, month: date.slice(0, 7), cents: f.amount_cents });
  }

  const financeMap = new Map<string, VehicleFinance>((finance ?? []).map((f) => [f.vehicle_id, f as unknown as VehicleFinance]));
  const employerCostBps = settings?.employer_cost_bps ?? 2500;

  const result = vehicleEconomics({
    months,
    vehicles: (vehicles ?? []).map((v) => ({ id: v.id, plate: v.plate })),
    revenue,
    fuel: fuelRows,
    pay,
    journal: (costs ?? []).map((c) => ({ vehicleId: c.vehicle_id, month: c.spent_on.slice(0, 7), cents: c.amount_cents })),
    finance: financeMap,
    employerCostBps,
    subscriptionUnitCents: company.partnership === 'SUBSCRIBER' ? ladderUnits(revenue, months) : null,
  });

  return {
    ...result,
    vehicles: vehicles ?? [],
    economics: result.vehicles,
    finance: financeMap,
    costs: costs ?? [],
    employerCostBps,
    /* Зарплата дней без машины в смене — не разнесена: показываем отдельно, чтобы не потерялась. */
    unassignedPayCents: Math.round(unassignedPay * (1 + employerCostBps / 10_000)),
  };
}

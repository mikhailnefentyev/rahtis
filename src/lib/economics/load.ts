import 'server-only';

import { payoutCents, COMMISSION_BPS, subscriptionLadderCents } from '@/lib/config';
import { buildDriverReport } from '@/lib/drivers/report';
import { invoiceLines, type InvoiceDay } from '@/lib/sites/invoice';
import { dayMinutes } from '@/lib/sites/work';
import { asCurrency, type Currency } from '@/lib/money/currency';
import { loadFxHistory } from '@/lib/money/fx';
import { createAdminClient } from '@/lib/supabase/admin';
import type { createClient } from '@/lib/supabase/server';
import { companyConverter } from './convert';
import { vehicleEconomics, type EconomicsInput, type VehicleFinance } from './profit';

/**
 * Данные доходности компании за месяцы: рейсы, работа на объектах,
 * топливо, зарплаты по сменам, карточки машин и журнал расходов — под
 * сессией перевозчика (RLS), считает profit.ts.
 *
 * Валюта: каждая строка — в своей валюте (рейсы RAHTIS и простой — евро,
 * свои рейсы — валюта заказа, объекты — валюта объекта, топливо — валюта
 * чека, расходы и карточка — своя колонка, абонемент — евро). Всё
 * переводится в рабочую валюту компании по курсу ЕЦБ дня строки до
 * сложения; строка без курса в итог не входит (missingRates).
 */

type Supabase = Awaited<ReturnType<typeof createClient>>;

const zone = 'Europe/Helsinki';
const dateFormat = new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' });
const localDate = (iso: string) => dateFormat.format(new Date(iso));
/** Следующий день YYYY-MM-DD. */
const nextDay = (date: string) => {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
};

/* Абонемент (евро): средняя цена за машину месяца по числу машин, у которых был доход (первая бесплатна). */
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

export async function loadEconomics(
  supabase: Supabase,
  company: { id: string; partnership: string | null; currency?: string | null },
  months: string[],
) {
  const currency: Currency = asCurrency(company.currency, 'EUR');
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
  const [{ data: vehicles }, { data: orders }, { data: fuel }, { data: finance }, { data: costs }, { data: settings }, { data: jobs }, fx] =
    await Promise.all([
      supabase.from('vehicles').select('id, plate, make').eq('company_id', company.id).order('plate'),
      admin
        .from('orders')
        .select('id, rate_cents, commission_bps, waiting_cents, contract_party, currency, closed_at, updated_at, assigned_vehicle_id')
        .eq('assigned_company_id', company.id)
        .eq('status', 'DONE')
        .gte('closed_at', new Date(Date.parse(sinceIso) - 86_400_000).toISOString())
        .lt('closed_at', untilIso)
        .limit(5000),
      supabase
        .from('fuel_entries')
        .select('vehicle_id, filled_at, amount_cents, currency')
        .eq('company_id', company.id)
        .gte('filled_at', new Date(Date.parse(sinceIso) - 86_400_000).toISOString())
        .lt('filled_at', untilIso)
        .limit(10000),
      supabase.from('vehicle_finance').select('*').eq('company_id', company.id),
      supabase.from('vehicle_costs').select('id, vehicle_id, spent_on, category, amount_cents, currency, note, supplier').eq('company_id', company.id).gte('spent_on', from).lte('spent_on', to).order('spent_on', { ascending: false }),
      supabase.from('company_economics').select('employer_cost_bps').eq('company_id', company.id).maybeSingle(),
      /*
       * Только свои объекты: объект самосвального заказа (order_id) уже
       * посчитан доходом заказа выше — иначе рейс вошёл бы дважды.
       */
      supabase.from('site_jobs').select('id, pricing, rate_cents, currency').eq('company_id', company.id).is('order_id', null),
      loadFxHistory(supabase, from, to),
    ]);
  const conv = companyConverter(fx, currency);

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
    /* Свой рейс — полная цена в валюте заказа; рейс RAHTIS — выплата в евро. Простой — евро. */
    const main = conv.cents(own ? rate : payoutCents(rate, o.commission_bps ?? COMMISSION_BPS), own ? o.currency : 'EUR', date);
    const waiting = conv.cents(o.waiting_cents ?? 0, 'EUR', date);
    if (main === null && waiting === null) continue;
    revenue.push({
      vehicleId,
      month: date.slice(0, 7),
      cents: (main ?? 0) + (waiting ?? 0),
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
      const cents = line ? conv.cents(line.amountCents, job.currency, d.day) : null;
      if (cents !== null) revenue.push({ vehicleId: d.vehicle_id, month: d.day.slice(0, 7), cents, kind: 'SITE' });
    }
  }

  /* Зарплата: ориентировочная по дням водителя, день — на машину его смены. */
  const [report, { data: shifts }, { data: profiles }] = await Promise.all([
    buildDriverReport({ from, to }).catch(() => null),
    supabase.from('driver_shifts').select('driver_id, started_at, vehicle_id').gte('started_at', sinceIso).lt('started_at', untilIso).limit(10000),
    supabase.from('driver_pay_profiles').select('driver_id, valid_from, currency').order('valid_from'),
  ]);
  /*
   * Зарплата дня — в валюте профиля оплаты, действующего в этот день
   * (lib/driverPay считает в ней); день без профиля — валюта компании.
   * Если день сам несёт currency — берётся она.
   */
  const payCurrency = (driverId: string, day: string): string => {
    let cur: string = currency;
    for (const p of profiles ?? []) if (p.driver_id === driverId && p.valid_from <= day) cur = p.currency;
    return cur;
  };
  const vehicleOfDay = new Map<string, string>();
  for (const s of shifts ?? []) {
    if (s.vehicle_id && vehicleIds.has(s.vehicle_id)) vehicleOfDay.set(`${s.driver_id}|${localDate(s.started_at)}`, s.vehicle_id);
  }
  const pay: EconomicsInput['pay'] = [];
  const allowances: NonNullable<EconomicsInput['allowances']> = [];
  let unassignedPay = 0;
  let unassignedAllowances = 0;
  for (const entry of report?.entries ?? []) {
    /*
     * Договорённость «на руки»: расходы водителя — законная схема целиком
     * (оклад и разрыв со взносами работодателя плюс суточные без налога), а
     * без коэффициентов страны — сама договорённость. Это одно место учёта:
     * сумма дня и суточные этих дней ниже пропускаются, а расходы идут в
     * ведро суточных — без надбавки employerCostBps, взносы уже внутри.
     */
    const agreedDates = new Set<string>();
    for (const a of entry.agreements ?? []) {
      for (let day = a.from; day <= a.to; day = nextDay(day)) agreedDates.add(day);
      for (const [date, value] of Object.entries(a.costByDay)) {
        if (!value || !inRange(date)) continue;
        const cents = conv.cents(value, a.result.currency, date);
        if (cents === null) continue;
        const vehicleId = vehicleOfDay.get(`${entry.driver.id}|${date}`);
        if (vehicleId) allowances.push({ vehicleId, month: date.slice(0, 7), cents });
        else unassignedAllowances += cents;
      }
    }
    for (const day of entry.summary.days) {
      if (!day.amountCents || !inRange(day.date) || agreedDates.has(day.date)) continue;
      const cents = conv.cents(day.amountCents, (day as { currency?: string }).currency ?? payCurrency(entry.driver.id, day.date), day.date);
      if (cents === null) continue;
      const vehicleId = vehicleOfDay.get(`${entry.driver.id}|${day.date}`);
      if (vehicleId) pay.push({ vehicleId, month: day.date.slice(0, 7), cents });
      else unassignedPay += cents;
    }
    /* Суточные и ночлег дня — в своей валюте (польские зарубежные — евро). */
    for (const [date, al] of Object.entries(entry.allowanceDays ?? {})) {
      const total = al.allowanceCents + al.lodgingCents;
      if (!total || !inRange(date) || agreedDates.has(date)) continue;
      const cents = conv.cents(total, al.currency, date);
      if (cents === null) continue;
      const vehicleId = vehicleOfDay.get(`${entry.driver.id}|${date}`);
      if (vehicleId) allowances.push({ vehicleId, month: date.slice(0, 7), cents });
      else unassignedAllowances += cents;
    }
  }

  const fuelRows: EconomicsInput['fuel'] = [];
  for (const f of fuel ?? []) {
    if (!f.amount_cents || !vehicleIds.has(f.vehicle_id)) continue;
    const date = localDate(f.filled_at);
    if (!inRange(date)) continue;
    /* Чек — в своей валюте (польская машина заправилась в Германии — евро). */
    const cents = conv.cents(f.amount_cents, f.currency, date);
    if (cents !== null) fuelRows.push({ vehicleId: f.vehicle_id, month: date.slice(0, 7), cents });
  }

  /* Абонемент — в евро: в валюту компании по курсу первого числа месяца. */
  const subscriptionUnits = (eur: Record<string, number>): Record<string, number> => {
    const out: Record<string, number> = {};
    for (const [m, cents] of Object.entries(eur)) {
      const v = conv.cents(cents, 'EUR', `${m}-01`);
      if (v !== null) out[m] = v;
    }
    return out;
  };

  const financeMap = new Map<string, VehicleFinance>((finance ?? []).map((f) => [f.vehicle_id, f as unknown as VehicleFinance]));
  const employerCostBps = settings?.employer_cost_bps ?? 2500;

  const result = vehicleEconomics({
    months,
    vehicles: (vehicles ?? []).map((v) => ({ id: v.id, plate: v.plate })),
    revenue,
    fuel: fuelRows,
    pay,
    allowances,
    journal: (costs ?? []).flatMap((c) => {
      const cents = conv.cents(c.amount_cents, c.currency, c.spent_on);
      return cents === null ? [] : [{ vehicleId: c.vehicle_id, month: c.spent_on.slice(0, 7), cents }];
    }),
    finance: financeMap,
    /* Карточка машины — в своей валюте: курс первого числа месяца. */
    financeRate: (vehicleId, month) => conv.rate(financeMap.get(vehicleId)?.currency ?? currency, `${month}-01`),
    employerCostBps,
    subscriptionUnitCents: company.partnership === 'SUBSCRIBER' ? subscriptionUnits(ladderUnits(revenue, months)) : null,
  });

  return {
    ...result,
    /** Валюта всех сумм результата — рабочая валюта компании. */
    currency,
    /** Строк без курса ЕЦБ (в итоги не вошли). */
    missingRates: conv.missing,
    vehicles: vehicles ?? [],
    economics: result.vehicles,
    finance: financeMap,
    costs: costs ?? [],
    employerCostBps,
    /* Зарплата дней без машины в смене — не разнесена: показываем отдельно, чтобы не потерялась. */
    unassignedPayCents: Math.round(unassignedPay * (1 + employerCostBps / 10_000)) + unassignedAllowances,
  };
}

import 'server-only';

import { checkCompanyRegistry } from '@/lib/registry';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { toTrust, type ReportStatus, type ShipperTrust } from './model';

/**
 * Сведения о заказчике для стола перевозчика: по заказам, которые сервер
 * страницы уже отобрал как видимые перевозчику (desk_orders,
 * my_assignments). Только договор напрямую: у рейса через Aivomaa оплату
 * перевозчику платит Aivomaa. Служебным ключом — заказчик закрыт от
 * перевозчика колоночными грантами, а функция отдаёт одни агрегаты.
 */
export async function shipperTrustByOrder(orderIds: readonly string[]): Promise<Record<string, ShipperTrust>> {
  const unique = [...new Set(orderIds.filter(Boolean))];
  if (unique.length === 0) return {};
  try {
    const admin = createAdminClient();
    const { data: orders } = await admin
      .from('orders')
      .select('id, shipper_company_id')
      .in('id', unique)
      .or('desk_contract.eq.CARRIER,contract_party.eq.CARRIER');
    const shippers = [...new Set((orders ?? []).map((o) => o.shipper_company_id))];
    if (shippers.length === 0) return {};
    const { data: rows, error } = await admin.rpc('shipper_trust', { p_company_ids: shippers });
    if (error) return {};
    const byCompany = new Map((rows ?? []).map((r) => [r.company_id, toTrust(r)]));
    const result: Record<string, ShipperTrust> = {};
    for (const o of orders ?? []) {
      const t = byCompany.get(o.shipper_company_id);
      if (t) result[o.id] = t;
    }
    return result;
  } catch {
    return {};
  }
}

/** Своя сводка заказчика («что видят о вас перевозчики») или любая — оператору. До миграции — NULL. */
export async function loadCompanyTrust(companyId?: string): Promise<ShipperTrust | null> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc('company_trust', companyId ? { p_company_id: companyId } : {});
    const row = data?.[0];
    return error || !row ? null : toTrust(row);
  } catch {
    return null;
  }
}

export type PaymentReportTarget = {
  editable: boolean;
  status: ReportStatus | null;
  daysLate: number | null;
  note: string | null;
  removed: boolean;
};

/** Рейсы перевозчика, по которым можно отметить оплату (или уже отмечено): id → отметка. */
export async function loadPaymentReportTargets(): Promise<Record<string, PaymentReportTarget>> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc('payment_report_targets');
    if (error) return {};
    return Object.fromEntries(
      (data ?? []).map((r) => [
        r.order_id,
        {
          editable: r.editable,
          status: (r.status ?? null) as ReportStatus | null,
          daysLate: r.days_late,
          note: r.note,
          removed: r.removed,
        },
      ]),
    );
  } catch {
    return {};
  }
}

export type RegistryRefreshResult = { checked: number; updated: number; errors: string[] };

/* Пауза между запросами к реестру: PRH ограничивает частоту, спешить некуда. */
const PAUSE_MS = 1000;
const BATCH = 8;
/* Запуск общий с напоминаниями (maxDuration маршрута): дальше бюджета не идём, остаток — завтра. */
const BUDGET_MS = 40_000;

/**
 * Еженедельная перепроверка реестра у заказчиков прямого режима
 * (public.trust_registry_due: заказ «напрямую» за 90 дней, снимку больше
 * недели). Ежедневный запуск, по 8 компаний, по одной, с паузой.
 * Реестр не ответил (ERROR) — прежний снимок остаётся: лучше старые
 * сведения, чем пустые.
 */
export async function refreshShipperRegistry(): Promise<RegistryRefreshResult> {
  const result: RegistryRefreshResult = { checked: 0, updated: 0, errors: [] };
  const admin = createAdminClient();
  const { data: due, error } = await admin.rpc('trust_registry_due', { p_limit: BATCH });
  if (error) {
    /* До миграции функции нет — тихо пропускаем. */
    if (error.code !== 'PGRST202' && error.code !== '42883') result.errors.push(`due: ${error.message}`);
    return result;
  }

  const started = Date.now();
  for (const [index, c] of (due ?? []).entries()) {
    if (Date.now() - started > BUDGET_MS) break;
    if (index > 0) await new Promise((resolve) => setTimeout(resolve, PAUSE_MS));
    result.checked += 1;
    const registry = await checkCompanyRegistry({
      country: c.country,
      businessId: c.business_id,
      vatNumber: c.vat_number,
      name: c.name,
    });
    if (registry.verdict === 'ERROR') {
      result.errors.push(`${c.id}: ${registry.issues[0] ?? 'ERROR'}`);
      continue;
    }
    const { error: updateError } = await admin.from('companies').update({ registry_check: registry }).eq('id', c.id);
    if (updateError) result.errors.push(`${c.id}: ${updateError.message}`);
    else result.updated += 1;
  }
  return result;
}

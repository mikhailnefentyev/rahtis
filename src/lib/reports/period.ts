import 'server-only';

import { vatBpsFor, withVat } from '@/lib/config';
import { createClient } from '@/lib/supabase/server';
import type { ClaimKind, ClaimStatus, PartyRole, PeriodClaim, PeriodReportRow } from '@/types/db';

/**
 * Отчёт за период: одна сборка на предпросмотр, PDF, XLSX и CSV.
 *
 * Четыре представления одного отчёта обязаны сходиться до цента. Если
 * каждое считает налог и итоги само, первое же расхождение в округлении
 * даст бухгалтеру Excel, не совпадающий с PDF, — и вопрос «какой из них
 * правильный», на который нет ответа. Поэтому числа считаются здесь один
 * раз, а представления только раскладывают готовое.
 *
 * Под сессией спрашивающего: состав колонок решает period_report по роли,
 * и секретный ключ здесь не нужен.
 *
 * НАЛОГ. Ставка — из config.ts по стране контрагента, как в документах
 * периода: финской компании 25,5 %, иностранной — обратное начисление.
 *   заказчик    — налог со ставки, по своей стране;
 *   перевозчик  — налог с выплаты, по своей стране;
 *   оператор    — налог со ставки по стране заказчика: это сторона
 *                 счёта, который оператор выставляет.
 * Налог округляется по рейсу, итог — сумма строк.
 */

export type ReportLine = {
  ref: string;
  shipperRef: string | null;
  closedOn: string;
  route: string;
  vehicle: string | null;
  trailer: string | null;
  km: number;
  rate: number;
  commissionBps: number | null;
  commission: number | null;
  payout: number | null;
  /** Плата заказчика 3 % за заказ со стола. У перевозчика — null. */
  fee: number | null;
  /** База налога глазами роли: ставка с платой у заказчика и оператора, выплата у перевозчика. */
  net: number;
  vatBps: number;
  vat: number;
  gross: number;
  shipper: string | null;
  carrier: string | null;
  documents: number;
  cmr: number;
  photos: number;
  claims: Array<{
    ref: string;
    kind: ClaimKind;
    status: ClaimStatus;
    amount: number | null;
  }>;
};

export type ReportClaim = {
  ref: string;
  orderRef: string;
  kind: ClaimKind;
  status: ClaimStatus;
  filedByRole: PartyRole;
  mine: boolean;
  amount: number | null;
  resolution: string | null;
  createdAt: string;
  resolvedAt: string | null;
  shipper: string | null;
  carrier: string | null;
};

export type PeriodReport = {
  role: PartyRole;
  from: string;
  to: string;
  companyName: string | null;
  lines: ReportLine[];
  claims: ReportClaim[];
  totals: {
    trips: number;
    km: number;
    rate: number;
    commission: number | null;
    payout: number | null;
    /** Плата заказчиков. У перевозчика — null. */
    fee: number | null;
    net: number;
    vat: number;
    gross: number;
    /** Одна ставка на весь отчёт, если она одна; иначе null — ставки по строкам. */
    vatBps: number | null;
    claims: number;
    claimed: number;
  };
};

export async function buildPeriodReport(input: {
  role: PartyRole;
  from: string;
  to: string;
  /** Страна компании смотрящего — для налога стороны. У оператора не нужна. */
  country: string | null;
  /** Только оператор: отчёт по одной компании. */
  companyId?: string | null;
}): Promise<{ report: PeriodReport | null; error: string | null }> {
  const supabase = await createClient();
  const company = input.role === 'ADMIN' ? (input.companyId ?? undefined) : undefined;

  const [{ data: rows, error }, { data: claimRows, error: claimsError }, companyName] =
    await Promise.all([
      supabase.rpc('period_report', {
        p_from: input.from,
        p_to: input.to,
        p_company: company,
      }),
      supabase.rpc('period_claims', {
        p_from: input.from,
        p_to: input.to,
        p_company: company,
      }),
      company
        ? supabase
            .from('companies')
            .select('name')
            .eq('id', company)
            .maybeSingle()
            .then((r) => r.data?.name ?? null)
        : Promise.resolve(null),
    ]);

  if (error || claimsError) return { report: null, error: (error ?? claimsError)!.message };

  const lines = ((rows ?? []) as PeriodReportRow[]).map((row) =>
    line(row, input.role, input.country),
  );
  const claims = ((claimRows ?? []) as PeriodClaim[]).map((c): ReportClaim => ({
    ref: c.ref,
    orderRef: c.order_ref,
    kind: c.kind,
    status: c.status,
    filedByRole: c.filed_by_role,
    mine: c.mine,
    amount: c.amount_cents,
    resolution: c.resolution,
    createdAt: c.created_at,
    resolvedAt: c.resolved_at,
    shipper: c.shipper_name,
    carrier: c.carrier_name,
  }));

  const sum = (pick: (l: ReportLine) => number | null) =>
    lines.reduce((acc, l) => acc + (pick(l) ?? 0), 0);
  /* Процент с перевозчика отменён 22.09.2026 — его колонки видит только оператор, для истории. */
  const seesFees = input.role === 'ADMIN';
  const rates = new Set(lines.map((l) => l.vatBps));

  return {
    error: null,
    report: {
      role: input.role,
      from: input.from,
      to: input.to,
      companyName,
      lines,
      claims,
      totals: {
        trips: lines.length,
        km: sum((l) => l.km),
        rate: sum((l) => l.rate),
        commission: seesFees ? sum((l) => l.commission) : null,
        payout: seesFees ? sum((l) => l.payout) : null,
        fee: input.role === 'CARRIER' ? null : sum((l) => l.fee),
        net: sum((l) => l.net),
        vat: sum((l) => l.vat),
        gross: sum((l) => l.gross),
        vatBps: rates.size <= 1 ? ([...rates][0] ?? vatBpsFor(input.country)) : null,
        claims: claims.length,
        claimed: claims.reduce((acc, c) => acc + (c.amount ?? 0), 0),
      },
    },
  };
}

function line(row: PeriodReportRow, role: PartyRole, country: string | null): ReportLine {
  const rate = row.rate_cents ?? 0;
  const fee = role === 'CARRIER' ? null : (row.shipper_fee_cents ?? 0);
  const net = role === 'CARRIER' ? (row.payout_cents ?? rate) : rate + (fee ?? 0);
  const vatBps = vatBpsFor(role === 'ADMIN' ? row.shipper_country : country);
  const gross = withVat(net, vatBps);

  return {
    ref: row.ref,
    shipperRef: row.shipper_ref,
    closedOn: row.closed_on,
    route: row.route ?? '',
    vehicle: row.vehicle_plate,
    trailer: row.trailer_plate,
    km: row.distance_km ?? 0,
    rate,
    commissionBps: row.commission_bps,
    commission: row.commission_cents,
    payout: row.payout_cents,
    fee,
    net,
    vatBps,
    vat: gross - net,
    gross,
    shipper: row.shipper_name,
    carrier: row.carrier_name,
    documents: row.documents_count,
    cmr: row.cmr_count,
    photos: row.photos_count,
    claims: (
      (row.claims ?? []) as Array<{
        ref: string;
        kind: ClaimKind;
        status: ClaimStatus;
        amount_cents: number | null;
      }>
    ).map((c) => ({
      ref: c.ref,
      kind: c.kind,
      status: c.status,
      amount: c.amount_cents,
    })),
  };
}

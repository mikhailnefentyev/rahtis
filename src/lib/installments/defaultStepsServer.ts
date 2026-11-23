import 'server-only';

import type { ReactElement } from 'react';
import type { DocumentProps } from '@react-pdf/renderer';
import { createFormat } from '@/lib/format';
import { createClient } from '@/lib/supabase/server';
import { buildSchedule, overduePayments, type VatMode } from './calc';
import { contractInput, type LoadedDeal } from './contract';
import { LETTER_PRINT, noticeLetter } from './contractText/noticeLetters';
import { CountryContractPdf } from './CountryContractPdf';
import { installmentCurrency, installmentDay, installmentToday } from './countries';
import { defaultStepPlan, type DefaultStep, type StepRecord } from './defaultSteps';
import { installmentRules } from './rules';

/**
 * Шаги после порога просрочки — то, что нужно серверу (24.11.2026):
 * записанные шаги сделки, просрочка на сегодня тем же правилом, что у
 * страницы сделки и ежедневного задания, и письмо шага в PDF. Логика сроков —
 * в defaultSteps.ts.
 */

export type StepRow = StepRecord & {
  id: string;
  overdue: { n: number; due: string; cents: number }[];
  overdue_cents: number;
  early: boolean;
};

/** Шаги сделки по порядку записи. Видят их только стороны (политика installment_default_steps_parties). */
export async function dealDefaultSteps(dealId: string): Promise<StepRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('installment_default_steps')
    .select('id, step, given_on, deadline, overdue, overdue_cents, early, created_at')
    .eq('deal_id', dealId)
    .order('given_on')
    .order('created_at');
  return (data ?? []).map((r) => ({
    ...r,
    step: r.step as DefaultStep,
    overdue: Array.isArray(r.overdue) ? (r.overdue as StepRow['overdue']) : [],
  }));
}

/**
 * Просрочка сделки на сегодня и достигнут ли порог страны — тем же правилом,
 * что у страницы сделки (overduePayments: только по отправленному документу,
 * от срока или дня отправки, что позже).
 */
export async function dealOverdueNow(d: LoadedDeal): Promise<{ rows: { n: number; due: string; cents: number }[]; totalCents: number; thresholdReached: boolean; today: string }> {
  const { deal, seller } = d;
  const supabase = await createClient();
  const today = installmentToday(seller.country);
  const { data: payments } = await supabase.from('installment_payments').select('*').eq('deal_id', deal.id).order('n');
  const invoiceIds = (payments ?? []).map((p) => p.invoice_id).filter((v): v is string => Boolean(v));
  const { data: invs } = invoiceIds.length
    ? await supabase.from('carrier_invoices').select('id, sent_at').in('id', invoiceIds)
    : { data: [] as { id: string; sent_at: string | null }[] };
  const sentDay = new Map((invs ?? []).filter((i) => i.sent_at).map((i) => [i.id, installmentDay(seller.country, i.sent_at!)]));
  const overdue = overduePayments(
    (payments ?? []).map((p) => ({
      ...p,
      dueDate: p.due_date,
      paid: Boolean(p.paid_at),
      invoiceSentDay: p.invoice_id ? (sentDay.get(p.invoice_id) ?? null) : null,
    })),
    today,
  );
  const rules = installmentRules(seller.country);
  const schedule = buildSchedule({
    priceCents: deal.price_cents,
    vatMode: deal.vat_mode as VatMode,
    vatBps: deal.vat_bps,
    downPaymentCents: deal.down_payment_cents,
    months: deal.months,
    finalCents: deal.final_cents,
    annualRateBps: deal.annual_rate_bps,
    handoverDate: deal.handover_date,
    firstDueDate: deal.first_due_date,
  });
  const unpaid = (payments ?? []).filter((p) => !p.paid_at).reduce((s, p) => s + p.principal_cents, 0);
  const thresholdReached =
    rules !== null &&
    rules.remedyAllowed(
      overdue.map((p) => ({ dueDate: p.lateFrom, unpaidCents: p.principal_cents, n: p.n })),
      today,
      'error' in schedule ? deal.price_cents : rules.base(schedule),
      unpaid,
    );
  const rows = overdue.map((p) => ({ n: p.n, due: p.due_date, cents: p.principal_cents + p.interest_cents }));
  return { rows, totalCents: rows.reduce((s, r) => s + r.cents, 0), thresholdReached, today };
}

const shortDate = (iso: string) => {
  const [y, m, day] = iso.split('-');
  return `${Number(day)}.${Number(m)}.${y}`;
};
const paddedDate = (iso: string) => {
  const [y, m, day] = iso.split('-');
  return `${day}.${m}.${y}`;
};

/**
 * Письмо шага в PDF на языке договора сделки (24.11.2026) — тем же
 * компонентом, что договоры стран. grace — письмо о сроке, на которое
 * ссылается отказ. null — у страны нет такого шага или у сделки нет договора.
 */
export function dealNoticeLetter(
  d: LoadedDeal,
  step: StepRow,
  grace: StepRow | null,
): { document: ReactElement<DocumentProps>; filename: string } | null {
  const plan = defaultStepPlan(d.seller.country);
  if (!plan) return null;
  const print = LETTER_PRINT[plan.rules];
  const date = print.isoDates ? (iso: string) => iso : plan.rules === 'FI_OSKL' ? shortDate : paddedDate;
  /* Стороны, номер и дата договора — из снимка при согласии, как в договоре. */
  const input = contractInput(d, plan.rules === 'FI_OSKL' ? undefined : { intl: print.intl, paddedDates: true, isoDates: print.isoDates });
  if (!input) return null;
  const f = createFormat(print.intl);
  const currency = d.deal.currency ?? installmentCurrency(d.seller.country);
  const money = (cents: number) => f.money(cents, currency);
  const party = (x: typeof input.seller) => ({ name: x.name, businessId: x.businessId, address: x.address, email: x.email });
  const doc = noticeLetter({
    step: step.step,
    rules: plan.rules,
    date: date(step.given_on),
    contract: { number: input.number, date: input.date },
    vehicle: `${input.vehicle.make} ${input.vehicle.plate}`.trim(),
    seller: party(input.seller),
    buyer: party(input.buyer),
    overdue: step.overdue.map((o) => ({ n: o.n, due: date(o.due), amount: money(o.cents) })),
    total: money(step.overdue_cents),
    deadline: step.deadline ? date(step.deadline) : null,
    grace: grace?.deadline ? { date: date(grace.given_on), deadline: date(grace.deadline) } : null,
    iban: d.seller.iban ? d.seller.iban.replace(/\s/g, '').replace(/(.{4})(?=.)/g, '$1 ') : null,
  });
  if (!doc) return null;
  return {
    document: CountryContractPdf(doc),
    filename: `${print.filePrefix}-${input.number}-${step.given_on}.pdf`,
  };
}

import 'server-only';

import type { FreightInvoiceTarget, ShipperInvoiceRow } from '@/components/domain/FreightInvoice';
import { createClient } from '@/lib/supabase/server';

/** Перевозчику: выполненные прямые рейсы, где можно отметить счёт, и записанные счета. До миграции — пусто. */
export async function loadFreightInvoiceTargets(): Promise<Record<string, FreightInvoiceTarget>> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc('freight_invoice_targets');
    if (error) return {};
    return Object.fromEntries(
      (data ?? []).map((r) => [
        r.order_id,
        {
          editable: r.editable,
          defaults: { amountCents: r.default_amount_cents, currency: r.default_currency, sendTo: r.default_send_to },
          invoice: r.invoice_id
            ? {
                id: r.invoice_id,
                number: r.number ?? '',
                amountCents: r.amount_cents ?? 0,
                currency: r.currency ?? r.default_currency,
                issuedOn: r.issued_on ?? '',
                dueOn: r.due_on ?? '',
                sendTo: r.send_to ?? '',
                paidAt: r.paid_at,
                paidSide: r.paid_marked_side,
                confirmed: r.paid_confirmed_at !== null,
                reminder1At: r.reminder_1_at,
                reminder2At: r.reminder_2_at,
              }
            : null,
          reportPrefilled: r.report_prefilled,
        } satisfies FreightInvoiceTarget,
      ]),
    );
  } catch {
    return {};
  }
}

/** Заказчику: счета перевозчиков, открытые и оплаченные за 90 дней. */
export async function loadShipperInvoices(): Promise<ShipperInvoiceRow[]> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc('shipper_freight_invoices');
    if (error) return [];
    return (data ?? []).map((r) => ({
      id: r.id,
      orderRef: r.order_ref,
      carrierName: r.carrier_name,
      number: r.number,
      amountCents: r.amount_cents,
      currency: r.currency,
      dueOn: r.due_on,
      paidAt: r.paid_at,
      paidSide: r.paid_marked_side,
      confirmed: r.paid_confirmed_at !== null,
    }));
  } catch {
    return [];
  }
}

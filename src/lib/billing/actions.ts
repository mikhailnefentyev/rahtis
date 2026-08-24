'use server';

import { revalidatePath } from 'next/cache';
import { COMMISSION_BPS, payoutCents } from '@/lib/config';
import { operatorInbox } from '@/lib/email';
import { invoicedEmail, settledEmail } from '@/lib/email/templates/billing';
import { getViewer } from '@/lib/auth/viewer';
import { createFormat } from '@/lib/format';
import { defaultLocale, getDictionary, isLocale, type Locale } from '@/lib/i18n';
import { notify } from '@/lib/notify';
import { createClient } from '@/lib/supabase/server';
import type { Database } from '@/types/database';

type BillingStatus = Database['public']['Enums']['billing_status'];

function toLocale(value: FormDataEntryValue | null): Locale {
  const raw = String(value ?? '');
  return isLocale(raw) ? raw : defaultLocale;
}

async function requireAdmin() {
  const viewer = await getViewer();
  if (viewer.status !== 'ready' || viewer.role !== 'ADMIN') {
    throw new Error('forbidden');
  }
  return viewer;
}

/**
 * Продвинуть расчёты на следующий шаг.
 *
 * Уведомление шлётся не на каждый шаг. INVOICED видит заказчик — ему
 * пришёл счёт. SETTLED видит перевозчик — ему пришли деньги. PAID это
 * внутренний факт оператора: заказчику незачем знать, что мы отметили у
 * себя его платёж, а перевозчику рано радоваться.
 *
 * Порядок обязателен: сначала база, потом уведомление. Иначе при отказе
 * базы стороне уйдёт сообщение о том, чего не произошло.
 */
export async function setBillingAction(formData: FormData): Promise<void> {
  const locale = toLocale(formData.get('locale'));
  await requireAdmin();

  const orderId = String(formData.get('order_id') ?? '');
  const next = String(formData.get('next') ?? '') as BillingStatus;
  const invoiceRef = String(formData.get('invoice_ref') ?? '').trim();

  const supabase = await createClient();

  const { data: order, error } = await supabase.rpc('set_billing', {
    p_order_id: orderId,
    p_next: next,
    p_invoice_ref: invoiceRef || undefined,
  });

  if (error || !order) {
    console.error('Состояние расчётов не изменилось:', error?.message);
    revalidatePath(`/${locale}/admin/billing`);
    return;
  }

  await announce(order, next, locale);
  revalidatePath(`/${locale}/admin/billing`);
}

type Order = Database['public']['Tables']['orders']['Row'];

async function announce(order: Order, next: BillingStatus, locale: Locale): Promise<void> {
  if (next !== 'INVOICED' && next !== 'SETTLED') return;

  const t = await getDictionary(locale);
  const f = createFormat(t.meta.intl);
  const supabase = await createClient();

  const invoiced = next === 'INVOICED';
  const companyId = invoiced ? order.shipper_company_id : order.assigned_company_id;
  if (!companyId) return;

  const { data: company } = await supabase
    .from('companies')
    .select('name, contact_email, billing_email')
    .eq('id', companyId)
    .single();

  if (!company) return;

  /*
   * Счёт идёт на почту для счетов, если она задана: там его ждёт
   * бухгалтерия. Контактный адрес — запасной, а не основной: письмо о
   * деньгах диспетчеру бесполезно.
   */
  const to = company.billing_email ?? company.contact_email;

  /*
   * Заказчику ставка, перевозчику выплата — им приходят разные деньги.
   *
   * Выплата считается, а не хранится: в строке заказа лежит ставка и
   * замороженная при закрытии комиссия. Считать по текущей ставке нельзя
   * — она изменится, а закрытый рейс не должен.
   */
  const rate = order.rate_cents ?? 0;
  const cents = invoiced ? rate : payoutCents(rate, order.commission_bps ?? COMMISSION_BPS);
  const amount = f.eur(cents);

  await notify({
    companyId,
    kind: 'BILLING',
    title: invoiced
      ? `${t.billing.INVOICED} · ${order.ref}`
      : `${t.billing.SETTLED} · ${order.ref}`,
    body: `${amount} · ${t.money.calcNote}`,
    link: invoiced ? '/shipper/done' : '/carrier/done',
    email: {
      ...(invoiced
        ? invoicedEmail({
            to,
            companyName: company.name,
            companyId,
            orderRef: order.ref,
            amount,
            invoiceRef: order.invoice_ref,
            operatorEmail: operatorInbox(),
          })
        : settledEmail({
            to,
            companyName: company.name,
            companyId,
            orderRef: order.ref,
            amount,
            operatorEmail: operatorInbox(),
          })),
    },
  });
}

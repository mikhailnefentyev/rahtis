'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { explainAdmin, withAdminError } from '@/lib/admin/errors';
import { COMMISSION_BPS, payoutCents, vatBpsFor, withVat } from '@/lib/config';
import { operatorInbox } from '@/lib/email';
import { emailLocaleOf } from '@/lib/email/text';
import { invoicedEmail, settledEmail } from '@/lib/email/templates/billing';
import { getViewer } from '@/lib/auth/viewer';
import { createFormat } from '@/lib/format';
import { defaultLocale, getDictionary, isLocale, type Locale } from '@/lib/i18n';
import { notify } from '@/lib/notify';
import { formatIban, getOperatorProfile } from '@/lib/operator/profile';
import { generatePeriodSettlement } from '@/lib/reports/generate';
import { createClient } from '@/lib/supabase/server';
import type { PostgrestError } from '@supabase/supabase-js';
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
    redirect(withAdminError(`/${locale}/admin/billing`, explainAdmin(error)));
  }

  await announce(order, next);
  revalidatePath(`/${locale}/admin/billing`);
}

type Order = Database['public']['Tables']['orders']['Row'];

/* Язык уведомления и письма берётся из карточки компании, а не из админки. */
async function announce(order: Order, next: BillingStatus): Promise<void> {
  if (next !== 'INVOICED' && next !== 'SETTLED') return;

  const supabase = await createClient();

  const invoiced = next === 'INVOICED';
  const companyId = invoiced ? order.shipper_company_id : order.assigned_company_id;
  if (!companyId) return;

  const { data: company } = await supabase
    .from('companies')
    .select('name, contact_email, billing_email, language, country')
    .eq('id', companyId)
    .single();

  if (!company) return;

  /*
   * Язык получателя, а не оператора.
   *
   * Словарь брался по локали админки, и уведомление в кабинете финской
   * компании становилось английским, стоило оператору переключить свой
   * интерфейс. Письмо рядом уже слушалось карточки компании — теперь
   * слушается и уведомление.
   */
  const t = await getDictionary(emailLocaleOf(company.language) as Locale);
  const f = createFormat(t.meta.intl);

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

  /* Налог по стране получателя — то же правило, что в сводках периода. */
  const vatBps = vatBpsFor(company.country);
  const gross = withVat(cents, vatBps);
  const money = {
    net: amount,
    vat: vatBps > 0 ? f.eur(gross - cents) : null,
    vatRate: vatBps > 0 ? f.percent(vatBps / 10_000, 1) : null,
    total: f.eur(gross),
  };

  const profile = await getOperatorProfile();
  const operator = {
    legalName: profile.legal_name,
    businessId: profile.business_id,
    vatNumber: profile.vat_number,
    address: [profile.street, [profile.postal_code, profile.city].filter(Boolean).join(' ')]
      .filter(Boolean)
      .join(', '),
    account: profile.iban
      ? [formatIban(profile.iban), profile.bic ? `BIC ${profile.bic}` : null]
          .filter(Boolean)
          .join(' · ')
      : null,
  };

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
            money,
            operator,
            invoiceRef: order.invoice_ref,
            operatorEmail: operatorInbox(),
            locale: emailLocaleOf(company.language),
          })
        : settledEmail({
            to,
            companyName: company.name,
            companyId,
            orderRef: order.ref,
            money,
            operator,
            operatorEmail: operatorInbox(),
            locale: emailLocaleOf(company.language),
          })),
    },
  });
}

/**
 * Тот же шаг расчётов для нескольких рейсов сразу.
 *
 * Счёт заказчику обычно один на период, а не на рейс, и выплата
 * перевозчику — один перевод. Поэтому на странице шаг делается по
 * компании: все её рейсы этого этапа с одним номером счёта. Каждый рейс
 * проходит через ту же set_billing — правила переходов и отметки времени
 * остаются в одном месте. Отказ по одному рейсу не останавливает
 * остальные: оператор увидит, какие не сдвинулись, по их этапу.
 */
export async function setBillingBatchAction(formData: FormData): Promise<void> {
  const locale = toLocale(formData.get('locale'));
  await requireAdmin();

  const next = String(formData.get('next') ?? '') as BillingStatus;
  const invoiceRef = String(formData.get('invoice_ref') ?? '').trim();
  const ids = formData.getAll('order_id').map(String).filter(Boolean);

  const supabase = await createClient();
  let failed = false;
  let firstError: PostgrestError | null = null;

  for (const orderId of ids) {
    const { data: order, error } = await supabase.rpc('set_billing', {
      p_order_id: orderId,
      p_next: next,
      p_invoice_ref: invoiceRef || undefined,
    });

    if (error || !order) {
      console.error('Состояние расчётов не изменилось:', orderId, error?.message);
      failed = true;
      firstError ??= error;
      continue;
    }

    await announce(order, next);
  }

  revalidatePath(`/${locale}/admin/billing`);
  if (failed) {
    redirect(withAdminError(`/${locale}/admin/billing`, explainAdmin(firstError) ?? 'generic'));
  }
}

/**
 * Выпустить счета периода вручную.
 *
 * Та же функция, что зовёт планировщик после конца периода. Нужна, когда
 * запуск не прошёл (сбой почты, выключенное расписание): на странице
 * расчётов у закрытого периода остались невыставленные рейсы. Номера
 * счетов закреплены за заказчиком и периодом, поэтому повторный выпуск
 * не заводит новых.
 */
export async function issuePeriodInvoicesAction(formData: FormData): Promise<void> {
  const locale = toLocale(formData.get('locale'));
  await requireAdmin();

  const start = String(formData.get('period_start') ?? '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start)) {
    redirect(withAdminError(`/${locale}/admin/billing`, 'generic'));
  }

  /* Полдень первого дня: момент заведомо внутри периода при любом смещении. */
  const result = await generatePeriodSettlement(`${start}T12:00:00Z`);

  revalidatePath(`/${locale}/admin/billing`);
  if (result.errors.length > 0) {
    console.error('Счета периода выпущены с ошибками:', result.errors.join('; '));
    redirect(withAdminError(`/${locale}/admin/billing`, 'generic'));
  }
}

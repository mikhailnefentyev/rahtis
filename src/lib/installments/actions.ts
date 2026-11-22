'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getViewer } from '@/lib/auth/viewer';
import { eurosToCents } from '@/lib/economics/money';
import { emailLocaleOf } from '@/lib/email/text';
import { defaultLocale, isLocale, type Locale } from '@/lib/i18n';
import { notify } from '@/lib/notify';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { isTerminationReason, vatModeAllowedForNew } from './access';
import { buildSchedule, type VatMode } from './calc';
import { fill, installmentUiCopy } from './copy';
import { createFirstInvoice } from './firstInvoice';
import { createCreditNote, ensureSchedule, runInstallments } from './payments';

/**
 * Действия раздела «Продажа техники в рассрочку» (22.11.2026). Права и
 * правила проверяет база (app.installment_party: главный в действующем
 * перевозчике с документами; условия — app.installment_terms_ok). Здесь —
 * разбор формы, та же проверка калькулятором и уведомления второй стороне.
 *
 * Каждое действие возвращает ActionState: отказ базы человек видит рядом
 * с кнопкой (useActionState), а не молчаливо перерисованную страницу
 * (22.11.2026).
 */

export type ActionState = { error: string | null; saved: boolean };

const done: ActionState = { error: null, saved: true };
const failed = (error: string): ActionState => ({ error, saved: false });

const VAT_MODES: VatMode[] = ['STANDARD', 'MARGIN', 'EXEMPT', 'NONE'];

const toLocale = (value: FormDataEntryValue | null): Locale => {
  const raw = String(value ?? '');
  return isLocale(raw) ? raw : defaultLocale;
};

const str = (fd: FormData, key: string) => String(fd.get(key) ?? '').trim();

function percentBps(value: string): number | null {
  const s = value.replace(/\s|%/g, '').replace(',', '.');
  if (!s) return 0;
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  return Math.round(Number(s) * 100);
}

function isoDate(value: string): string | null {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

/** Условия из формы; null — что-то не так. Проверка — тем же калькулятором, что видит пользователь. */
function readTerms(fd: FormData, vatMode: VatMode, vatBps: number, withDates: boolean) {
  const price = eurosToCents(str(fd, 'price'));
  const down = str(fd, 'down') ? eurosToCents(str(fd, 'down')) : 0;
  const finalRaw = str(fd, 'final');
  const final = finalRaw ? eurosToCents(finalRaw) : null;
  const rate = percentBps(str(fd, 'rate'));
  const months = Number(str(fd, 'months'));
  const handover = withDates ? isoDate(str(fd, 'handover')) : '2099-01-01';
  const firstDue = withDates ? isoDate(str(fd, 'first_due')) : '2099-02-01';
  if (price == null || down == null || final === undefined || rate == null || !handover || !firstDue) return null;
  const schedule = buildSchedule({
    priceCents: price,
    vatMode,
    vatBps,
    downPaymentCents: down,
    months,
    finalCents: final,
    annualRateBps: rate,
    handoverDate: handover,
    firstDueDate: firstDue,
  });
  if ('error' in schedule) return null;
  return { price, down, final, rate, months, handover, firstDue };
}

async function ready() {
  const viewer = await getViewer();
  const ok =
    viewer.status === 'ready' &&
    viewer.company?.kind === 'CARRIER' &&
    viewer.profile.member_kind !== 'DISPATCHER';
  return { viewer, ok: Boolean(ok) };
}

/** Уведомление второй стороне — на её языке, со ссылкой на сделку. */
async function tell(
  companyId: string,
  dealId: string,
  /* Код события и подстановки: в кабинете фраза на языке читающего; title/body — запасной текст fi/en. */
  event: { code: string; params: Record<string, string | number> },
  build: (c: ReturnType<typeof installmentUiCopy>) => { title: string; body: string },
) {
  const { data: other } = await createAdminClient().from('companies').select('id, language').eq('id', companyId).maybeSingle();
  if (!other) return;
  const c = installmentUiCopy(emailLocaleOf(other.language));
  const { title, body } = build(c);
  await notify({
    companyId: other.id,
    kind: 'BILLING',
    code: `installment.${event.code}`,
    params: event.params,
    title,
    body,
    link: `/carrier/installments/${dealId}`,
  });
}

async function dealParties(dealId: string) {
  const { data } = await createAdminClient()
    .from('installment_deals')
    .select('id, seller_company_id, buyer_company_id, listing_id, contract_number')
    .eq('id', dealId)
    .maybeSingle();
  if (!data) return null;
  const { data: listing } = await createAdminClient().from('equipment_listings').select('vehicle_id').eq('id', data.listing_id).maybeSingle();
  const { data: vehicle } = listing
    ? await createAdminClient().from('vehicles').select('plate').eq('id', listing.vehicle_id).maybeSingle()
    : { data: null };
  return { ...data, plate: vehicle?.plate ?? '' };
}

// ── Объявление ───────────────────────────────────────────────────────

export async function saveListingAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const locale = toLocale(fd.get('locale'));
  const c = installmentUiCopy(locale);
  const { ok } = await ready();
  if (!ok) return { error: c.notAllowed, saved: false };

  /* В кабинете объявление всегда с обычным НДС (решение 22.11.2026); другой режим не принимает и база. */
  const vatMode = str(fd, 'vat_mode') as VatMode;
  if (!vatModeAllowedForNew(vatMode)) return { error: c.listing.error, saved: false };
  /* Ставка для проверки калькулятором; в базе — по стране продавца. */
  const terms = readTerms(fd, vatMode, 2550, false);
  const odometer = str(fd, 'odometer') ? Number(str(fd, 'odometer').replace(/\s/g, '')) : null;
  if (!terms || (odometer != null && (!Number.isInteger(odometer) || odometer < 0))) return { error: c.listing.error, saved: false };

  const supabase = await createClient();
  const { data: id, error } = await supabase.rpc('save_equipment_listing', {
    p_id: str(fd, 'id') || null,
    p_vehicle_id: str(fd, 'vehicle_id'),
    p_price_cents: terms.price,
    p_vat_mode: vatMode,
    p_down_payment_cents: terms.down,
    p_months: terms.months,
    p_final_cents: terms.final,
    p_annual_rate_bps: terms.rate,
    p_odometer_km: odometer,
    p_description: str(fd, 'description').slice(0, 4000),
  });
  if (error || !id) {
    console.error('объявление не сохранено:', error?.message);
    return { error: c.listing.error, saved: false };
  }
  if (str(fd, 'publish') === '1') {
    const { error: pub } = await supabase.rpc('set_equipment_listing_status', { p_id: id, p_status: 'PUBLISHED' });
    if (pub) return { error: c.listing.error, saved: false };
  }
  revalidatePath(`/${locale}/carrier/installments`);
  redirect(`/${locale}/carrier/installments`);
}

export async function setListingStatusAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const locale = toLocale(fd.get('locale'));
  const c = installmentUiCopy(locale);
  const { ok } = await ready();
  if (!ok) return failed(c.notAllowed);
  const status = str(fd, 'status');
  if (status !== 'PUBLISHED' && status !== 'WITHDRAWN') return failed(c.deal.error);
  const supabase = await createClient();
  const id = str(fd, 'id');
  /* Кого предупредить, если объявление снимают: открытые переговоры закроются. */
  const { data: open } =
    status === 'WITHDRAWN'
      ? await createAdminClient().from('installment_deals').select('id, buyer_company_id').eq('listing_id', id).eq('status', 'NEGOTIATING')
      : { data: [] as { id: string; buyer_company_id: string }[] };
  const { error } = await supabase.rpc('set_equipment_listing_status', { p_id: id, p_status: status });
  if (error) {
    console.error('статус объявления:', error.message);
    /* 42501 — нет прав: не главный или у компании истекли документы. */
    return failed(error.code === '42501' ? c.notAllowed : c.deal.error);
  }
  for (const deal of open ?? []) {
    const parties = await dealParties(deal.id);
    if (!parties) continue;
    await tell(deal.buyer_company_id, deal.id, { code: 'withdrawn', params: { plate: parties.plate } }, (cc) => ({
      title: fill(cc.notify.cancelledTitle, { plate: parties.plate }),
      body: cc.notify.withdrawnBody,
    }));
  }
  revalidatePath(`/${locale}/carrier/installments`);
  return done;
}

// ── Сделка ───────────────────────────────────────────────────────────

export async function startDealAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const locale = toLocale(fd.get('locale'));
  const c = installmentUiCopy(locale);
  const { viewer, ok } = await ready();
  if (!ok || viewer.status !== 'ready' || !viewer.company) return { error: c.notAllowed, saved: false };

  /* Новая сделка — только с обычным НДС (решение 22.11.2026): по старому объявлению с другим режимом предложение не принимается. */
  const vatMode = str(fd, 'vat_mode') as VatMode;
  if (!vatModeAllowedForNew(vatMode)) return { error: c.listing.vatOld, saved: false };
  const terms = readTerms(fd, vatMode, Number(str(fd, 'vat_bps')) || 0, true);
  if (!terms) return { error: c.listing.error, saved: false };

  const supabase = await createClient();
  const { data: dealId, error } = await supabase.rpc('start_installment_deal', {
    p_listing_id: str(fd, 'listing_id'),
    p_price_cents: terms.price,
    p_down_payment_cents: terms.down,
    p_months: terms.months,
    p_final_cents: terms.final,
    p_annual_rate_bps: terms.rate,
    p_handover_date: terms.handover,
    p_first_due_date: terms.firstDue,
  });
  if (error || !dealId) {
    console.error('сделка не начата:', error?.message);
    return { error: c.deal.error, saved: false };
  }
  const parties = await dealParties(dealId);
  if (parties) {
    await tell(parties.seller_company_id, dealId, { code: 'offer', params: { plate: parties.plate, name: viewer.company!.name } }, (cc) => ({
      title: fill(cc.notify.offerTitle, { plate: parties.plate }),
      body: fill(cc.notify.offerBody, { name: viewer.company!.name }),
    }));
  }
  redirect(`/${locale}/carrier/installments/${dealId}`);
}

export async function proposeTermsAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const locale = toLocale(fd.get('locale'));
  const c = installmentUiCopy(locale);
  const { viewer, ok } = await ready();
  if (!ok || viewer.status !== 'ready' || !viewer.company) return { error: c.notAllowed, saved: false };

  /* Уже начатая сделка идёт со своим режимом НДС до конца — режим здесь нужен только калькулятору, в базе он не меняется. */
  const vatMode = str(fd, 'vat_mode') as VatMode;
  const terms = readTerms(fd, VAT_MODES.includes(vatMode) ? vatMode : 'STANDARD', Number(str(fd, 'vat_bps')) || 0, true);
  if (!terms) return { error: c.listing.error, saved: false };
  const dealId = str(fd, 'deal_id');

  const supabase = await createClient();
  const { error } = await supabase.rpc('propose_installment_terms', {
    p_deal_id: dealId,
    p_price_cents: terms.price,
    p_down_payment_cents: terms.down,
    p_months: terms.months,
    p_final_cents: terms.final,
    p_annual_rate_bps: terms.rate,
    p_handover_date: terms.handover,
    p_first_due_date: terms.firstDue,
  });
  if (error) {
    console.error('встречное предложение:', error.message);
    return { error: c.deal.error, saved: false };
  }
  const parties = await dealParties(dealId);
  if (parties) {
    const other = parties.seller_company_id === viewer.company.id ? parties.buyer_company_id : parties.seller_company_id;
    await tell(other, dealId, { code: 'counter', params: { plate: parties.plate, name: viewer.company!.name } }, (cc) => ({
      title: fill(cc.notify.counterTitle, { plate: parties.plate }),
      body: fill(cc.notify.counterBody, { name: viewer.company!.name }),
    }));
  }
  revalidatePath(`/${locale}/carrier/installments/${dealId}`);
  return { error: null, saved: true };
}

export async function acceptTermsAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const locale = toLocale(fd.get('locale'));
  const c = installmentUiCopy(locale);
  const { viewer, ok } = await ready();
  if (!ok || viewer.status !== 'ready' || !viewer.company) return { error: c.notAllowed, saved: false };
  const dealId = str(fd, 'deal_id');

  const supabase = await createClient();
  const version = Number(str(fd, 'version'));
  if (!Number.isInteger(version) || version < 1) return { error: c.deal.changed, saved: false };
  const { data: number, error } = await supabase.rpc('accept_installment_terms', {
    p_deal_id: dealId,
    p_version: version,
  });
  if (error || !number) {
    console.error('условия не приняты:', error?.message);
    return { error: error?.code === '40001' ? c.deal.changed : c.deal.error, saved: false };
  }

  /* Первый счёт продавца: если не вышел (нет IBAN и т. п.) — сделка всё равно согласована, причина видна на странице. */
  try {
    const status = await createFirstInvoice(dealId);
    if (status !== 'SENT' && status !== 'CREATED' && status !== 'EXISTS') console.warn('первый счёт рассрочки:', status);
  } catch (cause) {
    console.error('первый счёт рассрочки сорвался:', cause instanceof Error ? cause.message : cause);
  }

  const parties = await dealParties(dealId);
  if (parties) {
    const other = parties.seller_company_id === viewer.company.id ? parties.buyer_company_id : parties.seller_company_id;
    await tell(other, dealId, { code: 'agreed', params: { plate: parties.plate, number } }, (cc) => ({
      title: fill(cc.notify.agreedTitle, { plate: parties.plate }),
      body: fill(cc.notify.agreedBody, { number }),
    }));
  }
  revalidatePath(`/${locale}/carrier/installments/${dealId}`);
  revalidatePath(`/${locale}/carrier/installments`);
  return { error: null, saved: true };
}

/** Повторить первый счёт (например, после того как продавец указал IBAN). */
export async function retryFirstInvoiceAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const locale = toLocale(fd.get('locale'));
  const c = installmentUiCopy(locale);
  const { viewer, ok } = await ready();
  if (!ok || viewer.status !== 'ready' || !viewer.company) return failed(c.notAllowed);
  const dealId = str(fd, 'deal_id');
  /* Доступ — чтением под сессией (сделку видят только стороны); выставляет счёт только продавец. */
  const supabase = await createClient();
  const { data } = await supabase.from('installment_deals').select('id, seller_company_id').eq('id', dealId).maybeSingle();
  if (!data || data.seller_company_id !== viewer.company.id) return failed(c.deal.error);
  let result: ActionState = done;
  try {
    const status = await createFirstInvoice(dealId);
    /* Причину, по которой счёт снова не вышел, называем прямо: её исправляет сам продавец или покупатель. */
    if (status === 'NO_IBAN' || status === 'IBAN_RECENT' || status === 'NO_EMAIL') {
      result = failed(fill(c.deal.invoiceMissing, { reason: c.invoiceReasons[status] }));
    } else if (status === 'NOT_FOUND') {
      result = failed(c.deal.error);
    }
  } catch (cause) {
    console.error('первый счёт рассрочки сорвался:', cause instanceof Error ? cause.message : cause);
    result = failed(c.deal.error);
  }
  revalidatePath(`/${locale}/carrier/installments/${dealId}`);
  return result;
}

export async function cancelDealAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const locale = toLocale(fd.get('locale'));
  const c = installmentUiCopy(locale);
  const { viewer, ok } = await ready();
  if (!ok || viewer.status !== 'ready' || !viewer.company) return failed(c.notAllowed);
  const dealId = str(fd, 'deal_id');
  const supabase = await createClient();
  const { data: changed, error } = await supabase.rpc('cancel_installment_deal', { p_deal_id: dealId });
  if (error) {
    console.error('сделка не отменена:', error.message);
    /* Сделка могла измениться (счёт уже выставлен) — страницу обновляем, чтобы человек увидел нынешнее состояние. */
    revalidatePath(`/${locale}/carrier/installments/${dealId}`);
    return failed(error.code === '42501' ? c.notAllowed : c.deal.error);
  }
  const parties = changed ? await dealParties(dealId) : null;
  if (parties) {
    const other = parties.seller_company_id === viewer.company.id ? parties.buyer_company_id : parties.seller_company_id;
    await tell(other, dealId, { code: 'cancelled', params: { plate: parties.plate, name: viewer.company!.name } }, (cc) => ({
      title: fill(cc.notify.cancelledTitle, { plate: parties.plate }),
      body: fill(cc.notify.cancelledBody, { name: viewer.company!.name }),
    }));
  }
  revalidatePath(`/${locale}/carrier/installments/${dealId}`);
  revalidatePath(`/${locale}/carrier/installments`);
  return done;
}

// ── Этап 3: оплата первого счёта, передача, взносы, отмена с кредит-нотой ──

/** Продавец отмечает оплату первого счёта (деньги пришли на его счёт). */
export async function markFirstPaidAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const locale = toLocale(fd.get('locale'));
  const c = installmentUiCopy(locale);
  const { ok } = await ready();
  if (!ok) return failed(c.notAllowed);
  const dealId = str(fd, 'deal_id');
  const supabase = await createClient();
  const { error } = await supabase.rpc('mark_installment_first_paid', { p_deal_id: dealId });
  if (error) console.error('оплата первого счёта:', error.message);
  revalidatePath(`/${locale}/carrier/installments/${dealId}`);
  return error ? failed(c.deal.error) : done;
}

/** Подтверждение передачи своей стороной; после второго — график и уведомление обеим сторонам. */
export async function confirmHandoverAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const locale = toLocale(fd.get('locale'));
  const c = installmentUiCopy(locale);
  const { viewer, ok } = await ready();
  if (!ok || viewer.status !== 'ready' || !viewer.company) return { error: c.notAllowed, saved: false };
  const dealId = str(fd, 'deal_id');
  const checked = fd.getAll('check').length;
  if (checked < c.stage3.checklist.length) return { error: c.listing.error, saved: false };
  const kmRaw = str(fd, 'odometer').replace(/\s/g, '');
  const km = kmRaw ? Number(kmRaw) : null;
  if (km != null && (!Number.isInteger(km) || km < 0)) return { error: c.listing.error, saved: false };

  const supabase = await createClient();
  const { data: status, error } = await supabase.rpc('confirm_installment_handover', {
    p_deal_id: dealId,
    p_odometer_km: km,
    p_notes: str(fd, 'notes').slice(0, 2000) || null,
  });
  if (error) {
    console.error('передача:', error.message);
    return { error: c.deal.error, saved: false };
  }
  if (status === 'ACTIVE') {
    try {
      await ensureSchedule(dealId);
      /* Сразу выставить счета этой сделки, срок которых уже близко. */
      await runInstallments({ dealId });
    } catch (cause) {
      console.error('график рассрочки:', cause instanceof Error ? cause.message : cause);
    }
    const parties = await dealParties(dealId);
    if (parties) {
      for (const company of [parties.seller_company_id, parties.buyer_company_id]) {
        await tell(company, dealId, { code: 'handover', params: { plate: parties.plate } }, (cc) => ({
          title: fill(cc.notify.handoverTitle, { plate: parties.plate }),
          body: cc.notify.handoverBody,
        }));
      }
    }
  }
  revalidatePath(`/${locale}/carrier/installments/${dealId}`);
  revalidatePath(`/${locale}/carrier/fleet`);
  return { error: null, saved: true };
}

/** Продавец отмечает оплату взноса; последний — сделка выплачена. */
export async function markPaidAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const locale = toLocale(fd.get('locale'));
  const c = installmentUiCopy(locale);
  const { ok } = await ready();
  if (!ok) return failed(c.notAllowed);
  const dealId = str(fd, 'deal_id');
  const n = Number(str(fd, 'n'));
  if (!Number.isInteger(n) || n < 1) return failed(c.deal.error);
  const supabase = await createClient();
  const { data: status, error } = await supabase.rpc('mark_installment_paid', { p_deal_id: dealId, p_n: n });
  if (error) {
    console.error('оплата взноса:', error.message);
    revalidatePath(`/${locale}/carrier/installments/${dealId}`);
    return failed(c.deal.error);
  }
  if (status === 'PAID_OFF') {
    const parties = await dealParties(dealId);
    if (parties) {
      for (const company of [parties.seller_company_id, parties.buyer_company_id]) {
        await tell(company, dealId, { code: 'paid_off', params: { plate: parties.plate } }, (cc) => ({
          title: fill(cc.notify.paidOffTitle, { plate: parties.plate }),
          body: cc.notify.paidOffBody,
        }));
      }
    }
  }
  revalidatePath(`/${locale}/carrier/installments/${dealId}`);
  return done;
}

/** Отмена согласованной сделки после первого счёта (до передачи) — с кредит-нотой; отменяет только продавец. */
export async function cancelWithCreditAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const locale = toLocale(fd.get('locale'));
  const c = installmentUiCopy(locale);
  const { viewer, ok } = await ready();
  if (!ok || viewer.status !== 'ready' || !viewer.company) return failed(c.notAllowed);
  const dealId = str(fd, 'deal_id');
  const supabase = await createClient();
  const { error } = await supabase.rpc('cancel_installment_with_credit', { p_deal_id: dealId });
  if (error) {
    console.error('отмена с кредит-нотой:', error.message);
    /* Вторая сторона могла начать передачу — страницу обновляем. */
    revalidatePath(`/${locale}/carrier/installments/${dealId}`);
    return failed(c.deal.error);
  }
  /* Кредит-нота не вышла — сделка всё равно отменена: на странице останется «не выставлена» и кнопка повтора. */
  try {
    await createCreditNote(dealId);
  } catch (cause) {
    console.error('кредит-нота:', cause instanceof Error ? cause.message : cause);
  }
  const parties = await dealParties(dealId);
  if (parties) {
    const other = parties.seller_company_id === viewer.company.id ? parties.buyer_company_id : parties.seller_company_id;
    await tell(other, dealId, { code: 'cancelled', params: { plate: parties.plate, name: viewer.company!.name } }, (cc) => ({
      title: fill(cc.notify.cancelledTitle, { plate: parties.plate }),
      body: fill(cc.notify.cancelledBody, { name: viewer.company!.name }),
    }));
  }
  revalidatePath(`/${locale}/carrier/installments/${dealId}`);
  revalidatePath(`/${locale}/carrier/installments`);
  return done;
}

/** Повторить кредит-ноту, если она не вышла сразу (только продавец). */
export async function retryCreditNoteAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const locale = toLocale(fd.get('locale'));
  const c = installmentUiCopy(locale);
  const { viewer, ok } = await ready();
  if (!ok || viewer.status !== 'ready' || !viewer.company) return failed(c.notAllowed);
  const dealId = str(fd, 'deal_id');
  const supabase = await createClient();
  const { data } = await supabase.from('installment_deals').select('id, seller_company_id').eq('id', dealId).maybeSingle();
  if (!data || data.seller_company_id !== viewer.company.id) return failed(c.deal.error);
  let result: ActionState = done;
  try {
    if ((await createCreditNote(dealId)) === 'NOT_FOUND') result = failed(c.deal.error);
  } catch (cause) {
    console.error('кредит-нота:', cause instanceof Error ? cause.message : cause);
    result = failed(c.deal.error);
  }
  revalidatePath(`/${locale}/carrier/installments/${dealId}`);
  return result;
}

// ── Прекращение сделки в рассрочке ───────────────────────────────────

/* Функции terminate_installment_deal ещё нет в src/types/database.ts (миграция 20261126100000) — вызов с собственной подписью. */
type TerminateRpc = {
  rpc(
    fn: 'terminate_installment_deal',
    args: { p_deal_id: string; p_reason: string; p_note: string | null },
  ): PromiseLike<{ data: string | null; error: { code?: string; message: string } | null }>;
};

/**
 * Продавец записывает, что сделка в рассрочке прекращена (22.11.2026):
 * забрал машину по закону или стороны договорились. Счета, напоминания и
 * сигналы о пороге по сделке прекращаются; взаиморасчёт RAHTIS не считает.
 * Покупателю — уведомление в кабинете.
 */
export async function terminateDealAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const locale = toLocale(fd.get('locale'));
  const c = installmentUiCopy(locale);
  const { viewer, ok } = await ready();
  if (!ok || viewer.status !== 'ready' || !viewer.company) return failed(c.notAllowed);
  const dealId = str(fd, 'deal_id');
  const reason = str(fd, 'reason');
  const note = str(fd, 'note');
  if (!isTerminationReason(reason) || note.length > 2000) return failed(c.listing.error);

  const supabase = await createClient();
  const { error } = await (supabase as unknown as TerminateRpc).rpc('terminate_installment_deal', {
    p_deal_id: dealId,
    p_reason: reason,
    p_note: note || null,
  });
  if (error) {
    console.error('прекращение сделки:', error.message);
    /* Сделка могла измениться (последний взнос оплачен) — страницу обновляем. */
    revalidatePath(`/${locale}/carrier/installments/${dealId}`);
    /* 55006 — у машины покупателя открытые рейсы; 42501 — не продавец или не главный в компании. */
    return failed(error.code === '55006' ? c.termination.openTrips : error.code === '42501' ? c.notAllowed : c.deal.error);
  }
  const parties = await dealParties(dealId);
  if (parties) {
    await tell(parties.buyer_company_id, dealId, { code: 'terminated', params: { plate: parties.plate } }, (cc) => ({
      title: fill(cc.notify.terminatedTitle, { plate: parties.plate }),
      body: cc.notify.terminatedBody,
    }));
  }
  revalidatePath(`/${locale}/carrier/installments/${dealId}`);
  revalidatePath(`/${locale}/carrier/installments`);
  revalidatePath(`/${locale}/carrier/fleet`);
  return done;
}

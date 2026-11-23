'use server';

import { revalidatePath } from 'next/cache';
import { after } from 'next/server';
import { redirect } from 'next/navigation';
import { getViewer } from '@/lib/auth/viewer';
import { eurosToCents } from '@/lib/economics/money';
import { defaultLocale, getDictionary, isLocale, type Locale } from '@/lib/i18n';
import { notify } from '@/lib/notify';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import {
  installmentCabinet,
  installmentDealLink,
  installmentsBase,
  isTerminationReason,
  parseSaleVehicle,
  vatModeAllowedForNew,
} from './access';
import { announceListing } from './announce';
import { buildSchedule, type VatMode } from './calc';
import { fill, installmentUiCopy } from './copy';
import { installmentCountry, installmentInterestOffered, installmentMaxRateBps } from './countries';
import { installmentCountryCopy } from './countryCopy';
import { countryEventCode, countryNoticeLocale } from './countryTexts';
import { createFirstInvoice } from './firstInvoice';
import { createCreditNote, ensureSchedule, runInstallments } from './payments';

/**
 * Действия раздела «Продажа техники в рассрочку» (22.11.2026). Права и
 * правила проверяет база: продаёт главный в проверенной финской компании
 * любого вида (app.installment_seller), покупает главный в действующем
 * перевозчике с документами (app.installment_party) — решение 23.11.2026;
 * условия — app.installment_terms_ok. Здесь — разбор формы, та же проверка
 * калькулятором и уведомления второй стороне.
 *
 * Раздел есть в двух кабинетах: у перевозчика (/carrier/installments) и у
 * компании без парка (/shipper/installments). Ссылки и переходы строятся
 * от вида компании (installmentsBase).
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

/**
 * Условия из формы; null — что-то не так. Проверка — тем же калькулятором, что видит пользователь.
 * country — страна сделки: где проценты не предлагаются (Швеция, 23.11.2026), ставка может быть только 0.
 */
function readTerms(fd: FormData, vatMode: VatMode, vatBps: number, withDates: boolean, country: string | null | undefined) {
  const price = eurosToCents(str(fd, 'price'));
  const down = str(fd, 'down') ? eurosToCents(str(fd, 'down')) : 0;
  const finalRaw = str(fd, 'final');
  const final = finalRaw ? eurosToCents(finalRaw) : null;
  const rate = percentBps(str(fd, 'rate'));
  const months = Number(str(fd, 'months'));
  const handover = withDates ? isoDate(str(fd, 'handover')) : '2099-01-01';
  const firstDue = withDates ? isoDate(str(fd, 'first_due')) : '2099-02-01';
  if (price == null || down == null || final === undefined || rate == null || !handover || !firstDue) return null;
  if (rate !== 0 && !installmentInterestOffered(country)) return null;
  /* Польша (23.11.2026): не выше предела odsetek maksymalnych — 7 % (countries.ts); то же правило в базе. */
  if (rate > installmentMaxRateBps(country)) return null;
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

/* Главный в компании, у которой есть раздел: перевозчик или компания без парка (23.11.2026). Остальное проверяет база. */
async function ready() {
  const viewer = await getViewer();
  const kind = viewer.status === 'ready' ? viewer.company?.kind : null;
  const ok =
    viewer.status === 'ready' &&
    installmentCabinet(kind) !== null &&
    viewer.profile.member_kind !== 'DISPATCHER';
  /* base — раздел в своём кабинете: туда ведут переходы после действия. country — страна компании: по ней тексты (23.11.2026). */
  return { viewer, ok: Boolean(ok), base: installmentsBase(kind), companyCountry: viewer.status === 'ready' ? (viewer.company?.country ?? null) : null };
}

/*
 * Страницы раздела есть в обоих кабинетах (23.11.2026), и вторая сторона
 * сделки может смотреть её из другого: после действия обновляются обе.
 */
const BASES = [installmentsBase('CARRIER'), installmentsBase('SHIPPER')];

function refreshList(locale: Locale) {
  for (const base of BASES) revalidatePath(`/${locale}${base}`);
}

function refreshDeal(locale: Locale, dealId: string) {
  for (const base of BASES) revalidatePath(`/${locale}${base}/${dealId}`);
}

/* События, текст которых в словаре кабинета финский по содержанию (Traficom, закон о рассрочке). */
const COUNTRY_EVENTS = new Set(['paid_off']);

/** Уведомление второй стороне — на её языке, со ссылкой на сделку. */
async function tell(
  companyId: string,
  dealId: string,
  /* Код события и подстановки: в кабинете фраза на языке читающего; title/body — запасной текст fi/en. */
  event: { code: string; params: Record<string, string | number> },
  build: (c: ReturnType<typeof installmentUiCopy>) => { title: string; body: string },
) {
  const { data: other } = await createAdminClient().from('companies').select('id, language, kind, country').eq('id', companyId).maybeSingle();
  if (!other) return;
  /*
   * Стороны сделки — из одной страны, поэтому страна получателя и есть страна
   * сделки (23.11.2026). У Финляндии всё как было: язык fi/en и прежний код.
   * У другой страны текст — про её право и на языке компании, а у события,
   * чей текст зависит от страны (полная оплата), — свой код: кабинет покажет
   * записанный текст, а не финский из словаря.
   */
  const c = installmentUiCopy(countryNoticeLocale(other.language, other.country), other.country);
  const { title, body } = build(c);
  await notify({
    companyId: other.id,
    kind: 'BILLING',
    code: COUNTRY_EVENTS.has(event.code) ? countryEventCode(event.code, other.country) : `installment.${event.code}`,
    params: event.params,
    title,
    body,
    /* Сделку каждая сторона открывает в своём кабинете: продавец может быть компанией без парка (23.11.2026). */
    link: installmentDealLink(other.kind, dealId),
  });
}

async function dealParties(dealId: string) {
  const admin = createAdminClient();
  const { data } = await admin
    .from('installment_deals')
    .select('id, seller_company_id, buyer_company_id, listing_id, contract_number')
    .eq('id', dealId)
    .maybeSingle();
  if (!data) return null;
  /* Машина — из парка продавца или, у продавца без парка, из его карточки на продажу (23.11.2026). */
  const { data: listing } = await admin.from('equipment_listings').select('vehicle_id, sale_vehicle_id').eq('id', data.listing_id).maybeSingle();
  const { data: vehicle } = listing?.vehicle_id
    ? await admin.from('vehicles').select('plate').eq('id', listing.vehicle_id).maybeSingle()
    : listing?.sale_vehicle_id
      ? await admin.from('equipment_sale_vehicles').select('plate').eq('id', listing.sale_vehicle_id).maybeSingle()
      : { data: null };
  return { ...data, plate: vehicle?.plate ?? '' };
}

// ── Объявление ───────────────────────────────────────────────────────

/*
 * Перевозчикам своей страны — уведомление о новой технике (23.11.2026).
 * После ответа продавцу: публикация не ждёт рассылки и не срывается из-за
 * неё. Повторная публикация того же объявления никого не уведомит дважды
 * (announce.ts, отметки в базе).
 */
function announceAfter(listingId: string) {
  after(() => announceListing(listingId).then(() => undefined));
}

export async function saveListingAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const locale = toLocale(fd.get('locale'));
  const { viewer, ok, base, companyCountry } = await ready();
  /* Тексты — про право страны компании (она же страна сделки: сделка всегда внутри одной страны). */
  const c = installmentUiCopy(locale, companyCountry);
  /* Страна продавца — из реестра стран раздела (23.11.2026): закрытая страна объявлений не создаёт. */
  const country = installmentCountry(viewer.status === 'ready' ? viewer.company?.country : null);
  if (!ok || !country) return { error: c.notAllowed, saved: false };

  /* В кабинете объявление всегда с обычным НДС (решение 22.11.2026); другой режим не принимает и база. */
  const vatMode = str(fd, 'vat_mode') as VatMode;
  if (!vatModeAllowedForNew(vatMode)) return { error: c.listing.error, saved: false };
  /* Ставка для проверки калькулятором — обычная ставка страны продавца из её пакета; в базе — тоже по стране продавца. */
  const terms = readTerms(fd, vatMode, country.vatStandardBps, false, country.code);
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
    announceAfter(id);
  }
  refreshList(locale);
  redirect(`/${locale}${base}`);
}

export async function setListingStatusAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const locale = toLocale(fd.get('locale'));
  const { ok, companyCountry } = await ready();
  /* Тексты — про право страны компании (она же страна сделки: сделка всегда внутри одной страны). */
  const c = installmentUiCopy(locale, companyCountry);
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
  if (status === 'PUBLISHED') announceAfter(id);
  for (const deal of open ?? []) {
    const parties = await dealParties(deal.id);
    if (!parties) continue;
    await tell(deal.buyer_company_id, deal.id, { code: 'withdrawn', params: { plate: parties.plate } }, (cc) => ({
      title: fill(cc.notify.cancelledTitle, { plate: parties.plate }),
      body: cc.notify.withdrawnBody,
    }));
  }
  refreshList(locale);
  return done;
}

// ── Сделка ───────────────────────────────────────────────────────────

export async function startDealAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const locale = toLocale(fd.get('locale'));
  const { viewer, ok, base, companyCountry } = await ready();
  /* Тексты — про право страны компании (она же страна сделки: сделка всегда внутри одной страны). */
  const c = installmentUiCopy(locale, companyCountry);
  if (!ok || viewer.status !== 'ready' || !viewer.company) return { error: c.notAllowed, saved: false };

  /* Новая сделка — только с обычным НДС (решение 22.11.2026): по старому объявлению с другим режимом предложение не принимается. */
  const vatMode = str(fd, 'vat_mode') as VatMode;
  if (!vatModeAllowedForNew(vatMode)) return { error: c.listing.vatOld, saved: false };
  const terms = readTerms(fd, vatMode, Number(str(fd, 'vat_bps')) || 0, true, companyCountry);
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
    /* RC001 — продавец из другой страны: сделка только внутри одной страны (23.11.2026). */
    if (error?.code === 'RC001') return { error: installmentCountryCopy(locale).differentCountry, saved: false };
    /* 42501 — покупать может только перевозчик с действующими документами. */
    return { error: error?.code === '42501' ? c.buyNotAllowed : c.deal.error, saved: false };
  }
  const parties = await dealParties(dealId);
  if (parties) {
    await tell(parties.seller_company_id, dealId, { code: 'offer', params: { plate: parties.plate, name: viewer.company!.name } }, (cc) => ({
      title: fill(cc.notify.offerTitle, { plate: parties.plate }),
      body: fill(cc.notify.offerBody, { name: viewer.company!.name }),
    }));
  }
  redirect(`/${locale}${base}/${dealId}`);
}

export async function proposeTermsAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const locale = toLocale(fd.get('locale'));
  const { viewer, ok, companyCountry } = await ready();
  /* Тексты — про право страны компании (она же страна сделки: сделка всегда внутри одной страны). */
  const c = installmentUiCopy(locale, companyCountry);
  if (!ok || viewer.status !== 'ready' || !viewer.company) return { error: c.notAllowed, saved: false };

  /* Уже начатая сделка идёт со своим режимом НДС до конца — режим здесь нужен только калькулятору, в базе он не меняется. */
  const vatMode = str(fd, 'vat_mode') as VatMode;
  const terms = readTerms(fd, VAT_MODES.includes(vatMode) ? vatMode : 'STANDARD', Number(str(fd, 'vat_bps')) || 0, true, companyCountry);
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
  refreshDeal(locale, dealId);
  return { error: null, saved: true };
}

export async function acceptTermsAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const locale = toLocale(fd.get('locale'));
  const { viewer, ok, companyCountry } = await ready();
  /* Тексты — про право страны компании (она же страна сделки: сделка всегда внутри одной страны). */
  const c = installmentUiCopy(locale, companyCountry);
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
  refreshDeal(locale, dealId);
  refreshList(locale);
  return { error: null, saved: true };
}

/** Повторить первый счёт (например, после того как продавец указал IBAN). */
export async function retryFirstInvoiceAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const locale = toLocale(fd.get('locale'));
  const { viewer, ok, companyCountry } = await ready();
  /* Тексты — про право страны компании (она же страна сделки: сделка всегда внутри одной страны). */
  const c = installmentUiCopy(locale, companyCountry);
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
  refreshDeal(locale, dealId);
  return result;
}

export async function cancelDealAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const locale = toLocale(fd.get('locale'));
  const { viewer, ok, companyCountry } = await ready();
  /* Тексты — про право страны компании (она же страна сделки: сделка всегда внутри одной страны). */
  const c = installmentUiCopy(locale, companyCountry);
  if (!ok || viewer.status !== 'ready' || !viewer.company) return failed(c.notAllowed);
  const dealId = str(fd, 'deal_id');
  const supabase = await createClient();
  const { data: changed, error } = await supabase.rpc('cancel_installment_deal', { p_deal_id: dealId });
  if (error) {
    console.error('сделка не отменена:', error.message);
    /* Сделка могла измениться (счёт уже выставлен) — страницу обновляем, чтобы человек увидел нынешнее состояние. */
    refreshDeal(locale, dealId);
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
  refreshDeal(locale, dealId);
  refreshList(locale);
  return done;
}

// ── Этап 3: оплата первого счёта, передача, взносы, отмена с кредит-нотой ──

/** Продавец отмечает оплату первого счёта (деньги пришли на его счёт). */
export async function markFirstPaidAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const locale = toLocale(fd.get('locale'));
  const { ok, companyCountry } = await ready();
  /* Тексты — про право страны компании (она же страна сделки: сделка всегда внутри одной страны). */
  const c = installmentUiCopy(locale, companyCountry);
  if (!ok) return failed(c.notAllowed);
  const dealId = str(fd, 'deal_id');
  const supabase = await createClient();
  const { error } = await supabase.rpc('mark_installment_first_paid', { p_deal_id: dealId });
  if (error) console.error('оплата первого счёта:', error.message);
  refreshDeal(locale, dealId);
  return error ? failed(c.deal.error) : done;
}

/** Подтверждение передачи своей стороной; после второго — график и уведомление обеим сторонам. */
export async function confirmHandoverAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const locale = toLocale(fd.get('locale'));
  const { viewer, ok, companyCountry } = await ready();
  /* Тексты — про право страны компании (она же страна сделки: сделка всегда внутри одной страны). */
  const c = installmentUiCopy(locale, companyCountry);
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
  refreshDeal(locale, dealId);
  revalidatePath(`/${locale}/carrier/fleet`);
  return { error: null, saved: true };
}

/** Продавец отмечает оплату взноса; последний — сделка выплачена. */
export async function markPaidAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const locale = toLocale(fd.get('locale'));
  const { ok, companyCountry } = await ready();
  /* Тексты — про право страны компании (она же страна сделки: сделка всегда внутри одной страны). */
  const c = installmentUiCopy(locale, companyCountry);
  if (!ok) return failed(c.notAllowed);
  const dealId = str(fd, 'deal_id');
  const n = Number(str(fd, 'n'));
  if (!Number.isInteger(n) || n < 1) return failed(c.deal.error);
  const supabase = await createClient();
  const { data: status, error } = await supabase.rpc('mark_installment_paid', { p_deal_id: dealId, p_n: n });
  if (error) {
    console.error('оплата взноса:', error.message);
    refreshDeal(locale, dealId);
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
  refreshDeal(locale, dealId);
  return done;
}

/** Отмена согласованной сделки после первого счёта (до передачи) — с кредит-нотой; отменяет только продавец. */
export async function cancelWithCreditAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const locale = toLocale(fd.get('locale'));
  const { viewer, ok, companyCountry } = await ready();
  /* Тексты — про право страны компании (она же страна сделки: сделка всегда внутри одной страны). */
  const c = installmentUiCopy(locale, companyCountry);
  if (!ok || viewer.status !== 'ready' || !viewer.company) return failed(c.notAllowed);
  const dealId = str(fd, 'deal_id');
  const supabase = await createClient();
  const { error } = await supabase.rpc('cancel_installment_with_credit', { p_deal_id: dealId });
  if (error) {
    console.error('отмена с кредит-нотой:', error.message);
    /* Вторая сторона могла начать передачу — страницу обновляем. */
    refreshDeal(locale, dealId);
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
  refreshDeal(locale, dealId);
  refreshList(locale);
  return done;
}

/** Повторить кредит-ноту, если она не вышла сразу (только продавец). */
export async function retryCreditNoteAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const locale = toLocale(fd.get('locale'));
  const { viewer, ok, companyCountry } = await ready();
  /* Тексты — про право страны компании (она же страна сделки: сделка всегда внутри одной страны). */
  const c = installmentUiCopy(locale, companyCountry);
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
  refreshDeal(locale, dealId);
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
  const { viewer, ok, companyCountry } = await ready();
  /* Тексты — про право страны компании (она же страна сделки: сделка всегда внутри одной страны). */
  const c = installmentUiCopy(locale, companyCountry);
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
    refreshDeal(locale, dealId);
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
  refreshDeal(locale, dealId);
  refreshList(locale);
  revalidatePath(`/${locale}/carrier/fleet`);
  return done;
}

// ── Машина на продажу у компании без парка (23.11.2026) ──────────────

/**
 * Карточка машины, которую продаёт компания без парка: номер, марка и
 * модель, класс, эко-класс, оси; у фургона и грузовика — грузоподъёмность
 * и погрузочные метры. Сохраняется черновиком; кнопка «отправить» сразу
 * передаёт её оператору на проверку.
 */
export async function saveSaleVehicleAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const locale = toLocale(fd.get('locale'));
  const { ok, base, companyCountry } = await ready();
  /* Тексты — про право страны компании (она же страна сделки: сделка всегда внутри одной страны). */
  const c = installmentUiCopy(locale, companyCountry);
  if (!ok) return failed(c.notAllowed);
  const input = parseSaleVehicle({
    plate: str(fd, 'plate'),
    make: str(fd, 'make'),
    vehicleClass: str(fd, 'vehicle_class'),
    euroClass: str(fd, 'euro_class'),
    axles: str(fd, 'axles'),
    payloadKg: str(fd, 'payload_kg'),
    ldm: str(fd, 'ldm'),
  });
  if (!input) return failed(c.listing.error);

  const supabase = await createClient();
  const { data: id, error } = await supabase.rpc('save_equipment_sale_vehicle', {
    p_id: str(fd, 'id') || null,
    p_plate: input.plate,
    p_make: input.make,
    p_vehicle_class: input.vehicleClass,
    p_euro_class: input.euroClass,
    p_axles: input.axles,
    p_payload_kg: input.payloadKg,
    p_ldm: input.ldm,
  });
  if (error || !id) {
    console.error('машина на продажу не сохранена:', error?.message);
    if (error?.code === '42501') return failed(c.notAllowed);
    /* 23505 — этот номер у компании уже есть. */
    if (error?.code === '23505') return failed((await getDictionary(locale)).fleet.plateInOwnFleet);
    return failed(c.listing.error);
  }
  if (str(fd, 'send') === '1') {
    const { error: sent } = await supabase.rpc('submit_equipment_sale_vehicle', { p_id: id });
    if (sent) {
      console.error('машина на продажу не отправлена на проверку:', sent.message);
      refreshList(locale);
      return failed(c.deal.error);
    }
  }
  refreshList(locale);
  redirect(`/${locale}${base}`);
}

/** Отправить карточку машины на продажу оператору на проверку. */
export async function submitSaleVehicleAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const locale = toLocale(fd.get('locale'));
  const { ok, companyCountry } = await ready();
  /* Тексты — про право страны компании (она же страна сделки: сделка всегда внутри одной страны). */
  const c = installmentUiCopy(locale, companyCountry);
  if (!ok) return failed(c.notAllowed);
  const supabase = await createClient();
  const { error } = await supabase.rpc('submit_equipment_sale_vehicle', { p_id: str(fd, 'id') });
  refreshList(locale);
  if (error) {
    console.error('машина на продажу не отправлена на проверку:', error.message);
    return failed(error.code === '42501' ? c.notAllowed : c.deal.error);
  }
  return done;
}

/**
 * Решение оператора по машине на продажу (экран допуска машин в админке).
 * Права проверяет база (decide_equipment_sale_vehicle: только оператор);
 * компании уходит то же уведомление, что о машине парка.
 */
export async function decideSaleVehicleAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const locale = toLocale(fd.get('locale'));
  const t = await getDictionary(locale);
  const viewer = await getViewer();
  if (viewer.status !== 'ready' || viewer.role !== 'ADMIN') return failed(t.error.forbidden);
  const decision = str(fd, 'decision');
  if (decision !== 'APPROVED' && decision !== 'REJECTED') return failed(t.error.generic);
  const supabase = await createClient();
  const { error } = await supabase.rpc('decide_equipment_sale_vehicle', {
    p_id: str(fd, 'id'),
    p_decision: decision,
    p_note: str(fd, 'reason') || null,
  });
  if (error) {
    console.error('решение по машине на продажу:', error.message);
    /* 23505 — номер уже у одобренной к продаже машины другой компании. */
    return failed(error.code === '23505' ? t.moderation.vehiclePlateTaken : t.error.generic);
  }
  revalidatePath(`/${locale}/admin`);
  refreshList(locale);
  return done;
}

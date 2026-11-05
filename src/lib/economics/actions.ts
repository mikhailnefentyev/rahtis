'use server';

import { revalidatePath } from 'next/cache';
import { requireRole } from '@/lib/auth/guard';
import { flashError } from '@/lib/forms/flash';
import { defaultLocale, getDictionary, isLocale, type Locale } from '@/lib/i18n';
import { asCurrency } from '@/lib/money/currency';
import { createClient } from '@/lib/supabase/server';
import { eurosToCents } from './money';

/**
 * Доходность машин: карточка финансов машины, журнал расходов, процент
 * налогов работодателя. Под сессией перевозчика; база сама проверяет
 * компанию и подписку (RLS и триггер vehicle_money_check).
 */

function toLocale(value: FormDataEntryValue | null): Locale {
  const raw = String(value ?? '');
  return isLocale(raw) ? raw : defaultLocale;
}

const str = (form: FormData, key: string) => String(form.get(key) ?? '').trim();

const date = (value: string): string | null => (/^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null);

/*
 * Валюта сумм формы: выбранная в форме, иначе рабочая валюта компании.
 * Суммы вводятся в той валюте, что показывает форма, — она и пишется.
 */
const currencyOf = (form: FormData, company: { currency?: string | null } | null) =>
  asCurrency(str(form, 'currency'), asCurrency(company?.currency, 'EUR'));

export type FinanceState = { error: string | null; done: boolean };

export async function saveVehicleFinanceAction(_prev: FinanceState, formData: FormData): Promise<FinanceState> {
  const locale = toLocale(formData.get('locale'));
  const t = (await getDictionary(locale)).economics;
  const viewer = await requireRole(locale, 'CARRIER');
  const vehicleId = str(formData, 'vehicle_id');

  const money: Record<string, number | null> = {};
  for (const key of ['purchase_price', 'monthly_payment', 'residual', 'insurance_year', 'kasko_year', 'tax_year', 'other_fixed_month']) {
    const cents = eurosToCents(str(formData, key));
    if (cents === undefined) return { error: t.errAmount, done: false };
    money[key] = cents;
  }
  const financing = str(formData, 'financing');
  if (!['CASH', 'LOAN', 'INSTALLMENT', 'LEASING'].includes(financing)) return { error: t.errAmount, done: false };
  const life = Number(str(formData, 'useful_life_months') || 60);
  if (!Number.isInteger(life) || life < 6 || life > 360) return { error: t.errLife, done: false };

  const supabase = await createClient();
  const { error } = await supabase.from('vehicle_finance').upsert(
    {
      vehicle_id: vehicleId,
      company_id: viewer.company!.id,
      purchase_price_cents: money.purchase_price,
      purchased_on: date(str(formData, 'purchased_on')),
      financing,
      monthly_payment_cents: financing === 'CASH' ? null : money.monthly_payment,
      payments_until: financing === 'CASH' ? null : date(str(formData, 'payments_until')),
      useful_life_months: life,
      residual_cents: money.residual,
      insurance_cents_year: money.insurance_year,
      kasko_cents_year: money.kasko_year,
      tax_cents_year: money.tax_year,
      other_fixed_cents_month: money.other_fixed_month,
      currency: currencyOf(formData, viewer.company),
      updated_at: new Date().toISOString(),
      updated_by: viewer.userId,
    },
    { onConflict: 'vehicle_id' },
  );
  if (error) return { error: t.errGeneric, done: false };

  revalidatePath(`/${locale}/carrier/economics`, 'layout');
  return { error: null, done: true };
}

export type CostState = { error: string | null; done: boolean };

export async function addVehicleCostAction(_prev: CostState, formData: FormData): Promise<CostState> {
  const locale = toLocale(formData.get('locale'));
  const t = (await getDictionary(locale)).economics;
  const viewer = await requireRole(locale, 'CARRIER');

  const amount = eurosToCents(str(formData, 'amount'));
  if (!amount || amount <= 0) return { error: t.errAmount, done: false };
  const spentOn = date(str(formData, 'spent_on'));
  if (!spentOn) return { error: t.errDate, done: false };
  const category = str(formData, 'category');
  if (!['REPAIR', 'PARTS', 'TYRES', 'TOLLS', 'PARKING', 'WASH', 'FINE', 'OTHER'].includes(category)) return { error: t.errGeneric, done: false };
  const vehicleId = str(formData, 'vehicle_id');
  if (!vehicleId) return { error: t.errVehicle, done: false };

  const supabase = await createClient();
  const { error } = await supabase.from('vehicle_costs').insert({
    company_id: viewer.company!.id,
    vehicle_id: vehicleId,
    spent_on: spentOn,
    category,
    amount_cents: amount,
    currency: currencyOf(formData, viewer.company),
    note: str(formData, 'note').slice(0, 200) || null,
    /* Покупка из «Запчастей» — у кого куплено. */
    supplier: str(formData, 'supplier').slice(0, 120) || null,
    created_by: viewer.userId,
  });
  if (error) return { error: error.code === '42501' ? t.locked : t.errGeneric, done: false };

  revalidatePath(`/${locale}/carrier/economics`, 'layout');
  revalidatePath(`/${locale}/carrier/parts`);
  return { error: null, done: true };
}

export async function deleteVehicleCostAction(formData: FormData): Promise<void> {
  const locale = toLocale(formData.get('locale'));
  const viewer = await requireRole(locale, 'CARRIER');
  const supabase = await createClient();
  const { error } = await supabase.from('vehicle_costs').delete().eq('id', str(formData, 'id')).eq('company_id', viewer.company!.id);
  if (error) await flashError((await getDictionary(locale)).economics.errGeneric);
  revalidatePath(`/${locale}/carrier/economics`, 'layout');
}

export async function saveEmployerCostAction(formData: FormData): Promise<void> {
  const locale = toLocale(formData.get('locale'));
  const viewer = await requireRole(locale, 'CARRIER');
  const pct = Number(str(formData, 'employer_cost_pct').replace(',', '.'));
  if (!Number.isFinite(pct) || pct < 0 || pct > 100) {
    await flashError((await getDictionary(locale)).economics.errPct);
    return;
  }
  const supabase = await createClient();
  await supabase
    .from('company_economics')
    .upsert({ company_id: viewer.company!.id, employer_cost_bps: Math.round(pct * 100), updated_at: new Date().toISOString() }, { onConflict: 'company_id' });
  revalidatePath(`/${locale}/carrier/economics`, 'layout');
}

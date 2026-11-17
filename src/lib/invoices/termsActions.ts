'use server';

import { revalidatePath } from 'next/cache';
import { getViewer } from '@/lib/auth/viewer';
import { emailLocaleOf } from '@/lib/email/text';
import { defaultLocale, getDictionary, isLocale, type Locale } from '@/lib/i18n';
import { notify } from '@/lib/notify';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { isPaymentTerm, isSchedule } from './terms';

export type TermsState = { error: string | null; saved: boolean };

const toLocale = (value: FormDataEntryValue | null): Locale => {
  const raw = String(value ?? '');
  return isLocale(raw) ? raw : defaultLocale;
};

/**
 * Условия счёта с контрагентом (17.11.2026): одна сторона предлагает
 * периодичность и срок оплаты, другая принимает или отклоняет. Права и
 * то, что между компаниями есть заказ, проверяет база. Меняет главный в
 * компании, не диспетчер: это условие договора, а не рейса.
 */
async function ready(locale: Locale) {
  const viewer = await getViewer();
  const t = await getDictionary(locale);
  const ok =
    viewer.status === 'ready' &&
    viewer.company &&
    (viewer.company.kind === 'CARRIER' || viewer.company.kind === 'SHIPPER') &&
    viewer.profile.member_kind !== 'DISPATCHER';
  return { viewer, t, ok: Boolean(ok) };
}

/** Уведомление другой стороне — на её языке, со ссылкой на «Мои данные». */
async function tell(
  counterparty: string,
  fromName: string,
  build: (t: Awaited<ReturnType<typeof getDictionary>>) => { title: string; body: string },
) {
  const { data: other } = await createAdminClient()
    .from('companies')
    .select('id, language')
    .eq('id', counterparty)
    .maybeSingle();
  if (!other) return;
  const t = await getDictionary(emailLocaleOf(other.language));
  const { title, body } = build(t);
  await notify({ companyId: other.id, kind: 'BILLING', title: title.replace('{name}', fromName), body, link: '/account#invoice-terms' });
}

export async function proposeInvoiceTermsAction(_previous: TermsState, formData: FormData): Promise<TermsState> {
  const locale = toLocale(formData.get('locale'));
  const { viewer, t, ok } = await ready(locale);
  if (!ok || viewer.status !== 'ready' || !viewer.company) return { error: t.forwarder.roleOwnerOnly, saved: false };

  const counterparty = String(formData.get('counterparty') ?? '');
  const schedule = String(formData.get('schedule') ?? '');
  const term = Number(formData.get('term_days'));
  if (!isSchedule(schedule) || !isPaymentTerm(term)) return { error: t.invoiceTerms.error, saved: false };

  const supabase = await createClient();
  const { error } = await supabase.rpc('propose_invoice_terms', {
    p_counterparty: counterparty,
    p_schedule: schedule,
    p_term_days: term,
  });
  if (error) {
    console.error('условия счёта не предложены:', error.message);
    return { error: t.invoiceTerms.error, saved: false };
  }

  await tell(counterparty, viewer.company.name, (tt) => ({
    title: tt.invoiceTerms.notifyProposalTitle,
    body: tt.invoiceTerms.notifyProposalBody
      .replace('{schedule}', tt.invoiceTerms.schedules[schedule])
      .replace('{days}', String(term)),
  }));

  revalidatePath(`/${locale}/account`);
  return { error: null, saved: true };
}

export async function answerInvoiceTermsAction(formData: FormData): Promise<void> {
  const locale = toLocale(formData.get('locale'));
  const { viewer, ok } = await ready(locale);
  if (!ok || viewer.status !== 'ready' || !viewer.company) return;

  const counterparty = String(formData.get('counterparty') ?? '');
  const decision = String(formData.get('decision') ?? '');
  const accept = decision === 'ACCEPT';

  const supabase = await createClient();
  /* Принимаются те условия, что человек видел на экране: подменённое предложение база отклонит. */
  const seenSchedule = String(formData.get('schedule') ?? '');
  const seenTerm = Number(formData.get('term_days'));
  const { error } = await supabase.rpc('answer_invoice_terms', {
    p_counterparty: counterparty,
    p_accept: accept,
    ...(accept ? { p_schedule: seenSchedule, p_term_days: seenTerm } : {}),
  });
  if (error) {
    console.error('ответ на условия счёта не записан:', error.message);
    return;
  }

  /* Отзыв своего предложения — без уведомления: другой стороне отвечать уже не на что. */
  if (decision !== 'WITHDRAW') {
    await tell(counterparty, viewer.company.name, (tt) => ({
      title: accept ? tt.invoiceTerms.notifyAcceptedTitle : tt.invoiceTerms.notifyRejectedTitle,
      body: tt.invoiceTerms.hint,
    }));
  }

  revalidatePath(`/${locale}/account`);
}

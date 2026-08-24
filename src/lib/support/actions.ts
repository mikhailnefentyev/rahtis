'use server';

import { revalidatePath } from 'next/cache';
import { getViewer } from '@/lib/auth/viewer';
import { operatorInbox, sendEmail } from '@/lib/email';
import { operatorNoticeEmail, supportEmail } from '@/lib/email/templates/operator';
import { defaultLocale, getDictionary, isLocale, type Locale } from '@/lib/i18n';
import { createClient } from '@/lib/supabase/server';

function toLocale(value: FormDataEntryValue | null): Locale {
  const raw = String(value ?? '');
  return isLocale(raw) ? raw : defaultLocale;
}

export type SupportState = { error: string | null; done: boolean };

/**
 * Вопрос оператору из кабинета.
 *
 * Строка в базе первична, письмо вторично — как и везде в уведомлениях.
 * Вопрос, потерянный спам-фильтром, это потерянный клиент, поэтому он
 * лежит в очереди оператора с отметкой «разобрано» и не зависит от того,
 * дошло ли письмо.
 */
export async function submitSupportAction(
  _previous: SupportState,
  formData: FormData,
): Promise<SupportState> {
  const locale = toLocale(formData.get('locale'));
  const t = await getDictionary(locale);

  const subject = String(formData.get('subject') ?? '').trim();
  const body = String(formData.get('body') ?? '').trim();

  if (subject.length < 3 || body.length < 3) {
    return { error: t.validation.required, done: false };
  }

  const viewer = await getViewer();
  if (viewer.status !== 'ready' || !viewer.company) {
    return { error: t.error.forbidden, done: false };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc('submit_support_message', {
    p_subject: subject,
    p_body: body,
  });

  if (error) {
    console.error('Вопрос оператору не записан:', error.message);
    return { error: t.support.failed, done: false };
  }

  await sendEmail(
    supportEmail({
      operatorInbox: operatorInbox(),
      fromEmail: viewer.email ?? 'tuntematon',
      companyName: viewer.company.name,
      companyId: viewer.company.id,
      role: t.role[viewer.role],
      subject,
      body,
    }),
  );

  revalidatePath(`/${locale}`, 'layout');
  return { error: null, done: true };
}


export type NoticeState = { error: string | null; done: boolean };

/**
 * Произвольное уведомление компании от оператора.
 *
 * Идёт обоими каналами: в кабинет обязательно, письмом по возможности.
 * Через notify_company, а не прямой вставкой — здесь действует живой
 * оператор, и проверка прав в базе на месте.
 */
export async function sendNoticeAction(
  _previous: NoticeState,
  formData: FormData,
): Promise<NoticeState> {
  const locale = toLocale(formData.get('locale'));
  const t = await getDictionary(locale);

  const viewer = await getViewer();
  if (viewer.status !== 'ready' || viewer.role !== 'ADMIN') {
    return { error: t.error.forbidden, done: false };
  }

  const companyId = String(formData.get('company_id') ?? '');
  const subject = String(formData.get('subject') ?? '').trim();
  const body = String(formData.get('body') ?? '').trim();

  if (!companyId || subject.length < 3 || body.length < 3) {
    return { error: t.validation.required, done: false };
  }

  const supabase = await createClient();

  const { error } = await supabase.rpc('notify_company', {
    p_company_id: companyId,
    p_kind: 'ADMIN_MESSAGE',
    p_title: subject,
    p_body: body,
  });

  if (error) {
    console.error('Уведомление не отправлено:', error.message);
    return { error: t.adminMessage.failed, done: false };
  }

  const { data: company } = await supabase
    .from('companies')
    .select('contact_email')
    .eq('id', companyId)
    .single();

  if (company?.contact_email) {
    await sendEmail(
      operatorNoticeEmail({
        to: company.contact_email,
        companyId,
        subject,
        body,
        operatorEmail: operatorInbox(),
      }),
    );
  }

  revalidatePath(`/${locale}/admin`);
  return { error: null, done: true };
}


/** Оператор разобрал вопрос. Отдельная кнопка, чтобы очередь не росла молча. */
export async function handleSupportAction(formData: FormData): Promise<void> {
  const locale = toLocale(formData.get('locale'));

  const viewer = await getViewer();
  if (viewer.status !== 'ready' || viewer.role !== 'ADMIN') return;

  const supabase = await createClient();
  const { error } = await supabase.rpc('handle_support_message', {
    p_id: Number(formData.get('id') ?? 0),
  });

  if (error) {
    console.error('Вопрос не отмечен разобранным:', error.message);
  }

  revalidatePath(`/${locale}/admin`);
}

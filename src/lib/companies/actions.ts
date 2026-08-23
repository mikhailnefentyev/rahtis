'use server';

import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { getViewer } from '@/lib/auth/viewer';
import { isValidBusinessId } from '@/lib/format';
import { getDictionary, isLocale, type Locale, defaultLocale } from '@/lib/i18n';
import type { CompanyRole } from '@/types/db';

function toLocale(value: FormDataEntryValue | null): Locale {
  const raw = String(value ?? '');
  return isLocale(raw) ? raw : defaultLocale;
}

/* ── Публичная форма заявки ─────────────────────────────────────── */

export type ApplyState = { error: string | null; done: boolean };

/**
 * Приём заявки на регистрацию.
 *
 * Пишет секретным ключом, а не из браузера: анонимной политики на запись
 * в companies нет намеренно. Публичная форма — очевидный спам-вектор, и
 * держать её на серверном действии значит иметь куда поставить капчу и
 * ограничение частоты, не трогая RLS.
 */
export async function submitApplicationAction(
  _previous: ApplyState,
  formData: FormData,
): Promise<ApplyState> {
  const locale = toLocale(formData.get('locale'));
  const t = await getDictionary(locale);

  const kind = String(formData.get('kind') ?? '') as CompanyRole;
  const name = String(formData.get('name') ?? '').trim();
  const businessId = String(formData.get('business_id') ?? '').trim();
  const email = String(formData.get('email') ?? '')
    .trim()
    .toLowerCase();

  if (kind !== 'CARRIER' && kind !== 'SHIPPER') {
    return { error: t.apply.failed, done: false };
  }
  if (name.length < 2) return { error: t.validation.required, done: false };
  if (!isValidBusinessId(businessId)) return { error: t.validation.businessId, done: false };
  if (!/^\S+@\S+\.\S+$/.test(email)) return { error: t.validation.email, done: false };

  const admin = createAdminClient();
  const { error } = await admin.from('companies').insert({
    kind,
    name,
    business_id: businessId,
    contact_email: email,
  });

  if (error) {
    /* 23505 — сработал частичный уникальный индекс по (country, business_id). */
    return {
      error: error.code === '23505' ? t.apply.duplicate : t.apply.failed,
      done: false,
    };
  }

  return { error: null, done: true };
}

/* ── Решения оператора ──────────────────────────────────────────── */

export type ModerationState = { error: string | null; notice: string | null };

/**
 * Проверяет, что действие выполняет администратор.
 *
 * Нужна отдельно от RLS: дальше в дело идёт секретный ключ, который RLS
 * не подчиняется. Каждое такое место обязано проверять права само.
 */
async function requireAdmin() {
  const viewer = await getViewer();
  if (viewer.status !== 'ready' || viewer.role !== 'ADMIN') {
    throw new Error('forbidden');
  }
  return viewer;
}

/**
 * Одобрение заявки и выдача доступа.
 *
 * Порядок важен. Сначала решение фиксируется в базе — под сессией
 * оператора, через функцию moderate_company: она проверяет права, меняет
 * статус в обход колоночных грантов и оставляет в журнале настоящего
 * автора решения.
 *
 * Приглашение отправляется вторым шагом. Общей транзакции с почтовым
 * сервисом нет и быть не может, поэтому письмо может не уйти при уже
 * одобренной компании. Это состояние честно показывается оператору,
 * и приглашение можно отправить повторно.
 */
export async function approveCompanyAction(formData: FormData): Promise<void> {
  const locale = toLocale(formData.get('locale'));
  await requireAdmin();

  const companyId = String(formData.get('company_id') ?? '');
  const supabase = await createClient();

  /* Функция возвращает одну строку компании, а не набор — .single() не нужен. */
  const { data: company, error } = await supabase.rpc('moderate_company', {
    p_company_id: companyId,
    p_decision: 'APPROVED',
  });

  if (error || !company) {
    revalidatePath(`/${locale}/admin`);
    return;
  }

  if (isCompanyRole(company.kind)) {
    await sendInvite(companyId, company.contact_email, company.kind);
  }
  revalidatePath(`/${locale}/admin`);
}

/**
 * У компании роль ADMIN невозможна — это запрещено ограничением
 * companies_kind_not_admin. Проверка не формальность: она стоит между
 * данными из базы и записью роли в app_metadata, а именно оттуда роль
 * попадает в профиль. Если ограничение когда-нибудь снимут, приглашение
 * молча создало бы администратора платформы.
 */
function isCompanyRole(value: string): value is CompanyRole {
  return value === 'CARRIER' || value === 'SHIPPER';
}

export async function rejectCompanyAction(formData: FormData): Promise<void> {
  const locale = toLocale(formData.get('locale'));
  await requireAdmin();

  const supabase = await createClient();
  await supabase.rpc('moderate_company', {
    p_company_id: String(formData.get('company_id') ?? ''),
    p_decision: 'REJECTED',
    p_note: String(formData.get('reason') ?? '').trim() || undefined,
  });

  revalidatePath(`/${locale}/admin`);
}

export async function resendInviteAction(formData: FormData): Promise<void> {
  const locale = toLocale(formData.get('locale'));
  await requireAdmin();

  const companyId = String(formData.get('company_id') ?? '');
  const supabase = await createClient();

  const { data: company } = await supabase
    .from('companies')
    .select('contact_email, kind')
    .eq('id', companyId)
    .single();

  if (company && isCompanyRole(company.kind)) {
    await sendInvite(companyId, company.contact_email, company.kind);
  }

  revalidatePath(`/${locale}/admin`);
}

/**
 * Удаление компании из разобранных заявок.
 *
 * Функция базы отказывается удалять компанию с заказами: внешние ключи
 * стоят с каскадом, и удаление заказчика унесло бы вместе с ним все его
 * рейсы, накладные и суммы, по которым выставлены счета.
 *
 * Учётные записи снимаются здесь, а не в SQL: auth.users каскадом не
 * удаляется и доступна только админскому ключу. Порядок обратный
 * очевидному — сначала база отдаёт список пользователей и удаляет свои
 * строки, потом снимаются аккаунты. Если второй шаг не дойдёт, останется
 * учётка без профиля: она не войдёт никуда, потому что роль лежит в
 * app_metadata и проверяется по компании, которой уже нет.
 */
export async function deleteCompanyAction(formData: FormData): Promise<void> {
  const locale = toLocale(formData.get('locale'));
  await requireAdmin();

  const companyId = String(formData.get('company_id') ?? '');
  const supabase = await createClient();

  const { data: userIds, error } = await supabase.rpc('delete_company', {
    p_company_id: companyId,
  });

  if (error) {
    console.error('Компания не удалена:', error.message);
    revalidatePath(`/${locale}/admin`);
    return;
  }

  const admin = createAdminClient();
  for (const userId of userIds ?? []) {
    const { error: authError } = await admin.auth.admin.deleteUser(userId);
    if (authError) {
      console.error('Учётная запись не снята:', authError.message);
    }
  }

  revalidatePath(`/${locale}/admin`);
}


/**
 * Приглашение пользователя компании.
 *
 * Роль и компания кладутся в app_metadata: это единственное место, где
 * их можно записать так, чтобы пользователь не мог подменить их сам.
 * Триггер в базе увидит появление роли и создаст профиль.
 *
 * inviteUserByEmail сам app_metadata не принимает — только user_metadata,
 * которое пользователю доступно на запись. Поэтому метаданные ставятся
 * отдельным вызовом сразу после приглашения.
 */
async function sendInvite(companyId: string, email: string, role: CompanyRole): Promise<boolean> {
  const admin = createAdminClient();
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

  /*
   * Язык берётся из настроек, а не прошит строкой. Здесь стояло «/ru» —
   * локали, которой в проекте больше нет: ссылка из письма вела на
   * несуществующий адрес и держалась только на правиле перенаправления
   * снятых языков.
   */
  const l = defaultLocale;

  const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${site}/${l}/auth/confirm?next=${encodeURIComponent(`/${l}/set-password`)}`,
  });

  if (error || !data?.user) {
    console.error('Приглашение не отправлено:', error?.message);
    return false;
  }

  const { error: metaError } = await admin.auth.admin.updateUserById(data.user.id, {
    app_metadata: { role, company_id: companyId },
  });

  if (metaError) {
    console.error('Не удалось записать app_metadata:', metaError.message);
    return false;
  }

  return true;
}

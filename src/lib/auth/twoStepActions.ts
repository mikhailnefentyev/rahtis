'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { defaultLocale, getDictionary, isLocale, type Dictionary, type Locale } from '@/lib/i18n';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { recordSignIn, stepUpRequired, verifyCode, type CodeResult } from './mfa';
import { accountPath, cabinetPath, noAccessPath, safeRedirect } from './paths';
import { cleanCode, qrDataUrl } from './twoStep';
import { getViewer } from './viewer';

/*
 * Двухэтапный вход (6.11.2026): шаг кода при входе, подключение и
 * отключение, «подтвердите кодом» перед важным действием и сброс —
 * главным пользователем компании или поддержкой RAHTIS.
 *
 * Supabase MFA (TOTP): фактор и проверку кода держит Supabase Auth,
 * у нас только формы. Резервных кодов у Supabase нет — потерянный
 * телефон сбрасывает главный пользователь или поддержка (с записью в
 * журнал), и человек подключает приложение заново.
 */

export type CodeState = { error: string | null; done: boolean };

function toLocale(value: FormDataEntryValue | null): Locale {
  const raw = String(value ?? '');
  return isLocale(raw) ? raw : defaultLocale;
}

function codeError(t: Dictionary, result: CodeResult): string {
  if (result === 'wrong') return t.twoStep.wrongCode;
  if (result === 'throttled') return t.twoStep.tooMany;
  return t.twoStep.failed;
}

/** Шаг кода после пароля или ссылки из письма. */
export async function verifySignInCodeAction(_previous: CodeState, formData: FormData): Promise<CodeState> {
  const locale = toLocale(formData.get('locale'));
  const t = await getDictionary(locale);

  const code = cleanCode(String(formData.get('code') ?? ''));
  if (!code) return { error: t.twoStep.badCode, done: false };

  const result = await verifyCode(code);
  if (result !== 'ok') return { error: codeError(t, result), done: false };

  await recordSignIn(locale);

  const viewer = await getViewer();
  const fallback = viewer.status === 'ready' ? cabinetPath(locale, viewer.role) : noAccessPath(locale);
  redirect(safeRedirect(String(formData.get('next') ?? ''), fallback));
}

export type EnrolStart =
  | { ok: true; factorId: string; qr: string; secret: string }
  | { ok: false; error: string };

/**
 * Начать подключение: QR и ключ. Брошенные неподтверждённые факторы
 * убираются — иначе второй заход упрётся в занятое имя.
 */
export async function startEnrolAction(rawLocale: string): Promise<EnrolStart> {
  const locale = toLocale(rawLocale);
  const t = await getDictionary(locale);

  const viewer = await getViewer();
  const allowed = viewer.status === 'ready' || (viewer.status === 'mfa' && viewer.step === 'enrol');
  if (!allowed) return { ok: false, error: t.error.forbidden };
  if (viewer.status === 'ready' && viewer.twoStep) return { ok: false, error: t.twoStep.alreadyOn };

  const supabase = await createClient();
  const { data: factors } = await supabase.auth.mfa.listFactors();
  for (const factor of factors?.all ?? []) {
    if (factor.status !== 'verified') await supabase.auth.mfa.unenroll({ factorId: factor.id });
  }

  const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'RAHTIS', issuer: 'RAHTIS' });
  if (error || !data) {
    console.error('mfa enroll:', error?.code, error?.message);
    return { ok: false, error: t.twoStep.failed };
  }
  return { ok: true, factorId: data.id, qr: qrDataUrl(data.totp.qr_code), secret: data.totp.secret };
}

export type EnrolState = CodeState & { next: string | null };

/** Подтверждение подключения первым кодом; сессия сразу становится aal2. */
export async function confirmEnrolAction(_previous: EnrolState, formData: FormData): Promise<EnrolState> {
  const locale = toLocale(formData.get('locale'));
  const t = await getDictionary(locale);

  const factorId = String(formData.get('factor_id') ?? '');
  const code = cleanCode(String(formData.get('code') ?? ''));
  if (!factorId) return { error: t.twoStep.failed, done: false, next: null };
  if (!code) return { error: t.twoStep.badCode, done: false, next: null };

  /* Оператор, которого прислали подключать, после кода идёт в админку. */
  const before = await getViewer();
  const operator = before.status === 'mfa' && before.step === 'enrol';

  const result = await verifyCode(code, factorId);
  if (result !== 'ok') return { error: codeError(t, result), done: false, next: null };

  revalidatePath(accountPath(locale));
  return { error: null, done: true, next: operator ? cabinetPath(locale, 'ADMIN') : null };
}

/** Отключение — только со свежим кодом из того же приложения. */
export async function removeTwoStepAction(_previous: CodeState, formData: FormData): Promise<CodeState> {
  const locale = toLocale(formData.get('locale'));
  const t = await getDictionary(locale);

  const viewer = await getViewer();
  if (viewer.status !== 'ready' || !viewer.twoStep) return { error: t.error.forbidden, done: false };

  const code = cleanCode(String(formData.get('code') ?? ''));
  if (!code) return { error: t.twoStep.badCode, done: false };

  const result = await verifyCode(code);
  if (result !== 'ok') return { error: codeError(t, result), done: false };

  const supabase = await createClient();
  const { data: factors } = await supabase.auth.mfa.listFactors();
  for (const factor of factors?.all ?? []) {
    const { error } = await supabase.auth.mfa.unenroll({ factorId: factor.id });
    if (error) {
      console.error('mfa unenroll:', error.code, error.message);
      return { error: t.twoStep.failed, done: false };
    }
  }

  revalidatePath(accountPath(locale));
  return { error: null, done: true };
}

/** «Подтвердите кодом» перед важным действием; форма потом отправляется заново. */
export async function stepUpAction(_previous: CodeState, formData: FormData): Promise<CodeState> {
  const locale = toLocale(formData.get('locale'));
  const t = await getDictionary(locale);

  const viewer = await getViewer();
  if (viewer.status !== 'ready') return { error: t.error.forbidden, done: false };

  const code = cleanCode(String(formData.get('code') ?? ''));
  if (!code) return { error: t.twoStep.badCode, done: false };

  const result = await verifyCode(code);
  return result === 'ok' ? { error: null, done: true } : { error: codeError(t, result), done: false };
}

/** Снять все факторы пользователя служебным ключом и записать в журнал. */
async function resetFactors(
  userId: string,
  actor: { id: string; email: string | null },
  detail: Record<string, string>,
): Promise<boolean> {
  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.mfa.listFactors({ userId });
  if (error) {
    console.error('mfa admin list:', error.message);
    return false;
  }
  for (const factor of data?.factors ?? []) {
    const { error: deleteError } = await admin.auth.admin.mfa.deleteFactor({ id: factor.id, userId });
    if (deleteError) {
      console.error('mfa admin delete:', deleteError.message);
      return false;
    }
  }
  const { error: auditError } = await admin.from('audit_log').insert({
    actor_id: actor.id,
    actor_email: actor.email,
    action: 'two_step.reset',
    subject: `user:${userId}`,
    detail,
  });
  if (auditError) console.error('журнал сброса 2FA:', auditError.message);
  return true;
}

export type MemberResetState = CodeState & { stepUp?: boolean };

/** Главный пользователь сбрасывает двухэтапный вход диспетчеру (потерян телефон). */
export async function resetMemberTwoStepAction(_previous: MemberResetState, formData: FormData): Promise<MemberResetState> {
  const locale = toLocale(formData.get('locale'));
  const t = await getDictionary(locale);

  const viewer = await getViewer();
  if (viewer.status !== 'ready' || !viewer.company || viewer.profile.member_kind !== 'OWNER') {
    return { error: t.members.ownerOnly, done: false };
  }
  if (await stepUpRequired(viewer)) return { error: t.twoStep.stepUpNeeded, done: false, stepUp: true };

  const userId = String(formData.get('user_id') ?? '');
  if (!userId || userId === viewer.userId) return { error: t.error.forbidden, done: false };

  /* Только свой человек: список — та же функция, что на странице. */
  const supabase = await createClient();
  const { data: members } = await supabase.rpc('company_members');
  if (!(members ?? []).some((m) => m.user_id === userId)) return { error: t.error.forbidden, done: false };

  const ok = await resetFactors(userId, { id: viewer.userId, email: viewer.email }, { by: 'owner', company_id: viewer.company.id });
  if (!ok) return { error: t.twoStep.failed, done: false };

  revalidatePath(accountPath(locale));
  return { error: null, done: true };
}

/** Поддержка RAHTIS снимает двухэтапный вход пользователю компании. */
export async function adminResetTwoStepAction(formData: FormData): Promise<void> {
  const locale = toLocale(formData.get('locale'));
  const viewer = await getViewer();
  if (viewer.status !== 'ready' || viewer.role !== 'ADMIN') throw new Error('forbidden');

  const userId = String(formData.get('user_id') ?? '');
  const companyId = String(formData.get('company_id') ?? '');
  if (!userId) return;

  /* Пользователь должен принадлежать этой компании — сверяем по профилю. */
  const { data: profile } = await createAdminClient().from('profiles').select('company_id').eq('id', userId).maybeSingle();
  if (!profile || profile.company_id !== companyId) throw new Error('forbidden');

  await resetFactors(userId, { id: viewer.userId, email: viewer.email }, { by: 'support', company_id: companyId });
  revalidatePath(`/${locale}/admin/company/${companyId}`);
}

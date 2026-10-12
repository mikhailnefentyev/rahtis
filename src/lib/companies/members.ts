'use server';

import { revalidatePath } from 'next/cache';
import { confirmLink } from '@/lib/auth/links';
import { accountPath } from '@/lib/auth/paths';
import { getViewer } from '@/lib/auth/viewer';
import { siteUrl } from '@/lib/config';
import { operatorInbox, sendEmail } from '@/lib/email';
import { memberInviteEmail } from '@/lib/email/templates/memberInvite';
import { emailLocaleOf } from '@/lib/email/text';
import { getDictionary, isLocale, type Locale, defaultLocale } from '@/lib/i18n';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

/**
 * Диспетчеры компании: приглашение и удаление.
 *
 * Диспетчер — ещё один пользователь той же компании с той же ролью:
 * функции и допуски те же, пароль свой. Управляет ими только главный
 * пользователь (profiles.member_kind = 'OWNER').
 *
 * Пользователя в Auth заводит секретный ключ, а он RLS не подчиняется —
 * поэтому право проверяется здесь руками, до любого вызова под ключом.
 */

export type MemberState = { error: string | null; done: boolean };

/* Кабинет на одного-двух диспетчеров — норма; сотня приглашений — ошибка или злоупотребление. */
const MAX_MEMBERS = 20;

function toLocale(value: FormDataEntryValue | null): Locale {
  const raw = String(value ?? '');
  return isLocale(raw) ? raw : defaultLocale;
}

const str = (form: FormData, key: string): string => String(form.get(key) ?? '').trim();

/** Главный пользователь действующей компании — или null. */
async function requireOwner() {
  const viewer = await getViewer();
  if (viewer.status !== 'ready' || !viewer.company) return null;
  if (viewer.role !== 'CARRIER' && viewer.role !== 'SHIPPER') return null;
  if (viewer.profile.member_kind !== 'OWNER') return null;
  if (viewer.company.status === 'REJECTED' || viewer.company.frozen_at) return null;
  return { ...viewer, company: viewer.company, role: viewer.role };
}

export async function inviteMemberAction(_previous: MemberState, formData: FormData): Promise<MemberState> {
  const locale = toLocale(formData.get('locale'));
  const t = await getDictionary(locale);

  const owner = await requireOwner();
  if (!owner) return { error: t.members.ownerOnly, done: false };

  const fullName = str(formData, 'full_name').replace(/\s+/g, ' ');
  const email = str(formData, 'email').toLowerCase();

  if (fullName.length < 2 || fullName.length > 120) return { error: t.validation.required, done: false };
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { error: t.validation.email, done: false };

  const supabase = await createClient();
  const { data: members, error: listError } = await supabase.rpc('company_members');
  if (listError) return { error: t.error.generic, done: false };
  if ((members ?? []).length >= MAX_MEMBERS) return { error: t.members.tooMany, done: false };

  const admin = createAdminClient();

  /*
   * generateLink(invite) заводит пользователя и возвращает ссылку, письмо
   * шлём сами (почему — в companies/invite.ts). Занятая почта — отказ
   * Auth: у одного адреса один вход, и чужой аккаунт в компанию так не
   * перетянуть.
   */
  const { data, error } = await admin.auth.admin.generateLink({ type: 'invite', email });
  const user = data?.user;
  const hashedToken = data?.properties?.hashed_token;

  if (error || !user || !hashedToken) {
    const taken = /already|registered|exists/i.test(error?.message ?? '');
    if (!taken) console.error('Приглашение диспетчера не создано:', error?.message);
    return { error: taken ? t.members.emailTaken : t.error.generic, done: false };
  }

  /*
   * Роль, компания и вид участника — в app_metadata: записать его может
   * только секретный ключ. Триггер увидит роль и создаст профиль
   * диспетчера.
   */
  const { error: metaError } = await admin.auth.admin.updateUserById(user.id, {
    app_metadata: { role: owner.role, company_id: owner.company.id, member_kind: 'DISPATCHER' },
    user_metadata: { full_name: fullName },
  });

  if (metaError) {
    console.error('Не удалось записать app_metadata диспетчера:', metaError.message);
    /* Пользователь без роли остался бы в Auth навсегда и занял бы почту. */
    await admin.auth.admin.deleteUser(user.id);
    return { error: t.error.generic, done: false };
  }

  /*
   * Имя — прямо в профиль. Триггер срабатывает на запись app_metadata, а
   * user_metadata Auth пишет отдельным шагом, и профиль создавался без
   * имени: в списке диспетчер значился одной почтой (прогон 12.10.2026).
   */
  await admin.from('profiles').update({ full_name: fullName }).eq('id', user.id);

  await sendEmail(
    memberInviteEmail({
      to: email,
      toName: fullName,
      companyName: owner.company.name,
      companyId: owner.company.id,
      link: confirmLink({ site: siteUrl(), locale: defaultLocale, hashedToken, type: 'invite', next: '/set-password' }),
      operatorEmail: operatorInbox(),
      locale: emailLocaleOf(owner.company.language),
    }),
  );

  revalidatePath(accountPath(locale));
  return { error: null, done: true };
}

export async function removeMemberAction(_previous: MemberState, formData: FormData): Promise<MemberState> {
  const locale = toLocale(formData.get('locale'));
  const t = await getDictionary(locale);

  const owner = await requireOwner();
  if (!owner) return { error: t.members.ownerOnly, done: false };

  /* База проверяет ещё раз и снимает профиль: доступ пропадает в той же транзакции. */
  const supabase = await createClient();
  const { data: userId, error } = await supabase.rpc('remove_company_member', {
    p_user_id: str(formData, 'user_id'),
  });

  if (error || !userId) return { error: t.error.generic, done: false };

  /* Следом — сам пользователь: так гаснут его сессии и освобождается почта. */
  const { error: deleteError } = await createAdminClient().auth.admin.deleteUser(userId);
  if (deleteError) console.error('Пользователь диспетчера не удалён:', deleteError.message);

  revalidatePath(accountPath(locale));
  return { error: null, done: true };
}

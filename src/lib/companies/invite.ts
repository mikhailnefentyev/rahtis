import 'server-only';

import { confirmLink } from '@/lib/auth/links';
import { siteUrl } from '@/lib/config';
import { operatorInbox, sendEmail } from '@/lib/email';
import { inviteEmail } from '@/lib/email/templates/invite';
import { emailLocaleOf } from '@/lib/email/text';
import { defaultLocale } from '@/lib/i18n';
import { createAdminClient } from '@/lib/supabase/admin';
import type { CompanyRole } from '@/types/db';

/*
 * Вынесено из companies/actions.ts: приглашение шлёт и одобрение
 * заявки в админке, и напоминание тем, кто не открыл первое письмо
 * (companies/onboarding.ts). Ссылка каждый раз новая — старая живёт сутки.
 */

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
export async function sendInvite(
  companyId: string,
  companyName: string,
  email: string,
  role: CompanyRole,
  language: string | null,
): Promise<boolean> {
  const admin = createAdminClient();
  const site = siteUrl();
  const l = defaultLocale;

  /*
   * generateLink вместо inviteUserByEmail.
   *
   * inviteUserByEmail отправляет письмо сам — почтой Supabase, у которой
   * на проекте по умолчанию лимит в считанные письма в час, общий адрес
   * отправителя и репутация, из-за которой письма падают в спам. Именно
   * поэтому приглашения не доходили.
   *
   * generateLink делает ту же работу без отправки: заводит пользователя,
   * если его нет, и возвращает ссылку. Письмо дальше собираем и шлём мы
   * сами — на своём бланке и через свой провайдер. Почта Supabase из
   * цепочки уходит совсем.
   */
  const { data, error } = await admin.auth.admin.generateLink({
    type: 'invite',
    email,
    /* Ссылку строим сами: почему — в lib/auth/links.ts. */
  });

  const user = data?.user;
  const hashedToken = data?.properties?.hashed_token;

  const link = hashedToken
    ? confirmLink({ site, locale: l, hashedToken, type: 'invite', next: '/set-password' })
    : null;

  if (error || !user || !link) {
    console.error('Ссылка приглашения не создана:', error?.message);
    return false;
  }

  /*
   * Роль и компания кладутся в app_metadata: это единственное место, где
   * их можно записать так, чтобы пользователь не мог подменить их сам.
   * Триггер в базе увидит появление роли и создаст профиль.
   */
  const { error: metaError } = await admin.auth.admin.updateUserById(user.id, {
    app_metadata: { role, company_id: companyId },
  });

  if (metaError) {
    console.error('Не удалось записать app_metadata:', metaError.message);
    return false;
  }

  const result = await sendEmail(
    inviteEmail({
      to: email,
      companyName,
      companyId,
      link,
      operatorEmail: operatorInbox(),
      locale: emailLocaleOf(language),
    }),
  );

  /*
   * Письмо в журнале есть в любом случае, даже когда провайдер —
   * заглушка. Оператор откроет журнал и скопирует ссылку вручную, пока
   * реальная отправка не подключена.
   */
  return result.outboxId !== null;
}

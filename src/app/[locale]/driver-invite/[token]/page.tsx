import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { acceptInviteAction } from '@/lib/driverApp/actions';
import { getI18n, isLocale } from '@/lib/i18n';
import { createAdminClient } from '@/lib/supabase/admin';

export const metadata: Metadata = {
  manifest: '/driver.webmanifest',
  robots: { index: false },
};

/**
 * Страница приглашения водителя.
 *
 * Открывается по ссылке, которую перевозчик прислал со своего телефона.
 * До нажатия ничего не происходит — только показывается, кого и кто
 * приглашает: превью ссылки в мессенджере не должно гасить приглашение.
 *
 * Токен проверяется служебным ключом: у гостя прав на приглашения нет, и
 * давать их незачем.
 */
export default async function DriverInvitePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; token: string }>;
  searchParams: Promise<{ invalid?: string; failed?: string }>;
}) {
  const [{ locale, token }, query] = await Promise.all([params, searchParams]);
  if (!isLocale(locale)) notFound();

  const { t, m } = await getI18n(locale);
  const { data } = await createAdminClient().rpc('driver_invite_lookup', { p_token: token });
  const invite = data?.[0] ?? null;

  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col items-center justify-center gap-5 bg-ground px-6 text-center text-ink">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/icon.png" alt="" className="size-20 rounded-2xl" />

      {!invite || query.invalid ? (
        <p className="text-[17px] leading-relaxed text-ink-muted">{t.driverApp.inviteInvalid}</p>
      ) : (
        <>
          <h1 className="text-2xl font-semibold tracking-tight">
            {m('driverApp.welcome', { name: invite.full_name })}
          </h1>
          <p className="text-[17px] text-ink-muted">
            {t.driverApp.inviteCompany}: <span className="font-semibold text-ink">{invite.company_name}</span>
          </p>

          {query.failed && <p className="text-[15px] text-danger">{t.driverApp.inviteFailed}</p>}

          <form action={acceptInviteAction} className="w-full">
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="token" value={token} />
            <button className="h-14 w-full rounded-control bg-accent text-[17px] font-semibold text-accent-ink">
              {t.driverApp.inviteButton}
            </button>
          </form>
        </>
      )}
    </main>
  );
}

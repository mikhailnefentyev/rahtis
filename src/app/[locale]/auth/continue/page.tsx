import type { Metadata } from 'next';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { Button, Card, CardBody } from '@/components/ui';
import { LocaleSwitch } from '@/components/layout/LocaleSwitch';
import { getI18n, isLocale } from '@/lib/i18n';
import { pageMetadata, samePath } from '@/lib/seo';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const { t } = await getI18n(locale);
  return pageMetadata({
    locale,
    paths: samePath('/auth/continue'),
    title: t.linkContinue.inviteTitle,
    description: t.linkContinue.inviteText,
    noindex: true,
  });
}

/**
 * Ссылка из письма открывается здесь, а не сразу входит.
 *
 * Одноразовый токен тратится по нажатию «Jatka»: форма уходит POST'ом в
 * /auth/confirm. Почтовые сканеры (Outlook, Hotmail) ссылку открывают,
 * но форму не отправляют — токен доживает до человека. Подробнее — в
 * комментарии к /auth/confirm/route.ts.
 *
 * Обычная HTML-форма без JavaScript: страница должна работать и в
 * почтовом браузере телефона, где скрипты бывают выключены.
 */
export default async function ContinuePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ token_hash?: string; type?: string; next?: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const { t } = await getI18n(locale);
  const { token_hash: tokenHash, type, next } = await searchParams;
  const recovery = type === 'recovery';

  return (
    <main className="relative flex flex-1 items-center justify-center px-5 py-12">
      <div className="absolute top-5 right-5">
        <LocaleSwitch current={locale} />
      </div>

      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <Image
            src="/logo.png"
            alt={t.brand.name}
            width={1117}
            height={281}
            priority
            className="mx-auto h-8 w-auto"
          />
          <p className="label-micro mt-2">{t.brand.tagline}</p>
        </div>

        <Card>
          <CardBody className="p-6">
            <h1 className="text-[15px] font-semibold tracking-tight">
              {recovery ? t.linkContinue.recoveryTitle : t.linkContinue.inviteTitle}
            </h1>
            <p className="mt-1.5 mb-5 text-[13px] leading-relaxed text-ink-muted">
              {recovery ? t.linkContinue.recoveryText : t.linkContinue.inviteText}
            </p>

            {tokenHash && type ? (
              <form method="post" action={`/${locale}/auth/confirm`}>
                <input type="hidden" name="token_hash" value={tokenHash} />
                <input type="hidden" name="type" value={type} />
                {next && <input type="hidden" name="next" value={next} />}
                <Button type="submit" variant="primary" className="w-full">
                  {t.linkContinue.continue}
                </Button>
              </form>
            ) : (
              <p role="alert" className="text-[13px] text-warn">
                {t.invite.linkExpired}
              </p>
            )}
          </CardBody>
        </Card>
      </div>
    </main>
  );
}

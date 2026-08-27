import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { CabinetHeader } from '@/components/layout/CabinetHeader';
import { LocaleSwitch } from '@/components/layout/LocaleSwitch';
import { Badge, Card, CardBody, Kv, Mono } from '@/components/ui';
import { companyStatusTone } from '@/components/ui/tone';
import { noAccessPath, signInPath } from '@/lib/auth/paths';
import { getViewer } from '@/lib/auth/viewer';
import { getI18n, isLocale } from '@/lib/i18n';
import { RequisitesForm } from '../requisites/form';
import { ChangePasswordForm } from './form';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const { t } = await getI18n(locale);
  return { title: t.account.title };
}

/**
 * Свои данные: доступ человека и реквизиты его компании.
 *
 * Раньше это были две страницы — «Oma tili» с паролем и «Yritystiedot» с
 * IBAN, каждая со своей ссылкой в шапке. Разделяло их рассуждение, что
 * пароль личный, а счёт бухгалтерский. На практике и то и другое правит
 * один и тот же человек и по одному поводу: «поправить свои данные». Две
 * ссылки заставляли гадать, за какой из них лежит нужное поле.
 *
 * Порядок обратный прежнему приоритету: реквизиты выше пароля. Пароль
 * меняют раз в год, счёт и адрес — когда меняется банк или офис, и
 * приходят сюда обычно за ними.
 *
 * Раздел общий для всех трёх ролей. У оператора компании нет, поэтому
 * вторая половина у него просто отсутствует.
 */
export default async function AccountPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const viewer = await getViewer();
  if (viewer.status === 'guest') redirect(signInPath(locale, `/${locale}/account`));

  const { t } = await getI18n(locale);

  /* Отклонённой компании тут править нечего — реквизиты ей не помогут. */
  const company =
    viewer.status === 'ready' && viewer.company?.status !== 'REJECTED' ? viewer.company : null;

  return (
    <>
      {/*
        * Своя шапка кабинета, а не ссылка «назад»: раздел открывают из
        * кабинета и в кабинет же возвращаются, и терять по дороге вкладки
        * незачем. У пользователя без профиля роли нет — ему остаётся
        * прежняя минимальная шапка.
        */}
      {viewer.status === 'ready' ? (
        <CabinetHeader locale={locale} role={viewer.role} company={viewer.company} />
      ) : (
        <nav className="mx-auto flex w-full max-w-2xl items-center justify-between gap-4 px-5 pt-8">
          <Link href={noAccessPath(locale)} className="text-[13px] text-ink-muted hover:text-ink">
            ← {t.brand.operator}
          </Link>
          <LocaleSwitch current={locale} />
        </nav>
      )}

      <main className="mx-auto w-full max-w-3xl px-5 py-8">
        <h1 className="text-xl font-semibold tracking-tight">{t.account.title}</h1>

        <div className="mt-6 flex flex-col gap-4">
          <Card>
            <CardBody className="flex flex-col gap-1.5">
              <Kv k={t.company.email} v={<Mono>{viewer.email}</Mono>} />
              {viewer.status === 'ready' && (
                <>
                  <Kv k={t.cabinet.yourRole} v={t.role[viewer.role]} />
                  {viewer.company && <Kv k={t.cabinet.company} v={viewer.company.name} />}
                </>
              )}
            </CardBody>
          </Card>

          {company && (
            <section className="flex flex-col gap-4">
              <div className="flex flex-wrap items-center gap-2.5">
                <h2 className="text-[15px] font-semibold tracking-tight">{t.requisites.title}</h2>
                <Badge tone={companyStatusTone[company.status]}>
                  {t.companyStatus[company.status]}
                </Badge>
              </div>
              <p className="max-w-xl text-[13px] leading-relaxed text-ink-muted">
                {company.status === 'ACTIVE'
                  ? t.requisites.alreadyActive
                  : company.kind === 'CARRIER'
                    ? t.requisites.subtitleCarrier
                    : t.requisites.subtitleShipper}
              </p>

              <RequisitesForm company={company} />
            </section>
          )}

          <Card>
            <CardBody className="flex flex-col gap-4">
              <div>
                <h2 className="text-[15px] font-semibold tracking-tight">
                  {t.account.passwordTitle}
                </h2>
                <p className="mt-1.5 text-[13px] leading-relaxed text-ink-muted">
                  {t.account.passwordHint}
                </p>
              </div>

              <ChangePasswordForm />
            </CardBody>
          </Card>
        </div>
      </main>
    </>
  );
}

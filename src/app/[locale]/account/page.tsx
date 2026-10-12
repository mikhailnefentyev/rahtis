import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { CabinetShell } from '@/components/layout/CabinetShell';
import { LocaleSwitch } from '@/components/layout/LocaleSwitch';
import { Badge, Card, CardBody, Kv, Mono } from '@/components/ui';
import { companyStatusTone } from '@/components/ui/tone';
import { noAccessPath, signInPath } from '@/lib/auth/paths';
import { getViewer } from '@/lib/auth/viewer';
import { getI18n, isLocale } from '@/lib/i18n';
import { lookupAddress } from '@/lib/registry/prh';
import { RequisitesForm } from '../requisites/form';
import { createClient } from '@/lib/supabase/server';
import { ChangePasswordForm } from './form';
import { MembersPanel } from './MembersPanel';

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

  /* Своего адреса ещё нет — подставляем из реестра PRH (финская компания). */
  const prefill =
    company && !company.legal_street && company.business_id && (company.country ?? 'FI') === 'FI'
      ? await lookupAddress(company.business_id)
      : null;

  /*
   * Люди компании. У оператора компании нет; до миграции функции тоже
   * нет — тогда раздела просто не видно.
   */
  const { data: members } =
    viewer.status === 'ready' && company ? await (await createClient()).rpc('company_members') : { data: null };
  const isOwner = viewer.status === 'ready' && viewer.profile.member_kind !== 'DISPATCHER';

  const content = (
    <main className="cab-page cab-page--narrow">
      <h1 className="page-title">{t.account.title}</h1>

      <div className="mt-6 flex flex-col gap-4">
        <Card>
          <CardBody className="flex flex-col gap-1.5">
            <Kv k={t.company.email} v={<Mono>{viewer.email}</Mono>} />
            {viewer.status === 'ready' && (
              <>
                <Kv
                  k={t.cabinet.yourRole}
                  v={
                    viewer.company && !isOwner
                      ? `${t.role[viewer.role]} · ${t.members.dispatcher}`
                      : t.role[viewer.role]
                  }
                />
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

            <RequisitesForm company={company} prefill={prefill} />
          </section>
        )}

        {/*
          * Документы компании собраны в одном месте кабинета.
          *
          * Общие два лежат на витрине: их читают до регистрации. Свой
          * договор — здесь и только здесь: ставки, простой и сроки
          * оплаты касаются сторон, а не прохожих. У оператора этого
          * блока нет — он правит документы в разделе «Asiakirjat ja
          * versiot».
          */}
        {company && (
          <Card>
            <CardBody className="flex flex-col gap-3">
              <h2 className="text-[15px] font-semibold tracking-tight">
                {t.legal.ownDocuments}
              </h2>
              <div className="flex flex-col gap-2 text-[13px]">
                <Link
                  href={`/${locale}/${company.kind === 'CARRIER' ? 'carrier' : 'shipper'}/terms`}
                  className="font-semibold text-accent hover:underline"
                >
                  {company.kind === 'CARRIER' ? t.legal.CARRIER_AGREEMENT : t.legal.SHIPPER_AGREEMENT}
                </Link>
                <Link
                  href={`/${locale}/${locale === 'fi' ? 'kayttoehdot' : 'terms'}`}
                  className="text-ink-muted hover:text-ink"
                >
                  {t.legal.TERMS}
                </Link>
                <Link
                  href={`/${locale}/${locale === 'fi' ? 'tietosuoja' : 'privacy'}`}
                  className="text-ink-muted hover:text-ink"
                >
                  {t.legal.PRIVACY}
                </Link>
              </div>
            </CardBody>
          </Card>
        )}

        {viewer.status === 'ready' && company && members && (
          <Card>
            <CardBody className="flex flex-col gap-4">
              <div>
                <h2 className="text-[15px] font-semibold tracking-tight">{t.members.title}</h2>
                {isOwner && <p className="mt-1.5 text-[13px] leading-relaxed text-ink-muted">{t.members.hint}</p>}
              </div>

              <MembersPanel members={members} selfId={viewer.userId} canManage={isOwner} />
            </CardBody>
          </Card>
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
  );

  /*
   * У вошедшего с ролью — каркас кабинета: раздел открывают из кабинета
   * и в кабинет же возвращаются. У пользователя без профиля роли нет —
   * ему остаётся прежняя минимальная шапка.
   */
  if (viewer.status === 'ready') {
    return (
      <CabinetShell locale={locale} role={viewer.role} company={viewer.company}>
        {content}
      </CabinetShell>
    );
  }

  return (
    <>
      <nav className="mx-auto flex w-full max-w-2xl items-center justify-between gap-4 px-5 pt-8">
        <Link href={noAccessPath(locale)} className="text-[13px] text-ink-muted hover:text-ink">
          ← {t.brand.operator}
        </Link>
        <LocaleSwitch current={locale} />
      </nav>
      {content}
    </>
  );
}

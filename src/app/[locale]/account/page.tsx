import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { CabinetShell } from '@/components/layout/CabinetShell';
import { LocaleSwitch } from '@/components/layout/LocaleSwitch';
import { Badge, Card, CardBody, Kv, Mono } from '@/components/ui';
import { companyStatusTone } from '@/components/ui/tone';
import { noAccessPath, signInPath } from '@/lib/auth/paths';
import { getViewer } from '@/lib/auth/viewer';
import { isLocale } from '@/lib/i18n';
import { lookupCompany } from '@/lib/registry/prh';
import { RequisitesForm } from '../requisites/form';
import { createClient } from '@/lib/supabase/server';
import { ChangePasswordForm } from './form';
import { MembersPanel } from './MembersPanel';
import { WasteRegistrationsForm } from './WasteRegistrationsForm';
import { CurrencyForm } from './CurrencyForm';
import { ForwarderPanel } from './ForwarderPanel';
import { ShipperDocumentsPanel } from './ShipperDocumentsPanel';
import { SHIPPER_DOC_KINDS } from '@/lib/shipper-docs/model';
import { loadForwarderState } from '@/lib/forwarders/status';
import { ShipperTrustDetails } from '@/components/domain/ShipperTrust';
import { loadCompanyTrust } from '@/lib/trust/status';
import { parseRegistrations } from '@/lib/waste/registrations';
import { getViewerI18n } from '@/lib/i18n/viewer';
import { TwoStepPanel } from '@/components/domain/TwoStep';
import { APP } from '@/lib/config';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const { t } = await getViewerI18n(locale);
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
  if (viewer.status === 'mfa' && viewer.step === 'code') redirect(signInPath(locale, `/${locale}/account`));

  const { t, f } = await getViewerI18n(locale);

  /*
   * Двухэтапный вход и последние входы (6.11.2026). Дата подключения —
   * из факторов Supabase; устройства — свои строки sign_in_devices.
   */
  const security = viewer.status === 'ready' || viewer.status === 'mfa';
  const sessionClient = await createClient();
  const [factorAt, devices] = security
    ? await Promise.all([
        sessionClient.auth
          .getUser()
          .then(({ data }) => (data.user?.factors ?? []).find((x) => x.status === 'verified')?.created_at ?? null),
        sessionClient
          .from('sign_in_devices')
          .select('id, label, country, last_seen')
          .order('last_seen', { ascending: false })
          .limit(5)
          .then((r) => r.data ?? []),
      ])
    : [null, []];
  const twoStepCard = security && (
    <Card id="two-step" className="scroll-mt-24">
      <CardBody className="flex flex-col gap-5">
        <TwoStepPanel
          enabled={viewer.status === 'ready' && viewer.twoStep}
          enabledAt={factorAt}
          required={viewer.status === 'mfa' || (viewer.status === 'ready' && viewer.role === 'ADMIN')}
          support={APP.operator.email}
        />
        {devices.length > 0 && (
          <div className="flex flex-col gap-2 border-t border-line pt-4">
            <h3 className="label-micro">{t.twoStep.devicesTitle}</h3>
            <ul className="flex flex-col gap-1 text-[13px]">
              {devices.map((d) => (
                <li key={d.id} className="flex flex-wrap gap-x-2 text-ink-muted">
                  <span className="text-ink">{d.label}</span>
                  {d.country && <span>{d.country}</span>}
                  <span className="text-ink-dim">{t.twoStep.lastSeen.replace('{date}', f.dateTime(d.last_seen))}</span>
                </li>
              ))}
            </ul>
            <p className="text-xs text-ink-faint">{t.twoStep.devicesHint}</p>
          </div>
        )}
      </CardBody>
    </Card>
  );

  /* Оператор без двухэтапного входа: здесь только подключение, остальное после. */
  if (viewer.status === 'mfa') {
    return (
      <>
        <nav className="mx-auto flex w-full max-w-2xl items-center justify-end gap-4 px-5 pt-8">
          <LocaleSwitch current={locale} />
        </nav>
        <main className="cab-page cab-page--narrow">
          <h1 className="page-title">{t.account.title}</h1>
          <div className="mt-6 flex flex-col gap-4">{twoStepCard}</div>
        </main>
      </>
    );
  }

  /* Отклонённой компании тут править нечего — реквизиты ей не помогут. */
  const company =
    viewer.status === 'ready' && viewer.company?.status !== 'REJECTED' ? viewer.company : null;

  /* Своего названия или адреса ещё нет — подставляем из реестра PRH (финская компания). */
  const registry =
    company && (!company.legal_street || !company.legal_name) && company.business_id && (company.country ?? 'FI') === 'FI'
      ? await lookupCompany(company.business_id)
      : null;
  const prefill = registry ? { name: registry.name, ...(registry.address ?? { street: '', postalCode: '', city: '' }) } : null;

  /*
   * Люди компании. У оператора компании нет; до миграции функции тоже
   * нет — тогда раздела просто не видно.
   */
  const [{ data: members }, { data: twoStepIds }] =
    viewer.status === 'ready' && company
      ? await Promise.all([sessionClient.rpc('company_members'), sessionClient.rpc('two_step_users', {})])
      : [{ data: null }, { data: null }];
  const isOwner = viewer.status === 'ready' && viewer.profile.member_kind !== 'DISPATCHER';

  /*
   * Заказчик: экспедитор или грузовладелец и полис экспедитора для
   * договора напрямую с перевозчиком (6.11.2026). Последние загруженные
   * документы — в любом статусе: экспедитор должен видеть и отказ.
   * Там же документы заказчика — выписка, налоги, право подписи.
   */
  const shipper = company && company.kind === 'SHIPPER' && company.status === 'ACTIVE' && !company.client_of ? company : null;
  const [forwarder, forwarderDocs] = shipper
    ? await Promise.all([
        loadForwarderState(),
        (await createClient())
          .from('company_documents')
          .select('*')
          .in('kind', ['FORWARDER_INSURANCE', 'FORWARDER_LICENSE', ...SHIPPER_DOC_KINDS])
          .order('uploaded_at', { ascending: false })
          .limit(40)
          .then((r) => r.data ?? []),
      ])
    : [null, []];
  /* Что видят о заказчике перевозчики в прямом режиме — та же сводка, без имён отметивших. */
  const trust = shipper ? await loadCompanyTrust() : null;

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

        {/* Рабочая валюта компании (5.11.2026): деньги RAHTIS остаются в евро. */}
        {company && company.status === 'ACTIVE' && (company.kind === 'CARRIER' || company.kind === 'SHIPPER') && (
          <CurrencyForm currency={company.currency} kind={company.kind} canEdit={isOwner} />
        )}

        {shipper && (
          <ForwarderPanel
            role={shipper.shipper_role ?? 'FORWARDER'}
            canEditRole={isOwner}
            status={forwarder?.status ?? null}
            insurance={forwarderDocs.find((d) => d.kind === 'FORWARDER_INSURANCE') ?? null}
            license={forwarderDocs.find((d) => d.kind === 'FORWARDER_LICENSE') ?? null}
          />
        )}

        {/* Документы заказчика: по желанию, у экспедитора и грузовладельца (6.11.2026). */}
        {shipper && (
          <ShipperDocumentsPanel
            country={shipper.country ?? null}
            documents={forwarderDocs.filter((d) => (SHIPPER_DOC_KINDS as readonly string[]).includes(d.kind))}
          />
        )}

        {trust && (
          <Card>
            <CardBody>
              <h2 className="text-[15px] font-semibold tracking-tight">{t.trust.ownTitle}</h2>
              <p className="mt-1 mb-4 max-w-xl text-[13px] leading-relaxed text-ink-muted">{t.trust.ownIntro}</p>
              <ShipperTrustDetails trust={trust} />
            </CardBody>
          </Card>
        )}

        {/* Регистрации перевозчика отходов — только у перевозчика, печатаются в документах на отходы. */}
        {company && company.kind === 'CARRIER' && company.status === 'ACTIVE' && (
          <WasteRegistrationsForm registrations={parseRegistrations(company.waste_registrations)} />
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

              <MembersPanel
                members={members}
                selfId={viewer.userId}
                canManage={isOwner}
                twoStep={(twoStepIds ?? []).map((r) => r.user_id)}
              />
            </CardBody>
          </Card>
        )}

        {twoStepCard}

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

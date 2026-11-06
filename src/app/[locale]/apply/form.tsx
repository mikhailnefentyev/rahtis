'use client';

import { useActionState, useEffect, useRef, useState, useTransition } from 'react';
import { analytics } from '@heycatch/sdk';
import { Button, Card, CardBody, Field, Input, InputMono, Select } from '@/components/ui';
import { lookupApplicantAction, submitApplicationAction, type ApplyState } from '@/lib/companies/actions';
import { checkBusinessId, countryPack, enabledCountries, isCountryCode, type CountryCode } from '@/lib/country';
import { useI18n } from '@/lib/i18n/provider';
import type { ApplyInvite } from '@/lib/partners/invites';
import type { CompanyRole } from '@/types/db';
import { useKeepOnError } from '@/lib/forms/keepOnError';

const initial: ApplyState = { error: null, done: false };

export function ApplyForm({
  invite = null,
  defaultKind = 'CARRIER',
}: {
  invite?: ApplyInvite | null;
  /* Ссылка «julkaise oma kuljetuksesi» со страницы отслеживания открывает ветку заказчика. */
  defaultKind?: CompanyRole;
}) {
  const { t, m } = useI18n();
  const { locale } = useI18n();
  const [state, formAction, pending] = useActionState(submitApplicationAction, initial);
  const keepFormAction = useKeepOnError(state);

  const [kind, setKind] = useState<CompanyRole>(invite?.kind ?? defaultKind);
  /*
   * Ветка перевозчика. По умолчанию подряд: он ничего не стоит, пока
   * нет работы, и человек, пришедший «посмотреть», не должен случайно
   * подписаться на ежемесячный счёт.
   */
  const [mode, setMode] = useState<'SUBCONTRACTOR' | 'SUBSCRIBER'>('SUBCONTRACTOR');
  /*
   * Заказчик: экспедитор или грузовладелец (6.11.2026). От этого зависит,
   * нужен ли полис экспедитора для договора напрямую с перевозчиком.
   * По умолчанию экспедитор — заявка называется «Huolitsijan hakemus».
   */
  const [shipperRole, setShipperRole] = useState<'FORWARDER' | 'CARGO_OWNER'>('FORWARDER');
  const [name, setName] = useState(invite?.name ?? '');
  /*
   * Страна компании — от неё номер (Y-tunnus, NIP, USt-IdNr.…), его
   * проверка и реестр, с которым сверяет оператор. Финляндия первой:
   * так было до пакетов стран, и приглашения перевозчиков — финские.
   */
  const [country, setCountry] = useState<CountryCode>(isCountryCode(invite?.country) ? invite.country : 'FI');
  const [businessId, setBusinessId] = useState(invite?.businessId ?? '');
  const [vatNumber, setVatNumber] = useState('');
  const [email, setEmail] = useState(invite?.email ?? '');

  /*
   * Название по Y-tunnus из YTJ. Подставляется, если поле пустое или в нём
   * то, что раньше подставили сами: набранное руками не затираем.
   */
  const [ytj, setYtj] = useState<'idle' | 'found' | 'missing'>('idle');
  const [looking, startLookup] = useTransition();
  const asked = useRef(invite?.businessId ?? '');
  const filledName = useRef('');
  function lookupName(raw: string) {
    const value = raw.trim();
    if (value === asked.current) return;
    asked.current = value;
    if (country !== 'FI' || !/^\d{7}-?\d$/.test(value)) return setYtj('idle');
    startLookup(async () => {
      const result = await lookupApplicantAction(value);
      if (!result) return setYtj('idle');
      if (!result.found) return setYtj('missing');
      setName((current) => (current.trim() === '' || current === filledName.current ? result.name : current));
      filledName.current = result.name;
      setBusinessId(result.businessId);
      asked.current = result.businessId;
      setYtj('found');
    });
  }
  const ytjHint = looking ? t.sites.ytjLoading : ytj === 'found' ? t.apply.ytjFound : ytj === 'missing' ? t.sites.ytjMissing : t.apply.ytjHint;

  /* Итог для аналитики: только тип и страна, без названия и почты. Без согласия — ничего не уходит. */
  useEffect(() => {
    if (state.done) analytics.trackEvent('application_submitted', { kind, mode: kind === 'CARRIER' ? mode : null, country });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- одно событие на отправку
  }, [state.done]);

  if (state.done) {
    /*
     * Итог сверки с реестром — сразу, пока человек ещё на странице.
     * Нашёлся с тем же названием — «ок, ждите проверки». Нашёлся с другим —
     * показываем, что в реестре: опечатку в Y-tunnus лучше заметить сейчас.
     * Не нашёлся (toiminimi нет в открытых данных) или реестр молчит —
     * нейтральное «проверим вручную», не ошибка.
     */
    const registry = state.registry;
    const registryText =
      registry?.officialName && registry.nameMatch !== 'DIFFERENT'
        ? m('apply.registryOk', { name: registry.officialName })
        : registry?.officialName
          ? m('apply.registryOther', { name: registry.officialName })
          : t.apply.registryManual;

    return (
      <Card stripe="ok">
        <CardBody className="p-6">
          <h1 className="text-[15px] font-semibold tracking-tight">{t.apply.sentTitle}</h1>
          <p className="mt-2 text-[13px] leading-relaxed text-ink-muted">
            {m('signup.submitted', { company: name, businessId, email })}
          </p>
          <p
            className={
              registry?.nameMatch === 'DIFFERENT'
                ? 'mt-3 rounded-control border border-warn/35 bg-warn/10 px-3 py-2 text-[13px] leading-relaxed text-warn'
                : 'mt-3 text-[13px] leading-relaxed text-ink'
            }
          >
            {registryText}
          </p>
          <p className="mt-3 text-[13px] leading-relaxed text-ink-muted">
            {kind === 'CARRIER' ? t.apply.carrierNote : t.apply.shipperNote}
          </p>
        </CardBody>
      </Card>
    );
  }

  /* Номер компании проверяем до отправки — сервер проверит ещё раз. */
  const pack = countryPack(country);
  const businessIdError =
    businessId.length > 0 && !checkBusinessId(country, businessId).valid
      ? m('validation.businessIdFor', { label: pack.businessId.label, example: pack.businessId.example })
      : undefined;
  /* Номер плательщика НДС спрашиваем только там, где он не выводится из номера компании (EE, LT). */
  const askVat = pack.registry === 'VIES' && !pack.vatFromBusinessId;
  const regionName = new Intl.DisplayNames([locale], { type: 'region' });

  return (
    <Card>
      <CardBody className="p-6">
        <h1 className="text-[15px] font-semibold tracking-tight">{t.apply.title}</h1>
        <p className="mt-1.5 mb-5 text-[13px] leading-relaxed text-ink-muted">
          {t.apply.subtitle}
        </p>

        <form {...keepFormAction} action={formAction} className="flex flex-col gap-4">
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="kind" value={kind} />
          <input type="hidden" name="partnership" value={mode} />
          <input type="hidden" name="shipper_role" value={shipperRole} />
          {invite && <input type="hidden" name="invite" value={invite.token} />}
          {invite && (
            <p className="rounded-control border border-accent-line bg-accent-wash px-3 py-2 text-[13px] leading-relaxed text-ink">
              {invite.carrierName
                ? (invite.kind === 'CARRIER' ? t.apply.invitedByCarrier : t.apply.invitedBy).replace('{carrier}', invite.carrierName)
                : t.apply.invitedByRahtis}
            </p>
          )}

          <div
            role="radiogroup"
            aria-label={t.apply.title}
            className="grid grid-cols-2 gap-1 rounded-control border border-line bg-sunken p-1"
          >
            {(
              [
                ['CARRIER', t.apply.iAmCarrier],
                ['SHIPPER', t.apply.iAmShipper],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={kind === value}
                onClick={() => setKind(value)}
                className={
                  kind === value
                    ? 'cursor-pointer rounded-[4px] bg-accent px-3 py-2 text-[13px] font-semibold text-accent-ink'
                    : 'cursor-pointer rounded-[4px] px-3 py-2 text-[13px] font-semibold text-ink-faint transition-colors duration-150 hover:text-ink'
                }
              >
                {label}
              </button>
            ))}
          </div>

          {/*
            * Ветка нужна только перевозчику: заказчик ничего не платит
            * помесячно, и спрашивать его об этом не о чем.
            */}
          {kind === 'CARRIER' && (
            <div className="flex flex-col gap-2">
              <span className="label-micro">{t.apply.howTitle}</span>
              {(
                [
                  ['SUBCONTRACTOR', t.apply.howCon, t.apply.howConText],
                  ['SUBSCRIBER', t.apply.howSub, t.apply.howSubText],
                ] as const
              ).map(([value, label, text]) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={mode === value}
                  onClick={() => setMode(value)}
                  className={
                    mode === value
                      ? 'cursor-pointer rounded-control border border-accent bg-accent/5 p-3 text-left'
                      : 'cursor-pointer rounded-control border border-line p-3 text-left transition-colors duration-150 hover:border-ink-dim'
                  }
                >
                  <span className="block text-[13px] font-semibold tracking-tight">{label}</span>
                  <span className="mt-1 block text-[12px] leading-relaxed text-ink-muted">{text}</span>
                </button>
              ))}
              <p className="text-[12px] leading-relaxed text-ink-dim">{t.apply.howNote}</p>
            </div>
          )}

          {kind === 'SHIPPER' && (
            <div className="flex flex-col gap-2">
              <span className="label-micro">{t.forwarder.applyRoleTitle}</span>
              {(
                [
                  ['FORWARDER', t.forwarder.FORWARDER, t.forwarder.forwarderHint],
                  ['CARGO_OWNER', t.forwarder.CARGO_OWNER, t.forwarder.cargoOwnerHint],
                ] as const
              ).map(([value, label, text]) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={shipperRole === value}
                  onClick={() => setShipperRole(value)}
                  className={
                    shipperRole === value
                      ? 'cursor-pointer rounded-control border border-accent bg-accent/5 p-3 text-left'
                      : 'cursor-pointer rounded-control border border-line p-3 text-left transition-colors duration-150 hover:border-ink-dim'
                  }
                >
                  <span className="block text-[13px] font-semibold tracking-tight">{label}</span>
                  <span className="mt-1 block text-[12px] leading-relaxed text-ink-muted">{text}</span>
                </button>
              ))}
            </div>
          )}

          <Field label={t.company.country} required>
            {(p) => (
              <Select {...p} name="country" value={country} onChange={(e) => setCountry(e.target.value as CountryCode)}>
                {enabledCountries().map((code) => (
                  <option key={code} value={code}>
                    {regionName.of(code) ?? code}
                  </option>
                ))}
              </Select>
            )}
          </Field>

          <Field label={pack.businessId.label} required error={businessIdError} hint={country === 'FI' ? ytjHint : undefined}>
            {(p) => (
              <InputMono
                {...p}
                name="business_id"
                value={businessId}
                onChange={(e) => {
                  setBusinessId(e.target.value);
                  if (/^\d{7}-\d$/.test(e.target.value.trim())) lookupName(e.target.value);
                }}
                onBlur={(e) => lookupName(e.currentTarget.value)}
                placeholder={pack.businessId.example}
                required
              />
            )}
          </Field>

          {/*
            * Название после номера: у финской компании оно подставляется
            * из YTJ по Y-tunnus, и вводить его первым значило бы печатать
            * то, что форма знает сама.
            */}
          <Field label={t.company.name} required>
            {(p) => (
              <Input
                {...p}
                name="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nieminen Kuljetus Oy"
                required
              />
            )}
          </Field>

          {askVat && (
            <Field label={t.company.vatNumber} required hint={t.company.vatNumberHint}>
              {(p) => (
                <InputMono
                  {...p}
                  name="vat_number"
                  value={vatNumber}
                  onChange={(e) => setVatNumber(e.target.value)}
                  placeholder={`${country}123456789`}
                  required
                />
              )}
            </Field>
          )}

          <Field label={t.company.email} required hint={t.company.emailHint}>
            {(p) => (
              <Input
                {...p}
                name="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ops@company.fi"
                required
              />
            )}
          </Field>

          <p className="rounded-control border border-line bg-sunken px-3 py-2.5 text-xs leading-relaxed text-ink-muted">
            {kind === 'CARRIER' ? t.apply.carrierNote : t.apply.shipperNote}
          </p>

          {state.error && (
            <p
              role="alert"
              className="rounded-control border border-danger/35 bg-danger/10 px-3 py-2 text-[13px] text-danger"
            >
              {state.error}
            </p>
          )}

          <Button
            type="submit"
            variant="primary"
            size="lg"
            className="w-full"
            disabled={pending || Boolean(businessIdError)}
          >
            {pending ? t.apply.submitting : t.apply.submit}
          </Button>
        </form>
      </CardBody>
    </Card>
  );
}

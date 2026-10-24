'use client';

import { useActionState, useEffect, useState } from 'react';
import { analytics } from '@heycatch/sdk';
import { Button, Card, CardBody, Field, Input, InputMono, Select } from '@/components/ui';
import { submitApplicationAction, type ApplyState } from '@/lib/companies/actions';
import { checkBusinessId, countryPack, enabledCountries, isCountryCode, type CountryCode } from '@/lib/country';
import { useI18n } from '@/lib/i18n/provider';
import type { ApplyInvite } from '@/lib/partners/invites';
import type { CompanyRole } from '@/types/db';
import { useKeepOnError } from '@/lib/forms/keepOnError';

const initial: ApplyState = { error: null, done: false };

export function ApplyForm({ invite = null }: { invite?: ApplyInvite | null }) {
  const { t, m } = useI18n();
  const { locale } = useI18n();
  const [state, formAction, pending] = useActionState(submitApplicationAction, initial);
  const keepFormAction = useKeepOnError(state);

  const [kind, setKind] = useState<CompanyRole>(invite?.kind ?? 'CARRIER');
  /*
   * Ветка перевозчика. По умолчанию подряд: он ничего не стоит, пока
   * нет работы, и человек, пришедший «посмотреть», не должен случайно
   * подписаться на ежемесячный счёт.
   */
  const [mode, setMode] = useState<'SUBCONTRACTOR' | 'SUBSCRIBER'>('SUBCONTRACTOR');
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

          <Field label={pack.businessId.label} required error={businessIdError}>
            {(p) => (
              <InputMono
                {...p}
                name="business_id"
                value={businessId}
                onChange={(e) => setBusinessId(e.target.value)}
                placeholder={pack.businessId.example}
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

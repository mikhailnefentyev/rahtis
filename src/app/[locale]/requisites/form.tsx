'use client';

import { useActionState, useState } from 'react';
import {
  Badge,
  Button,
  Card,
  CardBody,
  Field,
  Input,
  InputMono,
  SectionTitle,
} from '@/components/ui';
import {
  deriveFinnishOvt,
  deriveFinnishVat,
  formatIban,
  isValidBic,
  isValidIban,
  isValidVatNumber,
} from '@/lib/banking';
import { saveRequisitesAction, type RequisitesState } from '@/lib/companies/requisites';
import { useI18n } from '@/lib/i18n/provider';
import type { Company } from '@/types/db';

const initial: RequisitesState = { error: null, done: false };

export function RequisitesForm({ company }: { company: Company }) {
  const { t, locale } = useI18n();
  const [state, formAction, pending] = useActionState(saveRequisitesAction, initial);

  const isCarrier = company.kind === 'CARRIER';

  /*
   * Начальные значения: уже сохранённое, иначе выведенное из Y-tunnus.
   * Форму заполняют один раз и надолго — подставить то, что вычисляется,
   * дешевле, чем заставлять человека переписывать это с бумаги.
   */
  const [vat, setVat] = useState(company.vat_number ?? deriveFinnishVat(company.business_id));
  const [iban, setIban] = useState(company.iban ? formatIban(company.iban) : '');
  const [bic, setBic] = useState(company.bic ?? '');
  const [sameAddress, setSameAddress] = useState(!company.billing_street);

  const vatError = vat.trim() && !isValidVatNumber(vat) ? t.requisites.vatInvalid : undefined;
  const ibanError = iban.trim() && !isValidIban(iban) ? t.requisites.ibanInvalid : undefined;
  const bicError = bic.trim() && !isValidBic(bic) ? t.requisites.bicInvalid : undefined;
  const blocked = Boolean(vatError || ibanError || bicError);

  if (state.done) {
    return (
      <Card stripe="ok">
        <CardBody className="p-6">
          <div className="flex flex-wrap items-center gap-2.5">
            <h2 className="text-[15px] font-semibold tracking-tight">{t.requisites.saved}</h2>
            <Badge tone="ok">{t.companyStatus.ACTIVE}</Badge>
          </div>
          <p className="mt-2 text-[13px] leading-relaxed text-ink-muted">
            {t.requisites.alreadyActive}
          </p>
        </CardBody>
      </Card>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="locale" value={locale} />

      {/* ── Юридические данные ── */}
      <Card>
        <CardBody>
          <SectionTitle>{t.requisites.legalSection}</SectionTitle>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label={t.requisites.legalName}
              hint={t.requisites.legalNameHint}
              required
              className="sm:col-span-2"
            >
              {(p) => (
                <Input
                  {...p}
                  name="legal_name"
                  required
                  defaultValue={company.legal_name ?? company.name}
                />
              )}
            </Field>

            <Field label={t.requisites.street} required className="sm:col-span-2">
              {(p) => (
                <Input
                  {...p}
                  name="legal_street"
                  required
                  defaultValue={company.legal_street ?? ''}
                  placeholder="Satamakatu 1"
                />
              )}
            </Field>

            <Field label={t.requisites.postalCode} required>
              {(p) => (
                <InputMono
                  {...p}
                  name="legal_postal_code"
                  required
                  defaultValue={company.legal_postal_code ?? ''}
                  placeholder="10900"
                />
              )}
            </Field>

            <Field label={t.requisites.city} required>
              {(p) => (
                <Input
                  {...p}
                  name="legal_city"
                  required
                  defaultValue={company.legal_city ?? ''}
                  placeholder="Hanko"
                />
              )}
            </Field>

            <Field label={t.requisites.country} required>
              {(p) => (
                <InputMono
                  {...p}
                  name="legal_country"
                  required
                  maxLength={2}
                  defaultValue={company.legal_country ?? 'FI'}
                  placeholder="FI"
                />
              )}
            </Field>

            <Field label={t.requisites.vat} hint={t.requisites.vatHint} required error={vatError}>
              {(p) => (
                <InputMono
                  {...p}
                  name="vat_number"
                  required
                  value={vat}
                  onChange={(e) => setVat(e.target.value)}
                  placeholder="FI12345678"
                />
              )}
            </Field>
          </div>
        </CardBody>
      </Card>

      {/* ── Заказчик: счета и электронное счёт-фактурирование ── */}
      {!isCarrier && (
        <>
          <Card>
            <CardBody>
              <SectionTitle>{t.requisites.billingSection}</SectionTitle>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label={t.requisites.billingEmail}
                  hint={t.requisites.billingEmailHint}
                  required
                >
                  {(p) => (
                    <Input
                      {...p}
                      name="billing_email"
                      type="email"
                      required
                      defaultValue={company.billing_email ?? ''}
                      placeholder="laskutus@company.fi"
                    />
                  )}
                </Field>

                <Field label={t.requisites.billingReference} hint={t.requisites.billingReferenceHint}>
                  {(p) => (
                    <Input
                      {...p}
                      name="billing_reference"
                      defaultValue={company.billing_reference ?? ''}
                    />
                  )}
                </Field>

                <label className="flex cursor-pointer items-center gap-2.5 sm:col-span-2">
                  <input
                    type="checkbox"
                    name="billing_same"
                    checked={sameAddress}
                    onChange={(e) => setSameAddress(e.target.checked)}
                    className="size-4 accent-accent"
                  />
                  <span className="text-[13px] text-ink">{t.requisites.billingSameAsLegal}</span>
                </label>

                {!sameAddress && (
                  <>
                    <Field label={t.requisites.street} className="sm:col-span-2">
                      {(p) => (
                        <Input
                          {...p}
                          name="billing_street"
                          defaultValue={company.billing_street ?? ''}
                        />
                      )}
                    </Field>
                    <Field label={t.requisites.postalCode}>
                      {(p) => (
                        <InputMono
                          {...p}
                          name="billing_postal_code"
                          defaultValue={company.billing_postal_code ?? ''}
                        />
                      )}
                    </Field>
                    <Field label={t.requisites.city}>
                      {(p) => (
                        <Input {...p} name="billing_city" defaultValue={company.billing_city ?? ''} />
                      )}
                    </Field>
                    <Field label={t.requisites.country}>
                      {(p) => (
                        <InputMono
                          {...p}
                          name="billing_country"
                          maxLength={2}
                          defaultValue={company.billing_country ?? 'FI'}
                        />
                      )}
                    </Field>
                  </>
                )}
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardBody>
              <SectionTitle>{t.requisites.einvoiceSection}</SectionTitle>
              <p className="-mt-1 mb-4 text-[13px] text-ink-muted">
                {t.requisites.einvoiceOptional}
              </p>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={t.requisites.ovt} hint={t.requisites.ovtHint}>
                  {(p) => (
                    <InputMono
                      {...p}
                      name="einvoice_ovt"
                      defaultValue={company.einvoice_ovt ?? deriveFinnishOvt(company.business_id)}
                    />
                  )}
                </Field>

                <Field label={t.requisites.operator} hint={t.requisites.operatorHint}>
                  {(p) => (
                    <InputMono
                      {...p}
                      name="einvoice_operator"
                      defaultValue={company.einvoice_operator ?? ''}
                      placeholder="003721291126"
                    />
                  )}
                </Field>
              </div>
            </CardBody>
          </Card>
        </>
      )}

      {/*
        * Счёт нужен обеим сторонам, но за разным. Перевозчику на него
        * приходят выплаты за рейсы. Заказчику — возвраты и хвосты по
        * кредит-нотам: электронные счета настроены не у всех, и без
        * счёта такой возврат некуда отправить.
        */}
      <Card>
        <CardBody>
          <SectionTitle>
            {isCarrier ? t.requisites.payoutSection : t.requisites.bankSection}
          </SectionTitle>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label={t.requisites.iban}
              hint={isCarrier ? t.requisites.ibanHint : t.requisites.ibanHintShipper}
              required={isCarrier}
              error={ibanError}
              className="sm:col-span-2"
            >
              {(p) => (
                <InputMono
                  {...p}
                  name="iban"
                  required={isCarrier}
                  value={iban}
                  onChange={(e) => setIban(e.target.value)}
                  onBlur={() => setIban(formatIban(iban))}
                  placeholder="FI21 1234 5600 0007 85"
                />
              )}
            </Field>

            <Field label={t.requisites.bic} hint={t.requisites.bicHint} error={bicError}>
              {(p) => (
                <InputMono
                  {...p}
                  name="bic"
                  value={bic}
                  onChange={(e) => setBic(e.target.value)}
                  placeholder="NDEAFIHH"
                />
              )}
            </Field>
          </div>
        </CardBody>
      </Card>

      {state.error && (
        <p
          role="alert"
          className="rounded-control border border-danger/35 bg-danger/10 px-3 py-2 text-[13px] text-danger"
        >
          {state.error}
        </p>
      )}

      {/*
        * Галочка обязательна и не проставлена заранее: предзаполненное
        * согласие не считается согласием по GDPR. Ссылки открываются в
        * новой вкладке — заполненную форму нельзя терять ради того,
        * чтобы прочитать условия.
        */}
      <label className="flex items-start gap-2.5 text-[13px] leading-relaxed">
        <input
          type="checkbox"
          name="accept_legal"
          required
          className="mt-0.5 size-4 shrink-0 accent-[var(--color-accent)]"
        />
        <span>
          {t.legal.accept}{' '}
          <a
            href={`/${locale}/${locale === 'fi' ? 'kayttoehdot' : 'terms'}`}
            target="_blank"
            rel="noopener"
            className="font-semibold text-accent hover:underline"
          >
            {t.legal.TERMS}
          </a>
          {' · '}
          <a
            href={`/${locale}/${locale === 'fi' ? 'tietosuoja' : 'privacy'}`}
            target="_blank"
            rel="noopener"
            className="font-semibold text-accent hover:underline"
          >
            {t.legal.PRIVACY}
          </a>
        </span>
      </label>

      <Button
        type="submit"
        variant="primary"
        size="lg"
        disabled={pending || blocked}
        className="w-full"
      >
        {pending ? t.requisites.saving : t.requisites.save}
      </Button>
    </form>
  );
}

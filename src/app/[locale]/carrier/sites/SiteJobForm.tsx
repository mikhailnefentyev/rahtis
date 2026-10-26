'use client';

import { useRouter } from 'next/navigation';
import { useActionState, useEffect } from 'react';
import { Button, Card, CardBody, Field, Input, InputMono, Select } from '@/components/ui';
import { saveSiteJobAction, type SiteJobState } from '@/lib/sites/actions';
import { MATERIALS } from '@/lib/sites/work';
import { useI18n } from '@/lib/i18n/provider';
import type { ScaleSite, SiteJob } from '@/types/db';

const initial: SiteJobState = { error: null, done: false };

/** Объект: клиент, адрес, оплата, груз и пункт приёмки по умолчанию, запас к концу дня. */
export function SiteJobForm({
  job,
  scaleSites,
  onClose,
}: {
  job: SiteJob | null;
  scaleSites: Pick<ScaleSite, 'id' | 'name' | 'city'>[];
  onClose?: () => void;
}) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const [state, action, pending] = useActionState(saveSiteJobAction, initial);
  const s = t.sites;

  useEffect(() => {
    if (!state.done) return;
    if (!job && state.id) router.push(`/${locale}/carrier/sites/${state.id}`);
    else onClose?.();
  }, [state, job, locale, router, onClose]);

  return (
    <Card>
      <CardBody>
        <form action={action} className="grid gap-4 sm:grid-cols-2">
          <input type="hidden" name="locale" value={locale} />
          {job && <input type="hidden" name="id" value={job.id} />}

          <Field label={s.name} required>
            {(p) => <Input {...p} name="name" required defaultValue={job?.name ?? ''} placeholder={s.namePh} />}
          </Field>
          <Field label={s.address}>
            {(p) => <Input {...p} name="address" defaultValue={job?.address ?? ''} />}
          </Field>
          <Field label={s.customer} required>
            {(p) => <Input {...p} name="customer_name" required defaultValue={job?.customer_name ?? ''} />}
          </Field>
          <Field label={s.customerBusinessId}>
            {(p) => <InputMono {...p} name="customer_business_id" defaultValue={job?.customer_business_id ?? ''} placeholder="1234567-8" />}
          </Field>
          <Field label={s.customerEmail} className="sm:col-span-2">
            {(p) => <Input {...p} type="email" name="customer_email" defaultValue={job?.customer_email ?? ''} />}
          </Field>
          <Field label={s.pricing} required>
            {(p) => (
              <Select {...p} name="pricing" defaultValue={job?.pricing ?? 'HOUR'}>
                {(['HOUR', 'LOAD', 'TONNE'] as const).map((k) => (
                  <option key={k} value={k}>
                    {s.pricingOptions[k]}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label={s.rate} hint={s.rateHint}>
            {(p) => (
              <InputMono
                {...p}
                name="rate"
                inputMode="decimal"
                defaultValue={job ? String(job.rate_cents / 100).replace('.', ',') : ''}
                placeholder="95,00"
              />
            )}
          </Field>
          <Field label={s.material}>
            {(p) => (
              <Select {...p} name="material_code" defaultValue={job?.material_code ?? '170504'}>
                {MATERIALS.map((m) => (
                  <option key={m.code} value={m.code}>
                    {t.siteWork.materials[m.code]}
                    {m.waste ? ` · ${m.code.slice(0, 2)} ${m.code.slice(2, 4)} ${m.code.slice(4)}` : ''}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label={s.receivingSite}>
            {(p) => (
              <Select {...p} name="receiving_site_id" defaultValue={job?.receiving_site_id ?? ''}>
                <option value="">{s.receivingNone}</option>
                {scaleSites.map((site) => (
                  <option key={site.id} value={site.id}>
                    {site.name}
                    {site.city ? `, ${site.city}` : ''}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label={s.buffer} hint={s.bufferHint}>
            {(p) => <InputMono {...p} name="buffer_minutes" inputMode="numeric" defaultValue={String(job?.buffer_minutes ?? 30)} />}
          </Field>

          <p className="mt-2 border-t border-line pt-4 text-[13px] font-semibold sm:col-span-2">{t.siteInvoice.billingTitle}</p>
          <Field label={t.siteInvoice.customerStreet}>
            {(p) => <Input {...p} name="customer_street" defaultValue={job?.customer_street ?? ''} />}
          </Field>
          <div className="grid grid-cols-[1fr_2fr] gap-3">
            <Field label={t.siteInvoice.customerPostal}>
              {(p) => <InputMono {...p} name="customer_postal_code" defaultValue={job?.customer_postal_code ?? ''} />}
            </Field>
            <Field label={t.siteInvoice.customerCity}>
              {(p) => <Input {...p} name="customer_city" defaultValue={job?.customer_city ?? ''} />}
            </Field>
          </div>
          <Field label={t.siteInvoice.customerCountry}>
            {(p) => (
              <Select {...p} name="customer_country" defaultValue={job?.customer_country ?? 'FI'}>
                {['FI', 'SE', 'NO', 'DK', 'EE', 'LV', 'LT', 'PL', 'DE'].map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label={t.siteInvoice.schedule} hint={t.siteInvoice.scheduleHint}>
            {(p) => (
              <Select {...p} name="invoice_schedule" defaultValue={job?.invoice_schedule ?? 'BIWEEKLY'}>
                {(['MANUAL', 'WEEKLY', 'BIWEEKLY'] as const).map((k) => (
                  <option key={k} value={k}>
                    {t.siteInvoice.schedules[k]}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label={t.siteInvoice.paymentTerm}>
            {(p) => <InputMono {...p} name="payment_term_days" inputMode="numeric" defaultValue={String(job?.payment_term_days ?? 14)} />}
          </Field>

          {state.error && <p className="text-[13px] text-danger sm:col-span-2">{state.error}</p>}

          <div className="flex gap-2 sm:col-span-2">
            <Button type="submit" variant="primary" disabled={pending}>
              {s.save}
            </Button>
            {onClose && <Button onClick={onClose}>{s.cancel}</Button>}
          </div>
        </form>
      </CardBody>
    </Card>
  );
}

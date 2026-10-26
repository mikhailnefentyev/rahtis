'use client';

import { useActionState, useState } from 'react';
import { Button, Card, CardBody, Field, Input, InputMono, Select } from '@/components/ui';
import { useI18n } from '@/lib/i18n/provider';
import { saveOrderWasteAction, type WasteState } from '@/lib/waste/actions';
import {
  normalizeEwc,
  RECOVERY_CODES,
  suggestedBasel,
  WASTE_PROCEDURES,
  wasteIssues,
  type WasteProcedure,
} from '@/lib/waste/shipment';
import type { OrderWaste } from '@/types/db';

const initial: WasteState = { error: null, saved: false };

/** Отметка «отходы» и графы Приложения VII. Проверки процедуры — сразу, по мере ввода. */
export function WasteForm({ orderId, waste, countries }: { orderId: string; waste: OrderWaste | null; countries: string[] }) {
  const { t, locale } = useI18n();
  const w = t.waste;
  const [state, action, pending] = useActionState(saveOrderWasteAction, initial);
  const [on, setOn] = useState(Boolean(waste));
  const [procedure, setProcedure] = useState<WasteProcedure>((waste?.procedure as WasteProcedure) ?? (new Set(countries).size > 1 ? 'ANNEX_VII' : 'DOMESTIC'));
  const [ewc, setEwc] = useState(waste?.ewc_code ?? '');
  const [basel, setBasel] = useState(waste?.basel_code ?? '');

  const issues = on ? wasteIssues(procedure, normalizeEwc(ewc), countries) : [];
  const full = procedure === 'ANNEX_VII' || procedure === 'NOTIFICATION';

  return (
    <Card>
      <CardBody>
        <form action={action} className="grid gap-4 sm:grid-cols-2">
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="order_id" value={orderId} />

          <label className="flex items-center gap-2 text-[14px] font-semibold sm:col-span-2">
            <input type="checkbox" name="is_waste" checked={on} onChange={(e) => setOn(e.target.checked)} className="size-4" />
            {w.isWaste}
          </label>

          {on && (
            <>
              <Field label={w.procedure} className="sm:col-span-2">
                {(p) => (
                  <Select {...p} name="procedure" value={procedure} onChange={(e) => setProcedure(e.target.value as WasteProcedure)}>
                    {WASTE_PROCEDURES.map((k) => (
                      <option key={k} value={k}>
                        {w.procedures[k]}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>

              {issues.length > 0 && (
                <ul className="flex flex-col gap-1 rounded-control border border-warn/40 bg-warn/10 px-3 py-2 text-[13px] text-warn sm:col-span-2">
                  {issues.map((i) => (
                    <li key={i}>{w.issues[i]}</li>
                  ))}
                </ul>
              )}

              {procedure !== 'REUSE' && (
                <>
                  <Field label={w.ewc} hint={w.ewcHint}>
                    {(p) => (
                      <InputMono
                        {...p}
                        name="ewc_code"
                        value={ewc}
                        placeholder="15 01 01"
                        onChange={(e) => {
                          setEwc(e.target.value);
                          const s = suggestedBasel(normalizeEwc(e.target.value));
                          if (s && !basel) setBasel(s);
                        }}
                      />
                    )}
                  </Field>
                  <Field label={w.basel} hint={w.baselHint}>
                    {(p) => <InputMono {...p} name="basel_code" value={basel} onChange={(e) => setBasel(e.target.value)} placeholder="B3020" />}
                  </Field>
                  <Field label={w.description} className="sm:col-span-2">
                    {(p) => <Input {...p} name="description" defaultValue={waste?.description ?? ''} />}
                  </Field>
                  <Field label={w.quantity}>
                    {(p) => <InputMono {...p} name="quantity_kg" inputMode="numeric" defaultValue={waste?.quantity_kg ? String(waste.quantity_kg) : ''} />}
                  </Field>
                </>
              )}

              {full && (
                <>
                  <Field label={w.recovery}>
                    {(p) => (
                      <Select {...p} name="recovery_code" defaultValue={waste?.recovery_code ?? 'R3'}>
                        {RECOVERY_CODES.map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                      </Select>
                    )}
                  </Field>
                  <Field label={w.producer}>
                    {(p) => <Input {...p} name="producer_name" defaultValue={waste?.producer_name ?? ''} />}
                  </Field>
                  <Field label={w.producerAddress}>
                    {(p) => <Input {...p} name="producer_address" defaultValue={waste?.producer_address ?? ''} />}
                  </Field>
                  <Field label={w.consignee}>
                    {(p) => <Input {...p} name="consignee_name" defaultValue={waste?.consignee_name ?? ''} />}
                  </Field>
                  <Field label={w.consigneeAddress}>
                    {(p) => <Input {...p} name="consignee_address" defaultValue={waste?.consignee_address ?? ''} />}
                  </Field>
                  <Field label={w.consigneeContact}>
                    {(p) => <Input {...p} name="consignee_contact" defaultValue={waste?.consignee_contact ?? ''} />}
                  </Field>
                  <Field label={w.facility}>
                    {(p) => <Input {...p} name="facility_name" defaultValue={waste?.facility_name ?? ''} />}
                  </Field>
                  <Field label={w.facilityAddress}>
                    {(p) => <Input {...p} name="facility_address" defaultValue={waste?.facility_address ?? ''} />}
                  </Field>
                  <Field label={w.contract}>
                    {(p) => <Input {...p} name="contract_ref" defaultValue={waste?.contract_ref ?? ''} />}
                  </Field>
                  <Field label={w.diwass} hint={w.diwassHint}>
                    {(p) => <InputMono {...p} name="diwass_number" defaultValue={waste?.diwass_number ?? ''} />}
                  </Field>
                </>
              )}
            </>
          )}

          {state.error && <p className="text-[13px] text-danger sm:col-span-2">{state.error}</p>}
          {state.saved && !pending && <p className="text-[13px] text-ok sm:col-span-2">{w.saved}</p>}

          <div className="sm:col-span-2">
            <Button type="submit" variant="primary" disabled={pending}>
              {on || !waste ? w.save : w.remove}
            </Button>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}

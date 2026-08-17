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
  Mono,
  SectionTitle,
  Select,
  Textarea,
} from '@/components/ui';
import { REGIONS } from '@/lib/config';
import { publishOrderAction, type PublishState } from '@/lib/orders/actions';
import { useI18n } from '@/lib/i18n/provider';

const initial: PublishState = { error: null, ref: null };

type Extra = { key: number; role: 'EXTRA_LOAD' | 'EXTRA_UNLOAD' };

/**
 * Форма публикации заказа.
 *
 * По ТЗ §5 это одна форма, а не пошаговый мастер: заказчик видит весь
 * маршрут целиком и добавляет необязательные части кнопками.
 */
export function OrderForm({ onPublished }: { onPublished: () => void }) {
  const { t, locale } = useI18n();
  const [state, formAction, pending] = useActionState(publishOrderAction, initial);

  const [extras, setExtras] = useState<Extra[]>([]);
  const [hasContinuation, setHasContinuation] = useState(false);
  const [hasReturn, setHasReturn] = useState(false);
  const [distance, setDistance] = useState('');
  const [rate, setRate] = useState('');

  /* Ставка за километр — подсказка при вводе, в базе не хранится. */
  const km = Number.parseInt(distance.replace(/\D/g, ''), 10);
  const euros = Number.parseFloat(rate.replace(/\s/g, '').replace(',', '.'));
  const perKm =
    Number.isFinite(km) && km > 0 && Number.isFinite(euros) && euros > 0
      ? `€${(euros / km).toFixed(2)}/${t.unit.km}`
      : '';

  if (state.ref) {
    return (
      <Card stripe="ok">
        <CardBody className="flex flex-wrap items-center gap-3">
          <Badge tone="ok">{t.orderForm.published}</Badge>
          <Mono className="text-[13px]">{state.ref}</Mono>
          <Button size="sm" onClick={onPublished} className="ml-auto">
            {t.action.close}
          </Button>
        </CardBody>
      </Card>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="locale" value={locale} />

      <Card>
        <CardBody className="grid gap-4 sm:grid-cols-2">
          <Field label={t.orderForm.type} required>
            {(p) => (
              <Select {...p} name="order_type" required defaultValue="TRAILER_SWAP">
                <option value="TRAILER_SWAP">{t.orderType.TRAILER_SWAP}</option>
                <option value="ROUND_TRIP">{t.orderType.ROUND_TRIP}</option>
                <option value="ONE_WAY">{t.orderType.ONE_WAY}</option>
              </Select>
            )}
          </Field>

          <Field label={t.orderForm.shipperRef} hint={t.orderForm.shipperRefHint}>
            {(p) => <InputMono {...p} name="shipper_ref" placeholder="BF-2026-0912" />}
          </Field>
        </CardBody>
      </Card>

      {/* ── Забор ── */}
      <Card stripe="info">
        <CardBody>
          <SectionTitle>{t.orderForm.pickupSection}</SectionTitle>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t.orderForm.placeKind} required>
              {(p) => (
                <Select {...p} name="pickup_place_kind" required defaultValue="PORT">
                  <option value="PORT">{t.placeKind.PORT}</option>
                  <option value="TERMINAL">{t.placeKind.TERMINAL}</option>
                  <option value="PARKING">{t.placeKind.PARKING}</option>
                  <option value="ADDRESS">{t.placeKind.ADDRESS}</option>
                </Select>
              )}
            </Field>
            <Field label={t.orderForm.placeName}>
              {(p) => <Input {...p} name="pickup_place_name" placeholder="Hanko Port, Terminal 2" />}
            </Field>
            <Field label={t.orderForm.address} required className="sm:col-span-2">
              {(p) => (
                <Input {...p} name="pickup_address" required placeholder="Satamakatu 1, 10900 Hanko" />
              )}
            </Field>
            <Field label={t.orderForm.city} required>
              {(p) => (
                <Select {...p} name="pickup_city" required defaultValue={REGIONS[0]}>
                  {REGIONS.map((city) => (
                    <option key={city} value={city}>
                      {city}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label={t.orderForm.date} required>
                {(p) => <Input {...p} type="date" name="pickup_date" required />}
              </Field>
              <Field label={t.orderForm.time}>
                {(p) => <Input {...p} type="time" name="pickup_time" />}
              </Field>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* ── Доп. точки ── */}
      {extras.map((extra, index) => (
        <Card key={extra.key} stripe="warn">
          <CardBody>
            <div className="mb-3 flex items-center justify-between">
              <SectionTitle className="mb-0 border-0 pb-0">
                {extra.role === 'EXTRA_LOAD' ? t.stopKind.EXTRA_LOAD : t.stopKind.EXTRA_UNLOAD}
              </SectionTitle>
              <Button
                size="sm"
                onClick={() => setExtras((list) => list.filter((e) => e.key !== extra.key))}
              >
                {t.orderForm.remove}
              </Button>
            </div>

            <input type="hidden" name="extra_role" value={extra.role} />

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t.orderForm.company} required>
                {(p) => <Input {...p} name="extra_company" required />}
              </Field>
              <Field label={t.orderForm.city} required>
                {(p) => <Input {...p} name="extra_city" required defaultValue={REGIONS[index % REGIONS.length]} />}
              </Field>
              <Field label={t.orderForm.address} required className="sm:col-span-2">
                {(p) => <Input {...p} name="extra_address" required />}
              </Field>
              <Field label={t.orderForm.date}>
                {(p) => <Input {...p} type="date" name="extra_date" />}
              </Field>
              <Field label={t.orderForm.time}>
                {(p) => <Input {...p} type="time" name="extra_time" />}
              </Field>
            </div>
          </CardBody>
        </Card>
      ))}

      {/* ── Выгрузка ── */}
      <Card stripe="live">
        <CardBody>
          <SectionTitle>{t.orderForm.deliverySection}</SectionTitle>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t.orderForm.company} required>
              {(p) => (
                <Input {...p} name="delivery_company" required placeholder="Helsinki Logistics Center" />
              )}
            </Field>
            <Field label={t.orderForm.city} required>
              {(p) => (
                <Select {...p} name="delivery_city" required defaultValue={REGIONS[1]}>
                  {REGIONS.map((city) => (
                    <option key={city} value={city}>
                      {city}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label={t.orderForm.address} required className="sm:col-span-2">
              {(p) => (
                <Input {...p} name="delivery_address" required placeholder="Tavaratie 5, 00700 Helsinki" />
              )}
            </Field>
            <Field label={t.orderForm.contact}>
              {(p) => <Input {...p} name="delivery_contact" placeholder="Mika Virtanen" />}
            </Field>
            <Field label={t.orderForm.phone}>
              {(p) => <InputMono {...p} name="delivery_phone" placeholder="+358407001122" />}
            </Field>
            <Field label={t.orderForm.date} required>
              {(p) => <Input {...p} type="date" name="delivery_date" required />}
            </Field>
            <Field label={t.orderForm.time}>
              {(p) => <Input {...p} type="time" name="delivery_time" />}
            </Field>
          </div>
        </CardBody>
      </Card>

      {/* ── Продолжение рейса ── */}
      {hasContinuation && (
        <Card stripe="info">
          <CardBody>
            <div className="mb-3 flex items-center justify-between">
              <SectionTitle className="mb-0 border-0 pb-0">{t.stopKind.CONTINUATION}</SectionTitle>
              <Button size="sm" onClick={() => setHasContinuation(false)}>
                {t.orderForm.remove}
              </Button>
            </div>

            <input type="hidden" name="has_continuation" value="on" />

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t.orderForm.company} required>
                {(p) => <Input {...p} name="cont_company" required />}
              </Field>
              <Field label={t.orderForm.continuationRef}>
                {(p) => <InputMono {...p} name="cont_ref" placeholder="NC-2026-0414" />}
              </Field>
              <Field label={t.orderForm.address} required className="sm:col-span-2">
                {(p) => <Input {...p} name="cont_address" required />}
              </Field>
              <Field label={t.orderForm.city} required>
                {(p) => <Input {...p} name="cont_city" required defaultValue={REGIONS[3]} />}
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label={t.orderForm.date}>
                  {(p) => <Input {...p} type="date" name="cont_date" />}
                </Field>
                <Field label={t.orderForm.time}>
                  {(p) => <Input {...p} type="time" name="cont_time" />}
                </Field>
              </div>
            </div>
          </CardBody>
        </Card>
      )}

      {/* ── Возврат прицепа ── */}
      {hasReturn && (
        <Card>
          <CardBody>
            <div className="mb-3 flex items-center justify-between">
              <SectionTitle className="mb-0 border-0 pb-0">{t.stopKind.TRAILER_RETURN}</SectionTitle>
              <Button size="sm" onClick={() => setHasReturn(false)}>
                {t.orderForm.remove}
              </Button>
            </div>

            <input type="hidden" name="has_return" value="on" />

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t.orderForm.returnWhere} required>
                {(p) => <Input {...p} name="ret_place" required placeholder="Hanko Port, Terminal 2" />}
              </Field>
              <Field label={t.orderForm.city} required>
                {(p) => <Input {...p} name="ret_city" required defaultValue={REGIONS[0]} />}
              </Field>
              <Field label={t.orderForm.address} required className="sm:col-span-2">
                {(p) => <Input {...p} name="ret_address" required />}
              </Field>
              <label className="flex cursor-pointer items-center gap-2.5 sm:col-span-2">
                <input type="checkbox" name="ret_loaded" className="size-4 accent-accent" />
                <span className="text-[13px] text-ink">{t.orderForm.returnLoaded}</span>
              </label>
            </div>
          </CardBody>
        </Card>
      )}

      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          onClick={() => setExtras((list) => [...list, { key: Date.now(), role: 'EXTRA_LOAD' }])}
        >
          {t.orderForm.addExtraLoad}
        </Button>
        <Button
          size="sm"
          onClick={() => setExtras((list) => [...list, { key: Date.now(), role: 'EXTRA_UNLOAD' }])}
        >
          {t.orderForm.addExtraUnload}
        </Button>
        {!hasContinuation && (
          <Button size="sm" onClick={() => setHasContinuation(true)}>
            {t.orderForm.addContinuation}
          </Button>
        )}
        {!hasReturn && (
          <Button size="sm" onClick={() => setHasReturn(true)}>
            {t.orderForm.addTrailerReturn}
          </Button>
        )}
      </div>

      {/* ── Груз и оплата ── */}
      <Card>
        <CardBody>
          <SectionTitle>{t.orderForm.cargoSection}</SectionTitle>
          <div className="grid gap-4 sm:grid-cols-4">
            <Field label={t.orderForm.trailer} className="sm:col-span-2">
              {(p) => <Input {...p} name="trailer" placeholder={t.orderForm.trailerPlaceholder} />}
            </Field>
            <Field label={t.orderForm.distance} required>
              {(p) => (
                <InputMono
                  {...p}
                  name="distance_km"
                  required
                  inputMode="numeric"
                  value={distance}
                  onChange={(e) => setDistance(e.target.value)}
                  placeholder="130"
                />
              )}
            </Field>
            <Field label={`${t.orderForm.rate} ${perKm}`} required>
              {(p) => (
                <InputMono
                  {...p}
                  name="rate"
                  required
                  inputMode="decimal"
                  value={rate}
                  onChange={(e) => setRate(e.target.value)}
                  placeholder="480"
                />
              )}
            </Field>
            <Field label={t.order.comment} className="sm:col-span-4">
              {(p) => <Textarea {...p} name="comment" rows={2} placeholder={t.order.commentPlaceholder} />}
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

      <div className="flex gap-2">
        <Button type="button" onClick={onPublished} className="flex-1">
          {t.action.cancel}
        </Button>
        <Button type="submit" variant="primary" size="lg" disabled={pending} className="flex-[3]">
          {pending ? t.orderForm.publishing : t.orderForm.publish}
        </Button>
      </div>
    </form>
  );
}

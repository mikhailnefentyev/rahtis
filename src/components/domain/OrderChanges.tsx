'use client';

import { useActionState, useState } from 'react';
import { Badge, Button, Input, Select } from '@/components/ui';
import { cn } from '@/lib/cn';
import { useI18n } from '@/lib/i18n/provider';
import {
  applyChangeRequestAction,
  changeTripAssignmentAction,
  dismissChangeRequestAction,
  proposePriceAction,
  type AmendState,
} from '@/lib/orders/amend';
import { reasonLines, type VehicleCheckView } from '@/lib/orders/vehicleCheck';
import { confirmVehicleCheckAction } from '@/lib/orders/vehicleCheckActions';

/*
 * Правки заказа после назначения (6.11.2026): режим цены и разница
 * пробега, предложение цены, смена машины и водителя, сообщения водителя
 * о другом адресе. Всё пишется в журнал (OrderAmendments) — здесь только
 * действия.
 */

export type OrderPricing = {
  mode: 'FIXED' | 'PER_KM';
  perKmCents: number | null;
  distanceKm: number | null;
  autoKm: number | null;
  rateCents: number | null;
  currency: string;
};

export type ChangeRequest = {
  id: string;
  stopId: string | null;
  message: string;
  address: string | null;
  hasPoint: boolean;
  createdAt: string;
};

export type OrderChangesData = { pricing?: OrderPricing; requests: ChangeRequest[]; vehicleCheck?: VehicleCheckView };

export type FleetOption = { id: string; label: string };

const idle: AmendState = { error: null, saved: false };

/** Режим цены, разница пробега по текущим адресам и предложение новой цены (FIXED). */
export function PricingNote({
  orderId,
  pricing,
  canPropose,
  className,
}: {
  orderId: string;
  pricing: OrderPricing | undefined;
  canPropose: boolean;
  className?: string;
}) {
  const { t, f, locale } = useI18n();
  const tw = t.trustWins;
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(proposePriceAction, idle);
  /* Записано — форма закрывается: предложение уже в журнале. */
  const formOpen = open && !state.saved;
  if (!pricing) return null;

  const delta = pricing.autoKm !== null && pricing.distanceKm !== null ? pricing.autoKm - pricing.distanceKm : 0;
  const perKm = pricing.mode === 'PER_KM' && pricing.perKmCents !== null;

  return (
    <div className={cn('text-xs text-ink-muted', className)}>
      <p>
        <Badge tone="neutral">{perKm ? tw.pricingPER_KM : tw.pricingFIXED}</Badge>{' '}
        {perKm
          ? tw.perKmLine.replace('{rate}', f.money(pricing.perKmCents ?? 0, pricing.currency)).replace('{km}', String(pricing.distanceKm ?? 0))
          : tw.pricingFixedNote}
      </p>
      {!perKm && Math.abs(delta) >= 1 && (
        <p className="mt-1 text-warn">
          {tw.distanceDelta
            .replace('{auto}', String(pricing.autoKm))
            .replace('{agreed}', String(pricing.distanceKm))
            .replace('{delta}', `${delta > 0 ? '+' : ''}${delta}`)}
        </p>
      )}
      {!perKm && canPropose && !formOpen && !state.saved && (
        <Button size="sm" className="mt-2" onClick={() => setOpen(true)}>
          {tw.proposePrice}
        </Button>
      )}
      {formOpen && (
        <form action={action} className="mt-2 flex flex-wrap items-end gap-2">
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="order_id" value={orderId} />
          <label className="flex flex-col gap-1">
            {f.label(tw.newPrice, pricing.currency)}
            <Input name="rate" inputMode="decimal" required className="w-32" />
          </label>
          <Input name="reason" maxLength={500} placeholder={tw.amendReason} aria-label={tw.amendReason} className="min-w-0 flex-1 basis-48" />
          <Button type="submit" size="sm" variant="primary" disabled={pending}>
            {tw.proposeSend}
          </Button>
          <Button type="button" size="sm" onClick={() => setOpen(false)}>
            {t.action.cancel}
          </Button>
        </form>
      )}
      {state.error && <p className="mt-1 text-danger">{state.error}</p>}
    </div>
  );
}

/** Сообщения водителя о другом адресе: в правку одной кнопкой или отклонить. */
export function ChangeRequests({ requests, className }: { requests: ChangeRequest[]; className?: string }) {
  const { t } = useI18n();
  if (requests.length === 0) return null;
  return (
    <div className={cn('rounded-control border border-warn/35 bg-warn/10 px-3 py-2', className)}>
      <p className="label-micro mb-1.5">{t.trustWins.changeRequests}</p>
      <ul className="flex flex-col gap-2">
        {requests.map((r) => (
          <ChangeRequestRow key={r.id} request={r} />
        ))}
      </ul>
    </div>
  );
}

function ChangeRequestRow({ request }: { request: ChangeRequest }) {
  const { t, f, locale } = useI18n();
  const tw = t.trustWins;
  const [state, action, pending] = useActionState(applyChangeRequestAction, idle);
  return (
    <li className="text-xs">
      <p className="text-ink">{tw.changeRequestLine.replace('{message}', request.message)}</p>
      <p className="text-ink-dim">
        {f.dateTime(request.createdAt)}
        {request.address && ` · ${tw.changeRequestAddress.replace('{address}', request.address)}`}
        {request.hasPoint && ` · ${tw.changeRequestPoint}`}
      </p>
      <div className="mt-1.5 flex flex-wrap items-end gap-2">
        {request.stopId && (
          <form action={action} className="flex flex-wrap items-end gap-2">
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="request_id" value={request.id} />
            <Input name="address" defaultValue={request.address ?? ''} placeholder={tw.applyAddress} aria-label={tw.applyAddress} className="w-56" />
            <Button type="submit" size="sm" variant="primary" disabled={pending}>
              {tw.applyRequest}
            </Button>
          </form>
        )}
        <form action={dismissChangeRequestAction}>
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="request_id" value={request.id} />
          <Button type="submit" size="sm">
            {tw.dismissRequest}
          </Button>
        </form>
      </div>
      {state.error && <p className="mt-1 text-danger">{state.error}</p>}
    </li>
  );
}

/**
 * Сверка машины на погрузке (6.11.2026). OK — маленькая зелёная отметка;
 * расхождение — красная «Проверьте машину» с причинами и подтверждением
 * «всё в порядке» с причиной. «Нет данных» не показывается — только
 * справочная строка о другом водителе, если она есть.
 */
export function VehicleCheckMark({
  check,
  side,
  className,
}: {
  check?: VehicleCheckView;
  side: 'SHIPPER' | 'CARRIER';
  className?: string;
}) {
  const { t, f, locale } = useI18n();
  if (!check) return null;
  const tv = t.vehicleCheck;
  const lines = reasonLines(check.reasons, tv);

  if (check.verdict !== 'MISMATCH') {
    if (check.verdict === 'NO_DATA' && lines.length === 0) return null;
    return (
      <p className={cn('text-xs', className)}>
        {check.verdict === 'OK' && <span className="font-semibold text-ok">✓ {tv.verified}</span>}
        {check.verdict === 'OK' && lines.length > 0 && ' · '}
        {lines.length > 0 && <span className="text-ink-muted">{lines.join(' · ')}</span>}
      </p>
    );
  }

  const mine = side === 'SHIPPER' ? check.shipperConfirmedAt : check.carrierConfirmedAt;
  const confirmations = [
    check.shipperConfirmedAt && `${tv.confirmedShipper.replace('{reason}', check.shipperReason ?? '')} · ${f.dateTime(check.shipperConfirmedAt)}`,
    check.carrierConfirmedAt && `${tv.confirmedCarrier.replace('{reason}', check.carrierReason ?? '')} · ${f.dateTime(check.carrierConfirmedAt)}`,
  ].filter(Boolean) as string[];

  return (
    <div
      id={`vehicle-check-${check.id}`}
      className={cn(
        'rounded-control border px-3 py-2 text-xs',
        mine ? 'border-line bg-sunken' : 'border-danger/40 bg-danger/10',
        className,
      )}
    >
      <p className={cn('font-semibold', mine ? 'text-ink' : 'text-danger')}>⚠ {tv.mismatch}</p>
      {!mine && <p className="mt-0.5 text-ink-muted">{tv.lead}</p>}
      {lines.length > 0 && (
        <ul className="mt-1 list-disc pl-4 text-ink">
          {lines.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      )}
      {confirmations.map((line) => (
        <p key={line} className="mt-1 text-ink-dim">
          ✓ {line}
        </p>
      ))}
      {!mine && (
        <form action={confirmVehicleCheckAction} className="mt-2 flex flex-wrap items-end gap-2">
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="check_id" value={check.id} />
          <Input
            name="reason"
            required
            minLength={3}
            maxLength={500}
            placeholder={tv.reasonPlaceholder}
            aria-label={tv.reasonLabel}
            className="w-64"
          />
          <Button type="submit" size="sm">
            {tv.confirm}
          </Button>
        </form>
      )}
    </div>
  );
}

/** Перевозчик меняет машину и/или водителя рейса — пройденные точки, фото и веса остаются при рейсе. */
export function TripAssignmentPanel({
  orderId,
  vehicles,
  drivers,
  className,
}: {
  orderId: string;
  vehicles: FleetOption[];
  drivers: FleetOption[];
  className?: string;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  /* Каждое открытие — новая форма (и своё состояние ответа). */
  const [round, setRound] = useState(0);
  if (vehicles.length === 0 && drivers.length === 0) return null;

  if (!open) {
    return (
      <div className={className}>
        <Button
          size="sm"
          onClick={() => {
            setRound((r) => r + 1);
            setOpen(true);
          }}
        >
          {t.trustWins.changeAssignment}
        </Button>
      </div>
    );
  }
  return (
    <AssignmentForm key={round} orderId={orderId} vehicles={vehicles} drivers={drivers} onClose={() => setOpen(false)} className={className} />
  );
}

function AssignmentForm({
  orderId,
  vehicles,
  drivers,
  onClose,
  className,
}: {
  orderId: string;
  vehicles: FleetOption[];
  drivers: FleetOption[];
  onClose: () => void;
  className?: string;
}) {
  const { t, locale } = useI18n();
  const tw = t.trustWins;
  const [state, action, pending] = useActionState(changeTripAssignmentAction, idle);

  if (state.saved) {
    return (
      <div className={className}>
        <span className="mr-2 text-xs text-ok">{tw.invoiceSaved}</span>
        <Button size="sm" onClick={onClose}>
          {t.action.cancel}
        </Button>
      </div>
    );
  }

  return (
    <form action={action} className={cn('flex flex-col gap-2 rounded-control border border-line bg-sunken p-3 text-xs', className)}>
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="order_id" value={orderId} />
      <p className="label-micro">{tw.changeAssignment}</p>
      <p className="text-ink-muted">{tw.changeAssignmentHint}</p>
      <div className="flex flex-wrap gap-2">
        <Select name="vehicle_id" defaultValue="" aria-label={tw.fieldVehicle} className="w-auto min-w-40">
          <option value="">{tw.keepVehicle}</option>
          {vehicles.map((v) => (
            <option key={v.id} value={v.id}>
              {v.label}
            </option>
          ))}
        </Select>
        <Select name="driver_id" defaultValue="" aria-label={t.vehicle.driver} className="w-auto min-w-40">
          <option value="">{tw.keepDriver}</option>
          {drivers.map((d) => (
            <option key={d.id} value={d.id}>
              {d.label}
            </option>
          ))}
        </Select>
      </div>
      <Input name="reason" maxLength={500} placeholder={tw.amendReason} aria-label={tw.amendReason} />
      {state.error && <p className="text-danger">{state.error}</p>}
      <div className="flex gap-2">
        <Button type="button" size="sm" onClick={onClose}>
          {t.action.cancel}
        </Button>
        <Button type="submit" size="sm" variant="primary" disabled={pending}>
          {tw.saveChange}
        </Button>
      </div>
    </form>
  );
}

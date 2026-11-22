'use client';

import { useActionState, useState } from 'react';
import { Badge, Button, Card, CardBody, Kv, Plate, Textarea } from '@/components/ui';
import { EURO_LABEL } from '@/lib/fleet/labels';
import { useI18n } from '@/lib/i18n/provider';
import { decideSaleVehicleAction, type ActionState } from '@/lib/installments/actions';
import { installmentUiCopy } from '@/lib/installments/copy';
import type { Database } from '@/types/database';

type SaleVehicle = Database['public']['Tables']['equipment_sale_vehicles']['Row'];

const initial: ActionState = { error: null, saved: false };

/**
 * Машина на продажу в рассрочку у компании без парка — на проверке
 * (23.11.2026). В рейсы она не выходит: оператор проверяет, что машина
 * существует и принадлежит продавцу, а данные карточки верны — по ним
 * строится объявление, договор и машина в парке покупателя. Документы
 * перевозчика (лицензия, страховка) продавцу не нужны, поэтому их здесь
 * нет — в отличие от карточки машины парка (VehicleCard).
 */
export function SaleVehicleCard({ vehicle, companyName }: { vehicle: SaleVehicle; companyName: string }) {
  const { t, m, locale } = useI18n();
  const ui = installmentUiCopy(locale);
  const cargo = vehicle.vehicle_class === 'VAN' || vehicle.vehicle_class === 'TRUCK';

  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const [decision, decideAction, deciding] = useActionState(decideSaleVehicleAction, initial);

  return (
    <Card>
      <CardBody className="flex flex-col gap-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <Plate className="text-[15px]">{vehicle.plate}</Plate>
              {/* Чем эта карточка отличается от машины парка: только на продажу. */}
              <Badge tone="info">{ui.nav}</Badge>
              <Badge tone="warn">{t.vehicleAccess.PENDING}</Badge>
              <span className="font-mono text-xs text-ink-dim">{EURO_LABEL[vehicle.euro_class]}</span>
            </div>

            <p className="mt-2 text-[13px] text-ink">
              {vehicle.make} ·{' '}
              {cargo
                ? `${vehicle.payload_kg} kg · ${String(vehicle.ldm).replace('.', ',')} ldm`
                : m('vehicle.axlesCount', { count: vehicle.axles })}
            </p>
            <div className="mt-2 flex flex-col gap-1">
              <Kv k={ui.catalog.seller} v={companyName} />
              <Kv k={t.vehicle.class} v={t.vehicleClass[vehicle.vehicle_class]} />
            </div>
          </div>

          {!rejecting && (
            <div className="flex flex-col gap-2">
              <form action={decideAction}>
                <input type="hidden" name="locale" value={locale} />
                <input type="hidden" name="id" value={vehicle.id} />
                <input type="hidden" name="decision" value="APPROVED" />
                <Button type="submit" variant="primary" size="sm" className="w-full" disabled={deciding}>
                  {t.vehicleAccess.APPROVED}
                </Button>
              </form>
              <Button variant="danger" size="sm" onClick={() => setRejecting(true)}>
                {t.action.reject}
              </Button>
            </div>
          )}
        </div>

        {decision.error && (
          <p role="alert" className="text-[13px] text-danger">
            {decision.error}
          </p>
        )}

        {rejecting && (
          <form action={decideAction} className="flex flex-col gap-2 border-t border-line pt-3">
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="id" value={vehicle.id} />
            <input type="hidden" name="decision" value="REJECTED" />

            <label className="label-micro" htmlFor={`sale-reason-${vehicle.id}`}>
              {t.moderation.reasonLabel}
            </label>
            <Textarea
              id={`sale-reason-${vehicle.id}`}
              name="reason"
              rows={2}
              required
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={t.moderation.vehicleReasonPlaceholder}
            />
            <p className="text-xs text-ink-faint">{t.moderation.reasonRequired}</p>

            <div className="flex gap-2">
              <Button type="button" size="sm" className="flex-1" onClick={() => setRejecting(false)}>
                {t.action.cancel}
              </Button>
              <Button type="submit" variant="danger" size="sm" className="flex-[2]" disabled={deciding || reason.trim().length === 0}>
                {t.action.reject}
              </Button>
            </div>
          </form>
        )}
      </CardBody>
    </Card>
  );
}

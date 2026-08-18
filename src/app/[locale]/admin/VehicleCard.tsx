'use client';

import { useState, useTransition } from 'react';
import { Badge, Button, Card, CardBody, Kv, Mono, Plate, Textarea } from '@/components/ui';
import { documentUrlAction } from '@/lib/fleet/actions';
import { decideVehicleAction } from '@/lib/fleet/actions';
import { EURO_LABEL } from '@/lib/fleet/labels';
import { useI18n } from '@/lib/i18n/provider';
import type { CompanyDocument, Vehicle } from '@/types/db';

/**
 * Машина на допуске.
 *
 * Рядом с карточкой — документы компании, потому что по ТЗ §3.4 оператор
 * проверяет их вместе. Открывать другую вкладку, чтобы посмотреть
 * страховку, значит гарантировать, что её смотреть перестанут.
 */
/** Документ вместе с уже посчитанным на сервере остатком дней. */
export type DocumentWithDays = { document: CompanyDocument; daysLeft: number | null };

export function VehicleCard({
  vehicle,
  companyName,
  documents,
}: {
  vehicle: Vehicle;
  companyName: string;
  documents: DocumentWithDays[];
}) {
  const { t, m, f, locale } = useI18n();
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const [opening, startOpening] = useTransition();

  function open(path: string) {
    startOpening(async () => {
      const url = await documentUrlAction(path);
      if (url) window.open(url, '_blank', 'noopener,noreferrer');
    });
  }

  return (
    <Card>
      <CardBody className="flex flex-col gap-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <Plate className="text-[15px]">{vehicle.plate}</Plate>
              <Badge tone="warn">{t.vehicleAccess.PENDING}</Badge>
              <span className="font-mono text-xs text-ink-dim">
                {EURO_LABEL[vehicle.euro_class]}
              </span>
            </div>

            <p className="mt-2 text-[13px] text-ink">
              {vehicle.make} · {m('vehicle.axlesCount', { count: vehicle.axles })}
            </p>
            <div className="mt-2 flex flex-col gap-1">
              <Kv k={t.role.CARRIER} v={companyName} />
              <Kv k={t.vehicle.driver} v={`${vehicle.driver_name} · ${vehicle.languages.join('/')}`} />
              <Kv k={t.vehicle.whatsapp} v={<Mono>{vehicle.whatsapp}</Mono>} />
              <Kv k={t.vehicle.base} v={vehicle.base_city} />
            </div>
          </div>

          {!rejecting && (
            <div className="flex flex-col gap-2">
              <form action={decideVehicleAction}>
                <input type="hidden" name="locale" value={locale} />
                <input type="hidden" name="id" value={vehicle.id} />
                <input type="hidden" name="decision" value="APPROVED" />
                <Button type="submit" variant="primary" size="sm" className="w-full">
                  {t.vehicleAccess.APPROVED}
                </Button>
              </form>
              <Button variant="danger" size="sm" onClick={() => setRejecting(true)}>
                {t.action.reject}
              </Button>
            </div>
          )}
        </div>

        {/* Документы компании — то, вместе с чем принимается решение. */}
        <div className="flex flex-wrap gap-2 border-t border-line pt-3">
          {documents.length === 0 ? (
            <span className="text-[13px] text-danger">{t.fleet.whyClosedNoDocs}</span>
          ) : (
            documents.map(({ document: doc, daysLeft }) => {
              const expired = daysLeft != null && daysLeft < 0;
              return (
                <Button
                  key={doc.id}
                  size="sm"
                  onClick={() => open(doc.storage_path)}
                  disabled={opening}
                  className={expired ? 'border-danger text-danger' : undefined}
                >
                  {t.documents[doc.kind]}
                  {' · '}
                  {doc.valid_until
                    ? expired
                      ? t.documents.expired
                      : f.date(doc.valid_until)
                    : t.documents.perpetual}
                </Button>
              );
            })
          )}
        </div>

        {rejecting && (
          <form action={decideVehicleAction} className="flex flex-col gap-2 border-t border-line pt-3">
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="id" value={vehicle.id} />
            <input type="hidden" name="decision" value="REJECTED" />

            <label className="label-micro" htmlFor={`reason-${vehicle.id}`}>
              {t.moderation.reasonLabel}
            </label>
            <Textarea
              id={`reason-${vehicle.id}`}
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
              <Button
                type="submit"
                variant="danger"
                size="sm"
                className="flex-[2]"
                disabled={reason.trim().length === 0}
              >
                {t.action.reject}
              </Button>
            </div>
          </form>
        )}
      </CardBody>
    </Card>
  );
}

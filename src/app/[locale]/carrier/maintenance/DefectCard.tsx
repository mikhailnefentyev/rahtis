'use client';

import Link from 'next/link';
import { Badge, Button, Card, CardBody, Plate } from '@/components/ui';
import { useI18n } from '@/lib/i18n/provider';
import { resolveDefectAction } from '@/lib/maintenance/actions';
import type { VehicleDefect } from '@/lib/maintenance/load';

/**
 * Дефект: где, насколько серьёзно, кто и когда сообщил, фото. Открытый
 * закрывается отметкой в сервисной книжке (там его можно выбрать как
 * исправленный тем же заездом) или здесь — «исправлено» без записи
 * либо «не дефект». Закрытый можно открыть снова.
 */
export function DefectCard({ defect, plate, showAsset = false }: { defect: VehicleDefect; plate: string; showAsset?: boolean }) {
  const { t, f, locale } = useI18n();
  const s = t.maintenance.defects;
  const open = defect.status === 'OPEN';
  const unsafe = defect.severity === 'UNSAFE';

  return (
    <Card stripe={open ? (unsafe ? 'danger' : 'warn') : 'neutral'}>
      <CardBody className="flex gap-3">
        {defect.photo_url && (
          <a href={defect.photo_url} target="_blank" rel="noreferrer" className="shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element -- подписанная ссылка на час, не статика */}
            <img src={defect.photo_url} alt={s.photo} className="size-20 rounded-control border border-line object-cover" />
          </a>
        )}
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-2">
            {showAsset && (
              <Link href={`/${locale}/carrier/maintenance/${defect.vehicle_id ?? defect.trailer_id}`} className="hover:underline">
                <Plate>{plate}</Plate>
              </Link>
            )}
            <span className="text-[13px] font-semibold">{s.areas[defect.area as keyof typeof s.areas] ?? defect.area}</span>
            <Badge tone={open ? (unsafe ? 'danger' : 'warn') : 'ok'}>
              {open ? s.severities[defect.severity as 'CAN_DRIVE' | 'UNSAFE'] : s.statuses[defect.status as 'FIXED' | 'DISMISSED']}
            </Badge>
          </div>
          <p className="text-[13px] whitespace-pre-line">{defect.description}</p>
          <p className="text-[12px] text-ink-muted">
            {defect.driver_name ?? s.fromCabinet} · {f.dateTime(defect.reported_at)}
            {defect.odometer_km != null && ` · ${f.number(defect.odometer_km)} km`}
            {!open && defect.resolved_at && ` · ${s.closedAt} ${f.date(defect.resolved_at)}`}
            {defect.resolution_note && ` · ${defect.resolution_note}`}
          </p>
          <div className="mt-1 flex flex-wrap gap-2">
            {open ? (
              <>
                <form action={resolveDefectAction}>
                  <input type="hidden" name="locale" value={locale} />
                  <input type="hidden" name="id" value={defect.id} />
                  <input type="hidden" name="status" value="FIXED" />
                  <Button type="submit" size="sm">
                    {s.fix}
                  </Button>
                </form>
                <form action={resolveDefectAction}>
                  <input type="hidden" name="locale" value={locale} />
                  <input type="hidden" name="id" value={defect.id} />
                  <input type="hidden" name="status" value="DISMISSED" />
                  <Button type="submit" size="sm" variant="ghost">
                    {s.dismiss}
                  </Button>
                </form>
              </>
            ) : (
              <form action={resolveDefectAction}>
                <input type="hidden" name="locale" value={locale} />
                <input type="hidden" name="id" value={defect.id} />
                <input type="hidden" name="status" value="OPEN" />
                <Button type="submit" size="sm" variant="ghost">
                  {s.reopen}
                </Button>
              </form>
            )}
          </div>
        </div>
      </CardBody>
    </Card>
  );
}

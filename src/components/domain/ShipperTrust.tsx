'use client';

import { useActionState, useState } from 'react';
import { Button, Input, Select } from '@/components/ui';
import { cn } from '@/lib/cn';
import { todayInHelsinki } from '@/lib/dates';
import { markState } from '@/lib/shipper-docs/model';
import { useI18n } from '@/lib/i18n/provider';
import { reportPaymentAction, type PaymentReportState } from '@/lib/trust/actions';
import { trustTone, type ReportStatus, type ShipperTrust } from '@/lib/trust/model';

/*
 * Сведения о заказчике в режиме «напрямую с перевозчиком» (6.11.2026):
 * возраст, реестр, оплата счетов Aivomaa (если есть история), отметки перевозчиков, объём,
 * проверенные документы заказчика (только отметка и даты).
 * Справка, не гарантия и не рейтинг — так и подписано (TERMS, раздел 8).
 */

const day = (d: string) => `${d.slice(0, 10)}T12:00:00Z`;
const capitalize = (s: string) => s.charAt(0).toLocaleUpperCase() + s.slice(1);

/** Строки сводки: общие для перевозчика, заказчика о себе и оператора. */
export function ShipperTrustDetails({ trust, className }: { trust: ShipperTrust; className?: string }) {
  const { t, f } = useI18n();
  const tr = t.trust;
  const date = (d: string) => f.date(day(d));
  const bad = trust.registry.flags.filter((x) => x !== 'OTHER');
  const a = trust.aivomaa;
  const r = trust.reports;

  /*
   * Реестр: банкротство и ликвидацию сообщают только PRH (FI) и
   * Brønnøysund (NO); VIES знает лишь номер НДС — «нет банкротства» там
   * не пишем. Реестр не ответил или компании нет в открытых данных
   * (toiminimi) — «нет данных», а не «чисто».
   */
  const known = trust.registry.verdict !== null && trust.registry.verdict !== 'ERROR' && trust.registry.verdict !== 'NOT_FOUND';
  const registryParts: string[] = [];
  if (trust.registry.flags.length > 0) {
    registryParts.push(
      trust.registry.flags.map((x, i) => (x === 'OTHER' ? trust.registry.situations[i] : tr[`flag${x}`])).join(', '),
    );
  } else if (known && (trust.country === 'FI' || trust.country === 'NO')) {
    registryParts.push(tr.registryClean);
  }
  if (known && trust.registry.vat !== null) registryParts.push(trust.registry.vat ? tr.vatYes : tr.vatNo);
  if (known && trust.country === 'FI' && trust.registry.prepayment !== null) {
    registryParts.push(trust.registry.prepayment ? tr.prepaymentYes : tr.prepaymentNo);
  }

  /*
   * Документы заказчика: только одобренные. Нет документа — строки нет
   * (отсутствие не красный флаг); истёк — нейтрально «устарел».
   */
  const sd = t.shipperDocs;
  const today = todayInHelsinki();
  const documents = trust.documents.map((d) => {
    const state = markState(d.validUntil, today);
    const dates = [
      d.issuedOn ? sd.issuedShort.replace('{date}', date(d.issuedOn)) : null,
      state === 'ok' && d.validUntil ? sd.untilShort.replace('{date}', date(d.validUntil)) : null,
    ].filter(Boolean);
    return (
      <span key={d.kind} className={cn('block', state === 'ok' ? 'text-ok' : 'text-ink-muted')}>
        {state === 'ok' && <span aria-hidden>✓ </span>}
        {sd[`mark${d.kind}`]}
        {dates.length > 0 && ` (${dates.join(', ')})`}
        {state === 'expired' && <span className="text-ink-dim"> · {sd.markExpired}</span>}
      </span>
    );
  });

  const rows: { k: string; v: React.ReactNode; tone?: 'bad' | 'warn' }[] = [
    {
      k: tr.age,
      v: trust.registeredOn
        ? tr.registeredOn.replace('{date}', date(trust.registeredOn))
        : tr.onPlatform.replace('{date}', date(trust.onPlatformSince)),
    },
    {
      k: tr.registry,
      tone: bad.length > 0 ? 'bad' : trust.registry.flags.length > 0 ? 'warn' : undefined,
      v: (
        <>
          {registryParts.length > 0 ? capitalize(registryParts.join(' · ')) : tr.registryUnknown}
          {trust.registry.checkedAt && (
            <span className="text-ink-dim"> · {tr.checkedAt.replace('{date}', date(trust.registry.checkedAt))}</span>
          )}
        </>
      ),
    },
    ...(documents.length > 0 ? [{ k: sd.trustRow, v: <>{documents}</> }] : []),
    /* Счета Aivomaa — только история рейсов, где Aivomaa была стороной (до 6.11.2026); нет истории — строки нет. */
    ...(a.invoiced === 0
      ? []
      : [
          {
            k: tr.aivomaa,
            tone: a.overdue > 0 ? ('bad' as const) : a.late > 0 ? ('warn' as const) : undefined,
            v: (
              <>
                {a.onTimePct === null
                  ? tr.aivomaaOpen.replace('{count}', String(a.invoiced))
                  : tr.aivomaaLine.replace('{pct}', String(a.onTimePct)).replace('{count}', String(a.invoiced))}
                {a.late > 0 &&
                  ` · ${tr.aivomaaLate.replace('{count}', String(a.late)).replace('{days}', String(a.avgDaysLate ?? 0))}`}
                {a.overdue > 0 && ` · ${tr.aivomaaOverdue.replace('{count}', String(a.overdue))}`}
              </>
            ),
          },
        ]),
    {
      k: tr.reports,
      tone: r.unpaid > 0 ? 'bad' : r.late > 0 ? 'warn' : undefined,
      v:
        r.total === 0
          ? tr.reportsNone
          : tr.reportsLine
              .replace('{onTime}', String(r.onTime))
              .replace('{late}', String(r.late))
              .replace('{unpaid}', String(r.unpaid)),
    },
    {
      k: tr.volume,
      v:
        trust.done12m === 0 && !trust.firstDoneAt
          ? tr.volumeNone
          : `${trust.done12m}${trust.firstDoneAt ? ` · ${tr.firstDone.replace('{date}', date(trust.firstDoneAt))}` : ''}`,
    },
  ];

  return (
    <div className={cn('flex flex-col gap-1.5 text-[13px]', className)}>
      {rows.map((row) => (
        <div key={row.k} className="flex flex-col gap-0.5 sm:flex-row sm:gap-3">
          <span className="shrink-0 text-ink-faint sm:w-44">{row.k}</span>
          <span
            className={cn(
              'min-w-0 break-words',
              row.tone === 'bad' ? 'font-semibold text-danger' : row.tone === 'warn' ? 'text-warn' : 'text-ink',
            )}
          >
            {row.tone === 'bad' && <span aria-hidden>● </span>}
            {row.v}
          </span>
        </div>
      ))}
      <p className="mt-1 text-xs text-ink-dim">{tr.disclaimer}</p>
    </div>
  );
}

/**
 * Значок «Maksutiedot» на строке стола и карточке рейса: раскрывается на
 * месте, без всплывающего слоя — на телефоне так надёжнее.
 */
export function ShipperTrustBadge({ trust, className }: { trust: ShipperTrust | undefined; className?: string }) {
  const { t } = useI18n();
  if (!trust) return null;
  const tone = trustTone(trust);

  return (
    <details className={cn('group text-xs', className)}>
      <summary
        className={cn(
          'inline-flex cursor-pointer list-none items-center gap-1.5 rounded-pill border px-2.5 py-0.5 font-semibold',
          tone === 'bad'
            ? 'border-danger/35 bg-danger/10 text-danger'
            : tone === 'warn'
              ? 'border-warn/35 bg-warn/10 text-warn'
              : 'border-line bg-raised text-ink-muted',
        )}
      >
        {tone !== 'neutral' && <span aria-hidden className="size-1.5 rounded-full bg-current" />}
        {t.trust.badge}
        <span className="font-normal text-ink-dim">· {t.trust.infoOnly}</span>
        <svg aria-hidden viewBox="0 0 24 24" className="size-3 transition-transform group-open:rotate-180" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </summary>
      <div className="mt-2 rounded-control border border-line bg-surface px-3 py-2.5">
        <ShipperTrustDetails trust={trust} />
      </div>
    </details>
  );
}

export type PaymentReportValue = {
  editable: boolean;
  status: ReportStatus | null;
  daysLate: number | null;
  note: string | null;
  removed: boolean;
};

const idle: PaymentReportState = { error: null, saved: false };

/** Отметка перевозчика об оплате прямого рейса: вовремя / с опозданием (дни) / не оплачен. */
export function PaymentReportControl({
  orderId,
  value,
  className,
}: {
  orderId: string;
  value: PaymentReportValue;
  className?: string;
}) {
  const { t, locale } = useI18n();
  const tr = t.trust;
  const [state, action, pending] = useActionState(reportPaymentAction, idle);
  const [status, setStatus] = useState<ReportStatus | ''>(value.status ?? '');

  if (!value.editable) {
    return (
      <div className={cn('text-xs text-ink-muted', className)}>
        <span className="label-micro mr-2">{tr.reportTitle}</span>
        {value.status ? tr[`status${value.status}`] : '—'}
        {value.status === 'LATE' && value.daysLate != null && ` (${tr.daysLateShort.replace('{days}', String(value.daysLate))})`}
        <span className="block text-ink-dim">{value.removed ? tr.reportRemoved : tr.reportLocked}</span>
      </div>
    );
  }

  return (
    <form action={action} className={cn('flex flex-col gap-2', className)}>
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="order_id" value={orderId} />
      <p className="label-micro">{tr.reportTitle}</p>
      <div className="flex flex-wrap items-end gap-2">
        <Select
          name="status"
          value={status}
          onChange={(e) => setStatus(e.target.value as ReportStatus | '')}
          aria-label={tr.reportTitle}
          className="w-auto min-w-40"
          required
        >
          <option value="" disabled>
            {tr.reportChoose}
          </option>
          <option value="ON_TIME">{tr.statusON_TIME}</option>
          <option value="LATE">{tr.statusLATE}</option>
          <option value="UNPAID">{tr.statusUNPAID}</option>
        </Select>
        {status === 'LATE' && (
          <label className="flex items-center gap-2 text-xs text-ink-muted">
            {tr.daysLate}
            <Input
              name="days_late"
              type="number"
              min={1}
              max={3650}
              defaultValue={value.daysLate ?? ''}
              required
              className="w-20"
            />
          </label>
        )}
        <Input
          name="note"
          maxLength={300}
          defaultValue={value.note ?? ''}
          placeholder={tr.notePlaceholder}
          aria-label={tr.notePlaceholder}
          className="min-w-0 flex-1 basis-48"
        />
        <Button type="submit" size="sm" disabled={pending || status === ''}>
          {tr.reportSave}
        </Button>
      </div>
      <p className="text-xs text-ink-dim">{tr.reportHint}</p>
      {state.error && <p className="text-[13px] text-danger">{state.error}</p>}
      {state.saved && !pending && <p className="text-[13px] text-ok">{tr.reportSaved}</p>}
    </form>
  );
}

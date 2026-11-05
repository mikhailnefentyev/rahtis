'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { cn } from '@/lib/cn';
import { compressPhoto } from '@/lib/driverApp/photo';
import { FUEL_MAX_QUANTITY, fuelUnit, type FuelProduct } from '@/lib/fuel/fuel';
import { useI18n } from '@/lib/i18n/provider';
import { CURRENCIES, type Currency } from '@/lib/money/currency';
import { useOutbox } from '../../OutboxProvider';

export type FuelState = {
  company_id: string;
  vehicle: { id: string; plate: string } | null;
  last_odometer: number | null;
  entries: {
    id: string;
    filled_at: string;
    product: FuelProduct;
    quantity: number;
    unit: 'l' | 'kg';
    amount_cents: number | null;
    /** Валюта чека; старая база её не отдаёт — тогда валюта компании. */
    currency?: string | null;
    odometer_km: number | null;
    station: string | null;
    plate: string | null;
    has_receipt: boolean;
  }[];
};

/* Что водитель заливает чаще всего — первым. */
const PRODUCTS: FuelProduct[] = ['DIESEL', 'ADBLUE', 'HVO', 'LBG', 'CBG', 'LNG', 'CNG', 'PETROL', 'OTHER'];

const BUTTON = 'h-14 w-full rounded-control px-4 text-[16px] font-semibold disabled:opacity-50';
const INPUT = 'h-12 w-full rounded-control border border-line bg-surface px-3 text-[16px]';

type Line = { product: FuelProduct; quantity: string };

const number = (value: string) => {
  const n = Number.parseFloat(value.replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};

/**
 * Форма заправки. Без связи заправка ложится в очередь телефона и уходит
 * позже со временем нажатия — как отметки рейса.
 *
 * Одометр сверяется с последним известным по машине: меньше прошлого или
 * больше трёх тысяч сверху — просим проверить. Подтвердил — сохраняем:
 * водитель у колонки знает лучше, а расчёт расхода такую строку пометит.
 */
export function FuelScreen({ state }: { state: FuelState }) {
  const { t, f } = useI18n();
  const d = t.fuelDriver;
  const { pending, enqueue } = useOutbox();

  const [odometer, setOdometer] = useState('');
  const [lines, setLines] = useState<Line[]>([{ product: 'DIESEL', quantity: '' }]);
  const [amount, setAmount] = useState('');
  /* Валюта чека: по умолчанию — компании; за границей водитель выбирает местную (поляк в Германии платит евро). */
  const [currency, setCurrency] = useState<Currency>(f.currency);
  const [station, setStation] = useState('');
  const [fullTank, setFullTank] = useState(true);
  const [photo, setPhoto] = useState<Blob | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const camera = useRef<HTMLInputElement>(null);

  const preview = useMemo(() => (photo ? URL.createObjectURL(photo) : null), [photo]);
  useEffect(() => () => void (preview && URL.revokeObjectURL(preview)), [preview]);

  const queued = pending.filter((event) => event.kind === 'FUEL');

  /* Одометр из ещё не отправленных заправок тоже «прошлый»: без связи водитель мог внести две подряд. */
  const lastOdometer = Math.max(
    state.last_odometer ?? 0,
    ...queued.map((event) => {
      try {
        return Number(JSON.parse(event.fields.data).odometer_km) || 0;
      } catch {
        return 0;
      }
    }),
  ) || null;

  function setLine(index: number, patch: Partial<Line>) {
    setLines((current) => current.map((line, i) => (i === index ? { ...line, ...patch } : line)));
    setSaved(false);
  }

  async function onPhoto(file: File | undefined) {
    if (!file) return;
    setPhoto(await compressPhoto(file));
  }

  async function save(confirmed: boolean) {
    setError(null);
    const km = number(odometer);
    const parsed = lines.map((line) => ({ product: line.product, quantity: number(line.quantity) }));

    if (km == null || km <= 0 || parsed.some((line) => line.quantity == null || line.quantity <= 0 || line.quantity > FUEL_MAX_QUANTITY)) {
      setError(d.required);
      return;
    }

    if (!confirmed && lastOdometer != null) {
      if (km < lastOdometer) return setWarning(d.odometerBack);
      if (km - lastOdometer > 3000) return setWarning(d.odometerJump);
    }

    setBusy(true);
    try {
      await enqueue(
        'FUEL',
        {
          data: JSON.stringify({
            odometer_km: Math.round(km),
            lines: parsed.map((line) => ({ product: line.product, quantity: Math.round(line.quantity! * 100) / 100 })),
            amount: number(amount),
            currency,
            station: station.trim() || null,
            full_tank: fullTank,
          }),
        },
        photo ?? undefined,
      );
      setOdometer('');
      setLines([{ product: 'DIESEL', quantity: '' }]);
      setAmount('');
      setCurrency(f.currency);
      setStation('');
      setFullTank(true);
      setPhoto(null);
      setWarning(null);
      setSaved(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <section className="flex flex-col gap-4 rounded-card border border-line bg-surface px-4 py-4">
        <p className="text-[15px]">
          {d.vehicle}: <span className="font-mono font-bold">{state.vehicle?.plate}</span>
        </p>

        <label className="flex flex-col gap-1 text-[13px]">
          {d.odometer}
          <input
            className={cn(INPUT, 'font-mono')}
            inputMode="numeric"
            value={odometer}
            onChange={(e) => {
              setOdometer(e.target.value);
              setWarning(null);
              setSaved(false);
            }}
            placeholder={lastOdometer ? String(lastOdometer) : '512340'}
          />
          {lastOdometer != null && (
            <span className="text-[13px] text-ink-muted">
              {d.lastOdometer}: <span className="font-mono">{f.number(lastOdometer)} km</span>
            </span>
          )}
        </label>

        {lines.map((line, index) => (
          <div key={index} className="grid grid-cols-[1fr_8rem] gap-3">
            <label className="flex flex-col gap-1 text-[13px]">
              {d.product}
              <select
                className={INPUT}
                value={line.product}
                onChange={(e) => setLine(index, { product: e.target.value as FuelProduct })}
              >
                {PRODUCTS.map((product) => (
                  <option key={product} value={product}>
                    {d.products[product]}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-[13px]">
              {d.quantity}, {fuelUnit(line.product)}
              <input
                className={cn(INPUT, 'font-mono')}
                inputMode="decimal"
                value={line.quantity}
                onChange={(e) => setLine(index, { quantity: e.target.value })}
              />
            </label>
            {index > 0 && (
              <button
                type="button"
                className="col-span-2 -mt-1 justify-self-start text-[14px] text-danger"
                onClick={() => setLines((current) => current.filter((_, i) => i !== index))}
              >
                {d.removeLine}
              </button>
            )}
          </div>
        ))}

        {lines.length < 4 && (
          <button
            type="button"
            className="h-12 rounded-control border border-dashed border-line-strong text-[15px] font-semibold text-accent"
            onClick={() => setLines((current) => [...current, { product: 'ADBLUE', quantity: '' }])}
          >
            {d.addLine}
          </button>
        )}

        <label className="flex min-h-12 items-center gap-3 text-[15px]">
          <input type="checkbox" className="size-6" checked={fullTank} onChange={(e) => setFullTank(e.target.checked)} />
          {d.fullTank}
        </label>

        <div className="grid gap-3">
          <div className="flex flex-col gap-1 text-[13px]">
            <label htmlFor="fuel-amount">{f.label(d.amount, currency)}</label>
            <div className="flex gap-1.5">
              <input
                id="fuel-amount"
                className={cn(INPUT, 'min-w-0 font-mono')}
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
              <select
                className={cn(INPUT, 'w-[5.5rem] shrink-0 px-2 font-mono')}
                value={currency}
                onChange={(e) => setCurrency(e.target.value as Currency)}
                aria-label={f.label(d.amount, currency)}
              >
                {CURRENCIES.map((code) => (
                  <option key={code} value={code}>
                    {code}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <label className="flex flex-col gap-1 text-[13px]">
            {d.station}
            <input className={INPUT} value={station} onChange={(e) => setStation(e.target.value)} maxLength={120} />
          </label>
        </div>

        <input
          ref={camera}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            void onPhoto(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
        <div className="flex items-center gap-3">
          {preview && (
            // eslint-disable-next-line @next/next/no-img-element -- снимок с телефона, ещё не на сервере
            <img src={preview} alt="" className="size-14 shrink-0 rounded-control border border-line object-cover" />
          )}
          <button
            type="button"
            className="h-12 flex-1 rounded-control border-[1.5px] border-line-strong bg-surface px-4 text-[15px] font-semibold"
            onClick={() => camera.current?.click()}
          >
            {photo ? d.receiptRetake : d.receipt}
          </button>
        </div>

        {error && <p className="text-[14px] text-danger">{error}</p>}
        {warning ? (
          <div className="flex flex-col gap-2 rounded-card bg-warn/10 px-3 py-3">
            <p className="text-[14px] text-warn">{warning}</p>
            <button type="button" className={cn(BUTTON, 'bg-ink text-surface')} disabled={busy} onClick={() => save(true)}>
              {d.confirmAnyway}
            </button>
          </div>
        ) : (
          <button type="button" className={cn(BUTTON, 'bg-accent text-accent-ink')} disabled={busy} onClick={() => save(false)}>
            {d.save}
          </button>
        )}
        {saved && <p className="text-[14px] text-ok">{d.saved}</p>}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-[17px] font-semibold">{d.recent}</h2>
        {queued.length === 0 && state.entries.length === 0 && <p className="text-[15px] text-ink-muted">{d.none}</p>}
        <ul className="flex flex-col gap-2">
          {queued.map((event) => {
            let data: { lines?: { product: FuelProduct; quantity: number }[]; odometer_km?: number } = {};
            try {
              data = JSON.parse(event.fields.data);
            } catch {}
            return (
              <li key={event.id} className="rounded-card border border-dashed border-line bg-surface px-4 py-3 text-[15px]">
                <p className="font-semibold">
                  {(data.lines ?? []).map((line) => `${d.products[line.product]} ${f.decimal(line.quantity)} ${fuelUnit(line.product)}`).join(' · ')}
                </p>
                <p className="text-[13px] text-ink-muted">
                  {f.dateTime(event.pressedAt)} · {d.queued}
                </p>
              </li>
            );
          })}
          {state.entries.map((entry) => (
            <li key={entry.id} className="rounded-card border border-line bg-surface px-4 py-3 text-[15px]">
              <p className="font-semibold">
                {d.products[entry.product]} {f.decimal(entry.quantity)} {entry.unit}
                {entry.amount_cents != null && <span className="font-normal text-ink-muted"> · {f.money(entry.amount_cents, entry.currency ?? null)}</span>}
              </p>
              <p className="text-[13px] text-ink-muted">
                {f.dateTime(entry.filled_at)}
                {entry.plate ? ` · ${entry.plate}` : ''}
                {entry.odometer_km != null ? ` · ${f.number(entry.odometer_km)} km` : ''}
                {entry.station ? ` · ${entry.station}` : ''}
              </p>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}

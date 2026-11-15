'use client';

import { useState } from 'react';
import { useI18n } from '@/lib/i18n/provider';

/*
 * Две серии, проверены validate_palette.js на белом фоне (яркость,
 * насыщенность, различимость при дальтонизме, контраст ≥ 3:1). Не
 * статусные цвета: ремонт — не «ошибка», а вид расхода.
 */
const PLANNED = '#0a7ea8';
const REPAIRS = '#7c4bcc';

export type ChartMonth = { month: string; label: string; planned: number; repairs: number };

/**
 * Расходы по месяцам: столбик = плановое (снизу) + ремонт (сверху).
 * Наведение или фокус на месяце — подсказка с суммами; под диаграммой
 * — те же числа таблицей (для чтения с экрана и печати).
 */
export function MonthlyChart({ months }: { months: ChartMonth[] }) {
  const { t, f } = useI18n();
  const s = t.maintenance.costs;
  const [active, setActive] = useState<number | null>(null);
  const [table, setTable] = useState(false);
  const max = Math.max(1, ...months.map((m) => m.planned + m.repairs));
  /* Шкала: круглый шаг (1, 2 или 5 × 10ⁿ), верх — ближайшее кратное над максимумом; линии на каждом шаге (≤ 3). */
  const step = niceStep(max / 3);
  const steps = Math.max(1, Math.ceil(max / step));
  const top = step * steps;
  const grid = Array.from({ length: steps }, (_, i) => step * (steps - i));
  const current = active != null ? months[active] : null;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-4 text-[12px] text-ink-muted">
        <Legend color={PLANNED} label={s.planned} />
        <Legend color={REPAIRS} label={s.repairs} />
        <button type="button" onClick={() => setTable(!table)} className="ml-auto text-accent hover:underline">
          {table ? s.hideTable : s.showTable}
        </button>
      </div>

      <div className="relative">
        {/* Сетка: подписи слева, линии во всю ширину. */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-40">
          {grid.map((g, i) => (
            <div key={i} className="absolute inset-x-0 border-t border-line" style={{ top: `${(1 - g / top) * 100}%` }}>
              <span className="absolute -top-2 left-0 bg-surface pr-1 font-mono text-[10px] text-ink-dim">{f.money(g)}</span>
            </div>
          ))}
          <div className="absolute inset-x-0 bottom-0 border-t border-line-strong" />
        </div>

        <div className="relative flex h-40 items-end gap-1 pl-14" onMouseLeave={() => setActive(null)}>
          {months.map((m, i) => {
            const total = m.planned + m.repairs;
            return (
              <button
                key={m.month}
                type="button"
                className="group relative flex h-full flex-1 flex-col justify-end outline-none"
                onMouseEnter={() => setActive(i)}
                onFocus={() => setActive(i)}
                onBlur={() => setActive(null)}
                aria-label={`${m.label}: ${s.planned} ${f.money(m.planned)}, ${s.repairs} ${f.money(m.repairs)}`}
              >
                {total > 0 && (
                  <span className="mx-auto flex w-full max-w-7 flex-col gap-[2px]" style={{ height: `${(total / top) * 100}%` }}>
                    {m.repairs > 0 && (
                      <span
                        className="block rounded-t"
                        style={{ flexGrow: m.repairs, background: REPAIRS, opacity: active == null || active === i ? 1 : 0.45 }}
                      />
                    )}
                    {m.planned > 0 && (
                      <span
                        className={`block ${m.repairs > 0 ? '' : 'rounded-t'}`}
                        style={{ flexGrow: m.planned, background: PLANNED, opacity: active == null || active === i ? 1 : 0.45 }}
                      />
                    )}
                  </span>
                )}
                <span className="absolute inset-x-0 -bottom-5 text-center text-[10px] text-ink-dim">{m.label}</span>
              </button>
            );
          })}
        </div>

        {current && (
          <div
            className="pointer-events-none absolute top-0 z-10 min-w-52 rounded-control border border-line bg-surface px-3 py-2 text-[12px] shadow-md"
            style={{
              left: `calc(3.5rem + (100% - 3.5rem) * ${(active! + 0.5) / months.length})`,
              transform: active! > months.length / 2 ? 'translateX(calc(-100% - 12px))' : 'translateX(12px)',
            }}
          >
            <p className="mb-1 font-semibold text-ink">{current.label}</p>
            <Row color={REPAIRS} label={s.repairs} value={f.money(current.repairs)} />
            <Row color={PLANNED} label={s.planned} value={f.money(current.planned)} />
            <p className="mt-1 flex justify-between gap-4 border-t border-line pt-1 text-ink">
              <span>{s.monthTotal}</span>
              <span className="font-mono">{f.money(current.planned + current.repairs)}</span>
            </p>
          </div>
        )}
      </div>

      {table && (
        <table className="mt-8 w-full text-[12px]">
          <thead>
            <tr className="text-left text-ink-faint">
              <th className="py-1 font-medium">{s.month}</th>
              <th className="py-1 text-right font-medium">{s.planned}</th>
              <th className="py-1 text-right font-medium">{s.repairs}</th>
              <th className="py-1 text-right font-medium">{s.monthTotal}</th>
            </tr>
          </thead>
          <tbody>
            {months.map((m) => (
              <tr key={m.month} className="border-t border-line">
                <td className="py-1">{m.label}</td>
                <td className="py-1 text-right font-mono">{f.money(m.planned)}</td>
                <td className="py-1 text-right font-mono">{f.money(m.repairs)}</td>
                <td className="py-1 text-right font-mono">{f.money(m.planned + m.repairs)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {!table && <div className="h-6" />}
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="inline-block size-2.5 rounded-sm" style={{ background: color }} aria-hidden="true" />
      {label}
    </span>
  );
}

function Row({ color, label, value }: { color: string; label: string; value: string }) {
  return (
    <p className="flex items-center justify-between gap-4 text-ink-muted">
      <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
        <span className="inline-block size-2 rounded-sm" style={{ background: color }} aria-hidden="true" />
        {label}
      </span>
      <span className="font-mono text-ink">{value}</span>
    </p>
  );
}

/** Круглый шаг шкалы в центах: 1, 2 или 5 × степень десяти (в целых единицах валюты). */
function niceStep(raw: number): number {
  const units = Math.max(1, raw / 100);
  const pow = 10 ** Math.floor(Math.log10(units));
  const n = units / pow;
  const nice = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return nice * pow * 100;
}

'use client';

import { useState } from 'react';
import { cn } from '@/lib/cn';
import { useI18n } from '@/lib/i18n/provider';
import { Badge, statusToneClass } from '@/components/ui';
import { DEFECTS, pickDefects, scoreInspection, severityOf, type DefectId, type InspectionScore } from '@/lib/training/inspection';
import { primaryButton, secondaryButton } from './ui';

/** Где на рисунке каждое место: центр цели нажатия, координаты viewBox 400 × 170. */
const SPOTS: Record<DefectId, { x: number; y: number }> = {
  mirror: { x: 12, y: 48 },
  windscreen: { x: 33, y: 56 },
  plate: { x: 22, y: 116 },
  wheelNut: { x: 55, y: 137 },
  oilLeak: { x: 72, y: 158 },
  airHose: { x: 104, y: 66 },
  fifthWheel: { x: 134, y: 102 },
  tread: { x: 125, y: 137 },
  sideMarker: { x: 230, y: 104 },
  bulge: { x: 300, y: 137 },
  mudflap: { x: 373, y: 134 },
  rearLight: { x: 385, y: 94 },
};

const ORDER = DEFECTS.map((d) => d.id) as DefectId[];

/** Колесо: протектор насечками; изношенное — гладкое, с грыжей — с выпуклостью, со сдвинутой гайкой — метка повёрнута. */
function Wheel({ cx, worn, bulge, nut }: { cx: number; worn?: boolean; bulge?: boolean; nut?: boolean }) {
  const cy = 137;
  return (
    <g>
      <circle cx={cx} cy={cy} r={14} className="fill-ink" />
      {!worn &&
        Array.from({ length: 12 }, (_, i) => {
          const a = (i * Math.PI) / 6;
          return (
            <line
              key={i}
              x1={cx + Math.cos(a) * 11.5}
              y1={cy + Math.sin(a) * 11.5}
              x2={cx + Math.cos(a) * 14}
              y2={cy + Math.sin(a) * 14}
              className="stroke-surface/60"
              strokeWidth={1.2}
            />
          );
        })}
      {bulge && <circle cx={cx + 11} cy={cy - 8} r={5} className="fill-ink" />}
      <circle cx={cx} cy={cy} r={7} className="fill-line-strong" />
      {[0, 90, 180, 270].map((deg, i) => (
        <rect
          key={deg}
          x={cx - 0.9}
          y={cy - 6.5}
          width={1.8}
          height={3}
          className={nut && i === 1 ? 'fill-danger' : 'fill-ink'}
          transform={`rotate(${deg + (nut && i === 1 ? 45 : 0)} ${cx} ${cy})`}
        />
      ))}
    </g>
  );
}

/** Рисунок автопоезда сбоку: неисправности из раунда нарисованы, остальное — в порядке. */
function Truck({ bad }: { bad: ReadonlySet<DefectId> }) {
  const has = (id: DefectId) => bad.has(id);
  return (
    <g>
      {/* дорога */}
      <line x1={0} y1={151} x2={400} y2={151} className="stroke-line-strong" strokeWidth={1.5} />
      {has('oilLeak') && <ellipse cx={72} cy={156} rx={18} ry={3.5} className="fill-ink/70" />}

      {/* прицеп */}
      <rect x={110} y={22} width={275} height={80} rx={3} className="fill-surface stroke-ink" strokeWidth={2} />
      {[165, 220, 275, 330].map((x) => (
        <line key={x} x1={x} y1={24} x2={x} y2={100} className="stroke-line" strokeWidth={1} />
      ))}
      <rect x={110} y={102} width={275} height={10} className="fill-ink/80" />
      <rect x={225} y={101} width={10} height={5} rx={1} className={has('sideMarker') ? 'fill-line-strong' : 'fill-warn'} />
      <rect x={165} y={101} width={10} height={5} rx={1} className="fill-warn" />
      {/* задний фонарь */}
      <rect x={380} y={88} width={8} height={12} rx={1.5} className={has('rearLight') ? 'fill-line-strong' : 'fill-danger'} />
      {has('rearLight') && <path d="M381 90 l5 4 -3 2 4 3" className="stroke-ink fill-none" strokeWidth={1} />}
      {/* брызговик за последним колесом */}
      {!has('mudflap') && <rect x={370} y={118} width={5} height={26} rx={1} className="fill-ink" />}
      <Wheel cx={300} bulge={has('bulge')} />
      <Wheel cx={328} />
      <Wheel cx={356} />

      {/* тягач */}
      <rect x={18} y={112} width={135} height={10} rx={2} className="fill-ink/80" />
      <path d="M20 112 V40 Q20 30 30 30 H88 Q96 30 96 40 V112 Z" className="fill-accent stroke-ink" strokeWidth={2} />
      <path d="M24 40 Q24 36 28 36 H44 V74 H24 Z" className="fill-accent-wash stroke-ink" strokeWidth={1.2} />
      {has('windscreen') && <path d="M28 44 l6 6 -3 4 7 8" className="stroke-ink fill-none" strokeWidth={1.2} />}
      <rect x={50} y={42} width={30} height={26} rx={2} className="fill-accent-wash stroke-ink" strokeWidth={1.2} />
      {/* зеркало */}
      <line x1={20} y1={48} x2={12} y2={44} className="stroke-ink" strokeWidth={2} />
      <rect x={6} y={38} width={8} height={16} rx={2} className="fill-accent-wash stroke-ink" strokeWidth={1.5} />
      {has('mirror') && <path d="M7 40 l6 5 -5 3 5 4" className="stroke-ink fill-none" strokeWidth={1} />}
      {/* номер спереди */}
      <rect x={14} y={113} width={17} height={7} rx={1} className="fill-surface stroke-ink" strokeWidth={1} />
      {has('plate') ? (
        <ellipse cx={22} cy={116.5} rx={8} ry={3.5} className="fill-ink/50" />
      ) : (
        <line x1={17} y1={116.5} x2={28} y2={116.5} className="stroke-ink" strokeWidth={1.5} />
      )}
      {/* седло и его рычаг */}
      <rect x={112} y={104} width={36} height={6} rx={1} className="fill-ink" />
      <line
        x1={140}
        y1={106}
        x2={has('fifthWheel') ? 152 : 146}
        y2={has('fifthWheel') ? 96 : 104}
        className={has('fifthWheel') ? 'stroke-danger' : 'stroke-ink'}
        strokeWidth={2.5}
        strokeLinecap="round"
      />
      {/* воздушные шланги между кабиной и прицепом */}
      <path d="M96 60 Q104 58 110 64" className="stroke-danger fill-none" strokeWidth={2} />
      {has('airHose') ? (
        <path d="M96 68 Q104 80 100 98" className="stroke-live fill-none" strokeWidth={2} />
      ) : (
        <path d="M96 68 Q104 66 110 72" className="stroke-live fill-none" strokeWidth={2} />
      )}
      <Wheel cx={55} nut={has('wheelNut')} />
      <Wheel cx={125} worn={has('tread')} />
    </g>
  );
}

/**
 * «Löydä viat»: рисунок автопоезда, в раунде четыре неисправности. Водитель
 * отмечает места; после проверки — найденные, пропущенные и ложные тревоги,
 * у каждой неисправности — насколько она серьёзна и почему.
 */
export function InspectionGame({ mode }: { mode: 'pro' | 'new' }) {
  const { t, m } = useI18n();
  const texts = t.training.inspect;
  /* Первый раунд без случайности: сервер и браузер рисуют одно и то же. «Новый осмотр» — уже вперемешку. */
  const [defects, setDefects] = useState<DefectId[]>(() => pickDefects(() => 0.37));
  const [marked, setMarked] = useState<DefectId[]>([]);
  const [score, setScore] = useState<InspectionScore | null>(null);

  const bad = new Set(defects);

  function toggle(id: DefectId) {
    if (score) return;
    setMarked((current) => (current.includes(id) ? current.filter((x) => x !== id) : [...current, id]));
  }

  function again() {
    setDefects(pickDefects());
    setMarked([]);
    setScore(null);
  }

  const ring = (id: DefectId): string => {
    if (!score) return marked.includes(id) ? 'stroke-accent' : 'stroke-transparent';
    if (score.found.includes(id)) return 'stroke-ok';
    if (score.missed.includes(id)) return 'stroke-danger';
    if (score.falseAlarms.includes(id)) return 'stroke-ink-faint';
    return 'stroke-transparent';
  };

  const describe = (id: DefectId) => (
    <li key={id} className="rounded-control border border-line bg-surface px-3 py-2.5">
      <div className="flex items-center justify-between gap-2">
        <b className="text-[15px]">{texts.defects[id].name}</b>
        <Badge tone={severityOf(id) === 'stop' ? 'danger' : 'warn'}>
          {severityOf(id) === 'stop' ? texts.stop : texts.fix}
        </Badge>
      </div>
      <p className="mt-1 text-[14px] text-ink-muted">{texts.defects[id].why}</p>
    </li>
  );

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-xl font-semibold tracking-tight">{texts.title}</h2>
      <p className="text-[16px]">{texts.task}</p>

      {/*
        * Рисунок шире экрана и листается вбок — как обход машины. Иначе на
        * телефоне цели нажатия выходили меньше 44 px.
        */}
      <div className="-mx-4 overflow-x-auto px-4 pb-1">
        <svg
          viewBox="0 0 400 170"
          className="w-[640px] max-w-none rounded-card border border-line bg-sunken"
          role="group"
          aria-label={texts.picture}
        >
          <Truck bad={bad} />
          {ORDER.map((id, index) => {
            const spot = SPOTS[id];
            const on = marked.includes(id);
            return (
              <g
                key={id}
                role="button"
                tabIndex={0}
                aria-pressed={on}
                aria-label={`${index + 1}`}
                onClick={() => toggle(id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    toggle(id);
                  }
                }}
                className="cursor-pointer outline-none"
              >
                {/* Невидимая цель под палец и видимое кольцо отметки. */}
                <circle cx={spot.x} cy={spot.y} r={17} className="fill-transparent" />
                <circle cx={spot.x} cy={spot.y} r={13} className={cn('fill-none', ring(id))} strokeWidth={3} strokeDasharray={score?.missed.includes(id) ? '4 3' : undefined} />
              </g>
            );
          })}
        </svg>
      </div>

      {mode === 'new' && !score && (
        <p className="rounded-control border border-dashed border-warn/60 bg-warn/5 px-3 py-2.5 text-[15px]">
          <b className="text-warn">{t.training.hint}:</b> {texts.newHint}
        </p>
      )}

      {!score ? (
        <button type="button" className={primaryButton} onClick={() => setScore(scoreInspection(defects, marked))}>
          {texts.check} · {marked.length}
        </button>
      ) : (
        <div className="flex flex-col gap-3" aria-live="polite">
          <p
            className={cn(
              'rounded-control border px-3 py-2.5 text-[16px] font-semibold',
              statusToneClass[score.missed.length === 0 && score.falseAlarms.length === 0 ? 'ok' : score.missedStop ? 'danger' : 'warn'],
            )}
          >
            {m('training.inspect.score', { found: score.found.length, total: defects.length })}
            {score.missedStop && <span className="mt-1 block text-[14px] font-normal">{m('training.inspect.missedStop')}</span>}
          </p>
          {score.found.length > 0 && (
            <section>
              <h3 className="label-micro mb-1.5">{texts.found}</h3>
              <ul className="flex flex-col gap-2">{score.found.map(describe)}</ul>
            </section>
          )}
          {score.missed.length > 0 && (
            <section>
              <h3 className="label-micro mb-1.5 text-danger">{texts.missed}</h3>
              <ul className="flex flex-col gap-2">{score.missed.map(describe)}</ul>
            </section>
          )}
          {score.falseAlarms.length > 0 && (
            <p className="text-[14px] text-ink-muted">
              {texts.falseAlarm}: {score.falseAlarms.length}
            </p>
          )}
          <button type="button" className={secondaryButton} onClick={again}>
            {texts.again}
          </button>
        </div>
      )}
    </div>
  );
}

import type { ReactNode } from 'react';
import { Card, CardBody, Mono } from '@/components/ui';
import { ON_REQUEST_FROM, SUBSCRIPTION_LADDER } from '@/lib/config';
import { legalMassKg, type MotorUnit, type TrailerUnit } from '@/lib/fleet/mass';
import { getI18n, type Locale } from '@/lib/i18n';

/**
 * Две секции главной для перевозчика: кабинет (конструктор сцепок и
 * инструменты автопарка) и цены.
 *
 * Пределы массы у сцепок не вписаны в текст, а считаются той же функцией,
 * что и в кабинете (src/lib/fleet/mass.ts): поменяется таблица — витрина
 * не разойдётся с тем, что перевозчик увидит у себя.
 */

type Body = 'BOX' | 'TIPPER' | 'LOWBED' | 'CONTAINER';
type Combo = {
  key: 'Ppv' | 'Puolikas' | 'Tral' | 'Kasetti' | 'Tpv' | 'Kontti';
  motor: MotorUnit;
  motorBody?: Body;
  trailer: TrailerUnit;
  trailerBody: Body;
};

/* Типичные оси для каждой сцепки; точный предел в кабинете — по своим машинам. */
const COMBOS: readonly Combo[] = [
  {
    key: 'Ppv',
    motor: { kind: 'TRACTOR', axles: 2 },
    trailer: { kind: 'SEMI', axles: 3, twinWheels: false },
    trailerBody: 'BOX',
  },
  {
    key: 'Puolikas',
    motor: { kind: 'TRACTOR', axles: 3 },
    trailer: { kind: 'SEMI', axles: 3, twinWheels: true },
    trailerBody: 'TIPPER',
  },
  {
    key: 'Tral',
    motor: { kind: 'TRACTOR', axles: 3 },
    trailer: { kind: 'SEMI', axles: 4, twinWheels: false },
    trailerBody: 'LOWBED',
  },
  {
    key: 'Kasetti',
    motor: { kind: 'TRUCK', axles: 5 },
    motorBody: 'TIPPER',
    trailer: { kind: 'FULL', axles: 4, twinWheels: true },
    trailerBody: 'TIPPER',
  },
  {
    key: 'Tpv',
    motor: { kind: 'TRUCK', axles: 4 },
    motorBody: 'BOX',
    trailer: { kind: 'FULL', axles: 4, twinWheels: true },
    trailerBody: 'BOX',
  },
  {
    key: 'Kontti',
    motor: { kind: 'TRACTOR', axles: 2 },
    trailer: { kind: 'SEMI', axles: 3, twinWheels: false },
    trailerBody: 'CONTAINER',
  },
];

export async function LandingFleet({ locale }: { locale: Locale }) {
  const { t } = await getI18n(locale);
  const l = t.landing;
  const tonnes = new Intl.NumberFormat(t.meta.intl, {
    maximumFractionDigits: 0,
  });
  const finland = new Intl.DisplayNames([locale], { type: 'region' }).of('FI') ?? 'FI';

  /* Примеры к четырём схемам оплаты водителя — названия те же, что в кабинете (t.payModel). */
  const money = new Intl.NumberFormat(t.meta.intl, { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 });
  const num = new Intl.NumberFormat(t.meta.intl, { maximumFractionDigits: 2 });
  const payExamples: [string, string][] = [
    [t.payModel.PER_KM, `${num.format(1200)} km × ${money.format(0.12)} = ${money.format(144)}`],
    [t.payModel.TRIP_PERCENT, `${money.format(1450)} × 25 % = ${money.format(362.5)}`],
    [t.payModel.FLAT_HOURLY, `${num.format(9.5)} h × ${money.format(18)} = ${money.format(171)}`],
    [t.payModel.TES, l.toolDriversTes],
  ];

  const tools: { title: string; text: string; spec: string; examples?: [string, string][] }[] = [
    { title: l.toolFuel, text: l.toolFuelText, spec: 'PDF · CSV' },
    { title: l.toolGps, text: l.toolGpsText, spec: '8 × API' },
    { title: l.toolEcon, text: l.toolEconText, spec: 'PDF · CSV' },
    {
      title: l.toolParts,
      text: l.toolPartsText,
      spec: 'FI SE NO DK EE LV LT PL DE',
    },
    { title: l.toolDrivers, text: l.toolDriversText, spec: '', examples: payExamples },
    { title: l.toolSites, text: l.toolSitesText, spec: 't · m³ · h' },
  ];

  return (
    <section id="fleet" className="border-y border-line bg-surface">
      <div className="mx-auto w-full max-w-6xl px-5 py-20">
        <p className="label-micro">{l.fleetEyebrow}</p>
        <h2 className="mt-2.5 max-w-[34ch] text-[clamp(26px,3vw,34px)] leading-tight font-semibold tracking-tight text-balance">{l.fleetTitle}</h2>
        <p className="mt-3 max-w-[62ch] text-[16px] text-ink-muted">{l.fleetLede}</p>

        {/* ── Конструктор сцепок ── */}
        <div className="mt-10">
          <h3 className="text-[20px] font-semibold tracking-tight">{l.comboTitle}</h3>
          <p className="mt-2 max-w-[70ch] text-[16px] text-ink-muted">{l.comboLede}</p>

          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {COMBOS.map((combo) => {
              const fi = legalMassKg('FI', combo.motor, [combo.trailer]).kg;
              const eu = legalMassKg('DE', combo.motor, [combo.trailer]).kg;
              const name = l[`combo${combo.key}`];
              const [code, ...rest] = name.split(' · ');
              return (
                <Card key={combo.key} >
                  <CardBody className="flex h-full flex-col">
                    <ComboSketch combo={combo} />
                    <p className="mt-4 label-micro" data-accent>
                      {code}
                    </p>
                    <h4 className="mt-1 text-[17px] leading-snug font-semibold tracking-tight">{rest.join(' · ')}</h4>
                    <p className="mt-1.5 text-[15px] text-ink-muted">{l[`combo${combo.key}Text`]}</p>
                    <dl className="mt-auto grid grid-cols-3 gap-2 pt-4">
                      {[
                        [l.comboAxles, `${combo.motor.axles}+${combo.trailer.axles}`],
                        [finland, `≤ ${tonnes.format(fi / 1000)} t`],
                        [l.comboEu, `${tonnes.format(eu / 1000)} t`],
                      ].map(([k, v]) => (
                        <div key={k} className="border-t border-line pt-2">
                          <dt className="label-micro">{k}</dt>
                          <dd className="mt-0.5 font-mono text-[14px] text-ink">{v}</dd>
                        </div>
                      ))}
                    </dl>
                  </CardBody>
                </Card>
              );
            })}
          </div>
          <p className="mt-3 max-w-[80ch] text-[13px] leading-relaxed text-ink-faint">{l.comboNote}</p>
        </div>

        {/* ── Инструменты автопарка ── */}
        <div className="mt-12 grid gap-px overflow-hidden rounded-card border border-line bg-line sm:grid-cols-2 lg:grid-cols-3">
          {tools.map((tool) => (
            <div key={tool.title} className="flex flex-col bg-surface p-5">
              <h3 className="text-[17px] leading-snug font-semibold tracking-tight">{tool.title}</h3>
              <p className="mt-1.5 text-[15px] text-ink-muted">{tool.text}</p>
              {tool.examples && (
                <dl className="mt-3 grid gap-2">
                  {tool.examples.map(([name, calc]) => (
                    <div key={name} className="border-t border-line pt-2">
                      <dt className="label-micro">{name}</dt>
                      <dd className="mt-0.5 font-mono text-[13px] leading-snug text-ink">{calc}</dd>
                    </div>
                  ))}
                </dl>
              )}
              <Mono className="mt-auto pt-3 text-[12px] tracking-[0.08em] text-ink-faint">{tool.spec}</Mono>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export async function LandingPricing({ locale }: { locale: Locale }) {
  const { t } = await getI18n(locale);
  const l = t.landing;
  const eur = new Intl.NumberFormat(t.meta.intl, {
    style: 'currency',
    currency: 'EUR',
  });

  return (
    <section id="pricing" className="border-t border-line">
      <div className="mx-auto w-full max-w-6xl px-5 py-20">
        <p className="label-micro">{l.pricingEyebrow}</p>
        <h2 className="mt-2.5 max-w-[32ch] text-[clamp(26px,3vw,34px)] leading-tight font-semibold tracking-tight text-balance">{l.pricingTitle}</h2>
        <p className="mt-3 max-w-[62ch] text-[16px] text-ink-muted">{l.pricingLede}</p>

        <div className="mt-8 grid gap-4 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
          <Card >
            <CardBody className="p-6">
              <p className="label-micro" data-accent>
                {l.priceOwnEyebrow}
              </p>
              <h3 className="mt-2 text-[20px] font-semibold tracking-tight">{l.priceOwnTitle}</h3>
              <p className="mt-2 text-[15px] text-ink-muted">{l.priceOwnText}</p>

              <table className="mt-5 w-full border-collapse text-[15px]">
                <thead>
                  <tr className="border-b border-line">
                    <th className="label-micro py-2 text-left font-normal">{l.priceVehicles}</th>
                    <th className="label-micro py-2 text-right font-normal">{l.pricePerVehicle}</th>
                  </tr>
                </thead>
                <tbody>
                  {SUBSCRIPTION_LADDER.map((step, i) => (
                    <tr key={step.from} className="border-b border-line">
                      <td className="py-2.5 font-mono">{`${step.from}–${step.to ?? ON_REQUEST_FROM - 1}`}</td>
                      <td className={`py-2.5 text-right font-mono ${i === 0 ? 'text-[18px] font-semibold text-ink' : 'text-ink'}`}>
                        {eur.format(step.cents / 100)}
                      </td>
                    </tr>
                  ))}
                  <tr>
                    <td className="py-2.5 font-mono">{l.priceFromN.replace('{n}', String(ON_REQUEST_FROM))}</td>
                    <td className="py-2.5 text-right text-ink-muted">{l.priceOnRequest}</td>
                  </tr>
                </tbody>
              </table>

              <p className="mt-4 inline-flex rounded-control border border-accent-line bg-accent-wash px-3 py-1 text-[13px] font-semibold text-accent">
                {l.priceYear}
              </p>
            </CardBody>
          </Card>

          <div className="grid gap-4">
            {[
              {
                eyebrow: l.priceSubEyebrow,
                title: l.priceSubTitle,
                text: l.priceSubText,
              },
              {
                eyebrow: l.priceShipEyebrow,
                title: l.priceShipTitle,
                text: l.priceShipText,
              },
            ].map((card) => (
              <Card key={card.title}>
                <CardBody className="p-6">
                  <p className="label-micro">{card.eyebrow}</p>
                  <h3 className="mt-2 font-mono text-[22px] font-semibold tracking-tight">{card.title}</h3>
                  <p className="mt-2 text-[15px] text-ink-muted">{card.text}</p>
                </CardBody>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/*
 * Схема сцепки сбоку, в одном масштабе для всех карточек: 1 единица = 10 см,
 * поэтому длины сцепок честно сравнимы между собой. Иллюстрация — подпись
 * рядом говорит то же словами, поэтому aria-hidden.
 */
const G = 48; // земля
const VIEW_W = 192;
const AXLE = 12; // шаг осей в тележке, 1,2 м

const INK = 'fill-ink';
const BODY = 'fill-accent-wash stroke-accent';
const RIB = 'stroke-accent';

function Wheel({ cx, r = 4.8 }: { cx: number; r?: number }) {
  return (
    <g>
      <circle cx={cx} cy={G - r} r={r} className={INK} />
      <circle cx={cx} cy={G - r} r={r * 0.5} className="fill-sunken" />
      <circle cx={cx} cy={G - r} r={r * 0.18} className={INK} />
    </g>
  );
}

/* Оси тележки вокруг центра группы. */
const group = (center: number, n: number, step = AXLE) => Array.from({ length: n }, (_, i) => center + (i - (n - 1) / 2) * step);

/** Кабина над передней осью, смотрит влево. x — передний край. */
function Cab({ x }: { x: number }) {
  return (
    <g strokeLinejoin="round">
      <path
        d={`M${x + 0.6} ${G - 10} L${x} ${G - 21} L${x + 1.4} ${G - 34} Q${x + 2} ${G - 37.5} ${x + 5.5} ${G - 37.5} L${x + 21.5} ${G - 37.5} Q${x + 23} ${G - 37.5} ${x + 23} ${G - 36} L${x + 23} ${G - 10} Z`}
        className="fill-surface stroke-ink"
        strokeWidth={1.1}
      />
      {/* окно двери и стойка */}
      <path d={`M${x + 2.6} ${G - 32.5} L${x + 12.5} ${G - 32.5} L${x + 12.5} ${G - 23.5} L${x + 1.8} ${G - 23.5} Z`} className="fill-sunken stroke-ink" strokeWidth={0.8} />
      <line x1={x + 14} y1={G - 34} x2={x + 14} y2={G - 12} className="stroke-ink" strokeWidth={0.6} />
      {/* спальник: окно сзади */}
      <rect x={x + 16} y={G - 32.5} width={5} height={5} rx={1} className="fill-sunken stroke-ink" strokeWidth={0.6} />
      {/* ступени и бампер */}
      <rect x={x + 3} y={G - 16} width={7} height={1.2} className={INK} />
      <rect x={x - 0.8} y={G - 12.5} width={6.5} height={3} rx={0.8} className={INK} />
      <rect x={x - 0.2} y={G - 15} width={2.4} height={1.6} rx={0.4} className="fill-warn" />
    </g>
  );
}

function Frame({ x0, x1, y = G - 12.5, h = 2.4 }: { x0: number; x1: number; y?: number; h?: number }) {
  return <rect x={x0} y={y} width={x1 - x0} height={h} className={INK} />;
}

/** Тентовый или фургонный кузов: стенка с рёбрами и рамы сверху/снизу. */
function BoxBody({ x0, x1, top = G - 40, bottom = G - 13 }: { x0: number; x1: number; top?: number; bottom?: number }) {
  const ribs = [];
  for (let x = x0 + 9; x < x1 - 4; x += 9) ribs.push(<line key={x} x1={x} y1={top + 1.5} x2={x} y2={bottom - 1.5} className={RIB} strokeWidth={0.5} opacity={0.45} />);
  return (
    <g>
      <rect x={x0} y={top} width={x1 - x0} height={bottom - top} rx={1.2} className={BODY} strokeWidth={1} />
      {ribs}
      <line x1={x0} y1={top + 2.2} x2={x1} y2={top + 2.2} className={RIB} strokeWidth={0.6} />
      <line x1={x0} y1={bottom - 2.2} x2={x1} y2={bottom - 2.2} className={RIB} strokeWidth={0.6} />
    </g>
  );
}

/** Самосвальный кузов: корыто, выше спереди, с вертикальными рёбрами. */
function TipperBody({ x0, x1, bottom = G - 13 }: { x0: number; x1: number; bottom?: number }) {
  const top = bottom - 19;
  const ribs = [];
  for (let x = x0 + 8; x < x1 - 4; x += 8) ribs.push(<line key={x} x1={x} y1={top + 1.6} x2={x} y2={bottom - 1} className={RIB} strokeWidth={0.7} opacity={0.6} />);
  return (
    <g strokeLinejoin="round">
      <path d={`M${x0 + 1.5} ${bottom} L${x0} ${top - 2} L${x1 - 1} ${top} L${x1} ${bottom - 3} Q${x1} ${bottom} ${x1 - 3} ${bottom} Z`} className={BODY} strokeWidth={1} />
      {ribs}
      <line x1={x0 + 0.4} y1={top - 0.2} x2={x1 - 1} y2={top + 1.6} className={RIB} strokeWidth={1.4} />
    </g>
  );
}

/** 40-футовый контейнер на шасси: гофра и угловые фитинги. */
function ContainerBody({ x0, x1, bottom = G - 13.5 }: { x0: number; x1: number; bottom?: number }) {
  const top = bottom - 26;
  const ribs = [];
  for (let x = x0 + 3; x < x1 - 2; x += 3) ribs.push(<line key={x} x1={x} y1={top + 1.5} x2={x} y2={bottom - 1.5} className={RIB} strokeWidth={0.45} opacity={0.4} />);
  return (
    <g>
      <rect x={x0} y={top} width={x1 - x0} height={bottom - top} className={BODY} strokeWidth={1} />
      {ribs}
      {[
        [x0, top],
        [x1 - 2.4, top],
        [x0, bottom - 2],
        [x1 - 2.4, bottom - 2],
      ].map(([x, y]) => (
        <rect key={`${x}-${y}`} x={x} y={y} width={2.4} height={2} className="fill-accent" />
      ))}
    </g>
  );
}

/** Низкорамный полуприцеп с гусем, аппарелями и экскаватором на площадке. */
function Lowbed({ f, axles }: { f: number; axles: number }) {
  const deckTop = G - 10.5;
  const end = f + 150;
  return (
    <g strokeLinejoin="round">
      <path
        d={`M${f} ${G - 16.5} L${f + 25} ${G - 16.5} L${f + 32} ${deckTop} L${end} ${deckTop} L${end} ${deckTop + 2.8} L${f + 31} ${deckTop + 2.8} L${f + 24} ${G - 13.5} L${f} ${G - 13.5} Z`}
        className={BODY}
        strokeWidth={1}
      />
      {/* аппарели, поднятые */}
      <path d={`M${end - 7} ${deckTop} L${end - 2} ${deckTop} L${end + 1} ${deckTop - 13} L${end - 3} ${deckTop - 13} Z`} className={BODY} strokeWidth={0.9} />
      {/* экскаватор: гусеница, поворотная часть, кабина, стрела с ковшом */}
      <rect x={f + 44} y={deckTop - 6} width={36} height={6} rx={3} className={INK} />
      {[f + 48, f + 56, f + 64, f + 72, f + 77].map((x) => (
        <circle key={x} cx={x} cy={deckTop - 3} r={1.4} className="fill-sunken" />
      ))}
      <path d={`M${f + 47} ${deckTop - 6} L${f + 47} ${deckTop - 16} L${f + 80} ${deckTop - 16} Q${f + 84} ${deckTop - 16} ${f + 84} ${deckTop - 12} L${f + 84} ${deckTop - 6} Z`} className="fill-warn stroke-ink" strokeWidth={0.9} />
      <path d={`M${f + 49} ${deckTop - 16} L${f + 49} ${deckTop - 27} L${f + 58} ${deckTop - 27} L${f + 60} ${deckTop - 16} Z`} className="fill-warn stroke-ink" strokeWidth={0.9} />
      <path d={`M${f + 50.5} ${deckTop - 25.5} L${f + 57} ${deckTop - 25.5} L${f + 58.3} ${deckTop - 18} L${f + 50.5} ${deckTop - 18} Z`} className="fill-sunken" />
      <path d={`M${f + 62} ${deckTop - 15} L${f + 74} ${deckTop - 33} L${f + 96} ${deckTop - 22} L${f + 98} ${deckTop - 6}`} className="fill-none stroke-ink" strokeWidth={2.6} strokeLinecap="round" />
      <path d={`M${f + 94} ${deckTop - 8} L${f + 103} ${deckTop - 8} L${f + 101} ${deckTop - 1} L${f + 95} ${deckTop - 1} Z`} className="fill-ink" />
      {group(end - 22, axles, 9).map((x) => (
        <Wheel key={x} cx={x} r={3.8} />
      ))}
    </g>
  );
}

/** Тягач: кабина, рама, бак, седло. Возвращает центр седла. */
function Tractor({ x, axles }: { x: number; axles: number }) {
  const rear = axles === 2 ? [x + 37] : [x + 35, x + 47];
  const len = rear[rear.length - 1] + 8 - x;
  const kingpin = (rear[0] + rear[rear.length - 1]) / 2 - 1;
  return {
    kingpin,
    node: (
      <g>
        <Frame x0={x + 2} x1={x + len} />
        <rect x={kingpin - 5} y={G - 14} width={10} height={1.6} rx={0.5} className={INK} />
        <Cab x={x} />
        <Wheel cx={x + 9} />
        {rear.map((cx) => (
          <Wheel key={cx} cx={cx} />
        ))}
      </g>
    ),
  };
}

/** Полуприцеп от переднего края f: длина, кузов, опорные стойки, тележка у хвоста. */
function Semi({ f, len, axles, body }: { f: number; len: number; axles: number; body: 'BOX' | 'TIPPER' | 'CONTAINER' }) {
  const end = f + len;
  const legAt = body === 'TIPPER' ? 36 : 44;
  return (
    <g>
      <Frame x0={f} x1={end} y={G - 14} h={1.8} />
      {/* опорные стойки — метра три за шкворнем */}
      <line x1={f + legAt} y1={G - 12} x2={f + legAt} y2={G - 3.5} className="stroke-ink" strokeWidth={1} />
      <rect x={f + legAt - 1.8} y={G - 3.5} width={3.6} height={1.2} rx={0.4} className={INK} />
      {body === 'BOX' && <BoxBody x0={f} x1={end} top={G - 40} bottom={G - 14} />}
      {body === 'TIPPER' && <TipperBody x0={f + 1} x1={end} bottom={G - 14} />}
      {body === 'CONTAINER' && <ContainerBody x0={f + 2} x1={end - 1} bottom={G - 14} />}
      {group(end - (body === 'TIPPER' ? 20 : 30), axles).map((cx) => (
        <Wheel key={cx} cx={cx} />
      ))}
    </g>
  );
}

/** Грузовик (нуппи) с кузовом: 2 передние оси при 4+ осях, остальные сзади. */
function Truck({ x, axles, body }: { x: number; axles: number; body: 'BOX' | 'TIPPER' }) {
  const front = axles >= 4 ? [x + 9, x + 21] : [x + 9];
  const rearN = axles - front.length;
  const len = 52 + rearN * AXLE;
  const rearCenter = x + len - 14;
  return {
    end: x + len,
    node: (
      <g>
        <Frame x0={x + 2} x1={x + len} />
        {body === 'BOX' ? <BoxBody x0={x + 25} x1={x + len} /> : <TipperBody x0={x + 25} x1={x + len} />}
        <Cab x={x} />
        {[...front, ...group(rearCenter, rearN)].map((cx) => (
          <Wheel key={cx} cx={cx} />
        ))}
      </g>
    ),
  };
}

/** Прицеп на дышле: поворотная тележка спереди, вторая сзади. */
function FullTrailer({ x, axles, body }: { x: number; axles: number; body: 'BOX' | 'TIPPER' }) {
  const len = 72;
  const frontN = Math.ceil(axles / 2);
  return (
    <g>
      <Frame x0={x} x1={x + len} y={G - 14} h={1.8} />
      {body === 'BOX' ? <BoxBody x0={x} x1={x + len} top={G - 40} bottom={G - 14} /> : <TipperBody x0={x} x1={x + len} bottom={G - 14} />}
      {[...group(x + 15, frontN), ...group(x + len - 14, axles - frontN)].map((cx) => (
        <Wheel key={cx} cx={cx} />
      ))}
    </g>
  );
}

function ComboSketch({ combo }: { combo: Combo }) {
  const x = 3;
  let art: ReactNode;

  if (combo.motor.kind === 'TRACTOR') {
    const tractor = Tractor({ x, axles: combo.motor.axles });
    const k = tractor.kingpin;
    art = (
      <>
        {combo.trailerBody === 'LOWBED' ? (
          <Lowbed f={k - 12} axles={combo.trailer.axles} />
        ) : (
          <Semi
            f={k - (combo.trailerBody === 'TIPPER' ? 8 : 14)}
            len={combo.trailerBody === 'TIPPER' ? 95 : combo.trailerBody === 'CONTAINER' ? 124 : 136}
            axles={combo.trailer.axles}
            body={combo.trailerBody === 'CONTAINER' ? 'CONTAINER' : combo.trailerBody === 'TIPPER' ? 'TIPPER' : 'BOX'}
          />
        )}
        {tractor.node}
      </>
    );
  } else {
    const body = combo.motorBody === 'TIPPER' ? 'TIPPER' : 'BOX';
    const truck = Truck({ x, axles: combo.motor.axles, body });
    const t0 = truck.end + 9;
    art = (
      <>
        <path d={`M${truck.end - 1} ${G - 11} L${t0 + 2} ${G - 11}`} className="fill-none stroke-ink" strokeWidth={1.4} />
        <FullTrailer x={t0} axles={combo.trailer.axles} body={combo.trailerBody === 'TIPPER' ? 'TIPPER' : 'BOX'} />
        {truck.node}
      </>
    );
  }

  return (
    <svg viewBox={`0 0 ${VIEW_W} ${G + 2}`} className="h-auto w-full" aria-hidden="true">
      <line x1={0} y1={G + 0.5} x2={VIEW_W} y2={G + 0.5} className="stroke-line-strong" strokeWidth={0.8} />
      {art}
    </svg>
  );
}

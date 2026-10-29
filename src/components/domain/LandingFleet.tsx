import type { ReactNode } from "react";
import { Card, CardBody, Mono } from "@/components/ui";
import { ON_REQUEST_FROM, SUBSCRIPTION_LADDER } from "@/lib/config";
import {
  legalMassKg,
  type MotorUnit,
  type TrailerUnit,
} from "@/lib/fleet/mass";
import { getI18n, type Locale } from "@/lib/i18n";

/**
 * Две секции главной для перевозчика: кабинет (конструктор сцепок и
 * инструменты автопарка) и цены.
 *
 * Пределы массы у сцепок не вписаны в текст, а считаются той же функцией,
 * что и в кабинете (src/lib/fleet/mass.ts): поменяется таблица — витрина
 * не разойдётся с тем, что перевозчик увидит у себя.
 */

type Body = "BOX" | "TIPPER" | "LOWBED";
type Combo = {
  key: "Ppv" | "Puolikas" | "Tral" | "Kasetti" | "Tpv";
  motor: MotorUnit;
  motorBody?: Body;
  trailer: TrailerUnit;
  trailerBody: Body;
};

/* Типичные оси для каждой сцепки; точный предел в кабинете — по своим машинам. */
const COMBOS: readonly Combo[] = [
  {
    key: "Ppv",
    motor: { kind: "TRACTOR", axles: 2 },
    trailer: { kind: "SEMI", axles: 3, twinWheels: false },
    trailerBody: "BOX",
  },
  {
    key: "Puolikas",
    motor: { kind: "TRACTOR", axles: 3 },
    trailer: { kind: "SEMI", axles: 3, twinWheels: true },
    trailerBody: "TIPPER",
  },
  {
    key: "Tral",
    motor: { kind: "TRACTOR", axles: 3 },
    trailer: { kind: "SEMI", axles: 4, twinWheels: false },
    trailerBody: "LOWBED",
  },
  {
    key: "Kasetti",
    motor: { kind: "TRUCK", axles: 5 },
    motorBody: "TIPPER",
    trailer: { kind: "FULL", axles: 4, twinWheels: true },
    trailerBody: "TIPPER",
  },
  {
    key: "Tpv",
    motor: { kind: "TRUCK", axles: 4 },
    motorBody: "BOX",
    trailer: { kind: "FULL", axles: 4, twinWheels: true },
    trailerBody: "BOX",
  },
];

export async function LandingFleet({ locale }: { locale: Locale }) {
  const { t } = await getI18n(locale);
  const l = t.landing;
  const tonnes = new Intl.NumberFormat(t.meta.intl, {
    maximumFractionDigits: 0,
  });
  const finland =
    new Intl.DisplayNames([locale], { type: "region" }).of("FI") ?? "FI";

  const tools = [
    { title: l.toolFuel, text: l.toolFuelText, spec: "PDF · CSV" },
    { title: l.toolGps, text: l.toolGpsText, spec: "8 × API" },
    { title: l.toolEcon, text: l.toolEconText, spec: "PDF · CSV" },
    {
      title: l.toolParts,
      text: l.toolPartsText,
      spec: "FI SE NO DK EE LV LT PL DE",
    },
    { title: l.toolDrivers, text: l.toolDriversText, spec: "TES" },
    { title: l.toolSites, text: l.toolSitesText, spec: "t · m³ · h" },
  ];

  return (
    <section id="fleet" className="border-y border-line bg-surface">
      <div className="mx-auto w-full max-w-6xl px-5 py-20">
        <p className="label-micro">{l.fleetEyebrow}</p>
        <h2 className="mt-2.5 max-w-[26ch] text-[clamp(26px,3vw,34px)] leading-tight font-semibold tracking-tight text-balance">
          {l.fleetTitle}
        </h2>
        <p className="mt-3 max-w-[62ch] text-[16px] text-ink-muted">
          {l.fleetLede}
        </p>

        {/* ── Конструктор сцепок ── */}
        <div className="mt-10">
          <h3 className="text-[20px] font-semibold tracking-tight">
            {l.comboTitle}
          </h3>
          <p className="mt-2 max-w-[70ch] text-[16px] text-ink-muted">
            {l.comboLede}
          </p>

          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {COMBOS.map((combo) => {
              const fi = legalMassKg("FI", combo.motor, [combo.trailer]).kg;
              const eu = legalMassKg("DE", combo.motor, [combo.trailer]).kg;
              const name = l[`combo${combo.key}`];
              const [code, ...rest] = name.split(" · ");
              return (
                <Card key={combo.key} className="border-t-2 border-t-accent">
                  <CardBody className="flex h-full flex-col">
                    <ComboSketch combo={combo} />
                    <p className="mt-4 label-micro" data-accent>
                      {code}
                    </p>
                    <h4 className="mt-1 text-[17px] leading-snug font-semibold tracking-tight">
                      {rest.join(" · ")}
                    </h4>
                    <p className="mt-1.5 text-[15px] text-ink-muted">
                      {l[`combo${combo.key}Text`]}
                    </p>
                    <dl className="mt-auto grid grid-cols-3 gap-2 pt-4">
                      {[
                        [
                          l.comboAxles,
                          `${combo.motor.axles}+${combo.trailer.axles}`,
                        ],
                        [finland, `≤ ${tonnes.format(fi / 1000)} t`],
                        [l.comboEu, `${tonnes.format(eu / 1000)} t`],
                      ].map(([k, v]) => (
                        <div key={k} className="border-t border-line pt-2">
                          <dt className="label-micro">{k}</dt>
                          <dd className="mt-0.5 font-mono text-[14px] text-ink">
                            {v}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  </CardBody>
                </Card>
              );
            })}
            {/* Шестая клетка — пояснение, чтобы сетка 3×2 не свисала одной карточкой. */}
            <div className="flex items-end rounded-card border border-dashed border-line-strong p-5">
              <p className="text-[14px] leading-relaxed text-ink-muted">
                {l.comboNote}
              </p>
            </div>
          </div>
        </div>

        {/* ── Инструменты автопарка ── */}
        <div className="mt-12 grid gap-px overflow-hidden rounded-card border border-line bg-line sm:grid-cols-2 lg:grid-cols-3">
          {tools.map((tool) => (
            <div key={tool.title} className="flex flex-col bg-surface p-5">
              <h3 className="text-[17px] leading-snug font-semibold tracking-tight">
                {tool.title}
              </h3>
              <p className="mt-1.5 text-[15px] text-ink-muted">{tool.text}</p>
              <Mono className="mt-auto pt-3 text-[12px] tracking-[0.08em] text-ink-faint">
                {tool.spec}
              </Mono>
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
    style: "currency",
    currency: "EUR",
  });

  return (
    <section id="pricing" className="border-t border-line">
      <div className="mx-auto w-full max-w-6xl px-5 py-20">
        <p className="label-micro">{l.pricingEyebrow}</p>
        <h2 className="mt-2.5 max-w-[24ch] text-[clamp(26px,3vw,34px)] leading-tight font-semibold tracking-tight text-balance">
          {l.pricingTitle}
        </h2>
        <p className="mt-3 max-w-[62ch] text-[16px] text-ink-muted">
          {l.pricingLede}
        </p>

        <div className="mt-8 grid gap-4 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
          <Card className="border-t-2 border-t-accent">
            <CardBody className="p-6">
              <p className="label-micro" data-accent>
                {l.priceOwnEyebrow}
              </p>
              <h3 className="mt-2 text-[20px] font-semibold tracking-tight">
                {l.priceOwnTitle}
              </h3>
              <p className="mt-2 text-[15px] text-ink-muted">
                {l.priceOwnText}
              </p>

              <table className="mt-5 w-full border-collapse text-[15px]">
                <thead>
                  <tr className="border-b border-line">
                    <th className="label-micro py-2 text-left font-normal">
                      {l.priceVehicles}
                    </th>
                    <th className="label-micro py-2 text-right font-normal">
                      {l.pricePerVehicle}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {SUBSCRIPTION_LADDER.map((step, i) => (
                    <tr key={step.from} className="border-b border-line">
                      <td className="py-2.5 font-mono">{`${step.from}–${step.to ?? ON_REQUEST_FROM - 1}`}</td>
                      <td
                        className={`py-2.5 text-right font-mono ${i === 0 ? "text-[18px] font-semibold text-ink" : "text-ink"}`}
                      >
                        {eur.format(step.cents / 100)}
                      </td>
                    </tr>
                  ))}
                  <tr>
                    <td className="py-2.5 font-mono">
                      {l.priceFromN.replace("{n}", String(ON_REQUEST_FROM))}
                    </td>
                    <td className="py-2.5 text-right text-ink-muted">
                      {l.priceOnRequest}
                    </td>
                  </tr>
                </tbody>
              </table>

              <p className="mt-4 inline-flex rounded-pill border border-accent-line bg-accent-wash px-3 py-1 text-[13px] font-semibold text-accent">
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
                  <h3 className="mt-2 font-mono text-[22px] font-semibold tracking-tight">
                    {card.title}
                  </h3>
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
 * Схема сцепки сбоку: кабина, кузов по типу и колёса по числу осей.
 * Иллюстрация — подпись рядом говорит то же словами, поэтому aria-hidden.
 */
const R = 5.5;
const GROUND = 60;
const AXLE_Y = GROUND - R;
const GAP = 12.5;

function wheels(xs: number[]) {
  return xs.map((x) => (
    <circle
      key={x}
      cx={x}
      cy={AXLE_Y}
      r={R}
      className="fill-ink stroke-surface"
      strokeWidth={1.5}
    />
  ));
}

/* Оси пачкой у заднего края: последняя на end, остальные перед ней. */
const pack = (end: number, n: number) =>
  Array.from({ length: n }, (_, i) => end - (n - 1 - i) * GAP);

function body(kind: Body, x0: number, x1: number, floor: number) {
  if (kind === "TIPPER") {
    return (
      <path
        d={`M${x0} ${floor} L${x0 + 4} ${floor - 20} L${x1} ${floor - 20} L${x1 - 3} ${floor} Z`}
        className="fill-accent-wash stroke-accent"
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
    );
  }
  if (kind === "LOWBED") return null;
  return (
    <rect
      x={x0}
      y={floor - 28}
      width={x1 - x0}
      height={28}
      rx={2}
      className="fill-accent-wash stroke-accent"
      strokeWidth={1.5}
    />
  );
}

function cab(x: number, floor: number) {
  return (
    <g>
      <path
        d={`M${x} ${floor} L${x} ${floor - 26} Q${x} ${floor - 32} ${x + 6} ${floor - 32} L${x + 22} ${floor - 32} L${x + 22} ${floor} Z`}
        className="fill-surface stroke-ink"
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
      <path
        d={`M${x + 3} ${floor - 27} L${x + 14} ${floor - 27} L${x + 14} ${floor - 17} L${x + 3} ${floor - 17} Z`}
        className="fill-sunken stroke-ink"
        strokeWidth={1}
      />
    </g>
  );
}

function ComboSketch({ combo }: { combo: Combo }) {
  const floor = AXLE_Y - 6;
  const parts: ReactNode[] = [];
  const x = 4;
  let end: number;

  if (combo.motor.kind === "TRACTOR") {
    /* Тягач: кабина, рама, седло; передняя ось под кабиной, задние — под седлом. */
    const len = 46 + (combo.motor.axles - 2) * GAP;
    parts.push(
      <rect
        key="frame"
        x={x}
        y={floor - 1}
        width={len}
        height={4}
        className="fill-ink"
      />,
    );
    parts.push(<g key="cab">{cab(x, floor)}</g>);
    parts.push(
      <g key="mw">
        {wheels([x + 11, ...pack(x + len - 6, combo.motor.axles - 1)])}
      </g>,
    );
    const kingpin = x + len - 6 - ((combo.motor.axles - 2) * GAP) / 2;
    const semiLen = combo.trailerBody === "LOWBED" ? 150 : 140;
    const s0 = kingpin - 6;
    const s1 = s0 + semiLen;
    if (combo.trailerBody === "LOWBED") {
      /* Гусь над седлом, низкая площадка, оси в хвосте. */
      parts.push(
        <path
          key="lb"
          d={`M${s0} ${floor - 8} L${s0 + 26} ${floor - 8} L${s0 + 34} ${floor + 1} L${s1} ${floor + 1} L${s1} ${floor + 5} L${s0 + 32} ${floor + 5} L${s0 + 24} ${floor - 4} L${s0} ${floor - 4} Z`}
          className="fill-accent-wash stroke-accent"
          strokeWidth={1.5}
          strokeLinejoin="round"
        />,
      );
      parts.push(
        <path
          key="cargo"
          d={`M${s0 + 56} ${floor + 1} L${s0 + 56} ${floor - 10} L${s0 + 78} ${floor - 10} L${s0 + 92} ${floor - 22} L${s0 + 100} ${floor - 18} L${s0 + 90} ${floor - 8} L${s0 + 96} ${floor + 1} Z`}
          className="fill-surface stroke-ink"
          strokeWidth={1.3}
          strokeLinejoin="round"
        />,
      );
    } else {
      parts.push(
        <rect
          key="deck"
          x={s0}
          y={floor - 3}
          width={semiLen}
          height={3}
          className="fill-ink"
        />,
      );
      parts.push(<g key="sb">{body(combo.trailerBody, s0, s1, floor - 3)}</g>);
    }
    parts.push(<g key="tw">{wheels(pack(s1 - 12, combo.trailer.axles))}</g>);
    end = s1;
  } else {
    /* Грузовик: кабина и кузов на одной раме, оси спереди и пачкой сзади. */
    const front = combo.motor.axles >= 4 ? 2 : 1;
    const rear = combo.motor.axles - front;
    const len = 30 + 26 + rear * GAP + 10;
    parts.push(
      <rect
        key="frame"
        x={x}
        y={floor - 1}
        width={len}
        height={4}
        className="fill-ink"
      />,
    );
    parts.push(<g key="cab">{cab(x, floor)}</g>);
    parts.push(
      <g key="mb">
        {body(combo.motorBody ?? "BOX", x + 25, x + len, floor - 1)}
      </g>,
    );
    parts.push(
      <g key="mw">
        {wheels([
          ...Array.from({ length: front }, (_, i) => x + 11 + i * GAP),
          ...pack(x + len - 7, rear),
        ])}
      </g>,
    );
    /* Дышло и прицеп. */
    const t0 = x + len + 16;
    const tLen = 18 + combo.trailer.axles * GAP + 14;
    parts.push(
      <line
        key="bar"
        x1={x + len}
        y1={floor + 1}
        x2={t0 + 6}
        y2={floor + 1}
        className="stroke-ink"
        strokeWidth={2}
      />,
    );
    parts.push(
      <rect
        key="tdeck"
        x={t0}
        y={floor - 3}
        width={tLen}
        height={3}
        className="fill-ink"
      />,
    );
    parts.push(
      <g key="tb">{body(combo.trailerBody, t0, t0 + tLen, floor - 3)}</g>,
    );
    const half = Math.ceil(combo.trailer.axles / 2);
    parts.push(
      <g key="tw">
        {wheels([
          ...pack(t0 + 10 + (half - 1) * GAP, half),
          ...pack(t0 + tLen - 8, combo.trailer.axles - half),
        ])}
      </g>,
    );
    end = t0 + tLen;
  }

  const width = end + 6;
  return (
    <svg
      viewBox={`0 0 ${width} ${GROUND + 4}`}
      className="h-16 w-full"
      preserveAspectRatio="xMinYMax meet"
      aria-hidden="true"
    >
      <line
        x1={0}
        y1={GROUND}
        x2={width}
        y2={GROUND}
        className="stroke-line-strong"
        strokeWidth={1}
      />
      {parts}
    </svg>
  );
}

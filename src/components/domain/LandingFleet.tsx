import Image from 'next/image';
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

type Combo = {
  key: 'Ppv' | 'Puolikas' | 'Tral' | 'Kasetti' | 'Tpv' | 'Kontti';
  motor: MotorUnit;
  trailer: TrailerUnit;
  /** Снимок сбоку в public/media/combos: все в одном масштабе, ширина в точках. */
  image: { src: string; width: number };
};

/* Самая длинная сцепка на снимках (TPV): от неё считается ширина остальных, чтобы масштаб был общий. */
const WIDEST = 1105;
const HEIGHT = 264;

/*
 * Оси — как на снимках; точный предел в кабинете считается по своим машинам.
 * Все шесть — снимки пользователя (29–30.10.2026), приведены к одному
 * масштабу по высоте кабины и к одной линии земли.
 */
const COMBOS: readonly Combo[] = [
  { key: 'Ppv', motor: { kind: 'TRACTOR', axles: 2 }, trailer: { kind: 'SEMI', axles: 3, twinWheels: false }, image: { src: '/media/combos/ppv.webp', width: 986 } },
  { key: 'Puolikas', motor: { kind: 'TRACTOR', axles: 3 }, trailer: { kind: 'SEMI', axles: 3, twinWheels: true }, image: { src: '/media/combos/puolikas.webp', width: 988 } },
  { key: 'Tral', motor: { kind: 'TRACTOR', axles: 3 }, trailer: { kind: 'SEMI', axles: 4, twinWheels: false }, image: { src: '/media/combos/tral.webp', width: 993 } },
  { key: 'Kasetti', motor: { kind: 'TRUCK', axles: 5 }, trailer: { kind: 'FULL', axles: 4, twinWheels: true }, image: { src: '/media/combos/kasettiyhdistelma.webp', width: 1041 } },
  { key: 'Tpv', motor: { kind: 'TRUCK', axles: 3 }, trailer: { kind: 'FULL', axles: 5, twinWheels: true }, image: { src: '/media/combos/taysperavaunuyhdistelma.webp', width: 1105 } },
  { key: 'Kontti', motor: { kind: 'TRACTOR', axles: 2 }, trailer: { kind: 'SEMI', axles: 3, twinWheels: false }, image: { src: '/media/combos/kontti.webp', width: 1002 } },
];

export async function LandingFleet({ locale }: { locale: Locale }) {
  const { t } = await getI18n(locale);
  const l = t.landing;
  const tonnes = new Intl.NumberFormat(t.meta.intl, {
    maximumFractionDigits: 0,
  });
  const finland = new Intl.DisplayNames([locale], { type: 'region' }).of('FI') ?? 'FI';

  const tools: { title: string; text: string; spec: string }[] = [
    { title: l.toolFuel, text: l.toolFuelText, spec: 'PDF · CSV' },
    { title: l.toolGps, text: l.toolGpsText, spec: '8 × API' },
    { title: l.toolEcon, text: l.toolEconText, spec: 'PDF · CSV' },
    {
      title: l.toolParts,
      text: l.toolPartsText,
      spec: 'FI SE NO DK EE LV LT PL DE',
    },
    { title: l.toolDrivers, text: l.toolDriversText, spec: 'km · % · h · TES' },
    { title: l.toolSites, text: l.toolSitesText, spec: 't · m³ · h' },
  ];

  return (
    <section id="fleet" className="border-y border-line bg-surface">
      <div className="mx-auto w-full max-w-6xl px-5 py-20">
        <p className="label-micro">{l.fleetEyebrow}</p>
        <h2 className="mt-2.5 max-w-[26ch] text-[clamp(26px,3vw,34px)] leading-tight font-semibold tracking-tight text-balance">{l.fleetTitle}</h2>
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
                <Card key={combo.key} className="border-t-2 border-t-accent">
                  <CardBody className="flex h-full flex-col">
                    {/* aria-hidden: что на снимке, сказано подписью ниже. */}
                    <div className="flex h-24 items-end" aria-hidden="true">
                      <Image
                        src={combo.image.src}
                        alt=""
                        width={combo.image.width}
                        height={HEIGHT}
                        sizes="(min-width: 1024px) 340px, (min-width: 640px) 45vw, 90vw"
                        style={{ width: `${(combo.image.width / WIDEST) * 100}%`, height: 'auto' }}
                      />
                    </div>
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
        <h2 className="mt-2.5 max-w-[24ch] text-[clamp(26px,3vw,34px)] leading-tight font-semibold tracking-tight text-balance">{l.pricingTitle}</h2>
        <p className="mt-3 max-w-[62ch] text-[16px] text-ink-muted">{l.pricingLede}</p>

        <div className="mt-8 grid gap-4 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
          <Card className="border-t-2 border-t-accent">
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

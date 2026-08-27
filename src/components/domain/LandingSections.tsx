import Link from 'next/link';
import { buttonClass, Card, CardBody, Mono } from '@/components/ui';
import { getI18n, type Locale } from '@/lib/i18n';

/**
 * Всё, что лежит на главной ниже первого экрана.
 *
 * Один файл на восемь секций намеренно: это одна страница с одним
 * рассказом, и разносить её по восьми файлам значит потерять из виду
 * порядок, в котором она читается. Разделять начнём, когда секции
 * научатся жить порознь.
 *
 * Серверный компонент: ничего интерактивного здесь нет, а значит нечего
 * и отправлять в браузер.
 */
export async function LandingSections({ locale }: { locale: Locale }) {
  const { t } = await getI18n(locale);
  const l = t.landing;

  return (
    <>
      {/* ── Направления работы ─────────────────────────────────── */}
      {/*
        * Здесь напрашивались логотипы клиентов, но выдуманные логотипы
        * были бы враньём, а пустая полоса читалась бы как «клиентов нет».
        * Города — то же социальное доказательство, только проверяемое.
        *
        * Список ровно тот же, что в справочнике площадок: обещать на
        * витрине город, куда заказ нельзя оформить, значит обещать
        * впустую.
        */}
      <div className="border-y border-line bg-surface py-6">
        <p className="label-micro text-center">{l.regions}</p>
        <p className="mt-3 text-center font-mono text-[15px] tracking-[0.14em] text-ink-dim">
          HANKO · HELSINKI · RAUMA · KOTKA · NAANTALI · TURKU
        </p>
      </div>

      {/* ── Что мы делаем ──────────────────────────────────────── */}
      <section id="service" className="mx-auto w-full max-w-6xl px-5 py-20">
        <p className="label-micro">{l.helpEyebrow}</p>
        <h2 className="mt-2.5 max-w-[22ch] text-[clamp(26px,3vw,34px)] leading-tight font-semibold tracking-tight text-balance">
          {l.helpTitle}
        </h2>
        <p className="mt-3 max-w-[62ch] text-[15px] text-ink-muted">{l.helpLede}</p>

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {[
            { eyebrow: l.helpCargo, title: l.helpCargoTitle, text: l.helpCargoText },
            { eyebrow: l.helpTruck, title: l.helpTruckTitle, text: l.helpTruckText },
            { eyebrow: l.helpDriver, title: l.helpDriverTitle, text: l.helpDriverText },
          ].map((card) => (
            <Card key={card.title}>
              <CardBody>
                <p className="label-micro">{card.eyebrow}</p>
                <h3 className="mt-2 text-[19px] font-semibold tracking-tight">{card.title}</h3>
                <p className="mt-2.5 text-[14px] text-ink-muted">{card.text}</p>
              </CardBody>
            </Card>
          ))}
        </div>
      </section>

      {/* ── Время ──────────────────────────────────────────────── */}
      <section className="border-y border-line bg-surface">
        <div className="mx-auto w-full max-w-6xl px-5 py-20">
          <p className="label-micro">{l.timeEyebrow}</p>
          <h2 className="mt-2.5 max-w-[22ch] text-[clamp(26px,3vw,34px)] leading-tight font-semibold tracking-tight text-balance">
            {l.timeTitle}
          </h2>
          <p className="mt-3 max-w-[62ch] text-[15px] text-ink-muted">{l.timeLede}</p>

          <div className="mt-8 grid gap-4 md:grid-cols-2">
            {/* Прошлое — пунктиром и утопленным: способ не отменён, он дороже. */}
            <div className="rounded-card border border-dashed border-line bg-sunken p-6">
              <p className="label-micro">{l.timeOld}</p>
              <ul className="mt-3.5 grid gap-2.5">
                {[l.timeOld1, l.timeOld2, l.timeOld3, l.timeOld4, l.timeOld5, l.timeOld6].map((line) => (
                  <li key={line} className="grid grid-cols-[15px_1fr] gap-2.5 text-[14px] text-ink-faint">
                    <span className="mt-[9px] h-px w-[9px] bg-line-strong" aria-hidden />
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            </div>

            <Card>
              <CardBody className="p-6">
                <p className="label-micro">{l.timeNew}</p>
                <ul className="mt-3.5 grid gap-2.5">
                  {[l.timeNew1, l.timeNew2, l.timeNew3, l.timeNew4, l.timeNew5, l.timeNew6].map((line) => (
                    <li key={line} className="grid grid-cols-[15px_1fr] gap-2.5 text-[14px] text-ink-muted">
                      <span className="mt-[7px] size-[7px] rounded-[2px] bg-accent" aria-hidden />
                      <span>{line}</span>
                    </li>
                  ))}
                </ul>
              </CardBody>
            </Card>
          </div>
        </div>
      </section>

      {/* ── Две двери ──────────────────────────────────────────── */}
      <section id="roles" className="mx-auto w-full max-w-6xl px-5 py-20">
        <p className="label-micro">{l.rolesEyebrow}</p>
        <h2 className="mt-2.5 text-[clamp(26px,3vw,34px)] leading-tight font-semibold tracking-tight text-balance">
          {l.rolesTitle}
        </h2>

        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {[
            {
              eyebrow: l.shipperEyebrow,
              title: l.shipperTitle,
              lines: [l.shipper1, l.shipper2, l.shipper3, l.shipper4, l.shipper5, l.shipper6],
            },
            {
              eyebrow: l.carrierEyebrow,
              title: l.carrierTitle,
              lines: [l.carrier1, l.carrier2, l.carrier3, l.carrier4, l.carrier5, l.carrier6],
            },
          ].map((role) => (
            <Card key={role.title}>
              <CardBody className="flex flex-col gap-3.5 p-6">
                <p className="label-micro">{role.eyebrow}</p>
                <h3 className="text-[20px] font-semibold tracking-tight">{role.title}</h3>
                <ul className="grid gap-2.5">
                  {role.lines.map((line) => (
                    <li key={line} className="grid grid-cols-[16px_1fr] gap-2.5 text-[14px] text-ink-muted">
                      <span className="mt-[7px] size-[7px] rounded-[2px] bg-accent-line" aria-hidden />
                      <span>{line}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  href={`/${locale}/apply`}
                  className={buttonClass({ variant: 'primary', size: 'md', className: 'self-start' })}
                >
                  {l.apply}
                </Link>
              </CardBody>
            </Card>
          ))}
        </div>
      </section>

      {/* ── Путь рейса ─────────────────────────────────────────── */}
      <section id="steps" className="border-y border-line bg-surface">
        <div className="mx-auto w-full max-w-6xl px-5 py-20">
          <p className="label-micro">{l.stepsEyebrow}</p>
          <h2 className="mt-2.5 text-[clamp(26px,3vw,34px)] leading-tight font-semibold tracking-tight text-balance">
            {l.stepsTitle}
          </h2>

          {/* Нумерация здесь не украшение: это настоящая последовательность. */}
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { n: '01', title: l.step1, text: l.step1Text },
              { n: '02', title: l.step2, text: l.step2Text },
              { n: '03', title: l.step3, text: l.step3Text },
              { n: '04', title: l.step4, text: l.step4Text },
            ].map((step) => (
              <Card key={step.n}>
                <CardBody>
                  <Mono className="text-[11px] font-bold tracking-[0.08em] text-accent">{step.n}</Mono>
                  <h3 className="mt-2 text-[15px] font-semibold">{step.title}</h3>
                  <p className="mt-1.5 text-[13px] text-ink-muted">{step.text}</p>
                </CardBody>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ── Сбои ───────────────────────────────────────────────── */}
      <section className="mx-auto w-full max-w-6xl px-5 py-20">
        <p className="label-micro">{l.faultsEyebrow}</p>
        <h2 className="mt-2.5 max-w-[24ch] text-[clamp(26px,3vw,34px)] leading-tight font-semibold tracking-tight text-balance">
          {l.faultsTitle}
        </h2>
        <p className="mt-3 max-w-[62ch] text-[15px] text-ink-muted">{l.faultsLede}</p>

        <div className="mt-8 grid gap-3.5 md:grid-cols-2">
          {[
            { when: l.fault1, then: l.fault1Text, tone: 'bg-warn' },
            { when: l.fault2, then: l.fault2Text, tone: 'bg-live' },
            { when: l.fault3, then: l.fault3Text, tone: 'bg-danger' },
            { when: l.fault4, then: l.fault4Text, tone: 'bg-ok' },
          ].map((fault) => (
            <Card key={fault.when}>
              <CardBody className="grid grid-cols-[3px_1fr] items-start gap-3.5">
                <span className={`h-full rounded-[2px] ${fault.tone}`} aria-hidden />
                <span>
                  <span className="block max-w-[24ch] text-[13px] font-semibold text-ink">
                    {fault.when}
                  </span>
                  <span className="mt-1 block text-[13px] text-ink-muted">{fault.then}</span>
                </span>
              </CardBody>
            </Card>
          ))}
        </div>
      </section>

      {/* ── Помощник водителя ──────────────────────────────────── */}
      <section id="assistant" className="border-y border-line bg-surface">
        <div className="mx-auto w-full max-w-6xl px-5 py-20">
          <p className="label-micro">
            {l.aiEyebrow}
            <span className="ml-2 rounded-pill border border-line-strong bg-sunken px-2 py-0.5 text-[9px] tracking-[0.1em] text-ink-faint">
              {l.aiSoon}
            </span>
          </p>
          <h2 className="mt-2.5 text-[clamp(26px,3vw,34px)] leading-tight font-semibold tracking-tight text-balance">
            {l.aiTitle}
          </h2>
          <p className="mt-3 max-w-[62ch] text-[15px] text-ink-muted">{l.aiLede}</p>
          <p className="mt-2.5 max-w-[62ch] text-[15px] text-ink-muted">{l.aiLede2}</p>

          <div className="mt-8 grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
            <Card>
              <CardBody className="p-[18px]">
                <div className="flex items-center gap-3 border-b border-line pb-3.5">
                  <span className="grid size-[42px] place-items-center rounded-lg border border-accent-line bg-accent-wash">
                    <Mono className="text-[13px] font-bold text-accent">AI</Mono>
                  </span>
                  <span>
                    <span className="block text-[15px] font-semibold">{t.brand.name}</span>
                    <span className="block text-xs text-ink-faint">{l.aiOnline}</span>
                  </span>
                </div>

                {/* Вопрос водителя слева, ответ помощника справа и акцентом. */}
                <div className="mt-3.5 flex flex-col gap-2">
                  {[
                    { text: l.aiQ1, out: false },
                    { text: l.aiA1, out: true },
                    { text: l.aiQ2, out: false },
                    { text: l.aiA2, out: true },
                    { text: l.aiQ3, out: false },
                    { text: l.aiA3, out: true },
                  ].map((bubble) => (
                    <span
                      key={bubble.text}
                      className={
                        bubble.out
                          ? 'flex max-w-[86%] flex-col items-end self-end'
                          : 'flex max-w-[86%] flex-col items-start self-start'
                      }
                    >
                      <span className="label-micro mb-1 text-ink-faint">
                        {bubble.out ? l.aiBot : l.aiDriver}
                      </span>
                      <span
                        className={
                          bubble.out
                            ? 'rounded-xl rounded-br-[4px] border border-accent-line bg-accent-wash px-3 py-2.5 text-[13px] leading-snug'
                            : 'rounded-xl rounded-bl-[4px] border border-line bg-sunken px-3 py-2.5 text-[13px] leading-snug'
                        }
                      >
                        {bubble.text}
                      </span>
                    </span>
                  ))}
                </div>
              </CardBody>
            </Card>

            <div className="grid gap-px overflow-hidden rounded-card border border-line bg-line sm:grid-cols-2">
              {[
                { title: l.ai1, text: l.ai1Text },
                { title: l.ai2, text: l.ai2Text },
                { title: l.ai3, text: l.ai3Text },
                { title: l.ai4, text: l.ai4Text },
                { title: l.ai5, text: l.ai5Text },
                { title: l.ai6, text: null },
              ].map((item) => (
                <div key={item.title} className="bg-surface p-5">
                  <h3 className="text-[14px] font-semibold">{item.title}</h3>
                  {item.text ? (
                    <p className="mt-1.5 text-[13px] text-ink-muted">{item.text}</p>
                  ) : (
                    <Mono className="mt-1.5 block text-[13px] tracking-[0.04em] text-ink-faint">
                      FI · SV · EN · ET · RU · PL · LT · LV
                    </Mono>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Направления ────────────────────────────────────────── */}
      <section className="mx-auto w-full max-w-6xl px-5 py-20">
        <p className="label-micro">{l.servicesEyebrow}</p>
        <h2 className="mt-2.5 text-[clamp(26px,3vw,34px)] leading-tight font-semibold tracking-tight text-balance">
          {l.servicesTitle}
        </h2>

        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <Card>
            <CardBody className="flex flex-col gap-3 p-6">
              <span className="self-start rounded-pill border border-accent-line bg-accent-wash px-2.5 py-1 text-[11px] font-semibold text-accent">
                {l.serviceLive}
              </span>
              <h3 className="text-[19px] font-semibold tracking-tight">
                {l.service1} <Mono className="text-[0.72em] text-ink-dim">irtoperä</Mono>
              </h3>
              <p className="text-[14px] text-ink-muted">{l.service1Text}</p>
              <p className="text-[14px] text-ink-muted">{l.service1Text2}</p>
            </CardBody>
          </Card>

          <div className="rounded-card border border-dashed border-line bg-sunken p-6">
            <span className="inline-block rounded-pill border border-line-strong bg-surface px-2.5 py-1 text-[11px] font-semibold text-ink-faint">
              {l.serviceSoon}
            </span>
            <h3 className="mt-3 text-[19px] font-semibold tracking-tight">{l.service2}</h3>
            <p className="mt-3 text-[14px] text-ink-muted">{l.service2Text}</p>
            <p className="mt-2.5 text-[14px] text-ink-muted">{l.service2Text2}</p>
          </div>
        </div>
      </section>

      {/* ── Финал ──────────────────────────────────────────────── */}
      <section className="border-y border-line bg-surface">
        <div className="mx-auto w-full max-w-6xl px-5 py-20 text-center">
          <p className="label-micro">{l.finalEyebrow}</p>
          <h2 className="mt-3 text-[clamp(28px,3.6vw,40px)] font-semibold tracking-tight text-balance">
            {l.finalTitle}
          </h2>
          <p className="mx-auto mt-3.5 max-w-[52ch] text-[15px] text-ink-muted">{l.finalLede}</p>
          <p className="mx-auto mt-2.5 max-w-[52ch] text-[15px] text-ink-muted">{l.finalLede2}</p>
          <p className="mx-auto mt-2.5 max-w-[52ch] text-[15px] text-ink-muted">{l.finalLede3}</p>

          <div className="mt-7 flex flex-wrap justify-center gap-2.5">
            <Link href={`/${locale}/apply`} className={buttonClass({ variant: 'primary', size: 'lg' })}>
              {l.applyShipper}
            </Link>
            <Link href={`/${locale}/apply`} className={buttonClass({ size: 'lg' })}>
              {l.applyCarrier}
            </Link>
          </div>
        </div>
      </section>

      {/* ── Подвал ─────────────────────────────────────────────── */}
      <footer className="mx-auto w-full max-w-6xl px-5 py-12">
        <div className="flex flex-wrap items-baseline gap-x-8 gap-y-4 text-xs text-ink-dim">
          <span>
            <span className="font-semibold text-ink-muted">{t.brand.operator}</span> ·{' '}
            <Mono>3592993-6</Mono> · {l.footerCountry}
          </span>
          <a href="mailto:info@aipoweredsolutions.fi" className="hover:text-ink-muted">
            info@aipoweredsolutions.fi
          </a>

          {/* Условия читают до согласия, поэтому ссылка на них — на витрине. */}
          <span className="flex gap-4">
            <Link
              href={`/${locale}/${locale === 'fi' ? 'kayttoehdot' : 'terms'}`}
              className="hover:text-ink-muted"
            >
              {t.legal.TERMS}
            </Link>
            <Link
              href={`/${locale}/${locale === 'fi' ? 'tietosuoja' : 'privacy'}`}
              className="hover:text-ink-muted"
            >
              {t.legal.PRIVACY}
            </Link>
          </span>
        </div>
      </footer>
    </>
  );
}

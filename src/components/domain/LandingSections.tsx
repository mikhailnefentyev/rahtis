import Image from 'next/image';
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
      <section id="assistant" className="assistant">
        <div className="mx-auto w-full max-w-6xl px-5 py-20">
          <p className="label-micro !text-[#8fa3bd]">
            {l.aiEyebrow}
          </p>
          <h2 className="mt-2.5 text-[clamp(26px,3vw,34px)] leading-tight font-semibold tracking-tight text-balance">
            {l.aiTitle}
          </h2>
          <p className="mt-3 max-w-[62ch] text-[15px] text-[#9fb0c6]">{l.aiLede}</p>
          <p className="mt-2.5 max-w-[62ch] text-[15px] text-[#9fb0c6]">{l.aiLede2}</p>

          <div className="mt-10 grid items-center gap-10 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
            <div className="assistant__stage">
              {/*
                * Телефон собран разметкой, а не снят скриншотом: переписка
                * переводится, и картинку пришлось бы переснимать на каждый
                * язык и на каждую правку текста.
                *
                * aria-hidden целиком — это иллюстрация. Всё, что она
                * говорит, сказано словами в соседней колонке, а озвучивать
                * подряд время на часах, значки связи и реплики примера
                * значит заставить слушать вслух картинку.
                */}
              <div className="phone" aria-hidden="true">
                <span className="phone__btn phone__btn--silence" />
                <span className="phone__btn phone__btn--up" />
                <span className="phone__btn phone__btn--down" />
                <div className="phone__island" />
                <div className="phone__screen">
                  <div className="phone__glare" />

                  <div className="wa-status">
                    <span>7.02</span>
                    <span className="wa-status__icons">
                      <Signal />
                      <Wifi />
                      <Battery />
                    </span>
                  </div>

                  <div className="wa-bar">
                    <ArrowBack />
                    <span className="wa-bar__avatar">
                      {/* Марка вместо аватара: у помощника лицо платформы. */}
                      <Image src="/mark.png" alt="" width={40} height={40} />
                    </span>
                    <span className="wa-bar__who">
                      <span className="wa-bar__name">{l.aiBot}</span>
                      <span className="wa-bar__state">{l.aiOnline}</span>
                    </span>
                    <span className="wa-bar__icons">
                      <Video />
                      <Phone />
                      <Dots />
                    </span>
                  </div>

                  <div className="wa-chat">
                    <span className="wa-day">{l.aiToday}</span>

                    {[
                      { text: l.aiQ1, out: true, at: '6.58' },
                      { text: l.aiA1, out: false, at: '6.58' },
                      { text: l.aiQ2, out: true, at: '7.00' },
                      { text: l.aiA2, out: false, at: '7.00' },
                      { text: l.aiQ3, out: true, at: '7.02' },
                    ].map((msg) => (
                      <span
                        key={msg.text}
                        className={msg.out ? 'wa-msg wa-msg--out' : 'wa-msg wa-msg--in'}
                      >
                        {msg.text}
                        <span className="wa-msg__meta">
                          {msg.at}
                          {msg.out && <Ticks />}
                        </span>
                      </span>
                    ))}

                    {/* Ответ на последний вопрос ещё печатается — переписка живая. */}
                    <span className="wa-typing">
                      <i />
                      <i />
                      <i />
                    </span>
                  </div>

                  <div className="wa-input">
                    <span className="wa-input__field">
                      <Smile />
                      <span>{l.aiPlaceholder}</span>
                      <Clip />
                    </span>
                    <span className="wa-input__send">
                      <Mic />
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="assistant__grid">
              {[
                { title: l.ai1, text: l.ai1Text },
                { title: l.ai2, text: l.ai2Text },
                { title: l.ai3, text: l.ai3Text },
                { title: l.ai4, text: l.ai4Text },
                { title: l.ai5, text: l.ai5Text },
                { title: l.ai6, text: null },
              ].map((item) => (
                <div key={item.title} className="assistant__cell">
                  <h3>{item.title}</h3>
                  {item.text ? (
                    <p>{item.text}</p>
                  ) : (
                    <Mono className="mt-1.5 block text-[13px] tracking-[0.04em] text-[#8fa3bd]">
                      FI · SV · EN · ET · RU · PL · LT · LV · BG · RO · DE
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

/*
 * Значки телефона.
 *
 * Рисуются здесь, а не берутся набором: их девять, они размером с ноготь
 * и нужны ровно в одном месте страницы. Библиотека иконок ради девяти
 * путей на одной иллюстрации — лишняя зависимость в бандле.
 *
 * Ни один из них не повторяет знак мессенджера: узнавание держится на
 * цвете и раскладке окна, а не на чужой марке.
 */
const stroke = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

function Signal() {
  return (
    <svg width="12" height="10" viewBox="0 0 12 10" fill="currentColor">
      <rect x="0" y="7" width="2" height="3" rx="0.5" />
      <rect x="3.2" y="5" width="2" height="5" rx="0.5" />
      <rect x="6.4" y="2.6" width="2" height="7.4" rx="0.5" />
      <rect x="9.6" y="0" width="2" height="10" rx="0.5" />
    </svg>
  );
}

function Wifi() {
  return (
    <svg width="12" height="10" viewBox="0 0 12 10" {...stroke} strokeWidth={1.3}>
      <path d="M1 3.4a7.5 7.5 0 0 1 10 0" />
      <path d="M3 5.6a4.5 4.5 0 0 1 6 0" />
      <circle cx="6" cy="8.2" r="0.7" fill="currentColor" stroke="none" />
    </svg>
  );
}

function Battery() {
  return (
    <svg width="16" height="9" viewBox="0 0 16 9" fill="none">
      <rect x="0.5" y="0.5" width="13" height="8" rx="2" stroke="currentColor" opacity="0.6" />
      <rect x="2" y="2" width="9" height="5" rx="1" fill="currentColor" />
      <path d="M15 3.2v2.6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" opacity="0.6" />
    </svg>
  );
}

function ArrowBack() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" {...stroke} style={{ flex: 'none' }}>
      <path d="M10 3 5 8l5 5" />
    </svg>
  );
}

function Video() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" {...stroke}>
      <rect x="1.5" y="4" width="9" height="8" rx="2" />
      <path d="M10.5 8.2l4-2.2v4.4l-4-2.2z" />
    </svg>
  );
}

function Phone() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" {...stroke}>
      <path d="M3 2.5h2.2l1 2.6-1.4 1a7.5 7.5 0 0 0 3.6 3.6l1-1.4 2.6 1V11a2 2 0 0 1-2.2 2A10.5 10.5 0 0 1 2.6 4.7 2 2 0 0 1 3 2.5z" />
    </svg>
  );
}

function Dots() {
  return (
    <svg width="4" height="15" viewBox="0 0 4 16" fill="currentColor">
      <circle cx="2" cy="3" r="1.4" />
      <circle cx="2" cy="8" r="1.4" />
      <circle cx="2" cy="13" r="1.4" />
    </svg>
  );
}

/* Две галочки: сообщение доставлено и прочитано. */
function Ticks() {
  return (
    <svg
      className="wa-msg__tick"
      width="13"
      height="8"
      viewBox="0 0 14 8"
      {...stroke}
      strokeWidth={1.5}
    >
      <path d="M1 4.4 3.2 6.6 7.6 1.4" />
      <path d="M6 4.4 8.2 6.6 12.6 1.4" />
    </svg>
  );
}

function Smile() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" {...stroke} strokeWidth={1.4} style={{ flex: 'none' }}>
      <circle cx="8" cy="8" r="6.2" />
      <path d="M5.6 9.4a3 3 0 0 0 4.8 0" />
      <circle cx="6" cy="6.4" r="0.5" fill="currentColor" stroke="none" />
      <circle cx="10" cy="6.4" r="0.5" fill="currentColor" stroke="none" />
    </svg>
  );
}

function Clip() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" {...stroke} strokeWidth={1.4} style={{ flex: 'none' }}>
      <path d="M11 4.5 5.9 9.6a1.8 1.8 0 0 0 2.5 2.5l5.1-5.1a3.4 3.4 0 0 0-4.8-4.8L3.4 7.5" />
    </svg>
  );
}

function Mic() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" {...stroke}>
      <rect x="6" y="1.8" width="4" height="7" rx="2" />
      <path d="M3.6 7.6a4.4 4.4 0 0 0 8.8 0M8 12v2.2" />
    </svg>
  );
}

import Link from 'next/link';
import { buttonClass, Card, CardBody, Mono } from '@/components/ui';
import { APP } from '@/lib/config';
import { getI18n, type Locale } from '@/lib/i18n';
import { placeCountries } from '@/lib/routing/places';

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
      <div className="border-y border-line bg-surface py-7">
        <p className="label-micro text-center">{l.regions}</p>
        {/*
          * Страны берутся из справочника, а не переписываются сюда:
          * убранная оттуда страна не должна остаться на витрине
          * обещанием, за которым уже нет ни одного порта.
          *
          * Одной строкой и словами, а не кодами. Двадцать девять городов
          * стояли здесь четырьмя строками разной длины и читались как
          * перенос по ширине; страна — то же обещание, сказанное с
          * одного взгляда.
          *
          * Разделитель — отдельный элемент между пунктами, и на телефоне
          * он не рисуется: четыре слова с разрядкой в 400 точек не
          * помещаются, ряд переносится, и точка встала бы в начало
          * второй строки. Расстояния там хватает и без неё.
          */}
        <p className="mt-3.5 flex flex-wrap justify-center gap-x-4 gap-y-1.5 text-center font-mono text-[13px] tracking-[0.16em] text-ink-faint sm:gap-x-0">
          {placeCountries().map((code, i) => (
            <span key={code}>
              {i > 0 && <span className="mx-4 hidden text-line-strong sm:inline">·</span>}
              {l.country[code as keyof typeof l.country].toUpperCase()}
            </span>
          ))}
        </p>
      </div>

      {/* ── Две ветки ──────────────────────────────────────────── */}
      {/*
        * Первое, что должен узнать пришедший: возим ли мы его рахти.
        *
        * Раньше ответ был разбросан по странице — что-то в заголовке,
        * что-то в описании услуги, — и человек с фургонным грузом уходил
        * с первого экрана, потому что видел там только прицепы и
        * контейнеры. Две карточки отвечают за две секунды.
        *
        * Деление ровно то же, каким платформа разделена внутри: тягач
        * видит одну половину витрины, фургон и грузовик — другую.
        * Придумывать сайту собственную классификацию значило бы обещать
        * не то, что человек потом увидит в кабинете.
        */}
      <section className="border-b border-line bg-surface">
        <div className="mx-auto w-full max-w-6xl px-5 py-20">
          <p className="label-micro">{l.branchesEyebrow}</p>
          <h2 className="mt-2.5 max-w-[22ch] text-[clamp(26px,3vw,34px)] leading-tight font-semibold tracking-tight text-balance">
            {l.branchesTitle}
          </h2>
          <p className="mt-3 max-w-[62ch] text-[16px] text-ink-muted">{l.branchesLede}</p>

          <div className="mt-8 grid gap-4 md:grid-cols-2">
            {[
              {
                eyebrow: l.unitBranch,
                title: l.unitBranchTitle,
                text: l.unitBranchText,
                spec: [
                  [l.branchFleet, l.unitFleet],
                  [l.branchTells, l.unitTells],
                  [l.branchExtra, l.unitExtra],
                ],
              },
              {
                eyebrow: l.expressBranch,
                title: l.expressBranchTitle,
                text: l.expressBranchText,
                spec: [
                  [l.branchFleet, l.expressFleet],
                  [l.branchTells, l.expressTells],
                  [l.branchExtra, l.expressExtra],
                ],
              },
            ].map((card) => (
              <Card key={card.title} className="border-t-2 border-t-accent">
                <CardBody className="flex h-full flex-col">
                  <p className="label-micro" data-accent>
                    {card.eyebrow}
                  </p>
                  <h3 className="mt-2 text-[20px] leading-snug font-semibold tracking-tight text-balance">
                    {card.title}
                  </h3>
                  <p className="mt-2.5 text-[16px] text-ink-muted">{card.text}</p>

                  {/*
                    * Три строки «ключ — значение» вместо строки примет.
                    *
                    * Ключи у обеих карточек одни и те же, и в этом весь
                    * смысл: половинки читаются не по очереди, а поперёк —
                    * взгляд идёт по строке и видит, чем ветки отличаются
                    * в одном и том же месте. Средняя строка отвечает на
                    * вопрос, ради которого сюда и пришли: что от меня
                    * потребуется, чтобы опубликовать.
                    *
                    * Значение моноширинно, ключ — нет: так строка
                    * выравнивается по левому краю колонки значений сама
                    * собой, без сетки в пикселях.
                    */}
                  <dl className="mt-auto pt-6">
                    {card.spec.map(([key, value]) => (
                      <div
                        key={key}
                        className="grid gap-x-3 border-t border-line py-2 first:border-t-0 first:pt-0 sm:grid-cols-[minmax(0,7rem)_1fr]"
                      >
                        <dt className="label-micro pt-0.5">{key}</dt>
                        <dd className="font-mono text-[13px] leading-snug tracking-tight text-ink">
                          {value}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </CardBody>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ── Что мы делаем ──────────────────────────────────────── */}
      <section id="service" className="mx-auto w-full max-w-6xl px-5 py-20">
        <p className="label-micro">{l.helpEyebrow}</p>
        <h2 className="mt-2.5 max-w-[22ch] text-[clamp(26px,3vw,34px)] leading-tight font-semibold tracking-tight text-balance">
          {l.helpTitle}
        </h2>
        <p className="mt-3 max-w-[62ch] text-[16px] text-ink-muted">{l.helpLede}</p>

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {[
            { eyebrow: l.helpCargo, title: l.helpCargoTitle, text: l.helpCargoText },
            { eyebrow: l.helpTruck, title: l.helpTruckTitle, text: l.helpTruckText },
            { eyebrow: l.helpDriver, title: l.helpDriverTitle, text: l.helpDriverText },
          ].map((card) => (
            /*
              * Кромка сверху и акцентный надзаголовок.
              *
              * Три белые карточки на светлом фоне читались как один
              * прямоугольник: отличить их друг от друга можно было
              * только прочитав. Цвет здесь не украшение, а граница —
              * он говорит, где начинается следующая карточка.
              */
            <Card key={card.title} className="border-t-2 border-t-accent">
              <CardBody>
                <p className="label-micro" data-accent>
                  {card.eyebrow}
                </p>
                <h3 className="mt-2 text-[20px] font-semibold tracking-tight">{card.title}</h3>
                <p className="mt-2.5 text-[16px] text-ink-muted">{card.text}</p>
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
          <p className="mt-3 max-w-[62ch] text-[16px] text-ink-muted">{l.timeLede}</p>

          {/*
            * Пары, а не два списка.
            *
            * Раньше здесь стояли две колонки по шесть законченных
            * предложений, и попарно они говорили об одном и том же —
            * обзвон против одной публикации, поиск груза против общего
            * стола. Но сопоставить их должен был читатель: удержать шесть
            * пунктов и найти к ним шесть ответов. Он этого не делает, он
            * видит двенадцать длинных строк и листает дальше.
            *
            * Теперь пара стоит на одной строке. Сравнение делает раскладка,
            * и поэтому предложение может ужаться до выражения — а разные
            * маркеры у колонок стали не нужны: противопоставление несёт
            * сетка, а не форма точки.
            *
            * На телефоне колонки складываются, и «было» просто стоит над
            * «стало». Порядок сохраняется, значок для этого не нужен.
            */}
          <div className="mt-8 overflow-hidden rounded-card border border-line">
            <div className="hidden bg-sunken sm:grid sm:grid-cols-2">
              {/*
                * Оба заголовка одинаково тихие. Акцентом красить правый
                * нечем: .label-micro задаёт цвет в том же слое, и утилита
                * text-accent до него не достаёт. Подпирать важностью ради
                * оттенка не стоит — сторону и так видно по колонке: слева
                * бледное, справа чернильное.
                */}
              <p className="label-micro border-r border-line px-5 py-3">{l.timeOld}</p>
              <p className="label-micro bg-accent-wash px-5 py-3" data-accent>
                {l.timeNew}
              </p>
            </div>

            <ul>
              {[
                [l.timeOld1, l.timeNew1],
                [l.timeOld2, l.timeNew2],
                [l.timeOld3, l.timeNew3],
                [l.timeOld4, l.timeNew4],
                [l.timeOld5, l.timeNew5],
                [l.timeOld6, l.timeNew6],
                [l.timeOld7, l.timeNew7],
              ].map(([was, now]) => (
                <li
                  key={now}
                  className="grid gap-y-1 border-t border-line first:border-t-0 sm:grid-cols-2 sm:first:border-t"
                >
                  <span className="px-5 pt-4 text-[16px] text-ink-faint sm:border-r sm:border-line sm:py-4">
                    {was}
                  </span>
                  {/*
                    * Правая половина подкрашена накрест всей таблицы.
                    *
                    * Раньше стороны различались только насыщенностью
                    * букв — бледное слева, чернильное справа, — и на
                    * беглом взгляде таблица читалась как один серый
                    * блок. Заливка несёт тот же смысл, что и колонка:
                    * это сторона RAHTIS.
                    */}
                  <span className="bg-accent-wash px-5 pb-4 text-[16px] font-medium text-ink sm:py-4">
                    {now}
                  </span>
                </li>
              ))}
            </ul>
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
              lines: [l.shipper2, l.shipper3, l.shipper4, l.shipper5, l.shipper6, l.shipper7],
            },
            {
              eyebrow: l.carrierEyebrow,
              title: l.carrierTitle,
              lines: [l.carrier2, l.carrier3, l.carrier4, l.carrier5, l.carrier6],
            },
          ].map((role) => (
            <Card key={role.title}>
              <CardBody className="flex flex-col gap-3.5 p-6">
                <p className="label-micro">{role.eyebrow}</p>
                <h3 className="text-[20px] font-semibold tracking-tight">{role.title}</h3>
                {/*
                  * Маркер тот же, что во всех списках страницы: квадратик
                  * 7×7 акцентом. Здесь он был бледнее остальных, и списки
                  * читались как разные по важности, хотя они равные.
                  */}
                <ul className="grid gap-2.5">
                  {role.lines.map((line) => (
                    <li key={line} className="grid grid-cols-[16px_1fr] gap-2.5 text-[16px] text-ink-muted">
                      <span className="mt-[7px] size-[7px] rounded-[2px] bg-accent" aria-hidden />
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

      {/* ── Плата за услугу ────────────────────────────────────── */}
      {/*
        * Блок стоит вплотную к карточкам ролей, потому что вопрос «мне
        * сколько это стоит» возникает ровно там, где человек прочитал,
        * что ему обещают.
        *
        * С 22.09.2026 цена названа прямо: перевозчик платит помесячно за
        * машины, которые ездили, заказчик — 3 % за заказ со стола, первый
        * месяц бесплатно. Числа живут в базе (app.subscription_unit_cents,
        * app.current_shipper_fee_bps) — при их смене текст правится вместе.
        * Ниже — работа, за которую эта плата: документы, счета, отчёты.
        */}
      <section className="border-y border-line bg-surface">
        <div className="mx-auto w-full max-w-6xl px-5 py-20">
          <p className="label-micro">{l.feeEyebrow}</p>
          <h2 className="mt-2.5 max-w-[24ch] text-[clamp(26px,3vw,34px)] leading-tight font-semibold tracking-tight text-balance">
            {l.feeTitle}
          </h2>
          <p className="mt-3 max-w-[62ch] text-[16px] text-ink-muted">{l.feeLede}</p>

          <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {[
              { title: l.fee1, text: l.fee1Text },
              { title: l.fee2, text: l.fee2Text },
              { title: l.fee3, text: l.fee3Text },
              { title: l.fee4, text: l.fee4Text },
            ].map((item) => (
              <Card key={item.title} className="border-t-2 border-t-accent">
                <CardBody>
                  <h3 className="text-[18px] font-semibold tracking-tight">{item.title}</h3>
                  <p className="mt-2.5 text-[16px] text-ink-muted">{item.text}</p>
                </CardBody>
              </Card>
            ))}
          </div>
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
              /*
                * Номер был набран одиннадцатым кеглем и терялся среди
                * подписей. Последовательность — главное, что говорит
                * эта секция, поэтому номер стал размером с заголовок,
                * а полоса слева повторяет его цветом.
                */
              <Card key={step.n} className="border-l-2 border-l-accent">
                <CardBody>
                  <Mono className="text-[26px] leading-none font-bold tracking-[0.02em] text-accent">
                    {step.n}
                  </Mono>
                  <h3 className="mt-3 text-[18px] font-semibold">{step.title}</h3>
                  <p className="mt-1.5 text-[16px] text-ink-muted">{step.text}</p>
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
        <p className="mt-3 max-w-[62ch] text-[16px] text-ink-muted">{l.faultsLede}</p>

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
                  {/*
                    * Четырнадцать, как во всех двухколоночных секциях.
                    * Здесь стояло тринадцать — размер секции с четырьмя
                    * колонками, где он оправдан узостью карточки. Рядом с
                    * «Двумя дверями» той же ширины это читалось как
                    * второсортность, хотя секция равная.
                    */}
                  <span className="block max-w-[26ch] text-[16px] font-semibold text-ink">
                    {fault.when}
                  </span>
                  <span className="mt-1 block text-[16px] text-ink-muted">{fault.then}</span>
                </span>
              </CardBody>
            </Card>
          ))}
        </div>
      </section>

      {/* ── Приложение водителя ──────────────────────────────────── */}
      <section id="assistant" className="assistant">
        <div className="mx-auto w-full max-w-6xl px-5 py-20">
          <p className="label-micro">
            {l.aiEyebrow}
          </p>
          <h2 className="mt-2.5 text-[clamp(26px,3vw,34px)] leading-tight font-semibold tracking-tight text-balance">
            {l.aiTitle}
          </h2>
          <p className="mt-3 max-w-[62ch] text-[16px] text-night-muted">{l.aiLede}</p>
          <p className="mt-2.5 max-w-[62ch] text-[16px] text-night-muted">{l.aiLede2}</p>

          <div className="mt-10 grid items-center gap-10 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
            <div className="assistant__stage">
              {/*
                * Телефон собран разметкой, а не снят скриншотом: экран
                * приложения переводится, и картинку пришлось бы переснимать
                * на каждый язык и на каждую правку текста.
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

                  <div className="app-status">
                    <span>7.12</span>
                    <span className="app-status__icons">
                      <Signal />
                      <Wifi />
                      <Battery />
                    </span>
                  </div>

                  <div className="app-head">
                    <span>
                      <ArrowBack /> {l.appBack}
                    </span>
                    <span className="app-head__ref">RS-2026-0142</span>
                  </div>

                  <div className="app-banner">
                    <div className="app-banner__small">{l.appStopOf}</div>
                    <div className="app-banner__big">{l.appBanner}</div>
                  </div>

                  <div className="app-list">
                    <div className="app-stop app-stop--done">
                      <span className="app-stop__rail">
                        <span className="app-dot app-dot--done">✓</span>
                      </span>
                      <span className="app-stop__body">
                        <span className="app-stop__role block">{l.appPickupRole}</span>
                        <span className="app-stop__place block">Vuosaari</span>
                        <span className="app-stop__meta block">{l.appPickupDone}</span>
                      </span>
                    </div>

                    <div className="app-stop">
                      <span className="app-stop__rail">
                        <span className="app-dot app-dot--now" />
                      </span>
                      <span className="app-stop__body">
                        <span className="app-stop__role block">{l.appUnloadRole}</span>
                        <span className="app-stop__place block">Kotka, Hietanen</span>
                        <span className="app-stop__meta block">{l.appArrived}</span>
                        <span className="app-shots">
                          <span className="app-shot">✓</span>
                          <span className="app-shot">✓</span>
                          <span className="app-shot app-shot--damage">!</span>
                          <span className="app-shot">✓</span>
                        </span>
                        <span className="app-btn app-btn--ghost block">{l.appSign}</span>
                        <span className="app-btn block">✓ {l.appDone}</span>
                      </span>
                    </div>

                    <div className="app-stop">
                      <span className="app-stop__rail">
                        <span className="app-dot" />
                      </span>
                      <span className="app-stop__body">
                        <span className="app-stop__role block">{l.appReturnRole}</span>
                        <span className="app-stop__place block">Hamina</span>
                      </span>
                    </div>
                  </div>

                  <div className="app-nav">
                    <span className="app-nav__active">{l.appNavTasks}</span>
                    <span>{l.appNavInbox}</span>
                    <span>{l.appNavProfile}</span>
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
                { title: l.ai6, text: l.ai6Text },
              ].map((item) => (
                <div key={item.title} className="assistant__cell">
                  <h3>{item.title}</h3>
                  <p>{item.text}</p>
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

        {/*
          * Карточек стало четыре, и сетка сменилась с трёх колонок на
          * две. В трёх колонках четвёртая карточка — приложение
          * водителя — свисала бы одна во втором ряду и читалась как
          * недоделка, тогда как это единственная честная пометка на
          * странице. Два на два держат ряд ровным, и каждой карточке
          * достаётся ширина на два абзаца.
          */}
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <Card>
            <CardBody className="flex flex-col gap-3 p-6">
              <span className="self-start rounded-pill border border-accent-line bg-accent-wash px-2.5 py-1 text-[11px] font-semibold text-accent">
                {l.serviceLive}
              </span>
              <h3 className="text-[20px] font-semibold tracking-tight">
                {l.service1} <Mono className="text-[0.72em] text-ink-faint">irtoperä</Mono>
              </h3>
              <p className="text-[16px] text-ink-muted">{l.service1Text}</p>
              <p className="text-[16px] text-ink-muted">{l.service1Text2}</p>
            </CardBody>
          </Card>

          {/*
            * Контейнеры перестали быть «следующим»: они работают.
            *
            * Карточка была пунктирной и с меткой «Seuraavaksi», пока
            * второй услугой числилась перевозка чужим кузовом. Держать
            * пунктир вокруг того, что уже возят, значит говорить
            * перевозчику «нам это ещё нельзя доверить».
            */}
          <Card>
            <CardBody className="flex flex-col gap-3 p-6">
              <span className="self-start rounded-pill border border-accent-line bg-accent-wash px-2.5 py-1 text-[11px] font-semibold text-accent">
                {l.serviceLive}
              </span>
              <h3 className="text-[20px] font-semibold tracking-tight">
                {l.service2} <Mono className="text-[0.72em] text-ink-faint">20 · 40 · 45</Mono>
              </h3>
              <p className="text-[16px] text-ink-muted">{l.service2Text}</p>
              <p className="text-[16px] text-ink-muted">{l.service2Text2}</p>
            </CardBody>
          </Card>

          {/*
            * Экспресс стоит третьим и с той же меткой «Toiminnassa»:
            * ветка работает, её видно на столе и по ней идут расчёты.
            * Ставить её в «Kehitteillä» значило бы отговаривать от того,
            * что уже можно заказать.
            */}
          <Card>
            <CardBody className="flex flex-col gap-3 p-6">
              <span className="self-start rounded-pill border border-accent-line bg-accent-wash px-2.5 py-1 text-[11px] font-semibold text-accent">
                {l.serviceLive}
              </span>
              <h3 className="text-[20px] font-semibold tracking-tight">
                {l.service4} <Mono className="text-[0.72em] text-ink-faint">3,5 t · 26 t</Mono>
              </h3>
              <p className="text-[16px] text-ink-muted">{l.service4Text}</p>
              <p className="text-[16px] text-ink-muted">{l.service4Text2}</p>
            </CardBody>
          </Card>

          {/*
            * Приложение водителя работает — метка та же, что у веток
            * перевозок. Пунктир «в разработке» здесь больше не правда.
            */}
          <Card>
            <CardBody className="flex flex-col gap-3 p-6">
              <span className="self-start rounded-pill border border-accent-line bg-accent-wash px-2.5 py-1 text-[11px] font-semibold text-accent">
                {l.serviceLive}
              </span>
              <h3 className="text-[20px] font-semibold tracking-tight">{l.service3}</h3>
              <p className="text-[16px] text-ink-muted">{l.service3Text}</p>
              <p className="text-[16px] text-ink-muted">{l.service3Text2}</p>
            </CardBody>
          </Card>
        </div>
      </section>

      {/* ── Финал ──────────────────────────────────────────────── */}
      <section className="border-y border-line bg-surface">
        <div className="mx-auto w-full max-w-6xl px-5 py-20 text-center">
          <p className="label-micro">{l.finalEyebrow}</p>
          <h2 className="mt-3 text-[clamp(28px,3.6vw,40px)] font-semibold tracking-tight text-balance">
            {l.finalTitle}
          </h2>
          <p className="mx-auto mt-3.5 max-w-[52ch] text-[16px] text-ink-muted">{l.finalLede}</p>
          <p className="mx-auto mt-2.5 max-w-[52ch] text-[16px] text-ink-muted">{l.finalLede2}</p>

          <div className="mx-auto mt-7 grid max-w-[480px] gap-2.5 sm:grid-cols-2">
            <Link
              href={`/${locale}/apply`}
              className={buttonClass({ variant: 'primary', size: 'lg', className: 'h-12 text-[15px]' })}
            >
              {l.applyShipper}
            </Link>
            <Link href={`/${locale}/apply`} className={buttonClass({ size: 'lg', className: 'h-12 text-[15px]' })}>
              {l.applyCarrier}
            </Link>
          </div>
        </div>
      </section>

      {/* ── Подвал ─────────────────────────────────────────────── */}
      <footer className="mx-auto w-full max-w-6xl px-5 py-12">
        <div className="flex flex-wrap items-baseline gap-x-8 gap-y-4 text-xs text-ink-faint">
          {/*
            * Здесь юрлицо, а не марка: рядом стоит Y-tunnus, а он
            * принадлежит Aivomaa Oy. Подвал витрины — то место, где по
            * закону должно быть видно, с кем человек имеет дело.
            */}
          <span>
            <span className="font-semibold text-ink-muted">{t.brand.legalEntity}</span> ·{' '}
            <Mono>{APP.operator.businessId}</Mono> · {l.footerCountry}
          </span>
          <a href={`mailto:${APP.operator.email}`} className="hover:text-ink-muted">
            {APP.operator.email}
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




/* Две галочки: сообщение доставлено и прочитано. */




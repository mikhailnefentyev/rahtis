'use client';

import { useState } from 'react';
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardDivider,
  CardHeader,
  CardTitle,
  Countdown,
  DocChip,
  EmptyState,
  Field,
  Input,
  InputMono,
  Kv,
  Modal,
  Mono,
  Plate,
  RateStars,
  SectionTitle,
  Select,
  Stars,
  Stat,
  StatRow,
  Table,
  TableFrame,
  Tabs,
  Td,
  Textarea,
  Th,
  Tr,
  Waypoint,
  WaypointList,
  companyStatusTone,
  orderStatusTone,
  vehicleAccessTone,
} from '@/components/ui';
import { COMMISSION_BPS, commissionCents, payoutCents } from '@/lib/config';
import { useI18n } from '@/lib/i18n/provider';

/*
 * Витрина UI-кита.
 *
 * Каждый компонент показан во всех состояниях, какие у него бывают.
 * Это не демо для заказчика, а рабочий инструмент: сюда приходят, чтобы
 * увидеть, как выглядит компонент до того, как встроить его в экран,
 * и чтобы заметить, что новое состояние сломало старое.
 *
 * Про строки на этой странице. Продуктовые формулировки — кнопки, статусы,
 * подписи полей — берутся из словаря, как и везде. Собственные заголовки
 * витрины («Палитра», «Типографика») и демо-данные оставлены в коде:
 * страница живёт только в разработке и не переводится, а тащить её служебные
 * подписи в словарь значит отдать переводчику полсотни строк, которых никто
 * никогда не увидит. Правило «ноль текста вне словарей» действует для всего
 * остального кода и держится линтером — исключение прописано в eslint.config.mjs.
 */

export type DemoDeadlines = {
  normal: string;
  urgent: string;
  expired: string;
};

export function UiKitShowcase({ deadlines }: { deadlines: DemoDeadlines }) {
  const { t, m, f } = useI18n();

  const [tab, setTab] = useState<'desk' | 'fleet' | 'report'>('desk');
  const [modalOpen, setModalOpen] = useState(false);
  const [rating, setRating] = useState<number | null>(null);

  const commissionRate = COMMISSION_BPS / 10_000;

  const payouts = [
    { carrier: 'Nieminen Kuljetus Oy', trips: 7, gross: 324_000, rating: 4.7 },
    { carrier: 'Koskinen Transport', trips: 4, gross: 198_000, rating: 4.3 },
    { carrier: 'Virtanen Logistics', trips: 2, gross: 76_000, rating: 4.0 },
  ];

  return (
    <main className="mx-auto w-full max-w-5xl px-5 py-10">
      <header className="mb-10">
        <p className="label-micro">{t.brand.name} · Priima</p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">UI Kit</h1>
        <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-ink-muted">
          Компоненты во всех состояниях. Бирюза принадлежит только интерактиву,
          семантические цвета — только состоянию. Данные всегда моноширинным.
        </p>
      </header>

      <div className="flex flex-col gap-12">
        <Section title="Палитра">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Swatch name="ground" className="bg-ground" note="фон" />
            <Swatch name="surface" className="bg-surface" note="карточки" />
            <Swatch name="raised" className="bg-raised" note="кнопки" />
            <Swatch name="sunken" className="bg-sunken" note="поля" />
            <Swatch name="accent" className="bg-accent" note="интерактив" />
            <Swatch name="ok" className="bg-ok" note="выполнено" />
            <Swatch name="warn" className="bg-warn" note="ждёт решения" />
            <Swatch name="danger" className="bg-danger" note="откат" />
            <Swatch name="live" className="bg-live" note="в работе" />
            <Swatch name="line" className="bg-line" note="границы" />
            <Swatch name="line-grid" className="bg-line-grid" note="сетка таблиц" />
            <Swatch name="ink" className="bg-ink" note="текст" />
          </div>
        </Section>

        <Section title="Типографика">
          <Card>
            <CardBody className="flex flex-col gap-3">
              <p className="text-2xl font-semibold tracking-tight">Заголовок раздела · 24px</p>
              <p className="text-[15px] font-semibold tracking-tight">Заголовок карточки · 15px</p>
              <p className="text-[13px] text-ink">Основной текст · 13px</p>
              <p className="text-[13px] text-ink-muted">Второстепенный текст · ink-muted</p>
              <p className="text-xs text-ink-faint">Подпись · ink-faint</p>
              <p className="label-micro">Надпись над данными · 10px капсом</p>
              <p className="font-mono text-[13px] tracking-tight">
                HKO-441 · {f.dateTime('2026-11-12T06:00:00Z')} · {m('order.distance', { km: 130 })}{' '}
                · {f.eur(48_000)}
              </p>
            </CardBody>
          </Card>
        </Section>

        <Section title="Локаль: числа, даты, множественное число">
          <Card>
            <CardBody className="flex flex-col gap-5">
              <Labelled label="Intl-форматтеры">
                <div className="flex flex-col gap-1">
                  <Kv k="Сумма" v={f.eur(324_000)} mono />
                  <Kv k="С копейками" v={f.eur(192_050)} mono />
                  <Kv k="Дата" v={f.date('2026-11-12T06:00:00Z')} mono />
                  <Kv k="Время" v={f.time('2026-11-12T06:00:00Z')} mono />
                  <Kv k="Дробное" v={f.decimal(4.7)} mono />
                  <Kv k="Проценты" v={f.percent(commissionRate)} mono />
                </div>
              </Labelled>

              <Labelled label="Plural · рейсы">
                <div className="flex flex-wrap gap-2">
                  {[0, 1, 2, 5, 11, 21, 22, 105].map((n) => (
                    <Mono key={n} className="rounded-control bg-sunken px-2 py-1 text-xs">
                      {m('order.tripsCount', { count: n })}
                    </Mono>
                  ))}
                </div>
              </Labelled>

              <Labelled label="Plural · оси">
                <div className="flex flex-wrap gap-2">
                  {[1, 2, 3, 5].map((n) => (
                    <Mono key={n} className="rounded-control bg-sunken px-2 py-1 text-xs">
                      {m('vehicle.axlesCount', { count: n })}
                    </Mono>
                  ))}
                </div>
              </Labelled>

              <Labelled label="Именованные подстановки">
                <p className="max-w-2xl text-[13px] text-ink-muted">
                  {m('signup.submitted', {
                    company: 'Nieminen Kuljetus Oy',
                    businessId: '1234567-8',
                    email: 'ops@nieminen.fi',
                  })}
                </p>
              </Labelled>
            </CardBody>
          </Card>
        </Section>

        <Section title="Кнопки">
          <div className="flex flex-col gap-4">
            <Row>
              <Button variant="primary">{t.action.take}</Button>
              <Button>{t.action.details}</Button>
              <Button variant="ghost">{t.action.collapse}</Button>
              <Button variant="danger">{t.action.decline}</Button>
            </Row>
            <Row>
              <Button variant="primary" size="sm">
                {t.action.choose}
              </Button>
              <Button variant="primary" size="md">
                {t.action.publish}
              </Button>
              <Button variant="primary" size="lg">
                {t.action.submitApplication}
              </Button>
            </Row>
            <Row>
              <Button variant="primary" disabled>
                {m('order.offersFull', { count: 3, max: 3 })}
              </Button>
              <Button disabled>{t.action.add}</Button>
            </Row>
          </div>
        </Section>

        <Section title="Статусы">
          <div className="flex flex-col gap-4">
            <Labelled label="Заказ">
              {Object.entries(t.orderStatus).map(([key, label]) => (
                <Badge key={key} tone={orderStatusTone[key as keyof typeof orderStatusTone]}>
                  {label}
                </Badge>
              ))}
            </Labelled>
            <Labelled label="Этап рейса">
              {Object.values(t.tripStep).map((label) => (
                <Badge key={label} tone="live">
                  {label}
                </Badge>
              ))}
            </Labelled>
            <Labelled label="Компания">
              {Object.entries(t.companyStatus).map(([key, label]) => (
                <Badge key={key} tone={companyStatusTone[key as keyof typeof companyStatusTone]}>
                  {label}
                </Badge>
              ))}
            </Labelled>
            <Labelled label="Допуск машины">
              {Object.entries(t.vehicleAccess).map(([key, label]) => (
                <Badge key={key} tone={vehicleAccessTone[key as keyof typeof vehicleAccessTone]}>
                  {label}
                </Badge>
              ))}
            </Labelled>
          </div>
        </Section>

        <Section title="Метрики">
          <StatRow>
            <Stat label={t.moderation.queue} value={f.number(3)} tone="warn" />
            <Stat label={t.money.revenue} value={f.eur(211_000)} tone="info" />
            <Stat label={t.money.payout} value={f.eur(204_670)} tone="live" />
            <Stat
              label={m('money.marginRate', { rate: commissionRate })}
              value={f.eur(6_330)}
              tone="ok"
            />
          </StatRow>
        </Section>

        <Section title="Обратный отсчёт">
          <Card>
            <CardBody className="flex flex-wrap gap-6">
              <Countdown deadline={deadlines.normal} />
              <Countdown deadline={deadlines.urgent} />
              <Countdown deadline={deadlines.expired} />
            </CardBody>
          </Card>
        </Section>

        <Section title="Вкладки">
          <Tabs
            items={[
              { key: 'desk', label: t.nav.desk },
              { key: 'fleet', label: t.nav.fleet, count: 2 },
              { key: 'report', label: t.nav.report },
            ]}
            active={tab}
            onChange={setTab}
          />
          <p className="mt-3 font-mono text-xs text-ink-dim">active: {tab}</p>
        </Section>

        <Section title="Карточка заказа">
          <Card stripe="live">
            <CardBody>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <h3 className="text-[15px] font-semibold tracking-tight">
                      {t.orderType.TRAILER_SWAP}
                    </h3>
                    <Badge tone="live">{t.tripStep.LOADED}</Badge>
                    <Mono className="text-xs text-ink-dim">BF-2026-0912</Mono>
                  </div>
                  <p className="mt-2 font-mono text-sm tracking-tight text-accent">
                    Hanko → Helsinki
                  </p>
                  <p className="mt-1.5 text-[13px] text-ink-muted">
                    Тент 13.6 · {m('vehicle.axlesCount', { count: 3 })} ·{' '}
                    <Mono>{m('order.distance', { km: 130 })}</Mono> ·{' '}
                    <Mono className="font-bold text-ink">{f.eur(48_000)}</Mono>{' '}
                    <Mono className="text-ink-dim">
                      · {m('order.ratePerKm', { rate: f.eurPerKm(48_000, 130) ?? '' })}
                    </Mono>
                  </p>
                  <p className="mt-1 text-xs text-ink-dim">Baltic Freight Oy</p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <Button variant="primary">{t.action.closeTrip}</Button>
                  <Countdown deadline={deadlines.normal} />
                </div>
              </div>

              <CardDivider className="my-4" />

              <WaypointList>
                <Waypoint
                  kind="PICKUP"
                  title={`${t.stopKind.PICKUP} · ${t.placeKind.PORT}`}
                  primary="Hanko Port, Terminal 2"
                  secondary="Satamakatu 1, 10900 Hanko"
                  meta={f.dateTime('2026-11-12T06:00:00Z')}
                />
                <Waypoint
                  kind="EXTRA_LOAD"
                  title={t.stopKind.EXTRA_LOAD}
                  primary="Kotka Cargo Oy"
                  secondary="Satamatie 8, 48100 Kotka"
                  meta={f.dateTime('2026-11-12T08:30:00Z')}
                />
                <Waypoint
                  kind="DELIVERY"
                  title={t.stopKind.DELIVERY}
                  primary="Helsinki Logistics Center"
                  secondary="Tavaratie 5, 00700 Helsinki · Mika Virtanen · +358 40 700 1122"
                  meta={f.dateTime('2026-11-12T12:00:00Z')}
                />
                <Waypoint
                  kind="TRAILER_RETURN"
                  title={t.stopKind.TRAILER_RETURN}
                  primary="Hanko Port, Terminal 2"
                />
              </WaypointList>

              <CardDivider className="my-4" />

              <div className="label-micro mb-2.5">
                {m('order.offersCounter', { count: 2, max: 3 })}
              </div>
              <div className="flex items-center justify-between gap-4 rounded-control border border-line bg-sunken px-3 py-2.5">
                <div className="min-w-0">
                  <div className="flex items-center gap-2.5">
                    <Plate>HKO-441</Plate>
                    <Stars value={4.7} count={9} />
                  </div>
                  <p className="mt-1 text-xs text-ink-muted">
                    {m('vehicle.axlesCount', { count: 3 })} · Antti Nieminen · Nieminen Kuljetus Oy
                  </p>
                </div>
                <Button variant="primary" size="sm">
                  {t.action.choose}
                </Button>
              </div>
            </CardBody>
          </Card>
        </Section>

        <Section title="Таблица-документ">
          <TableFrame
            caption={t.report.weeklyPayouts}
            actions={<Button size="sm">{t.action.export}</Button>}
          >
            <Table>
              <thead>
                <tr>
                  <Th>{t.role.carrier}</Th>
                  <Th>{t.vehicle.rating}</Th>
                  <Th numeric>{t.order.trips}</Th>
                  <Th numeric>{t.money.gross}</Th>
                  <Th numeric>{m('money.commissionRate', { rate: commissionRate })}</Th>
                  <Th numeric>{t.money.payout}</Th>
                </tr>
              </thead>
              <tbody>
                {payouts.map((row) => (
                  <Tr key={row.carrier} interactive>
                    <Td>{row.carrier}</Td>
                    <Td>
                      <Stars value={row.rating} />
                    </Td>
                    <Td numeric>{f.number(row.trips)}</Td>
                    <Td numeric className="text-ink-muted">
                      {f.eur(row.gross)}
                    </Td>
                    <Td numeric className="text-ok">
                      −{f.eur(commissionCents(row.gross))}
                    </Td>
                    <Td numeric className="font-bold text-live">
                      {f.eur(payoutCents(row.gross))}
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </TableFrame>
        </Section>

        <Section title="Поля формы">
          <Card>
            <CardBody className="grid gap-4 sm:grid-cols-2">
              <Field label={t.company.name} required>
                {(p) => <Input {...p} placeholder="Nieminen Kuljetus Oy" />}
              </Field>
              <Field label={t.company.businessId} required error={t.validation.businessId}>
                {(p) => <InputMono {...p} defaultValue="12345" />}
              </Field>
              <Field label={t.company.email} hint={t.company.emailHint}>
                {(p) => <Input {...p} type="email" placeholder="ops@company.fi" />}
              </Field>
              <Field label={t.vehicle.euro}>
                {(p) => (
                  <Select {...p} defaultValue="Euro 6">
                    <option>Euro 6</option>
                    <option>Euro 5</option>
                    <option>Euro 4</option>
                  </Select>
                )}
              </Field>
              <Field label={t.vehicle.plate}>
                {(p) => <InputMono {...p} placeholder="HKO-441" />}
              </Field>
              <Field label={t.vehicle.base}>{(p) => <Input {...p} disabled defaultValue="Hanko" />}</Field>
              <Field label={t.order.comment} className="sm:col-span-2">
                {(p) => <Textarea {...p} rows={3} placeholder={t.order.commentPlaceholder} />}
              </Field>
            </CardBody>
          </Card>
        </Section>

        <Section title="Секция формы">
          <Card>
            <CardBody>
              <SectionTitle>{t.order.cargoAndPayment}</SectionTitle>
              <div className="flex flex-col gap-1.5">
                <Kv k={t.order.trailer} v="Тент 13.6" />
                <Kv k={t.order.distance} v={m('order.distance', { km: 130 })} mono />
                <Kv k={t.order.rate} v={f.eur(48_000)} mono />
                <Kv k={t.vehicle.driver} v="Antti Nieminen · +358 40 111 2233" />
              </div>
            </CardBody>
          </Card>
        </Section>

        <Section title="Рейтинг и документы">
          <Card>
            <CardBody className="flex flex-col gap-5">
              <Labelled label="Оценка">
                <Stars value={4.7} count={9} />
                <Stars value={3.0} count={1} />
                <Stars value={null} />
              </Labelled>
              <Labelled label={t.rating.rate}>
                <RateStars onRate={setRating} />
                <Mono className="text-[13px] text-ink-muted">
                  {rating == null ? '—' : f.decimal(rating, 0)}
                </Mono>
              </Labelled>
              <Labelled label={t.order.documents}>
                <DocChip label={t.company.license} uploaded />
                <DocChip label={t.company.insurance} uploaded={false} />
              </Labelled>
            </CardBody>
          </Card>
        </Section>

        <Section title="Пустые состояния">
          <div className="grid gap-3 sm:grid-cols-2">
            <EmptyState title={t.empty.noOrders} description={t.empty.noOrdersHint} />
            <EmptyState
              title={t.empty.noAccessTitle}
              description={t.empty.noAccessText}
              action={<Button variant="primary">{t.action.addVehicle}</Button>}
            />
          </div>
        </Section>

        <Section title="Шапка карточки и модалка">
          <Card>
            <CardHeader>
              <CardTitle>{t.moderation.applications}</CardTitle>
              <Badge tone="warn" className="ml-auto">
                {m('moderation.queued', { count: 3 })}
              </Badge>
            </CardHeader>
            <CardBody>
              <Button onClick={() => setModalOpen(true)}>{t.order.closeTitle}</Button>
            </CardBody>
          </Card>

          <Modal
            open={modalOpen}
            onClose={() => setModalOpen(false)}
            title={t.order.closeTitle}
            subtitle={
              <>
                {t.orderType.TRAILER_SWAP} · <Mono>BF-2026-0912</Mono> · Hanko → Helsinki
              </>
            }
            footer={
              <>
                <Button onClick={() => setModalOpen(false)}>{t.action.cancel}</Button>
                <Button variant="primary" onClick={() => setModalOpen(false)}>
                  {t.action.confirm}
                </Button>
              </>
            }
          >
            <div className="flex flex-col gap-4">
              <p className="text-[13px] text-ink-muted">
                Esc и клик по подложке закрывают окно, фокус не выходит наружу — за это отвечает
                нативный &lt;dialog&gt;.
              </p>
              <Field label={t.order.damage}>
                {(p) => <Textarea {...p} rows={2} placeholder={t.order.damagePlaceholder} />}
              </Field>
            </div>
          </Modal>
        </Section>
      </div>
    </main>
  );
}

/* ── Вспомогательное для самой витрины ──────────────────────────────── */

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-4 border-b border-line pb-2 text-[13px] font-semibold tracking-tight text-ink-faint">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap items-center gap-2.5">{children}</div>;
}

function Labelled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-start gap-2.5">
      <span className="label-micro w-32 shrink-0 pt-1">{label}</span>
      {children}
    </div>
  );
}

function Swatch({ name, className, note }: { name: string; className: string; note: string }) {
  return (
    <div className="overflow-hidden rounded-control border border-line">
      <div className={`h-12 ${className}`} />
      <div className="bg-surface px-2.5 py-2">
        <div className="font-mono text-[11px] tracking-tight text-ink">{name}</div>
        <div className="text-[11px] text-ink-dim">{note}</div>
      </div>
    </div>
  );
}

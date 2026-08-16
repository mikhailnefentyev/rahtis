'use client';

import { useMemo, useState } from 'react';
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
import { createFormat } from '@/lib/format';
import { useT } from '@/lib/i18n/provider';

export type DemoDeadlines = {
  normal: string;
  urgent: string;
  expired: string;
};

/**
 * Витрина UI-кита.
 *
 * Каждый компонент показан во всех состояниях, какие у него бывают.
 * Это не демо для заказчика, а рабочий инструмент: сюда приходят, чтобы
 * увидеть, как выглядит компонент до того, как встроить его в экран,
 * и чтобы заметить, что новое состояние сломало старое.
 *
 * Демонстрационные дедлайны приходят пропсами с сервера — ровно так же,
 * как в бою они приедут из колонки deadline_at.
 */
export function UiKitShowcase({ deadlines }: { deadlines: DemoDeadlines }) {
  const t = useT();
  const f = useMemo(() => createFormat(t.meta.intl), [t.meta.intl]);

  const [tab, setTab] = useState<'desk' | 'fleet' | 'report'>('desk');
  const [modalOpen, setModalOpen] = useState(false);
  const [rating, setRating] = useState<number | null>(null);

  const payouts = [
    { carrier: 'Nieminen Kuljetus Oy', trips: 7, gross: 324_000 },
    { carrier: 'Koskinen Transport', trips: 4, gross: 198_000 },
    { carrier: 'Virtanen Logistics', trips: 2, gross: 76_000 },
  ];

  return (
    <main className="mx-auto w-full max-w-5xl px-5 py-10">
      <header className="mb-10">
        <p className="label-micro">{t.brand.name} · Этап 0 · направление A «Priima»</p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">UI-кит</h1>
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
              <p className="text-[13px] text-ink">Основной текст · 13px — плотно, но читаемо</p>
              <p className="text-[13px] text-ink-muted">Второстепенный текст · ink-muted</p>
              <p className="text-xs text-ink-faint">Подпись · ink-faint</p>
              <p className="label-micro">Надпись над данными · 10px капсом</p>
              <p className="font-mono text-[13px] tracking-tight">
                Данные моно: HKO-441 · 12.11.2026 08:00 · 130 км · {f.eur(48_000)}
              </p>
            </CardBody>
          </Card>
        </Section>

        <Section title="Кнопки">
          <div className="flex flex-col gap-4">
            <Row>
              <Button variant="primary">Беру</Button>
              <Button>Подробнее</Button>
              <Button variant="ghost">Свернуть</Button>
              <Button variant="danger">Отказаться</Button>
            </Row>
            <Row>
              <Button variant="primary" size="sm">
                Выбрать
              </Button>
              <Button variant="primary" size="md">
                Опубликовать
              </Button>
              <Button variant="primary" size="lg">
                Отправить заявку
              </Button>
            </Row>
            <Row>
              <Button variant="primary" disabled>
                Мест нет 3/3
              </Button>
              <Button disabled>Недоступно</Button>
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
            <Stat label="Очередь модерации" value="3" tone="warn" />
            <Stat label={t.money.revenue} value={f.eur(211_000)} tone="info" />
            <Stat label={t.money.payout} value={f.eur(204_670)} tone="live" />
            <Stat
              label={`${t.money.margin} · ${COMMISSION_BPS / 100}%`}
              value={f.eur(6_330)}
              tone="ok"
            />
          </StatRow>
        </Section>

        <Section title="Обратный отсчёт">
          <Card>
            <CardBody className="flex flex-wrap gap-6">
              <Countdown deadline={deadlines.normal} label={t.order.timeLeft} />
              <Countdown deadline={deadlines.urgent} label={t.order.timeLeft} />
              <Countdown deadline={deadlines.expired} label={t.order.timeLeft} />
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
          <p className="mt-3 text-[13px] text-ink-muted">Активна вкладка: {tab}</p>
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
                    Тент 13.6, 3 оси · <Mono>130</Mono> {t.unit.km} ·{' '}
                    <Mono className="font-bold text-ink">{f.eur(48_000)}</Mono>{' '}
                    <span className="text-ink-dim">
                      · <Mono>{f.eurPerKm(48_000, 130)}</Mono>
                      {t.unit.perKm}
                    </span>
                  </p>
                  <p className="mt-1 text-xs text-ink-dim">Baltic Freight Oy</p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <Button variant="primary">Закрыть рейс</Button>
                  <Countdown deadline={deadlines.normal} label={t.order.timeLeft} />
                </div>
              </div>

              <CardDivider className="my-4" />

              <WaypointList>
                <Waypoint
                  kind="PICKUP"
                  title={`${t.stopKind.PICKUP} · ${t.placeKind.PORT}`}
                  primary="Hanko Port, Terminal 2"
                  secondary="Satamakatu 1, 10900 Hanko"
                  meta="12.11.2026 08:00"
                />
                <Waypoint
                  kind="EXTRA_LOAD"
                  title={t.stopKind.EXTRA_LOAD}
                  primary="Kotka Cargo Oy"
                  secondary="Satamatie 8, 48100 Kotka"
                  meta="12.11.2026 10:30"
                />
                <Waypoint
                  kind="DELIVERY"
                  title={t.stopKind.DELIVERY}
                  primary="Helsinki Logistics Center"
                  secondary="Tavaratie 5, 00700 Helsinki · Mika Virtanen · +358 40 700 1122"
                  meta="12.11.2026 14:00"
                />
                <Waypoint
                  kind="TRAILER_RETURN"
                  title={t.stopKind.TRAILER_RETURN}
                  primary="Hanko Port, Terminal 2 — без груза"
                />
              </WaypointList>

              <CardDivider className="my-4" />

              <div className="label-micro mb-2.5">
                {t.order.offers} · 2 / 3 — выберите машину
              </div>
              <div className="flex items-center justify-between gap-4 rounded-control border border-line bg-sunken px-3 py-2.5">
                <div className="min-w-0">
                  <div className="flex items-center gap-2.5">
                    <Plate>HKO-441</Plate>
                    <Stars value={4.7} count={9} />
                  </div>
                  <p className="mt-1 text-xs text-ink-muted">
                    3 {t.unit.axles} · Antti Nieminen · Nieminen Kuljetus Oy
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
            caption="Еженедельные выплаты перевозчикам"
            actions={<Button size="sm">↓ {t.action.export}</Button>}
          >
            <Table>
              <thead>
                <tr>
                  <Th>Перевозчик</Th>
                  <Th>{t.vehicle.rating}</Th>
                  <Th numeric>{t.unit.trips}</Th>
                  <Th numeric>{t.money.gross}</Th>
                  <Th numeric>
                    {t.money.commission} {COMMISSION_BPS / 100}%
                  </Th>
                  <Th numeric>{t.money.payout}</Th>
                </tr>
              </thead>
              <tbody>
                {payouts.map((row, i) => (
                  <Tr key={row.carrier} interactive>
                    <Td>{row.carrier}</Td>
                    <Td>
                      <Stars value={[4.7, 4.3, 4.0][i] ?? null} />
                    </Td>
                    <Td numeric>{row.trips}</Td>
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
              <Field
                label={t.company.businessId}
                required
                error={t.validation.businessId}
              >
                {(p) => <InputMono {...p} defaultValue="12345" />}
              </Field>
              <Field label={t.company.email} hint="Сюда придут коды доступа">
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
              <Field label={t.vehicle.plate} className="sm:col-span-1">
                {(p) => <InputMono {...p} placeholder="HKO-441" />}
              </Field>
              <Field label="Недоступное поле">
                {(p) => <Input {...p} disabled defaultValue="Заполняется оператором" />}
              </Field>
              <Field label={t.order.comment} className="sm:col-span-2">
                {(p) => (
                  <Textarea {...p} rows={3} placeholder="Пропуск в порт, пломба, температурный режим…" />
                )}
              </Field>
            </CardBody>
          </Card>
        </Section>

        <Section title="Секция формы">
          <Card>
            <CardBody>
              <SectionTitle>Груз и оплата</SectionTitle>
              <div className="flex flex-col gap-1.5">
                <Kv k={t.order.trailer} v="Тент 13.6, 3 оси" />
                <Kv k={t.order.distance} v="130 км" mono />
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
                <Stars value={3.0} />
                <Stars value={null} emptyLabel={t.rating.none} />
              </Labelled>
              <Labelled label={t.rating.rate}>
                <RateStars onRate={setRating} />
                <span className="text-[13px] text-ink-muted">
                  {rating ? `Выставлено: ${rating}` : 'Не оценено'}
                </span>
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
            <EmptyState title={t.empty.noOrders} description="Смените регион в фильтре или подождите новых публикаций." />
            <EmptyState
              title="Нет допуска к заказам"
              description="Чтобы видеть стол и откликаться, нужна хотя бы одна допущенная машина."
              action={<Button variant="primary">Добавить машину</Button>}
            />
          </div>
        </Section>

        <Section title="Шапка карточки и модалка">
          <Card>
            <CardHeader>
              <CardTitle>Заявки на регистрацию</CardTitle>
              <Badge tone="warn" className="ml-auto">
                3 в очереди
              </Badge>
            </CardHeader>
            <CardBody>
              <Button onClick={() => setModalOpen(true)}>Открыть модалку</Button>
            </CardBody>
          </Card>

          <Modal
            open={modalOpen}
            onClose={() => setModalOpen(false)}
            title="Закрытие рейса"
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
                Esc и клик по подложке закрывают окно, фокус не выходит наружу —
                за это отвечает нативный &lt;dialog&gt;.
              </p>
              <Field label={t.order.damage}>
                {(p) => <Textarea {...p} rows={2} placeholder="Скол на левом борту прицепа" />}
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
    <div className="flex flex-wrap items-center gap-2.5">
      <span className="label-micro w-32 shrink-0">{label}</span>
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

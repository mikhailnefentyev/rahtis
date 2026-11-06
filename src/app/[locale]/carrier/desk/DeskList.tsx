'use client';

import { ForwarderPolicyNote, type ForwarderPolicyInfo } from '@/components/domain/ForwarderDirect';
import { ShipperTrustBadge } from '@/components/domain/ShipperTrust';
import type { ShipperTrust } from '@/lib/trust/model';
import { useActionState, useState, type ReactNode } from 'react';
import { OrderRouteMap } from '@/components/domain/RouteMap';
import { RouteStops } from '@/components/domain/RouteStops';
import { routeLabel } from '@/lib/orders/route';
import { formatWaitMinutes, type SiteWaiting } from '@/lib/orders/waiting';
import { HaulBadge } from '@/components/domain/HaulBadge';
import { Badge, Button, Card, CardBody, CardDivider, EmptyState, Mono, Plate, Select } from '@/components/ui';
import { MATCHING } from '@/lib/config';
import { groupTakeAction, takeOrderAction, type MatchingState } from '@/lib/orders/matching';
import { useI18n } from '@/lib/i18n/provider';
import { vehicleClassFits } from '@/lib/orders/haul';
import { isTransfer } from '@/lib/orders/transfer';
import type { DeskOrder, DeskStop, Vehicle } from '@/types/db';
import type { MatchChoice, OrderMatch } from '@/lib/desk/match';
import type { MessageKey } from '@/lib/i18n';

const initialTake: MatchingState = { error: null };

/**
 * «Беру» для заказа, предложенного группе машин заказчика: первый
 * получает, сразу подтверждено. Машины — только свои из группы.
 */
function GroupTakeButton({ orderId, vehicles, line }: { orderId: string; vehicles: Vehicle[]; line?: ReactNode }) {
  const { t, locale } = useI18n();
  const [state, formAction, pending] = useActionState(groupTakeAction, initialTake);
  const [vehicleId, setVehicleId] = useState(vehicles[0]?.id ?? '');

  return (
    <form action={formAction} className="flex flex-col items-end gap-2">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="order_id" value={orderId} />
      {line}
      {vehicles.length === 1 ? (
        <input type="hidden" name="vehicle_id" value={vehicles[0]!.id} />
      ) : (
        <Select
          name="vehicle_id"
          value={vehicleId}
          onChange={(e) => setVehicleId(e.target.value)}
          aria-label={t.direct.chooseVehicle}
        >
          {vehicles.map((v) => (
            <option key={v.id} value={v.id}>
              {v.plate}
            </option>
          ))}
        </Select>
      )}
      <Button type="submit" variant="primary" disabled={pending || vehicles.length === 0}>
        {t.direct.groupTake}
      </Button>
      {state.error && <p className="max-w-60 text-right text-xs text-danger">{state.error}</p>}
    </form>
  );
}

/** Рейс или отклик, которым машина уже занята в какой-то день. */
export type DeskBusy = { vehicleId: string; ref: string; date: string; time: string | null };

/**
 * Кнопка «Беру».
 *
 * Машину выбирает перевозчик: у компании их может быть несколько, а
 * отклик подаётся конкретной. С одной машиной выбирать нечего — селект
 * не показывается.
 */
function TakeButton({
  orderId,
  vehicles,
  combos = [],
  pickupDate,
  busy,
}: {
  orderId: string;
  vehicles: Vehicle[];
  /** Сцепки из конструктора, подходящие заказу по виду; точную проверку делает база. */
  combos?: DeskCombo[];
  pickupDate: string | null;
  busy: DeskBusy[];
}) {
  const { t, m, f, locale } = useI18n();
  const [state, formAction, pending] = useActionState(takeOrderAction, initialTake);
  /* Сначала сцепки (с прицепом рейса), потом машины без сцепки — как раньше. */
  const choices = [
    ...combos.map((c) => ({ value: `c:${c.id}`, vehicleId: c.vehicle_id, label: c.name })),
    ...vehicles.map((v) => ({ value: v.id, vehicleId: v.id, label: v.plate })),
  ];
  const [choice, setChoice] = useState(choices[0]?.value ?? '');
  const vehicleId = choices.find((c) => c.value === choice)?.vehicleId ?? '';

  /*
   * Предупреждение, а не запрет (решение пользователя от 26.09.2026): два
   * рейса в один день бывают законно — утренний короткий и дневной.
   * Перевозчик должен увидеть пересечение до отклика, а не узнать о нём,
   * когда оба заказчика ждут одну машину.
   */
  const clash = pickupDate
    ? busy.find((b) => b.vehicleId === vehicleId && b.date === pickupDate)
    : undefined;
  const clashPlate = vehicles.find((v) => v.id === vehicleId)?.plate ?? '';

  /* Подходящей машины нет — говорим об этом сразу, а не пустым списком и отказом после отправки. */
  if (choices.length === 0) {
    return <p className="max-w-52 text-right text-xs text-ink-muted">{t.matching.wrongClass}</p>;
  }

  return (
    <form action={formAction} className="flex flex-col items-end gap-2">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="order_id" value={orderId} />

      {choices.length === 1 ? (
        <input type="hidden" name="vehicle_id" value={choices[0]!.value} />
      ) : (
        <label className="flex flex-col items-end gap-1">
          <span className="label-micro">{combos.length ? t.matching.chooseCombo : t.matching.chooseVehicle}</span>
          <Select name="vehicle_id" required className="w-56" value={choice} onChange={(e) => setChoice(e.target.value)}>
            {choices.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </Select>
        </label>
      )}

      {clash && (
        <p className="max-w-60 text-right text-xs text-warn">
          {m('matching.vehicleBusy', {
            plate: clashPlate,
            ref: clash.ref,
            when: clash.time ? `${f.date(`${clash.date}T12:00:00Z`)} ${clash.time.slice(0, 5)}` : f.date(`${clash.date}T12:00:00Z`),
          })}
        </p>
      )}

      <Button type="submit" variant="primary" size="sm" disabled={pending}>
        {pending ? t.matching.taking : t.matching.take}
      </Button>

      {state.error && (
        <p role="alert" className="max-w-52 text-right text-xs text-danger">
          {state.error}
        </p>
      )}
    </form>
  );
}

const SOURCE_KEY: Record<string, MessageKey> = {
  ORDER: 'deskMatch.src.ORDER',
  GPS: 'deskMatch.src.GPS',
  LAST: 'deskMatch.src.LAST',
  BASE: 'deskMatch.src.BASE',
};

/** «Sopii ABC-123 · vapaa klo 14 · ≈15 km tyhjänä (GPS)» — одной строкой. */
function FitLine({ choice, today }: { choice: MatchChoice; today: string }) {
  const { m, f } = useI18n();
  const free = choice.freeLocal;
  /* Не идущий рейс — машина свободна сейчас (время в базе — «сейчас»). */
  const freeNow = !free || choice.source !== 'ORDER';
  const when = free
    ? free.slice(0, 10) === today
      ? free.slice(11, 16)
      : `${f.date(`${free.slice(0, 10)}T12:00:00Z`)} ${free.slice(11, 16)}`
    : '';
  const source = choice.source ? SOURCE_KEY[choice.source] : undefined;

  return (
    <p className="max-w-72 text-right text-xs text-ink-muted">
      <span className="font-semibold text-ink">{m('deskMatch.fits', { plate: choice.comboName ?? choice.plate })}</span>
      {' · '}
      {freeNow ? (
        m('deskMatch.freeNow')
      ) : choice.inTime ? (
        m('deskMatch.freeAt', { when })
      ) : (
        <span className="text-warn">{m('deskMatch.freeLate', { when })}</span>
      )}
      {choice.emptyKm !== null && (
        <>
          {' · '}
          {m('deskMatch.empty', { km: choice.emptyKm })}
          {source && <span className="text-ink-dim"> ({m(source, { ref: choice.afterRef ?? '' })})</span>}
        </>
      )}
    </p>
  );
}

/** Подходящей машины нет — приглушённая причина вместо кнопки. */
function MatchReason({ match, requirements, cargoKg }: { match: OrderMatch; requirements: unknown; cargoKg: number }) {
  const { t, m } = useI18n();
  const body = ((requirements ?? {}) as { body?: string | null }).body;
  const text =
    match.reason === 'BODY'
      ? body
        ? m('deskMatch.none.BODY', { body: t.mass.bodies[body as keyof typeof t.mass.bodies] ?? body })
        : m('deskMatch.none.LOADING')
      : match.reason === 'WEIGHT'
        ? m('deskMatch.none.WEIGHT', { kg: cargoKg })
        : match.reason === 'SIZE'
          ? m('deskMatch.none.SIZE')
          : match.reason === 'CLASS'
            ? m('deskMatch.none.CLASS')
            : m('deskMatch.none.NONE');
  return <p className="max-w-60 text-right text-xs text-ink-dim">{text}</p>;
}

/**
 * «Беру одним нажатием» (6.11.2026): лучшая своя машина уже выбрана,
 * кнопка называет её номер. Второе нажатие — подтверждение с главным:
 * цена, забор, машина. Отклик — тем же takeOrderAction (машина или сцепка).
 */
function OneTapTake({
  orderId,
  match,
  price,
  pickup,
  pickupDate,
  busy,
  requirements,
  cargoKg,
  today,
}: {
  orderId: string;
  match: OrderMatch;
  price: string | null;
  pickup: string;
  pickupDate: string | null;
  busy: DeskBusy[];
  requirements: unknown;
  cargoKg: number;
  today: string;
}) {
  const { t, m, f, locale } = useI18n();
  const [state, formAction, pending] = useActionState(takeOrderAction, initialTake);
  const [value, setValue] = useState(match.choices[0]?.value ?? '');
  const [confirming, setConfirming] = useState(false);
  const choice = match.choices.find((c) => c.value === value) ?? match.choices[0];

  if (!choice) {
    return <MatchReason match={match} requirements={requirements} cargoKg={cargoKg} />;
  }

  /* Пересечение в тот же день — предупреждение, не запрет (решение 26.09.2026). */
  const clash = pickupDate ? busy.find((b) => b.vehicleId === choice.vehicleId && b.date === pickupDate) : undefined;
  const label = choice.comboName ?? choice.plate;

  return (
    <div className="flex flex-col items-end gap-2">
      <FitLine choice={choice} today={today} />

      {confirming ? (
        <form action={formAction} className="flex w-64 flex-col gap-2 rounded-control border border-line bg-sunken p-3 text-xs">
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="order_id" value={orderId} />
          <input type="hidden" name="vehicle_id" value={choice.value} />
          <p className="font-semibold text-ink">{m('deskMatch.confirmTitle')}</p>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
            {price && (
              <>
                <dt className="text-ink-dim">{m('deskMatch.price')}</dt>
                <dd className="font-semibold text-ink">{price}</dd>
              </>
            )}
            <dt className="text-ink-dim">{m('deskMatch.pickup')}</dt>
            <dd className="text-ink">{pickup}</dd>
            <dt className="text-ink-dim">{m('deskMatch.vehicle')}</dt>
            <dd className="font-mono text-ink">{label}</dd>
          </dl>
          {clash && (
            <p className="text-warn">
              {m('matching.vehicleBusy', {
                plate: choice.plate,
                ref: clash.ref,
                when: clash.time ? `${f.date(`${clash.date}T12:00:00Z`)} ${clash.time.slice(0, 5)}` : f.date(`${clash.date}T12:00:00Z`),
              })}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button type="button" size="sm" onClick={() => setConfirming(false)} disabled={pending}>
              {m('deskMatch.back')}
            </Button>
            <Button type="submit" variant="primary" size="sm" disabled={pending}>
              {pending ? t.matching.taking : m('deskMatch.send')}
            </Button>
          </div>
        </form>
      ) : (
        <div className="flex flex-wrap items-center justify-end gap-2">
          {match.choices.length > 1 && (
            <Select
              aria-label={m('deskMatch.others', { count: match.choices.length - 1 })}
              title={m('deskMatch.others', { count: match.choices.length - 1 })}
              className="h-8 w-auto text-xs"
              value={choice.value}
              onChange={(e) => setValue(e.target.value)}
            >
              {match.choices.map((c) => (
                <option key={c.value} value={c.value}>
                  {`${c.comboName ?? c.plate}${c.emptyKm !== null ? ` · ≈${c.emptyKm} km` : ''}`}
                </option>
              ))}
            </Select>
          )}
          <Button variant="primary" size="sm" onClick={() => setConfirming(true)}>
            {m('deskMatch.take', { plate: label })}
          </Button>
        </div>
      )}

      {state.error && (
        <p role="alert" className="max-w-60 text-right text-xs text-danger">
          {state.error}
        </p>
      )}
    </div>
  );
}

/**
 * Стол заказов.
 *
 * Маршрут приходит уже без контактов получателя — их не отдаёт функция
 * desk_orders. Об этом сказано прямо в карточке: иначе перевозчик решит,
 * что заказчик не заполнил контакт.
 */
export function DeskList({
  orders,
  vehicles,
  combos = [],
  busy = [],
  waiting = {},
  currencyByOrder = {},
  policyByOrder = {},
  trustByOrder = {},
  perKmByOrder = {},
  matches,
  today = '',
}: {
  orders: DeskOrder[];
  /** Подобранные свои машины по id заказа; нет — стол без подбора (старый выбор машины). */
  matches?: Record<string, OrderMatch>;
  /** Сегодня по Хельсинки: «свободна с 14:00» без даты, если сегодня. */
  today?: string;
  /** Цена за км (ставка в центах): при правке маршрута цена пересчитывается. */
  perKmByOrder?: Record<string, number>;
  /** Полис экспедитора-заказчика у заказов «напрямую с перевозчиком»: справка. */
  policyByOrder?: Record<string, ForwarderPolicyInfo>;
  /** Сведения об оплате заказчика у заказов «напрямую»: справка, не гарантия. */
  trustByOrder?: Record<string, ShipperTrust>;
  /** Валюта цены по id заказа; нет — евро (стол RAHTIS всегда в евро). */
  currencyByOrder?: Record<string, string>;
  vehicles: Vehicle[];
  /** Сохранённые сцепки перевозчика (конструктор в автопарке). */
  combos?: DeskCombo[];
  busy?: DeskBusy[];
  /** Простой на площадках по id точки — где набралась статистика. */
  waiting?: Record<string, SiteWaiting>;
}) {
  const { t, m, f } = useI18n();
  const [expanded, setExpanded] = useState<string | null>(null);

  if (orders.length === 0) {
    return <EmptyState title={t.desk.empty} description={t.desk.emptyHint} />;
  }

  return (
    <div className="flex flex-col gap-3">
      {orders.map((order) => {
        const stops = (order.stops ?? []) as unknown as DeskStop[];
        const currency = currencyByOrder[order.id] ?? 'EUR';
        /* Справка в валюте перевозчика: «≈ 5 400 kr» рядом с ценой в евро. */
        const approx = order.rate_cents ? f.approx(order.rate_cents, currency) : '';

        /*
         * Вес заказа — самый тяжёлый из пунктов, как и в базе
         * (app.order_max_weight_kg): именно с ним take_order сравнивает
         * грузоподъёмность машины.
         */
        const cargoKg = stops.reduce((max, stop) => Math.max(max, stop.cargo_weight_kg ?? 0), 0);
        const open = expanded === order.id;
        const waits = stops
          .map((stop) => ({ stop, w: waiting[stop.id] }))
          .filter((x): x is { stop: DeskStop; w: SiteWaiting } => Boolean(x.w));

        return (
          <Card key={order.id} id={`desk-${order.id}`} stripe="info" className="scroll-mt-24">
            <CardBody>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <h3 className="text-[15px] font-semibold tracking-tight">
                      {isTransfer(stops) ? t.transfer.title : t.orderType[order.order_type]}
                    </h3>
                    {/*
                      * Единица — сразу после типа рейса и до номера.
                      * Перевозчик листает стол и решает по ней, есть ли у
                      * него подходящее шасси: заказ, который не на чем
                      * везти, дальше читать незачем.
                      */}
                    <HaulBadge haulKind={order.haul_kind} containerFeet={order.container_feet} ldm={order.ldm} />
                    {/* Требования заказа: кузов, загрузка, пометки фуры. */}
                    <RequirementBadges requirements={order.requirements} />
                    <Mono className="text-xs text-ink-dim">{order.ref}</Mono>
                    {/* Номер прицепа — по нему водитель находит железо на площадке. */}
                    {order.trailer_plate && <Plate>{order.trailer_plate}</Plate>}
                    {/* С 6.11.2026 всё напрямую; помечается только заказ, опубликованный раньше с Aivomaa как стороной. */}
                    {order.desk_contract === 'RAHTIS' && <Badge tone="neutral">{t.direct.contractRahtis}</Badge>}
                  </div>
                  {order.desk_contract === 'CARRIER' && <ForwarderPolicyNote info={policyByOrder[order.id]} className="mt-1.5" />}
                  {order.desk_contract === 'CARRIER' && <ShipperTrustBadge trust={trustByOrder[order.id]} className="mt-1.5" />}

                  <p className="mt-2 font-mono text-sm tracking-tight text-accent">
                    {routeLabel((order.stops ?? []) as DeskStop[]) ?? `${order.pickup_city} → ${order.finish_city ?? '—'}`}
                  </p>

                  <p className="mt-1.5 text-[13px] text-ink-muted">
                    {order.trailer ? `${order.trailer} · ` : ''}
                    {/*
                      * Вес груза — рядом с километрами, а не в развороте
                      * маршрута. У экспресса это второе число после
                      * метров, по которому решают, влезет ли: кузов
                      * ограничен и тем и другим, и прятать половину
                      * ответа под кнопку «показать точки» значит заставить
                      * открывать каждый заказ подряд.
                      */}
                    {cargoKg ? `${cargoKg} kg · ` : ''}
                    {m('order.distance', { km: order.distance_km ?? 0 })} ·{' '}
                    <span className="font-semibold text-ink">{f.money(order.rate_cents ?? 0, currency)}</span>{' '}
                    {approx && <span className="text-ink-dim">({approx}) </span>}
                    {perKmByOrder[order.id] && (
                      <Badge tone="info">
                        {t.trustWins.perKmBadge.replace('{rate}', f.money(perKmByOrder[order.id], currency))}
                      </Badge>
                    )}{' '}
                    <span className="text-ink-dim">{t.money.addVat}</span>{' '}
                    {order.distance_km && order.rate_cents ? (
                      <span className="text-ink-dim">
                        · {m('order.ratePerKm', {
                          rate: f.moneyPerKm(order.rate_cents, order.distance_km, currency) ?? '',
                        })}
                      </span>
                    ) : null}
                  </p>

                  {order.shipper_name && <p className="mt-1 text-xs text-ink-dim">{order.shipper_name}</p>}

                  {order.pickup_date && (
                    <p className="mt-1 font-mono text-xs text-ink-faint">
                      {f.date(`${order.pickup_date}T12:00:00Z`)}
                      {order.pickup_time ? ` ${order.pickup_time.slice(0, 5)}` : ''}
                    </p>
                  )}

                  {/* Сколько обычно стоят на этих площадках — до отклика, а не в счёте. */}
                  {waits.length > 0 && (
                    <p className="mt-1 text-xs text-ink-muted">
                      {t.desk.typicalWait}{' '}
                      {waits.map(({ stop, w }, i) => (
                        <span key={stop.id}>
                          {i > 0 ? ' · ' : ''}
                          {stop.city}{' '}
                          <span className={w.medianMinutes > 60 ? 'font-semibold text-warn' : 'font-semibold text-ink'}>
                            {formatWaitMinutes(w.medianMinutes)}
                          </span>
                        </span>
                      ))}
                    </p>
                  )}
                </div>

                <div className="flex flex-col items-end gap-2">
                  {order.group_until ? (
                    <>
                      <Badge tone="info">{m('direct.groupBadge', { time: f.time(order.group_until) })}</Badge>
                      {matches?.[order.id] && !matches[order.id]!.choices.length ? (
                        <MatchReason match={matches[order.id]!} requirements={order.requirements} cargoKg={cargoKg} />
                      ) : (
                        <GroupTakeButton
                          orderId={order.id}
                          /* С подбором — подходящие машины группы по порядку: первая выбрана. */
                          vehicles={
                            matches?.[order.id]
                              ? matches[order.id]!.choices.flatMap((c) => vehicles.filter((v) => v.id === c.vehicleId))
                              : vehicles.filter((v) => (order.group_vehicle_ids ?? []).includes(v.id))
                          }
                          line={matches?.[order.id] && <FitLine choice={matches[order.id]!.choices[0]!} today={today} />}
                        />
                      )}
                    </>
                  ) : order.taken_by_me ? (
                    <>
                      <Badge tone="warn">{t.matching.taken}</Badge>
                      <span className="text-xs text-ink-faint">{t.matching.waitingChoice}</span>
                    </>
                  ) : order.offers_count >= MATCHING.maxOffersPerOrder ? (
                    <Badge tone="neutral">
                      {t.matching.noSlots}{' '}
                      {m('matching.slotsTaken', {
                        count: order.offers_count,
                        max: MATCHING.maxOffersPerOrder,
                      })}
                    </Badge>
                  ) : matches?.[order.id] ? (
                    <OneTapTake
                      orderId={order.id}
                      match={matches[order.id]!}
                      price={order.rate_cents ? `${f.money(order.rate_cents, currency)} ${t.money.addVat}` : null}
                      pickup={
                        order.pickup_date
                          ? `${order.pickup_city} · ${f.date(`${order.pickup_date}T12:00:00Z`)}${order.pickup_time ? ` ${order.pickup_time.slice(0, 5)}` : ''}`
                          : order.pickup_city
                      }
                      pickupDate={order.pickup_date}
                      busy={busy.filter((b) => b.ref !== order.ref)}
                      requirements={order.requirements}
                      cargoKg={cargoKg}
                      today={today}
                    />
                  ) : (
                    <TakeButton
                      orderId={order.id}
                      /*
                       * Только машины нужного класса: тягач — под прицеп и контейнер,
                       * фургон и грузовик — под экспресс. Фургон под прицеп предлагался
                       * наравне с тягачами, и отказ приходил уже после отправки.
                       */
                      vehicles={vehicles.filter((v) =>
                        vehicleClassFits(order.haul_kind, v.vehicle_class),
                      )}
                      combos={combos.filter((c) => COMBO_KINDS_FOR[order.haul_kind]?.includes(c.kind))}
                      pickupDate={order.pickup_date}
                      busy={busy.filter((b) => b.ref !== order.ref)}
                    />
                  )}

                  {order.offers_count > 0 && !order.taken_by_me && (
                    <span className="font-mono text-xs text-ink-dim">
                      {t.matching.slots}{' '}
                      {m('matching.slotsTaken', {
                        count: order.offers_count,
                        max: MATCHING.maxOffersPerOrder,
                      })}
                    </span>
                  )}

                  <Button size="sm" onClick={() => setExpanded(open ? null : order.id)}>
                    {t.desk.details}
                  </Button>
                </div>
              </div>

              {open && (
                <>
                  <CardDivider className="my-4" />
                  <p className="label-micro mb-3">
                    {m('order.stopsCount', { count: stops.length })}
                  </p>
                  <RouteStops stops={stops} haulKind={order.haul_kind} />

                  {/*
                    * Карта на столе — до того, как заказ взят: по ней видно,
                    * куда на самом деле ехать. Контактов и получателя она не
                    * раскрывает, линия маршрута их не содержит.
                    */}
                  <OrderRouteMap
                    geometry={order.route_geometry}
                    bounds={order.route_bounds}
                    stops={stops}
                    haulKind={order.haul_kind}
                    className="mt-4"
                  />

                  {order.comment && (
                    <p className="mt-4 rounded-control border border-line bg-sunken px-3 py-2 text-xs text-ink-muted">
                      {order.comment}
                    </p>
                  )}

                  <p className="mt-3 text-xs text-ink-dim">{t.desk.contactsHidden}</p>
                </>
              )}
            </CardBody>
          </Card>
        );
      })}
    </div>
  );
}

export type DeskCombo = { id: string; vehicle_id: string; kind: string; name: string };

/* Какие сцепки вообще подходят виду заказа (грубо; размеры, кузов, загрузку и вес проверяет база — take_order_combo). */
const COMBO_KINDS_FOR: Partial<Record<string, readonly string[]>> = {
  TRAILER: ['TRACTOR_SOLO'],
  CONTAINER: ['TRACTOR_SOLO'],
  VAN: ['VAN', 'TRUCK', 'TRUCK_TRAILER'],
  TRUCK: ['TRUCK', 'TRUCK_TRAILER'],
  SEMI: ['SEMI'],
  TIPPER: ['NUPPI', 'KASETTI', 'PUOLIKAS'],
};

/** Кузов, загрузка и пометки фуры у заказа — бейджами рядом с видом перевозки. */
function RequirementBadges({ requirements }: { requirements: unknown }) {
  const { t } = useI18n();
  const r = (requirements ?? {}) as { body?: string | null; loading?: string[] | null; semi?: string[] | null };
  const semi = (r.semi ?? []).filter((x) => x === 'MEGA' || x === 'LIFTING_ROOF');
  if (!r.body && !(r.loading ?? []).length && !semi.length) return null;
  return (
    <>
      {r.body && <Badge tone="info">{t.mass.bodies[r.body as keyof typeof t.mass.bodies] ?? r.body}</Badge>}
      {(r.loading ?? []).map((l) => (
        <Badge key={l} tone="neutral">
          {t.mass.loading[l as keyof typeof t.mass.loading] ?? l}
        </Badge>
      ))}
      {semi.map((x) => (
        <Badge key={x} tone="neutral">
          {t.semi.features[x as 'MEGA' | 'LIFTING_ROOF']}
        </Badge>
      ))}
    </>
  );
}

'use client';

import { useActionState, useCallback, useEffect, useMemo, useState } from 'react';
import {
  Badge,
  Button,
  Card,
  CardBody,
  Field,
  Input,
  InputMono,
  Mono,
  SectionTitle,
  Textarea,
} from '@/components/ui';
import type { ChosenAddress } from '@/components/domain/AddressInput';
import { publishOrderAction, type PublishState } from '@/lib/orders/actions';
import { computeRouteAction, type RouteState } from '@/lib/routing/actions';
import { useI18n } from '@/lib/i18n/provider';
import { StopFields } from './StopFields';

const initial: PublishState = { error: null, ref: null };

type Extra = { key: number; role: 'EXTRA_LOAD' | 'EXTRA_UNLOAD' };

/**
 * Форма публикации заказа.
 *
 * По ТЗ §5 это одна форма, а не пошаговый мастер: заказчик видит весь
 * маршрут целиком и добавляет необязательные части кнопками.
 *
 * Поля самих точек живут в StopFields — одна разметка на все шесть ролей.
 * Здесь остаётся только то, что относится к заказу целиком, и порядок,
 * в котором точки идут по маршруту.
 */
export function OrderForm({ onPublished }: { onPublished: () => void }) {
  const { t, m, locale } = useI18n();
  const [state, formAction, pending] = useActionState(publishOrderAction, initial);

  /*
   * Пока делаем только перецеп (irtoperä).
   *
   * Его форма: забрали прицеп где-то → сколько угодно загрузок и выгрузок
   * в любом порядке → отцепили. Кругорейс по форме тот же самый — забрать
   * прицеп на терминале, загрузиться, выгрузиться, отцепить, — поэтому
   * отдельного типа для него не нужно: разница выражается набором
   * действий, а не пунктом в списке. Груз в один конец придёт позже, и
   * тогда селектор типа вернётся.
   */
  const [extras, setExtras] = useState<Extra[]>([]);
  const [distance, setDistance] = useState('');
  const [rate, setRate] = useState('');

  /*
   * Координаты выбранных адресов, по слотам маршрута. Ключ слота живёт
   * столько же, сколько блок формы: у доп.точек это их собственный key,
   * поэтому удаление второй точки не сдвигает координаты третьей.
   */
  const [coords, setCoords] = useState<Record<string, ChosenAddress | null>>({});
  const [route, setRoute] = useState<Extract<RouteState, { ok: true }> | null>(null);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [routing, setRouting] = useState(false);

  /*
   * Расчёт предлагает километраж, но не владеет им. Как только заказчик
   * правит поле руками, источником становится он: ставка считается от
   * distance_km, и молча вернуть туда своё число значило бы изменить цену
   * уже принятого решения.
   */
  const [source, setSource] = useState<'MANUAL' | 'AUTO'>('MANUAL');

  const onChosen = useCallback(
    (slot: string) => (chosen: ChosenAddress | null) => {
      setCoords((prev) => ({ ...prev, [slot]: chosen }));
      /* Маршрут посчитан по прежним точкам — он устарел. */
      setRoute(null);
    },
    [],
  );

  /* Слоты маршрута в порядке рейса: забор, действия, отцепка. */
  const slots = useMemo(
    () => ['pickup', ...extras.map((e) => `extra-${e.key}`), 'ret'],
    [extras],
  );

  /*
   * Точки в порядке маршрута — том же, в каком их читают в кабине и в
   * каком они уходят в create_order.
   */
  const routePoints = useMemo(
    () =>
      slots
        .map((slot) => coords[slot]?.position)
        .filter((p): p is { lat: number; lon: number } => Boolean(p)),
    [coords, slots],
  );

  /*
   * Считать можно только когда координаты есть у ВСЕХ точек.
   *
   * Раньше здесь стояло «хотя бы у двух», и точка без координат просто
   * выпадала из расчёта. Маршрут получался короче настоящего, а бейдж
   * говорил «рассчитано для грузовика» — то есть заказ уезжал с
   * километражом, посчитанным в обход одной из выгрузок, и ставка за
   * километр считалась не от того рейса, который поедет.
   *
   * Набранный руками адрес координат не имеет, и это не повод посчитать
   * без него: маршрут по неполному набору точек не короче настоящего, а
   * просто другой. Форма в таком случае говорит, что пробег нужно указать
   * самому.
   */
  const canRoute = slots.length >= 2 && routePoints.length === slots.length;

  /*
   * Отпечаток набора точек. По нему решается, нужен ли пересчёт: массив
   * пересобирается при каждом изменении координат, а маршрут зависит
   * только от самих значений и их порядка.
   */
  const pointsKey = routePoints.map((p) => `${p.lat},${p.lon}`).join(';');

  /*
   * Пробег считается сам, как только известны две точки. Кнопки нет
   * намеренно: заказчик заполняет адреса и вводит ставку, а километраж —
   * это следствие маршрута, а не отдельное решение. Лишнее нажатие здесь
   * означало бы, что можно опубликовать заказ с непосчитанным пробегом.
   *
   * Задержка нужна на случай, когда адреса правят подряд: маршрут стоит
   * денег за вызов, и считать промежуточные состояния незачем.
   */
  useEffect(() => {
    if (!canRoute) return;

    const timer = setTimeout(async () => {
      setRouting(true);
      setRouteError(null);

      const result = await computeRouteAction(routePoints, 'FI', locale);

      setRouting(false);
      if (!result.ok) {
        setRouteError(result.error);
        setRoute(null);
        return;
      }

      setRoute(result);
      setDistance(String(result.km));
      setSource('AUTO');
    }, 500);

    return () => clearTimeout(timer);
    /* routePoints выводится из pointsKey — сравнивать нужно значения. */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pointsKey, canRoute, locale]);

  /*
   * Маршрут действителен, только пока набор точек полон.
   *
   * Стоит добавить блок с ещё не выбранным адресом, и посчитанное раньше
   * перестаёт быть про этот рейс. Стирать его из состояния не нужно —
   * достаточно перестать им пользоваться: вернётся полный набор, вернётся
   * и линия. Число в поле пробега при этом остаётся, но перестаёт
   * называться расчётом: с этой минуты за него отвечает человек.
   */
  const liveRoute = canRoute ? route : null;
  const liveSource = canRoute ? source : 'MANUAL';

  /* Ставка за километр — подсказка при вводе, в базе не хранится. */
  const km = Number.parseInt(distance.replace(/\D/g, ''), 10);
  const euros = Number.parseFloat(rate.replace(/\s/g, '').replace(',', '.'));
  const perKm =
    Number.isFinite(km) && km > 0 && Number.isFinite(euros) && euros > 0
      ? `€${(euros / km).toFixed(2)}/${t.unit.km}`
      : '';

  if (state.ref) {
    return (
      <Card stripe="ok">
        <CardBody className="flex flex-wrap items-center gap-3">
          <Badge tone="ok">{t.orderForm.published}</Badge>
          <Mono className="text-[13px]">{state.ref}</Mono>
          <Button size="sm" onClick={onPublished} className="ml-auto">
            {t.action.close}
          </Button>
        </CardBody>
      </Card>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="locale" value={locale} />

      {/*
       * Кэш маршрута уезжает вместе с заказом: пересчитывать его при
       * каждом показе карточки значило бы платить за один и тот же
       * маршрут снова и снова.
       */}
      <input type="hidden" name="distance_source" value={liveSource} />
      <input type="hidden" name="distance_auto_km" value={liveRoute?.km ?? ''} />
      <input type="hidden" name="route_geometry" value={liveRoute?.geometry ?? ''} />
      <input
        type="hidden"
        name="route_bounds"
        value={liveRoute ? JSON.stringify(liveRoute.bounds) : ''}
      />
      <input type="hidden" name="route_fingerprint" value={liveRoute?.fingerprint ?? ''} />
      <input
        type="hidden"
        name="route_legs"
        value={liveRoute ? JSON.stringify(liveRoute.legs) : ''}
      />

      <Card>
        <CardBody className="grid gap-4 sm:grid-cols-2">
          {/*
            * Тип рейса пока один. Кругорейс по форме — тот же перецеп
            * (забрать прицеп, загрузиться, выгрузиться, отцепить), и
            * разница выражается набором действий, а не пунктом списка.
            */}
          <input type="hidden" name="order_type" value="TRAILER_SWAP" />
          <div>
            <p className="label-micro">{t.orderForm.type}</p>
            <p className="mt-1.5 text-[13px] font-semibold text-ink">
              {t.orderType.TRAILER_SWAP}
            </p>
          </div>

          <Field label={t.orderForm.shipperRef} hint={t.orderForm.shipperRefHint}>
            {(p) => <InputMono {...p} name="shipper_ref" placeholder="BF-2026-0912" />}
          </Field>
        </CardBody>
      </Card>

      {/* ── Забор прицепа ── */}
      <Card stripe="info">
        <CardBody>
          <SectionTitle>
            {t.orderForm.trailerPickupSection}
          </SectionTitle>
          <StopFields
            role="PICKUP"
            prefix="pickup"
            showPlaceName
            showTrailerState
            requireDate
            addressPlaceholder="Satamakatu 1, 10900 Hanko"
            placeNamePlaceholder="Hanko Port, Terminal 2"
            onChosen={onChosen('pickup')}
          />
        </CardBody>
      </Card>

      {/* ── Действия рейса: выгрузки и загрузки, сколько нужно ── */}
      <Card stripe="live">
        <CardBody>
          <SectionTitle>{t.orderForm.actionsSection}</SectionTitle>
          <p className="-mt-1 mb-3 text-xs text-ink-faint">{t.orderForm.actionsHint}</p>

          {extras.length === 0 && (
            <p className="mb-3 rounded-control border border-warn/35 bg-warn/10 px-3 py-2 text-[13px] text-warn">
              {t.orderForm.noActions}
            </p>
          )}

          <div className="flex flex-col gap-4">
            {extras.map((extra, index) => (
              <div key={extra.key} className="rounded-control border border-line bg-sunken p-3">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <span className="label-micro">
                    {index + 1} ·{' '}
                    {extra.role === 'EXTRA_LOAD' ? t.stopKind.EXTRA_LOAD : t.stopKind.EXTRA_UNLOAD}
                  </span>
                  <Button
                    size="sm"
                    onClick={() => setExtras((list) => list.filter((e) => e.key !== extra.key))}
                  >
                    {t.orderForm.remove}
                  </Button>
                </div>

                {/*
                  * Роль каждого действия уезжает своим скрытым полем: точки
                  * приходят на сервер массивами, и порядок в них — это и есть
                  * порядок рейса.
                  */}
                <input type="hidden" name="extra_role" value={extra.role} />

                <StopFields
                  role={extra.role}
                  prefix="extra"
                  repeated
                  requireCompany
                  showContact
                  onChosen={onChosen(`extra-${extra.key}`)}
                />
              </div>
            ))}
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              size="sm"
              onClick={() =>
                setExtras((list) => [...list, { key: Date.now(), role: 'EXTRA_UNLOAD' }])
              }
            >
              {t.orderForm.addUnload}
            </Button>
            <Button
              size="sm"
              onClick={() =>
                setExtras((list) => [...list, { key: Date.now(), role: 'EXTRA_LOAD' }])
              }
            >
              {t.orderForm.addLoad}
            </Button>
          </div>
        </CardBody>
      </Card>

      {/* ── Отцепка прицепа: окончание перецепа, убрать нельзя ── */}
      <Card stripe="info">
        <CardBody>
          <SectionTitle>{t.orderForm.dropSection}</SectionTitle>

          <input type="hidden" name="has_return" value="on" />

          <StopFields
            role="TRAILER_RETURN"
            prefix="ret"
            showPlaceName
            showTrailerState
            addressPlaceholder="Satamakatu 1, 10900 Hanko"
            placeNamePlaceholder="Hanko Port, Terminal 2"
            onChosen={onChosen('ret')}
          />
        </CardBody>
      </Card>



      {/* ── Груз и оплата ── */}
      <Card>
        <CardBody>
          <SectionTitle>{t.orderForm.cargoSection}</SectionTitle>
          <div className="grid gap-4 sm:grid-cols-4">
            {/*
              * Номер прицепа стоит первым в блоке и обязателен: прицепы
              * ищут по номерам, и заказ без него означает водителя,
              * который приехал на площадку и не знает, что цеплять.
              */}
            <Field
              label={t.orderForm.trailerPlate}
              hint={t.orderForm.trailerPlateHint}
              required
              className="sm:col-span-2"
            >
              {(p) => (
                <InputMono
                  {...p}
                  name="trailer_plate"
                  required
                  placeholder="ABC-123"
                  style={{ textTransform: 'uppercase' }}
                />
              )}
            </Field>

            <Field label={t.orderForm.trailer} className="sm:col-span-2">
              {(p) => <Input {...p} name="trailer" placeholder={t.orderForm.trailerPlaceholder} />}
            </Field>
            <Field label={t.orderForm.distance} required>
              {(p) => (
                <InputMono
                  {...p}
                  name="distance_km"
                  required
                  inputMode="numeric"
                  value={distance}
                  onChange={(e) => {
                    setDistance(e.target.value);
                    setSource('MANUAL');
                  }}
                  placeholder="130"
                />
              )}
            </Field>
            {/* Состояние расчёта — рядом с полем пробега, которое он заполняет. */}
            <div className="sm:col-span-2 flex flex-wrap items-center gap-3">
              {routing ? (
                <span className="text-xs text-ink-muted">{t.routing.calculating}</span>
              ) : !canRoute ? (
                <span className="text-xs text-ink-dim">{t.routing.noCoordinates}</span>
              ) : (
                liveRoute && (
                  <span className="text-xs text-ink-muted">
                    {m('routing.result', {
                      km: liveRoute.km,
                      hours: Math.floor(liveRoute.durationS / 3600),
                      minutes: Math.round((liveRoute.durationS % 3600) / 60),
                    })}
                  </span>
                )
              )}

              <Badge tone={liveSource === 'AUTO' ? 'ok' : 'neutral'}>
                {liveSource === 'AUTO' ? t.routing.auto : t.routing.manual}
              </Badge>
            </div>

            {routeError && (
              <p className="sm:col-span-4 text-xs text-warn" role="status">
                {routeError}
              </p>
            )}

            <Field label={`${t.orderForm.rate} ${perKm}`} required>
              {(p) => (
                <InputMono
                  {...p}
                  name="rate"
                  required
                  inputMode="decimal"
                  value={rate}
                  onChange={(e) => setRate(e.target.value)}
                  placeholder="480"
                />
              )}
            </Field>
            <Field label={t.order.comment} className="sm:col-span-4">
              {(p) => <Textarea {...p} name="comment" rows={2} placeholder={t.order.commentPlaceholder} />}
            </Field>
          </div>
        </CardBody>
      </Card>

      {state.error && (
        <p
          role="alert"
          className="rounded-control border border-danger/35 bg-danger/10 px-3 py-2 text-[13px] text-danger"
        >
          {state.error}
        </p>
      )}

      <div className="flex gap-2">
        <Button type="button" onClick={onPublished} className="flex-1">
          {t.action.cancel}
        </Button>
        <Button type="submit" variant="primary" size="lg" disabled={pending} className="flex-[3]">
          {pending ? t.orderForm.publishing : t.orderForm.publish}
        </Button>
      </div>
    </form>
  );
}

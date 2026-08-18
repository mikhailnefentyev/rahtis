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
  Select,
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

  const [extras, setExtras] = useState<Extra[]>([]);
  const [hasContinuation, setHasContinuation] = useState(false);
  const [hasReturn, setHasReturn] = useState(false);
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

  /*
   * Точки в порядке маршрута — том же, в каком их читают в кабине и в
   * каком они уходят в create_order. Расчёт возможен, когда координаты
   * есть хотя бы у двух точек: адрес, набранный руками и не выбранный из
   * подсказки, координат не имеет и в маршрут не попадает.
   */
  const routePoints = useMemo(() => {
    const slots = [
      'pickup',
      ...extras.map((e) => `extra-${e.key}`),
      'delivery',
      ...(hasContinuation ? ['cont'] : []),
      ...(hasReturn ? ['ret'] : []),
    ];

    return slots
      .map((slot) => coords[slot]?.position)
      .filter((p): p is { lat: number; lon: number } => Boolean(p));
  }, [coords, extras, hasContinuation, hasReturn]);

  const canRoute = routePoints.length >= 2;

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
      <input type="hidden" name="distance_source" value={source} />
      <input type="hidden" name="distance_auto_km" value={route?.km ?? ''} />
      <input type="hidden" name="route_geometry" value={route?.geometry ?? ''} />
      <input
        type="hidden"
        name="route_bounds"
        value={route ? JSON.stringify(route.bounds) : ''}
      />
      <input type="hidden" name="route_fingerprint" value={route?.fingerprint ?? ''} />
      <input
        type="hidden"
        name="route_legs"
        value={route ? JSON.stringify(route.legs) : ''}
      />

      <Card>
        <CardBody className="grid gap-4 sm:grid-cols-2">
          <Field label={t.orderForm.type} required>
            {(p) => (
              <Select {...p} name="order_type" required defaultValue="TRAILER_SWAP">
                <option value="TRAILER_SWAP">{t.orderType.TRAILER_SWAP}</option>
                <option value="ROUND_TRIP">{t.orderType.ROUND_TRIP}</option>
                <option value="ONE_WAY">{t.orderType.ONE_WAY}</option>
              </Select>
            )}
          </Field>

          <Field label={t.orderForm.shipperRef} hint={t.orderForm.shipperRefHint}>
            {(p) => <InputMono {...p} name="shipper_ref" placeholder="BF-2026-0912" />}
          </Field>
        </CardBody>
      </Card>

      {/* ── Забор прицепа ── */}
      <Card stripe="info">
        <CardBody>
          <SectionTitle>{t.orderForm.pickupSection}</SectionTitle>
          <StopFields
            role="PICKUP"
            prefix="pickup"
            defaultPlaceKind="PORT"
            showPlaceName
            requireDate
            addressPlaceholder="Satamakatu 1, 10900 Hanko"
            placeNamePlaceholder="Hanko Port, Terminal 2"
            onChosen={onChosen('pickup')}
          />
        </CardBody>
      </Card>

      {/* ── Доп. точки ── */}
      {extras.map((extra) => (
        <Card key={extra.key} stripe="warn">
          <CardBody>
            <div className="mb-3 flex items-center justify-between">
              <SectionTitle className="mb-0 border-0 pb-0">
                {extra.role === 'EXTRA_LOAD' ? t.stopKind.EXTRA_LOAD : t.stopKind.EXTRA_UNLOAD}
              </SectionTitle>
              <Button
                size="sm"
                onClick={() => setExtras((list) => list.filter((e) => e.key !== extra.key))}
              >
                {t.orderForm.remove}
              </Button>
            </div>

            <input type="hidden" name="extra_role" value={extra.role} />

            <StopFields
              role={extra.role}
              prefix="extra"
              repeated
              requireCompany
              onChosen={onChosen(`extra-${extra.key}`)}
            />
          </CardBody>
        </Card>
      ))}

      {/* ── Выгрузка ── */}
      <Card stripe="live">
        <CardBody>
          <SectionTitle>{t.orderForm.deliverySection}</SectionTitle>
          <StopFields
            role="DELIVERY"
            prefix="delivery"
            requireCompany
            showContact
            requireDate
            addressPlaceholder="Merituulentie 424, 48310 Kotka"
            onChosen={onChosen('delivery')}
          />
        </CardBody>
      </Card>

      {/* ── Продолжение рейса ── */}
      {hasContinuation && (
        <Card stripe="info">
          <CardBody>
            <div className="mb-3 flex items-center justify-between">
              <SectionTitle className="mb-0 border-0 pb-0">{t.stopKind.CONTINUATION}</SectionTitle>
              <Button size="sm" onClick={() => setHasContinuation(false)}>
                {t.orderForm.remove}
              </Button>
            </div>

            <input type="hidden" name="has_continuation" value="on" />

            <StopFields
              role="CONTINUATION"
              prefix="cont"
              requireCompany
              onChosen={onChosen('cont')}
            />
          </CardBody>
        </Card>
      )}

      {/* ── Возврат прицепа ── */}
      {hasReturn && (
        <Card>
          <CardBody>
            <div className="mb-3 flex items-center justify-between">
              <SectionTitle className="mb-0 border-0 pb-0">{t.stopKind.TRAILER_RETURN}</SectionTitle>
              <Button size="sm" onClick={() => setHasReturn(false)}>
                {t.orderForm.remove}
              </Button>
            </div>

            <input type="hidden" name="has_return" value="on" />

            <StopFields
              role="TRAILER_RETURN"
              prefix="ret"
              defaultPlaceKind="PORT"
              showPlaceName
              showReturnLoaded
              placeNamePlaceholder="Hanko Port, Terminal 2"
              onChosen={onChosen('ret')}
            />
          </CardBody>
        </Card>
      )}

      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          onClick={() => setExtras((list) => [...list, { key: Date.now(), role: 'EXTRA_LOAD' }])}
        >
          {t.orderForm.addExtraLoad}
        </Button>
        <Button
          size="sm"
          onClick={() => setExtras((list) => [...list, { key: Date.now(), role: 'EXTRA_UNLOAD' }])}
        >
          {t.orderForm.addExtraUnload}
        </Button>
        {!hasContinuation && (
          <Button size="sm" onClick={() => setHasContinuation(true)}>
            {t.orderForm.addContinuation}
          </Button>
        )}
        {!hasReturn && (
          <Button size="sm" onClick={() => setHasReturn(true)}>
            {t.orderForm.addTrailerReturn}
          </Button>
        )}
      </div>

      {/* ── Груз и оплата ── */}
      <Card>
        <CardBody>
          <SectionTitle>{t.orderForm.cargoSection}</SectionTitle>
          <div className="grid gap-4 sm:grid-cols-4">
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
                route && (
                  <span className="text-xs text-ink-muted">
                    {m('routing.result', {
                      km: route.km,
                      hours: Math.floor(route.durationS / 3600),
                      minutes: Math.round((route.durationS % 3600) / 60),
                    })}
                  </span>
                )
              )}

              <Badge tone={source === 'AUTO' ? 'ok' : 'neutral'}>
                {source === 'AUTO' ? t.routing.auto : t.routing.manual}
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

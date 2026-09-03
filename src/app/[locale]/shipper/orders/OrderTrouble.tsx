'use client';

import { useActionState, useEffect, useState } from 'react';
import { Button, Field, Input, InputMono, Mono } from '@/components/ui';
import {
  repriceOrderAction,
  withdrawOrderAction,
  type LifecycleState,
} from '@/lib/orders/lifecycle';
import { repricedRateCents } from '@/lib/orders/pricing';
import { useI18n } from '@/lib/i18n/provider';

/**
 * Что делать заказчику, когда с заказом что-то не так.
 *
 * Две разные вещи, и они намеренно не в одной кнопке.
 *
 * Пересчёт — про расхождение: маршрут оказался длиннее, чем считали при
 * публикации, и перевозчик везёт лишние километры бесплатно. Цена идёт
 * за пробегом по той же €/км, о которой договаривались.
 *
 * Снятие — про то, что везти не надо вовсе. От отката в матчинге
 * отличается тем, что заказ не возвращается на стол: откат значит «пусть
 * возьмёт другой», снятие — «отбой». Одна кнопка на оба смысла заставила
 * бы гадать, что случится после нажатия.
 *
 * Обе спрятаны за раскрытием и обе спрашивают подтверждение делом —
 * причиной или числом, — а не вопросом «вы уверены?». Диалог, на который
 * отвечают не глядя, не защищает ни от чего.
 */

const initial: LifecycleState = { error: null, done: false };

export function OrderTrouble({
  orderId,
  distanceKm,
  rateCents,
  autoKm,
  className,
}: {
  orderId: string;
  distanceKm: number | null;
  rateCents: number | null;
  /** Что насчитал роутер после правки маршрута. Расхождение и есть повод. */
  autoKm: number | null;
  className?: string;
}) {
  const { t, m, f } = useI18n();

  const [open, setOpen] = useState<'none' | 'reprice' | 'withdraw'>('none');

  return (
    <div className={className}>
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" onClick={() => setOpen(open === 'reprice' ? 'none' : 'reprice')}>
          {t.lifecycle.repriceOpen}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="danger"
          onClick={() => setOpen(open === 'withdraw' ? 'none' : 'withdraw')}
        >
          {t.lifecycle.withdraw}
        </Button>
      </div>

      {open === 'reprice' && (
        <RepriceForm
          orderId={orderId}
          distanceKm={distanceKm}
          rateCents={rateCents}
          autoKm={autoKm}
          onDone={() => setOpen('none')}
        />
      )}

      {open === 'withdraw' && (
        <WithdrawForm orderId={orderId} onDone={() => setOpen('none')} />
      )}

      {/* Подсказка про €/км нужна до раскрытия: она и есть повод открыть. */}
      {open === 'none' && autoKm !== null && distanceKm !== null && autoKm !== distanceKm && (
        <p className="mt-2 text-xs text-warn">
          {m('lifecycle.wasNow', {
            before: m('lifecycle.kmAndMoney', {
              km: distanceKm,
              amount: f.eur(rateCents ?? 0),
            }),
            after: m('lifecycle.kmAndMoney', {
              km: autoKm,
              amount: f.eur(repricedRateCents(rateCents ?? 0, distanceKm, autoKm)),
            }),
          })}
        </p>
      )}
    </div>
  );
}

/**
 * Пробег и ставка правятся вместе.
 *
 * Ставка предлагается по прежней €/км и подтягивается при каждом
 * изменении километров — но остаётся обычным полем: последнее слово о
 * деньгах за тем, кто платит. Заказчик, договорившийся о доплате не по
 * километрам, впишет свою сумму, и подсказка ему не помешает.
 */
function RepriceForm({
  orderId,
  distanceKm,
  rateCents,
  autoKm,
  onDone,
}: {
  orderId: string;
  distanceKm: number | null;
  rateCents: number | null;
  autoKm: number | null;
  onDone: () => void;
}) {
  const { t, m, f, locale } = useI18n();
  const [state, formAction, pending] = useActionState(repriceOrderAction, initial);

  /* Открывается на том, что предлагает расчёт, а не на прежнем числе:
     если бы прежнее устраивало, форму бы не открывали. */
  const suggested = autoKm ?? distanceKm ?? 0;
  const [km, setKm] = useState(String(suggested));
  const [rate, setRate] = useState(
    String((repricedRateCents(rateCents ?? 0, distanceKm ?? 0, suggested) / 100).toFixed(2)),
  );

  const onKm = (next: string) => {
    setKm(next);
    const parsed = Number.parseInt(next.replace(/\D/g, ''), 10);
    if (!Number.isFinite(parsed) || !distanceKm || !rateCents) return;
    setRate(String((repricedRateCents(rateCents, distanceKm, parsed) / 100).toFixed(2)));
  };

  /*
   * Закрывается эффектом, а не прямо в теле: вызов onDone при рендере
   * менял бы состояние родителя посреди его же отрисовки, и React
   * справедливо ругается. Здесь это ещё и заметно — форма закрылась бы
   * до того, как список успел перечитать заказ.
   */
  useEffect(() => {
    if (state.done) onDone();
  }, [state.done, onDone]);

  return (
    <form action={formAction} className="mt-3 border-t border-line pt-3">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="order_id" value={orderId} />

      <p className="mb-3 text-xs text-ink-muted">{t.lifecycle.repriceHint}</p>

      {distanceKm !== null && rateCents !== null && (
        <Mono className="mb-3 block text-[11px] text-ink-dim">
          {m('lifecycle.kmAndMoney', { km: distanceKm, amount: f.eur(rateCents) })}
        </Mono>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t.orderForm.distance} required>
          {(p) => (
            <InputMono
              {...p}
              name="distance_km"
              inputMode="numeric"
              required
              value={km}
              onChange={(e) => onKm(e.target.value)}
            />
          )}
        </Field>

        <Field label={t.orderForm.rate} hint={t.money.addVat} required>
          {(p) => (
            <Input
              {...p}
              name="rate"
              inputMode="decimal"
              required
              value={rate}
              onChange={(e) => setRate(e.target.value)}
            />
          )}
        </Field>
      </div>

      {state.error && (
        <p role="alert" className="mt-3 text-xs text-danger">
          {state.error}
        </p>
      )}

      <div className="mt-3 flex gap-2">
        <Button type="button" size="sm" onClick={onDone}>
          {t.action.cancel}
        </Button>
        <Button type="submit" size="sm" variant="primary" disabled={pending}>
          {pending ? t.lifecycle.repricing : t.lifecycle.reprice}
        </Button>
      </div>
    </form>
  );
}

/**
 * Снятие заказа.
 *
 * Причина не обязательна для базы, но спрашивается всегда: она уходит в
 * журнал, и перевозчик, у которого рейс исчез из кабинета, прочитает
 * именно её. Пустое поле честнее выдуманной причины, поэтому required
 * здесь нет.
 */
function WithdrawForm({ orderId, onDone }: { orderId: string; onDone: () => void }) {
  const { t, locale } = useI18n();
  const [state, formAction, pending] = useActionState(withdrawOrderAction, initial);

  return (
    <form action={formAction} className="mt-3 border-t border-line pt-3">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="order_id" value={orderId} />

      <p className="mb-3 text-xs text-ink-muted">{t.lifecycle.withdrawHint}</p>

      <Field label={t.lifecycle.reason}>
        {(p) => <Input {...p} name="reason" placeholder={t.lifecycle.reasonPlaceholder} />}
      </Field>

      {state.error && (
        <p role="alert" className="mt-3 text-xs text-danger">
          {state.error}
        </p>
      )}

      <div className="mt-3 flex gap-2">
        <Button type="button" size="sm" onClick={onDone}>
          {t.action.cancel}
        </Button>
        <Button type="submit" size="sm" variant="danger" disabled={pending}>
          {pending ? t.lifecycle.withdrawing : t.lifecycle.withdraw}
        </Button>
      </div>
    </form>
  );
}

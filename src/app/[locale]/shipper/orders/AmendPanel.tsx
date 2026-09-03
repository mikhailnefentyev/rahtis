'use client';

import { useActionState, useEffect, useState } from 'react';
import { Button, SectionTitle } from '@/components/ui';
import {
  addStopAction,
  amendStopAction,
  removeStopAction,
  type AmendState,
} from '@/lib/orders/amend';
import { stopFieldFlags } from '@/lib/orders/stopFields';
import { stopTitle, type HaulKind } from '@/lib/orders/haul';
import { useI18n } from '@/lib/i18n/provider';
import type { OrderStop, StopRole } from '@/types/db';
import { StopFields, type StopDefaults } from './StopFields';

/**
 * Живая корректировка маршрута в кабинете заказчика (ТЗ §8).
 *
 * Показывает только непройденные точки. Пройденная — это уже история
 * рейса: там стояла машина, там ставилась отметка, там могло записаться
 * повреждение. Её нет в списке не потому, что кнопка отключена, а потому
 * что менять там нечего — и это видно до нажатия, а не после отказа.
 *
 * Новая точка вставляется «перед этой», а не «на позицию N». Номер —
 * внутренняя мелочь, он меняется от каждой вставки; сосед не меняется.
 */

const initial: AmendState = { error: null, saved: false };

/** Точка в поля формы. Ключи — суффиксы имён, как их читает FormData. */
function defaultsOf(stop: OrderStop): StopDefaults {
  return {
    place_name: stop.place_name ?? '',
    company: stop.company_name ?? '',
    address: stop.address,
    date: stop.scheduled_date ?? '',
    /* Поле времени принимает ЧЧ:ММ, а база хранит с секундами. */
    time: stop.scheduled_time ? stop.scheduled_time.slice(0, 5) : '',
    contact: stop.contact_name ?? '',
    phone: stop.contact_phone ?? '',
    /* Килограммы базы обратно в тонны формы, с запятой — как их вводят. */
    weight: stop.cargo_weight_kg ? String(stop.cargo_weight_kg / 1000).replace('.', ',') : '',
    seal: stop.seal_required === null ? '' : String(stop.seal_required),
    consignee: stop.consignee ?? '',
    ref: stop.external_ref ?? '',
    note: stop.note ?? '',
    trailer_loaded: stop.trailer_loaded === null ? 'false' : String(stop.trailer_loaded),
  };
}

type Editing =
  | { kind: 'edit'; stop: OrderStop }
  /** Новая точка встанет перед stop. */
  | { kind: 'add'; stop: OrderStop; role: StopRole };

export function AmendPanel({
  orderId,
  stops,
  haulKind = 'TRAILER',
  className,
}: {
  orderId: string;
  stops: OrderStop[];
  /* Забор и возврат называются по единице: у контейнера прицепа нет. */
  haulKind?: HaulKind;
  className?: string;
}) {
  const { t } = useI18n();
  const [editing, setEditing] = useState<Editing | null>(null);

  const pending = stops.filter((s) => s.completed_at === null).sort((a, b) => a.sequence - b.sequence);

  if (pending.length === 0) return null;

  return (
    <div className={className}>
      <div className="mb-2.5 flex flex-wrap items-baseline justify-between gap-2">
        <p className="label-micro">{t.amend.title}</p>
        <p className="text-xs text-ink-dim">{t.amend.rateUnchanged}</p>
      </div>

      <div className="flex flex-col gap-2">
        {pending.map((stop) => {
          const open = editing?.stop.id === stop.id ? editing : null;
          /* Концы рейса не убираются: без них перецепа не бывает. */
          const removable = stop.role === 'EXTRA_LOAD' || stop.role === 'EXTRA_UNLOAD';

          return (
            <div key={stop.id} className="rounded-control border border-line bg-sunken p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[13px] text-ink">
                  {stop.sequence + 1} · {stopTitle(t, stop.role, haulKind)} —{' '}
                  {stop.place_name ?? stop.company_name ?? stop.city}
                </span>

                <div className="flex flex-wrap gap-1.5">
                  <Button
                    size="sm"
                    onClick={() =>
                      setEditing(open?.kind === 'edit' ? null : { kind: 'edit', stop })
                    }
                  >
                    {t.amend.edit}
                  </Button>
                  <Button
                    size="sm"
                    onClick={() =>
                      setEditing(
                        open?.kind === 'add' && open.role === 'EXTRA_LOAD'
                          ? null
                          : { kind: 'add', stop, role: 'EXTRA_LOAD' },
                      )
                    }
                  >
                    {t.amend.insertLoad}
                  </Button>
                  <Button
                    size="sm"
                    onClick={() =>
                      setEditing(
                        open?.kind === 'add' && open.role === 'EXTRA_UNLOAD'
                          ? null
                          : { kind: 'add', stop, role: 'EXTRA_UNLOAD' },
                      )
                    }
                  >
                    {t.amend.insertUnload}
                  </Button>
                  {removable && <RemoveStop orderId={orderId} stopId={stop.id} />}
                </div>
              </div>

              {open && (
                <StopEditor
                  /* Смена точки или роли начинает форму заново. */
                  key={`${open.kind}-${open.stop.id}-${open.kind === 'add' ? open.role : ''}`}
                  orderId={orderId}
                  editing={open}
                  haulKind={haulKind}
                  onDone={() => setEditing(null)}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Форма одной правки.
 *
 * Та же разметка полей, что при публикации: правка — это те же поля той
 * же точки, и вторая форма для них разошлась бы с первой на первой же
 * добавленной графе.
 */
function StopEditor({
  orderId,
  editing,
  haulKind,
  onDone,
}: {
  orderId: string;
  editing: Editing;
  haulKind: HaulKind;
  onDone: () => void;
}) {
  const { t, locale } = useI18n();

  const adding = editing.kind === 'add';
  const role = adding ? editing.role : editing.stop.role;
  const flags = stopFieldFlags(role);

  const [state, formAction, pending] = useActionState(
    adding ? addStopAction : amendStopAction,
    initial,
  );

  /* Правка записана — форма закрывается, список перерисовывается сервером. */
  useEffect(() => {
    if (state.saved) onDone();
  }, [state.saved, onDone]);

  return (
    <form action={formAction} className="mt-3 border-t border-line pt-3">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="order_id" value={orderId} />
      <input type="hidden" name="role" value={role} />

      {adding ? (
        <input type="hidden" name="before_stop_id" value={editing.stop.id} />
      ) : (
        <>
          <input type="hidden" name="stop_id" value={editing.stop.id} />
          {/*
            * Адрес, с которым форма открылась. По нему сервер понимает,
            * трогали адрес или нет: пустые координаты нетронутого поля
            * иначе стёрли бы точку с карты ни за что.
            */}
          <input type="hidden" name="address_before" value={editing.stop.address} />
        </>
      )}

      <SectionTitle>{adding ? stopTitle(t, role, haulKind) : t.amend.edit}</SectionTitle>

      <StopFields
        role={role}
        prefix="stop"
        requireCompany={flags.company}
        showContact={flags.contact}
        showPlaceName={flags.placeName}
        showTrailerState={flags.trailerState}
        haulKind={haulKind}
        defaults={adding ? undefined : defaultsOf(editing.stop)}
      />

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
          {adding
            ? pending
              ? t.amend.adding
              : t.amend.add
            : pending
              ? t.amend.saving
              : t.amend.save}
        </Button>
      </div>
    </form>
  );
}

/** Убрать точку — отдельной формой, чтобы не вкладывать её в форму правки. */
function RemoveStop({ orderId, stopId }: { orderId: string; stopId: string }) {
  const { t, locale } = useI18n();
  const [state, formAction, pending] = useActionState(removeStopAction, initial);

  return (
    <form action={formAction} className="contents">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="order_id" value={orderId} />
      <input type="hidden" name="stop_id" value={stopId} />
      <Button type="submit" size="sm" variant="danger" disabled={pending}>
        {pending ? t.amend.removing : t.amend.remove}
      </Button>
      {state.error && (
        <p role="alert" className="w-full text-xs text-danger">
          {state.error}
        </p>
      )}
    </form>
  );
}

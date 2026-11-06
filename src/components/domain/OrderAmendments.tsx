'use client';

import { Badge, Button, Mono } from '@/components/ui';
import { acknowledgeAmendmentsAction, respondProposalAction } from '@/lib/orders/amend';
import { stopTitle, type HaulKind } from '@/lib/orders/haul';
import { useI18n } from '@/lib/i18n/provider';
import type { AmendmentChange, OrderAmendment, StopRole } from '@/types/db';

/**
 * Журнал живой корректировки маршрута (ТЗ §8).
 *
 * Один компонент на обе стороны: заказчик видит, что он поменял,
 * перевозчик — что поменялось у него под колёсами. Разница только в
 * кнопке подтверждения, и это правильно: спор о том, была ли правка
 * доведена, разбирается по одной и той же записи, а не по двум разным
 * экранам.
 *
 * База отдаёт факты — {поле: {было, стало}}, — а фразу собирает словарь.
 * Готовый текст, сложенный на сервере, был бы написан по-русски навсегда.
 */

/**
 * Поля, у которых есть подпись. Остальные журнал не показывает.
 *
 * Первая часть — поля точки, вторая — самого заказа: снятие, отказ
 * перевозчика и пересчёт пишутся в тот же журнал, потому что читаются
 * они вперемешку. «Выгрузку перенесли на 14:00, потом маршрут стал
 * длиннее, потом перевозчик отказался» — это одна история рейса, и
 * разносить её по трём лентам значит заставить читателя сшивать её
 * самому по времени.
 */
function useFieldLabels(): Record<string, string> {
  const { t } = useI18n();

  return {
    place_name: t.orderForm.placeName,
    company_name: t.orderForm.company,
    address: t.orderForm.address,
    scheduled_date: t.orderForm.date,
    scheduled_time: t.orderForm.time,
    contact_name: t.orderForm.contact,
    contact_phone: t.orderForm.phone,
    external_ref: t.orderForm.loadingRef,
    note: t.orderForm.stopNote,
    cargo_weight_kg: t.orderForm.cargoWeight,
    consignee: t.orderForm.consignee,
    seal_required: t.orderForm.seal,
    trailer_loaded: t.orderForm.trailerState,

    status: t.lifecycle.fieldStatus,
    by: t.lifecycle.fieldBy,
    reason: t.lifecycle.fieldReason,
    distance_km: t.order.distance,
    rate_cents: t.orderForm.rate,
    vehicle: t.trustWins.fieldVehicle,
    driver: t.vehicle.driver,
  };
}

export function OrderAmendments({
  amendments,
  orderId,
  haulKind = 'TRAILER',
  canAcknowledge = false,
  side,
  currency = 'EUR',
  className,
}: {
  amendments: OrderAmendment[];
  orderId: string;
  /** Валюта цены заказа: пересчёт её не меняет. */
  currency?: string;
  /* Забор и возврат называются по единице: у контейнера прицепа нет. */
  haulKind?: HaulKind;

  /** Кнопка «принял к сведению» у стороны рейса (side), пока рейс идёт. */
  canAcknowledge?: boolean;
  /**
   * Чья это карточка. С 6.11.2026 правят обе стороны: каждая отмечает
   * правки другой и отвечает на её предложение цены.
   */
  side?: 'SHIPPER' | 'CARRIER';
  className?: string;
}) {
  const { t, m, f, locale } = useI18n();
  const labels = useFieldLabels();

  if (amendments.length === 0) return null;

  /* Своих правок сторона не «принимает к сведению» — только чужие. */
  const theirs = (a: OrderAmendment) => (side === 'CARRIER' ? a.actor_side !== 'CARRIER' : a.actor_side === 'CARRIER');
  const pending = amendments.filter((a) => a.acknowledged_at === null && (!side || theirs(a)));
  const tw = t.trustWins;
  const actorLabel = (side: string, name: string | null): string => {
    const label =
      side === 'SHIPPER' ? tw.actorSHIPPER : side === 'CARRIER' ? tw.actorCARRIER : side === 'OPERATOR' ? tw.actorOPERATOR : tw.actorSYSTEM;
    return name && side !== 'OPERATOR' ? `${label} (${name})` : label;
  };

  /**
   * Значение поля так, как его читают люди.
   *
   * Даты, время и вес не пишутся строкой из базы: разделитель дробной
   * части и порядок частей даты у русского и финского разные, и
   * форматирование принадлежит локали, а не журналу.
   */
  const show = (field: string, value: unknown): string | null => {
    if (value === null || value === undefined || value === '') return null;

    if (field === 'seal_required') {
      return value ? t.orderForm.sealYes : t.orderForm.sealNo;
    }
    if (field === 'trailer_loaded') {
      return value ? t.orderForm.trailerLoaded : t.orderForm.trailerEmpty;
    }
    if (field === 'cargo_weight_kg' && typeof value === 'number') {
      return m('stop.weight', { tonnes: value / 1000 });
    }
    /* Дата и время местные настенные — момента времени здесь нет. */
    if (field === 'scheduled_date') return f.date(`${String(value)}T12:00:00Z`);
    if (field === 'scheduled_time') return String(value).slice(0, 5);

    /*
     * Поля событий заказа. Статус и сторона приезжают из базы кодами —
     * OPEN, CANCELLED, SHIPPER, — и переводятся теми же словарями, что
     * бейджи в списках. Показать код значило бы завести второе название
     * у того же состояния.
     */
    if (field === 'status') {
      const code = String(value) as keyof typeof t.orderStatus;
      return t.orderStatus[code] ?? String(value);
    }
    if (field === 'by') {
      const code = String(value) as keyof typeof t.role;
      return t.role[code] ?? String(value);
    }
    if (field === 'rate_cents' && typeof value === 'number') return f.money(value, currency);
    if (field === 'distance_km' && typeof value === 'number') {
      return m('order.distance', { km: value });
    }

    return String(value);
  };

  return (
    <div className={className}>
      <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          {/*
           * «Изменения от заказчика» — подпись для того, кому правка
           * адресована, и только пока она не доведена. Заказчику в его
           * собственном кабинете она сообщала бы, что кто-то другой
           * поменял ему маршрут.
           */}
          <p className="label-micro">
            {canAcknowledge && pending.length > 0
              ? side === 'SHIPPER'
                ? tw.changelogFromCarrier
                : t.order.changelogFromShipper
              : t.order.changelog}
          </p>
          {pending.length > 0 && (
            <Badge tone="warn">{m('amend.pendingCount', { count: pending.length })}</Badge>
          )}
        </div>

        {/*
         * Подтверждается весь рейс разом: пометка отвечает на вопрос «я в
         * курсе, что поменялось», а не «я прочитал строку номер три».
         */}
        {canAcknowledge && pending.length > 0 && (
          <form action={acknowledgeAmendmentsAction}>
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="order_id" value={orderId} />
            <Button type="submit" size="sm" variant="primary">
              {t.amend.acknowledge}
            </Button>
          </form>
        )}
      </div>

      <ul className="flex flex-col gap-2">
        {amendments.map((amendment) => {
          const fresh = amendment.acknowledged_at === null && (!side || theirs(amendment));
          const kindLabel =
            amendment.kind === 'ASSIGNMENT_CHANGED'
              ? tw.kindASSIGNMENT_CHANGED
              : amendment.kind === 'PRICE_PROPOSED'
                ? tw.kindPRICE_PROPOSED
                : t.amendKind[amendment.kind];
          /* Предложение цены ждёт ответа другой стороны. */
          const proposal = amendment.kind === 'PRICE_PROPOSED' ? amendment.proposal_status : null;
          const canRespond = proposal === 'PROPOSED' && side !== undefined && amendment.actor_side !== side && amendment.actor_side !== 'OPERATOR';
          const changes = (amendment.changes ?? {}) as Record<string, AmendmentChange>;

          return (
            <li
              key={amendment.id}
              className={
                fresh
                  ? 'rounded-control border border-warn/35 bg-warn/10 px-3 py-2'
                  : 'rounded-control border border-line bg-sunken px-3 py-2'
              }
            >
              {/*
                * У события заказа точки нет, и подписи о ней тоже.
                * Раньше роль и название были обязательны, потому что
                * других записей в журнале не бывало; теперь бейджа
                * «Заказ снят» достаточно, а приписка «точка: ничего»
                * была бы шумом.
                */}
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={fresh ? 'warn' : 'neutral'}>{kindLabel}</Badge>
                {proposal && (
                  <Badge tone={proposal === 'ACCEPTED' ? 'ok' : proposal === 'DECLINED' ? 'neutral' : 'warn'}>
                    {proposal === 'ACCEPTED' ? tw.proposalAccepted : proposal === 'DECLINED' ? tw.proposalDeclined : tw.proposalOpen}
                  </Badge>
                )}
                {amendment.stop_role !== null && (
                  <span className="text-[13px] text-ink">
                    {m('amend.stopAt', {
                      kind: stopTitle(t, amendment.stop_role as StopRole, haulKind),
                      place: amendment.stop_label ?? '',
                    })}
                  </span>
                )}
              </div>

              <ul className="mt-1.5 flex flex-col gap-0.5">
                {Object.entries(changes).map(([field, change]) => {
                  const label = field === 'rate_cents' ? f.label(labels[field] ?? '', currency) : labels[field];
                  if (!label) return null;

                  const from = show(field, change.from);
                  const to = show(field, change.to);
                  if (from === null && to === null) return null;

                  return (
                    <li key={field} className="text-xs text-ink-muted">
                      {from !== null && to !== null
                        ? m('amend.fieldChange', { label, from, to })
                        : m('amend.fieldValue', { label, value: (to ?? from) as string })}
                    </li>
                  );
                })}
              </ul>

              {amendment.reason && <p className="mt-1 text-xs text-ink">{tw.reasonLine.replace('{reason}', amendment.reason)}</p>}

              {canRespond && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {(['1', '0'] as const).map((accept) => (
                    <form key={accept} action={respondProposalAction}>
                      <input type="hidden" name="locale" value={locale} />
                      <input type="hidden" name="amendment_id" value={amendment.id} />
                      <input type="hidden" name="accept" value={accept} />
                      <Button type="submit" size="sm" variant={accept === '1' ? 'primary' : undefined}>
                        {accept === '1' ? tw.proposalAccept : tw.proposalDecline}
                      </Button>
                    </form>
                  ))}
                </div>
              )}

              <Mono className="mt-1 block text-[11px] text-ink-dim">
                {m('amend.madeAt', { date: f.dateTime(amendment.created_at) })}
                {/* Кто правил: сторона и имя (снимок на момент правки). */}
                {amendment.actor_side && ` · ${tw.amendBy.replace('{who}', actorLabel(amendment.actor_side, amendment.actor_name))}`}
                {!fresh && ` · ${t.amend.acknowledged}`}
                {/* Водитель отмечает правку точки в приложении («Nähty»). */}
                {amendment.driver_seen_at && ` · ${tw.driverSeen.replace('{date}', f.dateTime(amendment.driver_seen_at))}`}
              </Mono>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

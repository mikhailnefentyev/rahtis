'use client';

import { useState } from 'react';
import { AddressInput, type ChosenAddress } from '@/components/domain/AddressInput';
import { Field, Input, InputMono, Select, Textarea } from '@/components/ui';
import { REGIONS } from '@/lib/config';
import { CITY_CENTRES } from '@/lib/routing/cities';
import {
  hasBookingRef,
  hasCargo,
  hasConsignee,
  hasExternalRef,
  needsPlaceKind,
} from '@/lib/orders/stopFields';
import { useI18n } from '@/lib/i18n/provider';
import type { PlaceKind, StopRole } from '@/types/db';

const PLACE_KINDS: PlaceKind[] = ['PORT', 'TERMINAL', 'PARKING', 'ADDRESS'];

/**
 * Поля одной точки маршрута.
 *
 * Одна разметка на все шесть ролей вместо шести похожих блоков. Что
 * показывать, решает матрица из lib/orders/stopFields.ts — та же, по
 * которой построены ограничения в базе.
 *
 * Про repeated: доп.точек может быть сколько угодно, и их поля приходят
 * в FormData массивами с одинаковыми именами — точки различаются позицией
 * в массиве. Поэтому у повторяемой точки каждое поле обязано попасть в
 * форму, даже когда роль его не допускает: пропущенный input сдвинул бы
 * все последующие точки на одну. Неприменимые поля уходят пустыми
 * скрытыми input, а не исчезают.
 */
export function StopFields({
  role,
  prefix,
  repeated = false,
  cityFromRegions = false,
  defaultPlaceKind = 'ADDRESS',
  defaultCity,
  requireCompany = false,
  showContact = false,
  showPlaceName = false,
  showReturnLoaded = false,
  requireDate = false,
  addressPlaceholder,
  placeNamePlaceholder,
  onChosen,
}: {
  role: StopRole;
  /** Имена полей: `${prefix}_address` и так далее. */
  prefix: string;
  repeated?: boolean;
  cityFromRegions?: boolean;
  defaultPlaceKind?: PlaceKind;
  defaultCity?: string;
  requireCompany?: boolean;
  showContact?: boolean;
  showPlaceName?: boolean;
  showReturnLoaded?: boolean;
  requireDate?: boolean;
  addressPlaceholder?: string;
  placeNamePlaceholder?: string;
  /** Координаты выбранного адреса — форме, чтобы посчитать маршрут. */
  onChosen?: (chosen: ChosenAddress | null) => void;
}) {
  const { t } = useI18n();

  /*
   * Тип места держится в состоянии: от него зависит, спрашивать ли бронь.
   * Это единственное поле точки, влияющее на состав остальных.
   */
  const [placeKind, setPlaceKind] = useState<PlaceKind>(defaultPlaceKind);

  /*
   * Город смещает выдачу подсказки. Без смещения «Satamak» отдаёт Вааса
   * раньше Ханко — проверено замером.
   */
  const [city, setCity] = useState(defaultCity ?? (cityFromRegions ? REGIONS[0] : ''));

  const name = (field: string) => `${prefix}_${field}`;

  /** Пустое скрытое поле вместо неприменимого — чтобы не сбить позиции. */
  const filler = (field: string) =>
    repeated ? <input key={field} type="hidden" name={name(field)} value="" /> : null;

  const cargo = hasCargo(role);
  const consignee = hasConsignee(role);
  const externalRef = hasExternalRef(role);
  const booking = hasBookingRef(placeKind);

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label={t.orderForm.placeKind} required={needsPlaceKind(role)}>
        {(p) => (
          <Select
            {...p}
            name={name('place_kind')}
            required={needsPlaceKind(role)}
            value={placeKind}
            onChange={(e) => setPlaceKind(e.target.value as PlaceKind)}
          >
            {PLACE_KINDS.map((kind) => (
              <option key={kind} value={kind}>
                {t.placeKind[kind]}
              </option>
            ))}
          </Select>
        )}
      </Field>

      {showPlaceName ? (
        <Field label={t.orderForm.placeName}>
          {(p) => <Input {...p} name={name('place_name')} placeholder={placeNamePlaceholder} />}
        </Field>
      ) : (
        filler('place_name')
      )}

      {requireCompany ? (
        <Field label={t.orderForm.company} required>
          {(p) => <Input {...p} name={name('company')} required />}
        </Field>
      ) : (
        filler('company')
      )}

      <Field
        label={t.orderForm.address}
        hint={t.orderForm.addressHint}
        required
        className="sm:col-span-2"
      >
        {(p) => (
          <AddressInput
            {...p}
            name={name('address')}
            required
            placeholder={addressPlaceholder}
            near={CITY_CENTRES[city]}
            onChosen={onChosen}
          />
        )}
      </Field>

      <Field label={t.orderForm.city} required>
        {(p) =>
          cityFromRegions ? (
            <Select
              {...p}
              name={name('city')}
              required
              value={city}
              onChange={(e) => setCity(e.target.value)}
            >
              {REGIONS.map((region) => (
                <option key={region} value={region}>
                  {region}
                </option>
              ))}
            </Select>
          ) : (
            <Input
              {...p}
              name={name('city')}
              required
              value={city}
              onChange={(e) => setCity(e.target.value)}
            />
          )
        }
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label={t.orderForm.date} required={requireDate}>
          {(p) => <Input {...p} type="date" name={name('date')} required={requireDate} />}
        </Field>
        <Field label={t.orderForm.time}>
          {(p) => <Input {...p} type="time" name={name('time')} />}
        </Field>
      </div>

      {showContact && (
        <>
          <Field label={t.orderForm.contact}>
            {(p) => <Input {...p} name={name('contact')} placeholder="Mika Virtanen" />}
          </Field>
          <Field label={t.orderForm.phone}>
            {(p) => <InputMono {...p} name={name('phone')} placeholder="+358407001122" />}
          </Field>
        </>
      )}

      {/*
       * Бронь. Моноширинным и отдельной строкой: её диктуют по телефону
       * на воротах порта, и I/1 или O/0 должны различаться на глаз.
       */}
      {booking ? (
        <Field
          label={t.orderForm.bookingRef}
          hint={t.orderForm.bookingRefHint}
          className="sm:col-span-2"
        >
          {(p) => <InputMono {...p} name={name('booking_ref')} placeholder="BK-4471902" />}
        </Field>
      ) : (
        filler('booking_ref')
      )}

      {cargo ? (
        <>
          <Field label={t.orderForm.cargoWeight} hint={t.orderForm.cargoWeightHint}>
            {(p) => (
              <InputMono {...p} name={name('weight')} inputMode="decimal" placeholder="24,5" />
            )}
          </Field>

          {/*
           * Пломба — список из трёх значений, а не флажок. Флажок не
           * отправляется, когда снят, и у повторяемых точек это сбило бы
           * позиции в массиве. Заодно различаются «пломба не нужна» и
           * «про пломбу пока не сказали».
           */}
          <Field label={t.orderForm.seal}>
            {(p) => (
              <Select {...p} name={name('seal')} defaultValue="">
                <option value="">{t.orderForm.sealUnknown}</option>
                <option value="true">{t.orderForm.sealYes}</option>
                <option value="false">{t.orderForm.sealNo}</option>
              </Select>
            )}
          </Field>
        </>
      ) : (
        [filler('weight'), filler('seal')]
      )}

      {consignee ? (
        <Field label={t.orderForm.consignee} hint={t.orderForm.consigneeHint}>
          {(p) => <Input {...p} name={name('consignee')} />}
        </Field>
      ) : (
        filler('consignee')
      )}

      {externalRef ? (
        <Field label={t.orderForm.loadingRef} hint={t.orderForm.loadingRefHint}>
          {(p) => <InputMono {...p} name={name('ref')} placeholder="NC-2026-0414" />}
        </Field>
      ) : (
        filler('ref')
      )}

      {showReturnLoaded && (
        <label className="flex cursor-pointer items-center gap-2.5 sm:col-span-2">
          <input type="checkbox" name={name('loaded')} className="size-4 accent-accent" />
          <span className="text-[13px] text-ink">{t.orderForm.returnLoaded}</span>
        </label>
      )}

      {/*
       * Инструкции по точке — отдельно от комментария к заказу. Общий
       * комментарий водитель читает один раз перед рейсом, а «звонить за
       * час», «въезд с задней стороны» нужны в конкретном месте.
       */}
      <Field label={t.orderForm.stopNote} className="sm:col-span-2">
        {(p) => (
          <Textarea {...p} name={name('note')} rows={2} placeholder={t.orderForm.stopNotePlaceholder} />
        )}
      </Field>
    </div>
  );
}

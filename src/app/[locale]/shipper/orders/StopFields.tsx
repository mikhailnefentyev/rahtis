'use client';

import { AddressInput, type ChosenAddress } from '@/components/domain/AddressInput';
import { Field, Input, InputMono, Select, Textarea } from '@/components/ui';
import { hasCargo, hasConsignee, hasExternalRef } from '@/lib/orders/stopFields';
import { useI18n } from '@/lib/i18n/provider';
import type { StopRole } from '@/types/db';

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
  requireCompany = false,
  showContact = false,
  showPlaceName = false,
  showTrailerState = false,
  requireDate = false,
  addressPlaceholder,
  placeNamePlaceholder,
  onChosen,
}: {
  role: StopRole;
  /** Имена полей: `${prefix}_address` и так далее. */
  prefix: string;
  repeated?: boolean;
  requireCompany?: boolean;
  showContact?: boolean;
  showPlaceName?: boolean;
  /** Прицеп с грузом или пустой — спрашивается на заборе и на отцепке. */
  showTrailerState?: boolean;
  requireDate?: boolean;
  addressPlaceholder?: string;
  placeNamePlaceholder?: string;
  /** Координаты выбранного адреса — форме, чтобы посчитать маршрут. */
  onChosen?: (chosen: ChosenAddress | null) => void;
}) {
  const { t } = useI18n();


  const name = (field: string) => `${prefix}_${field}`;

  /** Пустое скрытое поле вместо неприменимого — чтобы не сбить позиции. */
  const filler = (field: string) =>
    repeated ? <input key={field} type="hidden" name={name(field)} value="" /> : null;

  const cargo = hasCargo(role);
  const consignee = hasConsignee(role);
  const externalRef = hasExternalRef(role);

  return (
    <div className="grid gap-4 sm:grid-cols-2">
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
            onChosen={onChosen}
          />
        )}
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
      {/*
        * Бронь спрашивается везде, а не только у портов и терминалов.
        * Где её требуют на воротах, знает заказчик, а не форма: список
        * «порт или терминал» всё равно не покрывал бы склады с пропускной
        * системой и частные площадки.
        */}
      <Field
        label={t.orderForm.bookingRef}
        hint={t.orderForm.bookingRefHint}
        className="sm:col-span-2"
      >
        {(p) => <InputMono {...p} name={name('booking_ref')} placeholder="BK-4471902" />}
      </Field>

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

      {showTrailerState && (
        <Field label={t.orderForm.trailerState} required>
          {(p) => (
            <Select {...p} name={name('trailer_loaded')} required defaultValue="false">
              <option value="false">{t.orderForm.trailerEmpty}</option>
              <option value="true">{t.orderForm.trailerLoaded}</option>
            </Select>
          )}
        </Field>
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

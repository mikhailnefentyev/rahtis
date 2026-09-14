'use client';

import { useActionState, useEffect, useState } from 'react';
import { Button, Card, CardBody, Field, Input, InputMono, Select } from '@/components/ui';
import { saveVehicleAction, type VehicleState } from '@/lib/fleet/actions';
import { useI18n } from '@/lib/i18n/provider';
import { DRIVER_LANGUAGES, type Vehicle, type VehicleClass } from '@/types/db';

const initial: VehicleState = { error: null, done: false };

/**
 * Карточка авто: создание и правка.
 *
 * Правка существенных полей у допущенной машины возвращает её на проверку —
 * это делает триггер в базе, а форма предупреждает об этом заранее, чтобы
 * пропавший допуск не выглядел поломкой.
 */
/**
 * Подписи для выбора осей.
 *
 * Числа те же, что в app.axle_capacity_kg: двухосный берёт 25 тонн,
 * трёхосный 32. Для четырёх и пяти отдельного правила нет, поэтому там
 * остаётся голое число.
 */
const AXLE_LABEL: Record<number, string> = {
  2: '2 · 25 t',
  3: '3 · 32 t',
};

export function VehicleForm({
  vehicle,
  onClose,
}: {
  vehicle: Vehicle | null;
  onClose: () => void;
}) {
  const { t, m, locale } = useI18n();
  const [state, formAction, pending] = useActionState(saveVehicleAction, initial);
  const [languages, setLanguages] = useState<string[]>(vehicle?.languages ?? ['FI']);

  /*
   * Класс решает, какая половина карточки видна.
   *
   * У тягача спрашивают оси и контейнерное шасси — то, чем он берёт
   * чужую единицу. У фургона и грузовика единицы нет: груз едет в
   * кузове, и вместо осей нужны килограммы и погрузочные метры, по
   * которым платформа подбирает машину под заказ.
   */
  const [vehicleClass, setVehicleClass] = useState<VehicleClass>(
    vehicle?.vehicle_class ?? 'TRACTOR',
  );
  const express = vehicleClass !== 'TRACTOR';

  /* Дату техосмотра спрашиваем только там, где заявлен холодильник. */
  const [reefer, setReefer] = useState(vehicle?.reefer ?? false);

  /* Закрываем форму после успешного сохранения — в эффекте, а не в рендере. */
  useEffect(() => {
    if (state.done) onClose();
  }, [state.done, onClose]);

  function toggleLanguage(code: string) {
    setLanguages((current) =>
      current.includes(code) ? current.filter((c) => c !== code) : [...current, code],
    );
  }

  return (
    <Card stripe="info">
      <CardBody>
        <h3 className="mb-4 text-[13px] font-semibold tracking-tight">
          {vehicle ? t.fleet.editVehicle : t.fleet.newVehicle}
        </h3>

        <form action={formAction} className="grid gap-4 sm:grid-cols-2">
          <input type="hidden" name="locale" value={locale} />
          {vehicle && <input type="hidden" name="id" value={vehicle.id} />}
          {languages.map((code) => (
            <input key={code} type="hidden" name="languages" value={code} />
          ))}

          <Field label={t.vehicle.class} hint={t.vehicle.classHint} className="sm:col-span-2">
            {(p) => (
              <Select
                {...p}
                name="vehicle_class"
                value={vehicleClass}
                onChange={(e) => setVehicleClass(e.target.value as VehicleClass)}
              >
                <option value="TRACTOR">{t.vehicleClass.TRACTOR}</option>
                <option value="VAN">{t.vehicleClass.VAN}</option>
                <option value="TRUCK">{t.vehicleClass.TRUCK}</option>
              </Select>
            )}
          </Field>

          <Field label={t.vehicle.plate} required>
            {(p) => (
              <InputMono
                {...p}
                name="plate"
                required
                defaultValue={vehicle?.plate ?? ''}
                placeholder="HKO-441"
                className="uppercase"
              />
            )}
          </Field>

          <Field label={t.vehicle.make} required>
            {(p) => (
              <Input {...p} name="make" required defaultValue={vehicle?.make ?? ''} placeholder="Volvo FH" />
            )}
          </Field>

          <Field label={t.vehicle.driver} required>
            {(p) => (
              <Input
                {...p}
                name="driver_name"
                required
                defaultValue={vehicle?.driver_name ?? ''}
                placeholder="Antti Nieminen"
              />
            )}
          </Field>

          <Field label={t.vehicle.whatsapp} required>
            {(p) => (
              <InputMono
                {...p}
                name="whatsapp"
                required
                defaultValue={vehicle?.whatsapp ?? '+358'}
                placeholder="+358401112233"
              />
            )}
          </Field>

          {/*
            * Оси названы вместе с грузоподъёмностью: перевозчик выбирает
            * не число, а то, какие заказы машина сможет брать. Пределы те
            * же, что проверяет база в take_order.
            *
            * У фургона и грузовика вопроса нет: правило «две оси — 25
            * тонн» написано про седельный тягач и к кузову неприменимо.
            */}
          {!express && (
            <Field label={t.vehicle.axles} hint={t.vehicle.capacityHint} required>
              {(p) => (
                <Select {...p} name="axles" required defaultValue={String(vehicle?.axles ?? 3)}>
                  {[2, 3, 4, 5].map((n) => (
                    <option key={n} value={n}>
                      {AXLE_LABEL[n] ?? String(n)}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          )}

          {/*
            * Кузов: килограммы и метры. Оба обязательны и оба участвуют в
            * подборе — take_order сверяет вес заказа с грузоподъёмностью,
            * а погрузочные метры кузова с метрами груза. Незаполненная
            * карточка означала бы машину, которой не достаётся ни один
            * заказ, и понять почему было бы неоткуда.
            */}
          {express && (
            <>
              <Field label={t.vehicle.payload} hint={t.vehicle.payloadHint} required>
                {(p) => (
                  <InputMono
                    {...p}
                    name="payload_kg"
                    required
                    inputMode="numeric"
                    defaultValue={vehicle?.payload_kg ?? ''}
                    placeholder={vehicleClass === 'VAN' ? '1200' : '9500'}
                  />
                )}
              </Field>

              <Field label={t.vehicle.ldm} hint={t.vehicle.ldmHint} required>
                {(p) => (
                  <InputMono
                    {...p}
                    name="ldm"
                    required
                    inputMode="decimal"
                    defaultValue={vehicle?.ldm ?? ''}
                    placeholder={vehicleClass === 'VAN' ? '3,4' : '7,2'}
                  />
                )}
              </Field>

              {/*
                * Оснащение — то, на что смотрит заказчик, выбирая отклик.
                * Требованием заказа оно пока не сделано намеренно: пока
                * таких машин в парке единицы, обязательное требование
                * дало бы заказ, который некому взять.
                */}
              <Field label={t.vehicle.equipment} className="sm:col-span-2">
                {() => (
                  <div className="flex flex-wrap gap-4">
                    <label className="flex items-center gap-2 text-[13px]">
                      <input
                        type="checkbox"
                        name="tail_lift"
                        value="1"
                        defaultChecked={vehicle?.tail_lift ?? false}
                        className="size-4 accent-[var(--color-accent)]"
                      />
                      {t.vehicle.tailLift}
                    </label>
                    <label className="flex items-center gap-2 text-[13px]">
                      <input
                        type="checkbox"
                        name="side_loading"
                        value="1"
                        defaultChecked={vehicle?.side_loading ?? false}
                        className="size-4 accent-[var(--color-accent)]"
                      />
                      {t.vehicle.sideLoading}
                    </label>
                    <label className="flex items-center gap-2 text-[13px]">
                      <input
                        type="checkbox"
                        name="reefer"
                        value="1"
                        checked={reefer}
                        onChange={(e) => setReefer(e.target.checked)}
                        className="size-4 accent-[var(--color-accent)]"
                      />
                      {t.vehicle.reefer}
                    </label>
                  </div>
                )}
              </Field>

              {/*
                * Заявленный холодильник без даты техосмотра — обещание,
                * которое нечем проверить. Того же требует ограничение в
                * базе; здесь оно лишь показано человеку вовремя.
                */}
              {reefer && (
                <Field
                  label={t.vehicle.reeferUntil}
                  hint={t.vehicle.reeferUntilHint}
                  required
                  className="sm:col-span-2"
                >
                  {(p) => (
                    <Input
                      {...p}
                      type="date"
                      name="reefer_inspection_until"
                      required
                      defaultValue={vehicle?.reefer_inspection_until ?? ''}
                    />
                  )}
                </Field>
              )}
            </>
          )}

          {/*
            * Шасси под контейнеры — рядом с осями, а не среди примет
            * машины: и то и другое отвечает на вопрос «какие заказы эта
            * машина сможет взять», и проверяет их одна и та же функция в
            * take_order.
            *
            * Флажки, а не выпадающий список: длины не исключают друг
            * друга, и «двадцатка и сороковка» — обычный случай, а не
            * редкость. Пусто означает, что машина контейнеры не возит, и
            * это умолчание для всего существующего парка.
            */}
          {!express && (
          <Field label={t.vehicle.containerFeet} hint={t.vehicle.containerFeetHint}>
            {() => (
              <div className="flex flex-wrap gap-3">
                {[20, 30, 40, 45].map((size) => (
                  <label key={size} className="flex items-center gap-2 text-[13px]">
                    <input
                      type="checkbox"
                      name="container_feet"
                      value={size}
                      defaultChecked={vehicle?.container_feet?.includes(size) ?? false}
                      className="size-4 accent-[var(--color-accent)]"
                    />
                    {m('order.containerSize', { feet: size })}
                  </label>
                ))}
              </div>
            )}
          </Field>
          )}

          <Field label={t.vehicle.adr} hint={t.vehicle.adrHint}>
            {(p) => (
              <label className="flex items-center gap-2.5 text-[13px]">
                <input
                  id={p.id}
                  type="checkbox"
                  name="adr"
                  value="1"
                  defaultChecked={vehicle?.adr ?? false}
                  className="size-4 accent-[var(--color-accent)]"
                />
                {t.vehicle.adrHas}
              </label>
            )}
          </Field>

          <Field label={t.vehicle.euro} required>
            {(p) => (
              <Select {...p} name="euro_class" required defaultValue={vehicle?.euro_class ?? 'EURO_6'}>
                <option value="EURO_6">Euro 6</option>
                <option value="EURO_5">Euro 5</option>
                <option value="EURO_4">Euro 4</option>
              </Select>
            )}
          </Field>

          {/*
            * База — обычное поле, а не список.
            *
            * Список из шести городов запуска не давал перевозчику из Раумы
            * или Оулу указать свою базу вовсе, хотя стол он видит по всей
            * стране. Регионы стола и так считаются по фактическим заказам
            * (desk_regions), а не по этому списку.
            */}
          <Field label={t.vehicle.base} required>
            {(p) => (
              <Input
                {...p}
                name="base_city"
                required
                defaultValue={vehicle?.base_city ?? ''}
                placeholder="Helsinki"
              />
            )}
          </Field>

          <div className="sm:col-span-2">
            <span className="label-micro mb-2 block">{t.vehicle.languages}</span>
            <div className="flex flex-wrap gap-1.5">
              {DRIVER_LANGUAGES.map((code) => {
                const on = languages.includes(code);
                return (
                  <button
                    key={code}
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggleLanguage(code)}
                    className={
                      on
                        ? 'cursor-pointer rounded-control border border-accent bg-accent px-2.5 py-1 font-mono text-xs font-bold text-accent-ink'
                        : 'cursor-pointer rounded-control border border-line bg-raised px-2.5 py-1 font-mono text-xs text-ink-faint transition-colors duration-150 hover:border-accent-line hover:text-ink'
                    }
                  >
                    {code}
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-xs text-ink-faint">{t.fleet.languagesHint}</p>
          </div>

          {vehicle?.access === 'APPROVED' && (
            <p className="rounded-control border border-warn/35 bg-warn/10 px-3 py-2 text-[13px] text-warn sm:col-span-2">
              {t.fleet.onReview}
            </p>
          )}

          {state.error && (
            <p role="alert" className="text-[13px] text-danger sm:col-span-2">
              {state.error}
            </p>
          )}

          <div className="flex gap-2 sm:col-span-2">
            <Button type="button" onClick={onClose} className="flex-1">
              {t.action.cancel}
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={pending || languages.length === 0}
              className="flex-[2]"
            >
              {t.action.save}
            </Button>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}

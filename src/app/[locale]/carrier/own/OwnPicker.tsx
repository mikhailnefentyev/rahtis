'use client';

import { useEffect, useRef, useState } from 'react';
import { CountrySelect } from '@/components/CountrySelect';
import { Field, Input, InputMono, Select } from '@/components/ui';
import { countryPack } from '@/lib/country';
import { vehicleClassFits, type HaulKind } from '@/lib/orders/haul';
import { useI18n } from '@/lib/i18n/provider';
import type { CarrierClient, OwnVehicle } from '@/types/db';
import { matchPlate, type DraftClient } from '@/lib/orders/importDraft';
import { cn } from '@/lib/cn';

/**
 * Клиент и машина своего рейса — последним блоком формы вместо выбора
 * «стол или напрямую».
 *
 * Клиент берётся из справочника или заводится здесь же: имя обязательно,
 * Y-tunnus и почта — нет. Почта нужна только для ссылки на ход рейса.
 *
 * Машины — только подходящие единице: тягач для прицепа и контейнера,
 * фургон или грузовик для экспресса. Не выходящие на рейсы не
 * показываются, занятые — с пометкой: второй рейс в очередь бывает.
 *
 * Если заказ называет машину (письмо DFDS: «auto ABC-123»), она выбрана
 * сразу. Не нашлась или не может взять рейс — выбор пустой и сказано почему:
 * молча поставить другую машину хуже, чем спросить.
 */
export function OwnPicker({
  clients,
  vehicles,
  trailers = [],
  haulKind,
  homeCountry = 'FI',
  draftClient = null,
  draftVehiclePlate = '',
}: {
  clients: CarrierClient[];
  vehicles: OwnVehicle[];
  /** Прицепы компании — сразу собрать сцепку рейса (конструктор). */
  trailers?: { id: string; plate: string; kind: string; body_type: string | null }[];
  haulKind: HaulKind;
  /** Страна перевозчика — с неё начинается выбор страны нового клиента. */
  homeCountry?: string;
  /** Заказчик из письма или PDF: найденный в справочнике или новый. */
  draftClient?: DraftClient | null;
  /** Номер машины из письма или PDF, как его прочитал разбор. */
  draftVehiclePlate?: string;
}) {
  const { t } = useI18n();
  const [clientId, setClientId] = useState(draftClient ? (draftClient.id ?? '') : (clients[0]?.id ?? ''));
  const chosen = clients.find((c) => c.id === clientId) ?? null;
  /*
   * Поля держит состояние, а не браузер: после отказа сервера React
   * сбрасывает неуправляемые поля формы, и клиент с машиной пропадали —
   * форму приходилось дозаполнять заново (прогон 12.10.2026).
   */
  const [name, setName] = useState(draftClient?.name ?? '');
  const [businessId, setBusinessId] = useState(draftClient?.businessId ?? '');
  const [country, setCountry] = useState(homeCountry);
  const pack = countryPack(country);
  const [email, setEmail] = useState(
    draftClient?.email || (clients.find((c) => c.id === (draftClient ? draftClient.id : clients[0]?.id))?.contact_email ?? ''),
  );
  const ai = draftClient ? 'ai-filled' : undefined;
  /* Тягач — перецеп, контейнер и полный полуприцеп (фура); фургон и грузовик — свой экспресс. */
  const fitting = vehicles.filter((v) => v.available && vehicleClassFits(haulKind, v.vehicle_class));
  const draftKey = draftVehiclePlate.trim();
  const fromDraft = draftKey ? matchPlate(draftKey, vehicles) : null;
  const draftFits = fromDraft !== null && fitting.some((v) => v.vehicle_id === fromDraft.vehicle_id);
  const [vehicleId, setVehicleId] = useState(draftFits ? fromDraft.vehicle_id : '');
  const draftNote = !draftKey
    ? null
    : draftFits
      ? vehicleId === fromDraft.vehicle_id
        ? { warn: false, text: t.own.vehicleFromDraft.replace('{plate}', fromDraft.plate) }
        : null
      : {
          warn: true,
          text: (fromDraft ? t.own.vehicleDraftUnfit : t.own.vehicleDraftUnknown).replace(
            '{plate}',
            fromDraft?.plate ?? draftVehiclePlate,
          ),
        };

  /*
   * Со списками хуже, чем с полями: сброс формы возвращает выпадающий
   * список к первой строке, хотя состояние помнит выбор. На экране —
   * первый клиент из справочника, в состоянии — «новый клиент», и рейс
   * ушёл бы не тому. По событию сброса списки пересоздаются из состояния.
   */
  const root = useRef<HTMLDivElement>(null);
  const [resets, setResets] = useState(0);
  useEffect(() => {
    const form = root.current?.closest('form');
    if (!form) return;
    const onReset = () => setResets((n) => n + 1);
    form.addEventListener('reset', onReset);
    return () => form.removeEventListener('reset', onReset);
  }, []);
  const optional = ` (${t.own.optional})`;

  return (
    <div ref={root} className="flex flex-col gap-4">
      <fieldset className="grid gap-3 sm:grid-cols-3">
        <legend className="label-micro mb-2">{t.own.clientSection}</legend>
        {clients.length > 0 && (
          <Field label={t.own.clientPick} className={cn('sm:col-span-3', ai)}>
            {(p) => (
              <Select
                key={resets}
                {...p}
                name="client_id"
                value={clientId}
                onChange={(e) => {
                  setClientId(e.target.value);
                  /* Почта — того клиента, который выбран; у нового поле пустое. */
                  setEmail(clients.find((c) => c.id === e.target.value)?.contact_email ?? '');
                }}
              >
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                    {c.business_id ? ` · ${c.business_id}` : ''}
                  </option>
                ))}
                <option value="">{t.own.clientNew}</option>
              </Select>
            )}
          </Field>
        )}
        {!chosen && (
          <>
            <Field label={t.own.clientName} required className={ai}>
              {(p) => (
                <Input
                  {...p}
                  name="client_name"
                  required
                  minLength={2}
                  maxLength={200}
                  autoComplete="organization"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              )}
            </Field>
            <Field label={t.company.country}>
              {(p) => (
                <CountrySelect
                  key={resets}
                  {...p}
                  name="client_country"
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                />
              )}
            </Field>
            <Field label={`${country === 'FI' ? t.own.clientBusinessId : pack.businessId.label}${optional}`}>
              {(p) => (
                <InputMono
                  {...p}
                  name="client_business_id"
                  placeholder={pack.businessId.example}
                  value={businessId}
                  onChange={(e) => setBusinessId(e.target.value)}
                />
              )}
            </Field>
          </>
        )}
        <Field
          label={`${t.own.clientEmail}${optional}`}
          hint={t.own.clientEmailHint}
          className={chosen ? 'sm:col-span-3' : undefined}
        >
          {(p) => (
            <Input
              {...p}
              name="client_email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          )}
        </Field>
      </fieldset>

      <Field
        label={t.own.vehicle}
        required
        className={draftNote && !draftNote.warn ? 'ai-filled' : undefined}
        hint={draftNote && !draftNote.warn ? draftNote.text : undefined}
      >
        {(p) =>
          fitting.length === 0 ? (
            <p id={p.id} className="text-[13px] text-warn" role="status">
              {t.own.noVehicles}
            </p>
          ) : (
            <Select key={resets} {...p} name="own_vehicle_id" required value={vehicleId} onChange={(e) => setVehicleId(e.target.value)}>
              <option value="" disabled>
                —
              </option>
              {fitting.map((v) => (
                <option key={v.vehicle_id} value={v.vehicle_id}>
                  {v.plate} · {v.driver_name ?? '—'}
                  {v.busy ? ` · ${t.own.busy}` : ''}
                </option>
              ))}
            </Select>
          )
        }
      </Field>
      {draftNote?.warn && (
        <p className="-mt-2 text-[13px] text-warn" role="status">
          {draftNote.text}
        </p>
      )}
      {/* Прицеп рейса — сразу: машина + прицеп = сцепка (полуприцеп к тягачу, прицеп к грузовику или нуппи). */}
      {(() => {
        const vclass = fitting.find((v) => v.vehicle_id === vehicleId)?.vehicle_class;
        const list = trailers.filter((tr) =>
          vclass === 'TRACTOR' ? tr.kind === 'SEMI' : vclass === 'TRUCK' || vclass === 'TIPPER' ? tr.kind !== 'SEMI' : false,
        );
        if (haulKind === 'TRAILER' || haulKind === 'CONTAINER' || list.length === 0) return null;
        return (
          <Field label={t.combos.tripTrailer}>
            {(p) => (
              <Select key={`${resets}-${vehicleId}`} {...p} name="own_trailer_id" defaultValue="">
                <option value="">{t.combos.none}</option>
                {list.map((tr) => (
                  <option key={tr.id} value={tr.id}>
                    {tr.plate}
                    {tr.body_type ? ` · ${t.mass.bodies[tr.body_type as keyof typeof t.mass.bodies]}` : ''}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        );
      })()}
    </div>
  );
}

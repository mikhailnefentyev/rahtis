'use client';

import { useActionState, useEffect, useMemo, useState } from 'react';
import { Badge, Button, Card, CardBody, EmptyState, Field, InputMono, Plate, Select } from '@/components/ui';
import { deleteTrailerAction, saveTrailerAction, type TrailerState } from '@/lib/fleet/actions';
import {
  MASS_COUNTRIES,
  ROAD_CLASSES,
  combinationMass,
  combinationProblem,
  isMassCountry,
  type MassCountry,
  type MotorUnit,
  type RoadClass,
  type TrailerUnit,
} from '@/lib/fleet/mass';
import { useCompanyCountry, useI18n } from '@/lib/i18n/provider';
import type { BodyType, Trailer, TrailerKind, Vehicle } from '@/types/db';

const BODY_TYPES: BodyType[] = ['TIPPER', 'CASSETTE', 'FLATBED', 'CONTAINER', 'CURTAIN', 'BOX', 'TANK', 'OTHER'];
const KINDS: TrailerKind[] = ['FULL', 'SEMI', 'CENTER_AXLE'];
const initial: TrailerState = { error: null, done: false };

const tonnes = (kg: number) => `${(kg / 1000).toLocaleString('fi-FI', { maximumFractionDigits: 1 })} t`;

/**
 * Прицепы перевозчика и сцепки с разрешённой массой.
 *
 * Сцепки не хранятся — их собирает смена. Здесь перевозчик видит, что
 * даёт каждая пара «машина + прицеп» в выбранной стране: предел по
 * закону, по техпаспорту, тару и грузоподъёмность.
 */
export function TrailersMass({ vehicles, trailers }: { vehicles: Vehicle[]; trailers: Trailer[] }) {
  const { t } = useI18n();
  const companyCountry = useCompanyCountry();
  const [editing, setEditing] = useState<Trailer | 'new' | null>(null);
  const [country, setCountry] = useState<MassCountry>(isMassCountry(companyCountry) ? companyCountry : 'FI');
  const [roadClass, setRoadClass] = useState<RoadClass | ''>('');

  const classes = ROAD_CLASSES[country];
  const effectiveClass = classes?.includes(roadClass as RoadClass) ? (roadClass as RoadClass) : classes?.[0];

  const rows = useMemo(() => {
    const motors = vehicles.filter((v) => v.vehicle_class !== 'VAN' && v.access !== 'REJECTED');
    const list: { key: string; motor: Vehicle; trailer: Trailer | null }[] = [];
    for (const motor of motors) {
      list.push({ key: motor.id, motor, trailer: null });
      for (const trailer of trailers) {
        const m: MotorUnit = { kind: motor.vehicle_class === 'TRACTOR' ? 'TRACTOR' : 'TRUCK', axles: motor.axles };
        const tr: TrailerUnit = { kind: trailer.kind, axles: trailer.axles, twinWheels: trailer.twin_wheels };
        if (!combinationProblem(m, [tr])) list.push({ key: `${motor.id}-${trailer.id}`, motor, trailer });
      }
    }
    return list.map((row) => {
      const motor: MotorUnit = {
        kind: row.motor.vehicle_class === 'TRACTOR' ? 'TRACTOR' : 'TRUCK',
        axles: row.motor.axles,
        grossMaxKg: row.motor.gross_max_kg,
        tareKg: row.motor.tare_kg,
      };
      const trailerUnits: TrailerUnit[] = row.trailer
        ? [{ kind: row.trailer.kind, axles: row.trailer.axles, twinWheels: row.trailer.twin_wheels, grossMaxKg: row.trailer.gross_max_kg, tareKg: row.trailer.tare_kg }]
        : [];
      return { ...row, mass: combinationMass(country, motor, trailerUnits, { roadClass: effectiveClass }) };
    });
  }, [vehicles, trailers, country, effectiveClass]);

  const regionName = (code: string) => {
    try {
      return new Intl.DisplayNames([t.meta.intl], { type: 'region' }).of(code) ?? code;
    } catch {
      return code;
    }
  };

  return (
    <section className="mt-10">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-line pb-2">
        <h2 className="text-[13px] font-semibold tracking-tight text-ink-faint">{t.mass.trailersTitle}</h2>
        {editing === null && (
          <Button variant="primary" size="sm" onClick={() => setEditing('new')}>
            {t.mass.addTrailer}
          </Button>
        )}
      </div>

      {editing !== null && (
        <div className="mb-4">
          <TrailerForm trailer={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />
        </div>
      )}

      {trailers.length === 0 && editing === null ? (
        <EmptyState title={t.mass.trailersTitle} description={t.mass.noTrailers} />
      ) : (
        <div className="flex flex-col gap-2">
          {trailers.map((trailer) => (
            <Card key={trailer.id}>
              <CardBody className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2.5 text-[13px]">
                  <Plate className="text-[15px]">{trailer.plate}</Plate>
                  <span>{t.mass.kinds[trailer.kind]}</span>
                  <span className="text-ink-muted">· {trailer.axles} {t.mass.axles.toLowerCase()}</span>
                  {trailer.body_type && <Badge tone="neutral">{t.mass.bodies[trailer.body_type]}</Badge>}
                  {trailer.twin_wheels && <Badge tone="info">{t.mass.twinWheels}</Badge>}
                  {trailer.tare_kg && <span className="text-ink-dim">· {t.mass.tare} {tonnes(trailer.tare_kg)}</span>}
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => setEditing(trailer)}>
                    {t.action.details}
                  </Button>
                  <DeleteTrailer id={trailer.id} />
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      <h2 className="mt-10 mb-2 border-b border-line pb-2 text-[13px] font-semibold tracking-tight text-ink-faint">{t.mass.title}</h2>
      <p className="mb-4 max-w-2xl text-[13px] leading-relaxed text-ink-muted">{t.mass.lede}</p>

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <Field label={t.mass.country}>
          {(p) => (
            <Select {...p} value={country} onChange={(e) => setCountry(e.target.value as MassCountry)}>
              {MASS_COUNTRIES.map((c) => (
                <option key={c} value={c}>
                  {regionName(c)}
                </option>
              ))}
            </Select>
          )}
        </Field>
        {classes && (
          <Field label={t.mass.roadClass}>
            {(p) => (
              <Select {...p} value={effectiveClass} onChange={(e) => setRoadClass(e.target.value as RoadClass)}>
                {classes.map((c) => (
                  <option key={c} value={c}>
                    {t.mass.roadClasses[c]}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        )}
      </div>

      {rows.length === 0 ? (
        <EmptyState title={t.mass.title} description={t.mass.noCombos} />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-line">
          <table className="w-full min-w-[640px] text-[13px]">
            <thead className="bg-sunken text-left text-xs text-ink-faint">
              <tr>
                <th className="px-3 py-2 font-medium">{t.mass.title}</th>
                <th className="px-3 py-2 font-medium">{t.mass.axles}</th>
                <th className="px-3 py-2 font-medium">{t.mass.limit}</th>
                <th className="px-3 py-2 font-medium">{t.mass.tare}</th>
                <th className="px-3 py-2 font-medium">{t.mass.payload}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ key, motor, trailer, mass }) => (
                <tr key={key} className="border-t border-line align-top">
                  <td className="px-3 py-2">
                    <span className="font-mono">{motor.plate}</span>
                    {trailer ? <span className="font-mono"> + {trailer.plate}</span> : <span className="text-ink-dim"> · {t.mass.solo}</span>}
                    {motor.body_type && <span className="ml-1 text-ink-dim">· {t.mass.bodies[motor.body_type]}</span>}
                  </td>
                  <td className="px-3 py-2">{mass.totalAxles}</td>
                  <td className="px-3 py-2">
                    <span className="font-semibold">{tonnes(mass.limitKg)}</span>
                    {mass.technicalKg !== null && mass.technicalKg < mass.legalKg && (
                      <span className="block text-xs text-ink-dim">
                        {t.mass.legal} {tonnes(mass.legalKg)}, {t.mass.technicalCap} {tonnes(mass.technicalKg)}
                      </span>
                    )}
                    {mass.basis === 'upper' && <span className="block text-xs text-ink-dim">{t.mass.upper}</span>}
                  </td>
                  <td className="px-3 py-2">{mass.tareKg !== null ? tonnes(mass.tareKg) : '—'}</td>
                  <td className="px-3 py-2">
                    {mass.payloadKg !== null ? (
                      <span className="font-semibold">{tonnes(mass.payloadKg)}</span>
                    ) : (
                      <span className="text-xs text-ink-dim">{t.mass.noTare}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function DeleteTrailer({ id }: { id: string }) {
  const { t, locale } = useI18n();
  return (
    <form action={deleteTrailerAction}>
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="id" value={id} />
      <Button type="submit" variant="danger" size="sm">
        {t.mass.delete}
      </Button>
    </form>
  );
}

function TrailerForm({ trailer, onClose }: { trailer: Trailer | null; onClose: () => void }) {
  const { t, locale } = useI18n();
  const [state, formAction, pending] = useActionState(saveTrailerAction, initial);

  useEffect(() => {
    if (state.done) onClose();
  }, [state, onClose]);

  return (
    <Card>
      <CardBody>
        <form action={formAction} className="grid gap-4 sm:grid-cols-2">
          <input type="hidden" name="locale" value={locale} />
          {trailer && <input type="hidden" name="id" value={trailer.id} />}

          <Field label={t.mass.trailerPlate} required>
            {(p) => <InputMono {...p} name="plate" required defaultValue={trailer?.plate ?? ''} placeholder="ABC-123" />}
          </Field>
          <Field label={t.mass.trailerKind} required>
            {(p) => (
              <Select {...p} name="kind" required defaultValue={trailer?.kind ?? 'FULL'}>
                {KINDS.map((k) => (
                  <option key={k} value={k}>
                    {t.mass.kinds[k]}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label={t.mass.axles} required>
            {(p) => (
              <Select {...p} name="axles" required defaultValue={String(trailer?.axles ?? 4)}>
                {[1, 2, 3, 4, 5, 6].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label={t.mass.body}>
            {(p) => (
              <Select {...p} name="body_type" defaultValue={trailer?.body_type ?? ''}>
                <option value="">{t.mass.bodyNone}</option>
                {BODY_TYPES.map((b) => (
                  <option key={b} value={b}>
                    {t.mass.bodies[b]}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label={t.mass.grossMax} hint={t.mass.grossMaxHint}>
            {(p) => <InputMono {...p} name="gross_max_kg" inputMode="numeric" defaultValue={trailer?.gross_max_kg ?? ''} placeholder="32000" />}
          </Field>
          <Field label={t.mass.tareKg} hint={t.mass.tareHint}>
            {(p) => <InputMono {...p} name="tare_kg" inputMode="numeric" defaultValue={trailer?.tare_kg ?? ''} placeholder="9000" />}
          </Field>
          <Field label={t.mass.twinWheels} hint={t.mass.twinWheelsHint} className="sm:col-span-2">
            {() => (
              <label className="flex items-center gap-2 text-[13px]">
                <input type="checkbox" name="twin_wheels" value="1" defaultChecked={trailer?.twin_wheels ?? true} />
                {t.mass.twinWheels}
              </label>
            )}
          </Field>

          {state.error && <p className="text-[13px] text-danger sm:col-span-2">{state.error}</p>}

          <div className="flex gap-2 sm:col-span-2">
            <Button type="submit" variant="primary" disabled={pending}>
              {t.mass.save}
            </Button>
            <Button onClick={onClose}>{t.mass.cancel}</Button>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}

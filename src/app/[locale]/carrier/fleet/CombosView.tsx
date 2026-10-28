'use client';

import { useActionState, useEffect, useMemo, useState } from 'react';
import { Badge, Button, Card, CardBody, EmptyState, Field, Select } from '@/components/ui';
import { deleteComboAction, saveComboAction, type ComboState } from '@/lib/fleet/actions';
import { comboKind } from '@/lib/fleet/mass';
import { useI18n } from '@/lib/i18n/provider';
import type { Trailer, Vehicle } from '@/types/db';
import type { Database } from '@/types/database';

type Combo = Database['public']['Tables']['vehicle_combos']['Row'];

const initial: ComboState = { error: null, done: false };
const tonnes = (kg: number) => `${(kg / 1000).toLocaleString('fi-FI', { maximumFractionDigits: 1 })} t`;

/**
 * Конструктор сцепок (пользователь 28.10.2026): перевозчик сам собирает
 * сцепки из своих машин и прицепов — тягач один под перецепку, тягач +
 * самосвальный полуприцеп, нуппи + трал, грузовик + тент… Что сцепка
 * везёт, считает сервер (закон страны по SKAL, груз, метры, объём).
 * Откликаясь на заказ, перевозчик выберет сцепку (этап B).
 */
export function CombosView({ vehicles, trailers, combos }: { vehicles: Vehicle[]; trailers: Trailer[]; combos: Combo[] }) {
  const { t, locale } = useI18n();
  const c = t.combos;
  const [adding, setAdding] = useState(false);
  const [state, action, pending] = useActionState(saveComboAction, initial);
  const motors = vehicles.filter((v) => v.access !== 'REJECTED');

  return (
    <section className="mt-10">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-3 border-b border-line pb-2">
        <h2 className="text-[13px] font-semibold tracking-tight text-ink-faint">{c.title}</h2>
        {!adding && (
          <Button variant="primary" size="sm" onClick={() => setAdding(true)} disabled={motors.length === 0}>
            {c.add}
          </Button>
        )}
      </div>
      <p className="mb-4 max-w-2xl text-[13px] leading-relaxed text-ink-muted">{c.lede}</p>

      {adding && <ComboForm vehicles={motors} trailers={trailers} onClose={() => setAdding(false)} />}

      {/* Ошибка пересчёта сохранённой сцепки. */}
      {state.error && <p className="mb-2 text-[13px] text-danger">{state.error}</p>}

      {combos.length === 0 && !adding ? (
        <EmptyState title={c.title} description={c.empty} />
      ) : (
        <div className="flex flex-col gap-2">
          {combos.map((combo) => (
            <Card key={combo.id}>
              <CardBody className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 text-[13px]">
                  <p>
                    <span className="font-mono font-semibold">{combo.name}</span>{' '}
                    <span className="text-ink-muted">· {c.kinds[combo.kind as keyof typeof c.kinds]}</span>
                  </p>
                  <p className="mt-1 text-ink-muted">
                    {combo.axles} {t.mass.axles.toLowerCase()} · {c.legal} {tonnes(combo.legal_kg)}
                    {combo.payload_kg ? ` · ${c.payload} ${tonnes(combo.payload_kg)}` : ''}
                    {combo.ldm ? ` · ${String(combo.ldm).replace('.', ',')} ldm` : ''}
                    {combo.volume_m3 ? ` · ${String(combo.volume_m3).replace('.', ',')} m³` : ''}
                  </p>
                  {(combo.bodies.length > 0 || combo.loading.length > 0) && (
                    <p className="mt-1 flex flex-wrap gap-1.5">
                      {combo.bodies.map((b) => (
                        <Badge key={b} tone="neutral">
                          {t.mass.bodies[b as keyof typeof t.mass.bodies] ?? b}
                        </Badge>
                      ))}
                      {combo.loading.map((l) => (
                        <Badge key={l} tone="info">
                          {t.mass.loading[l as keyof typeof t.mass.loading] ?? l}
                        </Badge>
                      ))}
                    </p>
                  )}
                </div>
                <div className="flex gap-2">
                  {/* Пересчитать: размеры и массы машины или прицепа могли поменяться. */}
                  <form action={action}>
                    <input type="hidden" name="locale" value={locale} />
                    <input type="hidden" name="id" value={combo.id} />
                    <input type="hidden" name="vehicle_id" value={combo.vehicle_id} />
                    <input type="hidden" name="trailer_id" value={combo.trailer_id ?? ''} />
                    <Button type="submit" size="sm" disabled={pending}>
                      {c.recalc}
                    </Button>
                  </form>
                  <form action={deleteComboAction}>
                    <input type="hidden" name="locale" value={locale} />
                    <input type="hidden" name="id" value={combo.id} />
                    <Button type="submit" size="sm" variant="danger">
                      {c.delete}
                    </Button>
                  </form>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}
    </section>
  );
}

/** Форма новой сцепки: машина и подходящий к ней прицеп (или без). */
function ComboForm({ vehicles, trailers, onClose }: { vehicles: Vehicle[]; trailers: Trailer[]; onClose: () => void }) {
  const { t, locale } = useI18n();
  const c = t.combos;
  const [vehicleId, setVehicleId] = useState('');
  const [trailerId, setTrailerId] = useState('');
  const [state, action, pending] = useActionState(saveComboAction, initial);
  const motors = vehicles;
  const vehicle = motors.find((v) => v.id === vehicleId) ?? null;

  /* Прицепы, которые к этой машине можно прицепить: полуприцеп — к тягачу, прицеп — к грузовику или нуппи. */
  const fitting = useMemo(
    () => (vehicle ? trailers.filter((tr) => comboKind(vehicle.vehicle_class, { kind: tr.kind, bodyType: tr.body_type }) !== null) : []),
    [vehicle, trailers],
  );
  const picked = trailers.find((tr) => tr.id === trailerId) ?? null;
  const kind = vehicle ? comboKind(vehicle.vehicle_class, picked ? { kind: picked.kind, bodyType: picked.body_type } : null) : null;

  useEffect(() => {
    if (state.done) onClose();
  }, [state, onClose]);

  return (
    <Card className="mb-4">
        <CardBody>
          <form action={action} className="grid gap-4 sm:grid-cols-2">
            <input type="hidden" name="locale" value={locale} />
            <Field label={c.motor} required>
              {(p) => (
                <Select
                  {...p}
                  name="vehicle_id"
                  required
                  value={vehicleId}
                  onChange={(e) => {
                    setVehicleId(e.target.value);
                    setTrailerId('');
                  }}
                >
                  <option value="">—</option>
                  {motors.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.plate} · {t.vehicleClass[v.vehicle_class]}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label={c.trailer}>
              {(p) => (
                <Select {...p} name="trailer_id" value={trailerId} onChange={(e) => setTrailerId(e.target.value)} disabled={!vehicle || vehicle.vehicle_class === 'VAN'}>
                  <option value="">{c.none}</option>
                  {fitting.map((tr) => (
                    <option key={tr.id} value={tr.id}>
                      {tr.plate} · {t.mass.kinds[tr.kind]}
                      {tr.body_type ? ` · ${t.mass.bodies[tr.body_type]}` : ''} · {tr.axles} {t.mass.axles.toLowerCase()}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            {kind && <p className="text-[13px] sm:col-span-2">{c.kinds[kind]}</p>}
            {state.error && <p className="text-[13px] text-danger sm:col-span-2">{state.error}</p>}
            <div className="flex gap-2 sm:col-span-2">
              <Button type="submit" variant="primary" disabled={pending || !vehicle || !kind}>
                {c.save}
              </Button>
              <Button onClick={onClose}>{t.mass.cancel}</Button>
            </div>
          </form>
        </CardBody>
      </Card>
  );
}

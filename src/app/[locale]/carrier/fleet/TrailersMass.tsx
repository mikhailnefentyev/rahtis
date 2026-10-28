'use client';

import { useActionState, useEffect, useState } from 'react';
import { Badge, Button, Card, CardBody, EmptyState, Field, InputMono, Plate, Select } from '@/components/ui';
import { deleteTrailerAction, saveTrailerAction, type TrailerState } from '@/lib/fleet/actions';
import { useI18n } from '@/lib/i18n/provider';
import { isSemiFeature } from '@/lib/orders/haul';
import type { BodyType, Trailer, TrailerKind, Vehicle } from '@/types/db';

/* Кузова полуприцепов и прицепов (пользователь 28.10.2026): самосвал, тент, изотерм, реф, трал — и прежние. */
const BODY_TYPES: BodyType[] = ['TIPPER', 'CURTAIN', 'ISOTHERM', 'REEFER', 'LOWBED', 'BOX', 'FLATBED', 'CONTAINER', 'TANK', 'OTHER'];
/* Загрузка сверху, сбоку, сзади — у кузовов для грузов. */
const LOADING_BODIES: readonly string[] = ['CURTAIN', 'ISOTHERM', 'REEFER', 'BOX'];
const KINDS: TrailerKind[] = ['FULL', 'SEMI', 'CENTER_AXLE'];
const initial: TrailerState = { error: null, done: false };

const tonnes = (kg: number) => `${(kg / 1000).toLocaleString('fi-FI', { maximumFractionDigits: 1 })} t`;
const metres = (m: number) => `${Number(m).toLocaleString('fi-FI', { maximumFractionDigits: 2 })} m`;

/**
 * Прицепы и полуприцепы перевозчика: вид, кузов (самосвал, тент, изотерм,
 * реф, трал…), загрузка, грузоподъёмность и размеры. Сцепки из них
 * собираются в конструкторе ниже (CombosView).
 */
export function TrailersMass({ trailers }: { vehicles?: Vehicle[]; trailers: Trailer[] }) {
  const { t } = useI18n();
  const [editing, setEditing] = useState<Trailer | 'new' | null>(null);

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
                  {trailer.kind === 'SEMI' &&
                    (trailer.semi_features ?? []).map((feature) =>
                      isSemiFeature(feature) ? (
                        <Badge key={feature} tone="neutral">
                          {t.semi.features[feature]}
                        </Badge>
                      ) : null,
                    )}
                  {trailer.tare_kg && <span className="text-ink-dim">· {t.mass.tare} {tonnes(trailer.tare_kg)}</span>}
                  {trailer.length_m && <span className="text-ink-dim">· {metres(trailer.length_m)}</span>}
                  {trailer.body_volume_m3 && <span className="text-ink-dim">· {Number(trailer.body_volume_m3).toLocaleString('fi-FI')} m³</span>}
                  {trailer.coupling_distance_m && (
                    <span className="text-ink-dim">
                      · {t.mass.couplingShort} {metres(trailer.coupling_distance_m)}
                    </span>
                  )}
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
  /* Пометки фуры (метры, MEGA, загрузка) — только у полуприцепа: по ним подбираются экспресс-заказы SEMI. */
  const [kind, setKind] = useState<TrailerKind>(trailer?.kind ?? 'FULL');
  const [body, setBody] = useState<string>(trailer?.body_type ?? '');
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
              <Select {...p} name="kind" required value={kind} onChange={(e) => setKind(e.target.value as TrailerKind)}>
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
              <Select {...p} name="body_type" value={body} onChange={(e) => setBody(e.target.value)}>
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
          <Field label={t.mass.volumeM3} hint={t.mass.volumeHint}>
            {(p) => <InputMono {...p} name="body_volume_m3" inputMode="decimal" defaultValue={trailer?.body_volume_m3 ?? ''} placeholder="24" />}
          </Field>
          <Field label={t.mass.lengthM} hint={t.mass.lengthHint}>
            {(p) => <InputMono {...p} name="length_m" inputMode="decimal" defaultValue={trailer?.length_m ?? ''} placeholder="13,6" />}
          </Field>
          <Field label={t.mass.couplingTrailer} hint={t.mass.couplingTrailerHint}>
            {(p) => (
              <InputMono {...p} name="coupling_distance_m" inputMode="decimal" defaultValue={trailer?.coupling_distance_m ?? ''} placeholder="8,2" />
            )}
          </Field>
          <Field label={t.mass.payloadKg} hint={t.mass.payloadHint}>
            {(p) => <InputMono {...p} name="payload_kg" inputMode="numeric" defaultValue={trailer?.payload_kg ?? ''} placeholder="30000" />}
          </Field>
          <Field label={t.semi.trailerLdm}>
            {(p) => <InputMono {...p} name="ldm" inputMode="decimal" defaultValue={trailer?.ldm ?? (kind === 'SEMI' ? 13.6 : '')} placeholder={kind === 'SEMI' ? '13,6' : '7,7'} />}
          </Field>
          <Field label={t.mass.innerLength}>
            {(p) => <InputMono {...p} name="inner_length_m" inputMode="decimal" defaultValue={trailer?.inner_length_m ?? ''} placeholder="13,6" />}
          </Field>
          <Field label={t.mass.innerWidth}>
            {(p) => <InputMono {...p} name="inner_width_m" inputMode="decimal" defaultValue={trailer?.inner_width_m ?? ''} placeholder="2,48" />}
          </Field>
          <Field label={t.mass.innerHeight}>
            {(p) => <InputMono {...p} name="inner_height_m" inputMode="decimal" defaultValue={trailer?.inner_height_m ?? ''} placeholder="2,7" />}
          </Field>
          {LOADING_BODIES.includes(body) && (
            <Field label={t.mass.loadingLabel} className="sm:col-span-2">
              {() => (
                  <div className="flex flex-wrap gap-x-5 gap-y-2">
                    {(['TOP', 'SIDE', 'REAR'] as const).map((side) => (
                      <label key={side} className="flex items-center gap-2 text-[13px]">
                        <input type="checkbox" name="loading" value={side} defaultChecked={(trailer?.loading ?? []).includes(side)} />
                        {t.mass.loading[side]}
                      </label>
                    ))}
                  </div>
              )}
            </Field>
          )}
          {kind === 'SEMI' && (
            <>
              <Field label={t.semi.trailerTitle} className="sm:col-span-2">
                {() => (
                  <div className="flex flex-wrap gap-x-5 gap-y-2">
                    {(['MEGA', 'LIFTING_ROOF'] as const).map((feature) => (
                      <label key={feature} className="flex items-center gap-2 text-[13px]">
                        <input
                          type="checkbox"
                          name="semi_features"
                          value={feature}
                          defaultChecked={trailer?.semi_features?.includes(feature) ?? false}
                        />
                        {t.semi.features[feature]}
                      </label>
                    ))}
                  </div>
                )}
              </Field>
            </>
          )}
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

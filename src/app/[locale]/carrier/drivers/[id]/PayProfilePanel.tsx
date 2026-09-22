'use client';

import Link from 'next/link';
import { useActionState, useState } from 'react';
import { Badge, Button, Card, CardBody, Field, Input, InputMono, Select } from '@/components/ui';
import {
  deletePayProfileAction,
  savePayProfileAction,
  type FormState,
} from '@/lib/drivers/actions';
import { useI18n } from '@/lib/i18n/provider';
import type { DriverPayProfile, PayModel, TesRuleSet } from '@/types/db';

const initial: FormState = { error: null, done: false };
const MODELS: PayModel[] = ['FLAT_HOURLY', 'TES', 'PER_KM', 'TRIP_PERCENT'];

/**
 * Модель оплаты водителя: действующая, история и форма новой ставки.
 *
 * Ставка не правится задним числом — новая строка с датой начала. Так
 * отчёт за прошлый месяц считается по ставке того месяца, а не по
 * сегодняшней.
 */
export function PayProfilePanel({
  driverId,
  profiles,
  sets,
  grades,
  today,
}: {
  driverId: string;
  /** Сегодня по Хельсинки, с сервера: рендер обязан быть чистым. */
  today: string;
  /** По убыванию даты начала. */
  profiles: DriverPayProfile[];
  sets: Pick<TesRuleSet, 'id' | 'name' | 'valid_from' | 'company_id'>[];
  /** Категории таблиц ставок: по одной строке на набор и категорию. */
  grades: Array<{ rule_set_id: string; grade: string; label: string }>;
}) {
  const { t, m, f, locale } = useI18n();
  const [state, formAction, pending] = useActionState(savePayProfileAction, initial);
  const [model, setModel] = useState<PayModel>(profiles[0]?.model ?? 'FLAT_HOURLY');
  /*
   * Категории водителя без ступени стажа: из «TRUCK_4 · …, 4–8 v» остаётся
   * «TRUCK · …». Ступень калькулятор выводит сам из даты начала стажа.
   */
  /*
   * Ступень — окончание _0/_4/_8/_12, и только у категории, где ступени
   * есть: INTL_8 — это «+8 %», а не восьмая ступень.
   */
  const baseCode = (set: string | null, grade: string | null | undefined) => {
    if (!grade) return null;
    const base = grade.replace(/_(0|4|8|12)$/, '');
    return base !== grade && grades.some((g) => g.rule_set_id === set && g.grade === `${base}_0`) ? base : grade;
  };

  const categories = [
    ...new Map(
      grades.map((g) => {
        const code = baseCode(g.rule_set_id, g.grade)!;
        const label = code === g.grade ? g.label : g.label.replace(/,\s[^,]*\sv$/, '');
        return [`${g.rule_set_id}:${code}`, { rule_set_id: g.rule_set_id, code, label }];
      }),
    ).values(),
  ];
  const stepped = (set: string | null, code: string | null) =>
    grades.some((g) => g.rule_set_id === set && g.grade === `${code}_0`);

  /* По умолчанию — набор с таблицей ставок: там и категория, и стаж. */
  const [setId, setSetId] = useState<string>(
    profiles[0]?.tes_rule_set_id ?? categories[0]?.rule_set_id ?? sets[0]?.id ?? '',
  );
  const setCategories = categories.filter((c) => c.rule_set_id === setId);
  const last = profiles[0]?.tes_rule_set_id === setId ? profiles[0] : null;
  const [category, setCategory] = useState<string>(baseCode(setId, last?.tes_grade) ?? '');

  const gradeLabel = (p: DriverPayProfile) => {
    const code = baseCode(p.tes_rule_set_id, p.tes_grade);
    const label = categories.find((c) => c.rule_set_id === p.tes_rule_set_id && c.code === code)?.label;
    const since = p.tes_experience_since
      ? m('pay.experienceSince', { date: f.date(`${p.tes_experience_since}T12:00:00Z`) })
      : null;
    return [label, since].filter(Boolean).join(' · ');
  };

  const current = profiles.find((p) => p.valid_from <= today) ?? null;
  const setName = (id: string | null) => sets.find((s) => s.id === id)?.name ?? '—';

  const rate = (p: DriverPayProfile): string => {
    switch (p.model) {
      case 'PER_KM':
        return `${f.eur(p.per_km_cents ?? 0)} / km`;
      case 'FLAT_HOURLY':
        return `${f.eur(p.hourly_cents ?? 0)} / h`;
      case 'TRIP_PERCENT':
        return `${f.decimal((p.trip_bps ?? 0) / 100, 1)} %`;
      case 'TES':
        return [setName(p.tes_rule_set_id), gradeLabel(p)].filter(Boolean).join(' · ');
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {current ? (
        <p className="flex flex-wrap items-center gap-2 text-[13px]">
          <Badge tone="info">{t.pay.current}</Badge>
          {m('pay.modelSince', {
            model: t.payModel[current.model],
            date: f.date(`${current.valid_from}T12:00:00Z`),
          })}{' '}
          · <span className="font-semibold">{rate(current)}</span>
        </p>
      ) : (
        <p className="text-[13px] text-warn">{t.pay.none}</p>
      )}

      <Card stripe="info">
        <CardBody>
          <form action={formAction} className="grid gap-4 sm:grid-cols-2">
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="driver_id" value={driverId} />

            <Field label={t.pay.model} hint={t.payModelHint[model]} required>
              {(p) => (
                <Select
                  {...p}
                  name="model"
                  value={model}
                  onChange={(e) => setModel(e.target.value as PayModel)}
                >
                  {MODELS.map((code) => (
                    <option key={code} value={code}>
                      {t.payModel[code]}
                    </option>
                  ))}
                </Select>
              )}
            </Field>

            <Field label={t.pay.validFrom} required>
              {(p) => <Input {...p} type="date" name="valid_from" required defaultValue={today} />}
            </Field>

            {model === 'FLAT_HOURLY' && (
              <Field label={t.pay.hourly} required>
                {(p) => <InputMono {...p} name="hourly" required inputMode="decimal" placeholder="18,50" />}
              </Field>
            )}

            {model === 'PER_KM' && (
              <Field label={t.pay.perKm} required>
                {(p) => <InputMono {...p} name="per_km" required inputMode="decimal" placeholder="0,35" />}
              </Field>
            )}

            {model === 'TRIP_PERCENT' && (
              <Field label={t.pay.tripPercent} required>
                {(p) => (
                  <InputMono {...p} name="trip_percent" required inputMode="decimal" placeholder="25" />
                )}
              </Field>
            )}

            {model === 'TES' &&
              (sets.length === 0 ? (
                <p className="text-[13px] text-warn sm:col-span-2">
                  {t.pay.noTes}{' '}
                  <Link href={`/${locale}/carrier/drivers/tes`} className="underline">
                    {t.drivers.tes}
                  </Link>
                </p>
              ) : (
                <>
                  <Field label={t.pay.tesSet} required>
                    {(p) => (
                      <Select
                        {...p}
                        name="tes_rule_set_id"
                        required
                        value={setId}
                        onChange={(e) => {
                          setSetId(e.target.value);
                          setCategory('');
                        }}
                      >
                        {sets.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name} · {f.date(`${s.valid_from}T12:00:00Z`)}
                          </option>
                        ))}
                      </Select>
                    )}
                  </Field>
                  {/*
                    * Категория и стаж — у набора с таблицей ставок. Стаж —
                    * датой: ступень (меньше 4 лет, 4–8, 8–12, больше 12)
                    * калькулятор выводит на каждый день сам.
                    */}
                  {setCategories.length > 0 && (
                    <>
                      <Field label={t.pay.tesGrade} required>
                        {(p) => (
                          <Select
                            {...p}
                            name="tes_grade"
                            required
                            value={category}
                            onChange={(e) => setCategory(e.target.value)}
                          >
                            <option value="" disabled>
                              —
                            </option>
                            {setCategories.map((c) => (
                              <option key={c.code} value={c.code}>
                                {c.label}
                              </option>
                            ))}
                          </Select>
                        )}
                      </Field>
                      {(category === '' || stepped(setId, category)) && (
                        <Field label={t.pay.tesExperience} hint={t.pay.tesExperienceHint} required>
                          {(p) => (
                            <Input
                              {...p}
                              type="date"
                              name="tes_experience_since"
                              required
                              max={today}
                              defaultValue={last?.tes_experience_since ?? ''}
                            />
                          )}
                        </Field>
                      )}
                    </>
                  )}
                </>
              ))}

            {state.error && (
              <p role="alert" className="text-[13px] text-danger sm:col-span-2">
                {state.error}
              </p>
            )}
            {state.done && !pending && (
              <p className="text-[13px] text-ok sm:col-span-2">{t.pay.saved}</p>
            )}

            <div className="sm:col-span-2">
              <Button
                type="submit"
                variant="primary"
                disabled={pending || (model === 'TES' && sets.length === 0)}
              >
                {t.pay.save}
              </Button>
            </div>
          </form>
        </CardBody>
      </Card>

      {profiles.length > 0 && (
        <div>
          <h3 className="label-micro mb-2">{t.pay.history}</h3>
          <ul className="flex flex-col gap-1.5">
            {profiles.map((p) => (
              <li
                key={p.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-control border border-line px-3 py-2 text-[13px]"
              >
                <span>
                  {f.date(`${p.valid_from}T12:00:00Z`)} · {t.payModel[p.model]} ·{' '}
                  <span className="font-semibold">{rate(p)}</span>
                </span>
                <form action={deletePayProfileAction}>
                  <input type="hidden" name="locale" value={locale} />
                  <input type="hidden" name="id" value={p.id} />
                  <input type="hidden" name="driver_id" value={driverId} />
                  <Button type="submit" variant="ghost" size="sm">
                    {t.pay.delete}
                  </Button>
                </form>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

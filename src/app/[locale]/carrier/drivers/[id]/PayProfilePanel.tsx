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
import type { AllowanceRuleSet, DriverPayProfile, PayModel, TesRuleSet } from '@/types/db';
import { useKeepOnError } from '@/lib/forms/keepOnError';
import { wageWarnings } from '@/lib/pay/allowances';
import { asLegality, inEea } from '../payCountry';

const initial: FormState = { error: null, done: false };
const MODELS: PayModel[] = ['FLAT_HOURLY', 'TES', 'DAY_NET', 'MONTHLY_NET', 'PER_TRIP', 'PER_KM', 'TRIP_PERCENT'];

/** Премии — только поверх часов или оклада. */
const withBonus = (model: PayModel) => model === 'TES' || model === 'FLAT_HOURLY';

/** Договорённость «на руки»: за день, за месяц, за рейс (lib/pay/agreed). */
const isAgreed = (model: PayModel) => model === 'DAY_NET' || model === 'MONTHLY_NET' || model === 'PER_TRIP';

const BASES = ['ROUTE', 'WORK', 'ABROAD'] as const;
type Basis = (typeof BASES)[number];
const asBasis = (value: string | null | undefined): Basis =>
  BASES.includes(value as Basis) ? (value as Basis) : 'ROUTE';

type CountryRateDraft = { key: number; country: string; amount: string };

/** Ставки по странам из jsonb профиля. */
const countryRatesOf = (value: unknown): Array<[string, number]> =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? Object.entries(value as Record<string, unknown>).filter((e): e is [string, number] => typeof e[1] === 'number')
    : [];

/**
 * Модель оплаты водителя: действующая, история и форма новой ставки.
 *
 * Ставка не правится задним числом — новая строка с датой начала. Так
 * отчёт за прошлый месяц считается по ставке того месяца, а не по
 * сегодняшней.
 *
 * К модели — набор суточных и премии (за км, процент рейса) поверх часов
 * или оклада. Предупреждения — сразу в форме: оплата только за км в
 * ЕС/ЕЭЗ и выбранный «серый» или незаконный набор.
 */
export function PayProfilePanel({
  driverId,
  profiles,
  sets,
  allowanceSets,
  country,
  grades,
  today,
}: {
  driverId: string;
  /** Сегодня по Хельсинки, с сервера: рендер обязан быть чистым. */
  today: string;
  /** По убыванию даты начала. */
  profiles: DriverPayProfile[];
  sets: Pick<TesRuleSet, 'id' | 'name' | 'valid_from' | 'company_id' | 'legality' | 'currency'>[];
  /** Свои наборы суточных компании. */
  allowanceSets: Pick<AllowanceRuleSet, 'id' | 'name' | 'valid_from' | 'legality' | 'country'>[];
  /** Страна компании — для проверки «только за км» в ЕС/ЕЭЗ. */
  country: string;
  /** Категории таблиц ставок: по одной строке на набор и категорию. */
  grades: Array<{ rule_set_id: string; grade: string; label: string }>;
}) {
  const { t, m, f, locale } = useI18n();
  const [state, formAction, pending] = useActionState(savePayProfileAction, initial);
  const keepFormAction = useKeepOnError(state);
  const [model, setModel] = useState<PayModel>(profiles[0]?.model ?? 'FLAT_HOURLY');
  const [allowanceId, setAllowanceId] = useState<string>(profiles[0]?.allowance_rule_set_id ?? '');
  /*
   * Договорённость: прошлые значения — в форму по умолчанию, ставки по
   * странам — строками и одним JSON в скрытом поле.
   */
  const lastAgreed = profiles[0] && isAgreed(profiles[0].model) ? profiles[0] : null;
  const [paperId, setPaperId] = useState<string>(lastAgreed?.tes_rule_set_id ?? '');
  const [countryRows, setCountryRows] = useState<CountryRateDraft[]>(() =>
    countryRatesOf(lastAgreed?.agreed_country_day_cents).map(([country, cents], key) => ({
      key,
      country,
      amount: (cents / 100).toFixed(2).replace('.', ','),
    })),
  );
  const [nextRowKey, setNextRowKey] = useState(countryRows.length);
  const patchRow = (key: number, change: Partial<CountryRateDraft>) =>
    setCountryRows((list) => list.map((r) => (r.key === key ? { ...r, ...change } : r)));
  const countryRatesJson = JSON.stringify(
    countryRows.map((r) => ({ country: r.country.trim().toUpperCase(), amount: r.amount })),
  );
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

  const baseRate = (p: DriverPayProfile): string => {
    switch (p.model) {
      case 'PER_KM':
        return `${f.money(p.per_km_cents ?? 0, p.currency)} / km`;
      case 'FLAT_HOURLY':
        return `${f.money(p.hourly_cents ?? 0, p.currency)} / h`;
      case 'TRIP_PERCENT':
        return `${f.decimal((p.trip_bps ?? 0) / 100, 1)} %`;
      case 'TES':
        return [setName(p.tes_rule_set_id), gradeLabel(p)].filter(Boolean).join(' · ');
      case 'DAY_NET':
      case 'MONTHLY_NET':
      case 'PER_TRIP': {
        const g = t.agreed;
        const amount =
          p.model === 'DAY_NET'
            ? [
                p.agreed_day_cents ? `${f.money(p.agreed_day_cents, p.currency)} / ${g.perDay}` : null,
                g.basis[asBasis(p.agreed_day_basis)],
                p.agreed_home_day_cents != null ? `${g.homeShort} ${f.money(p.agreed_home_day_cents, p.currency)}` : null,
                ...countryRatesOf(p.agreed_country_day_cents).map(([c, cents]) => `${c} ${f.money(cents, p.currency)}`),
              ]
            : p.model === 'MONTHLY_NET'
              ? [`${f.money(p.agreed_monthly_cents ?? 0, p.currency)} / ${g.perMonth}`]
              : [`${f.money(p.agreed_trip_cents ?? 0, p.currency)} / ${g.perTrip}`];
        return [...amount, p.tes_rule_set_id ? setName(p.tes_rule_set_id) : null, p.third_country_driver ? g.thirdShort : null]
          .filter(Boolean)
          .join(' · ');
      }
    }
  };

  /* Ставка, премии поверх неё и суточные — одной строкой. */
  const rate = (p: DriverPayProfile): string =>
    [
      baseRate(p),
      p.bonus_per_km_cents ? `${t.paySetup.bonusShort} ${f.money(p.bonus_per_km_cents, p.currency)} / km` : null,
      p.bonus_trip_bps ? `${t.paySetup.bonusShort} ${f.decimal(p.bonus_trip_bps / 100, 1)} %` : null,
      p.allowance_rule_set_id
        ? `${t.paySetup.allowanceShort}: ${allowanceSets.find((s) => s.id === p.allowance_rule_set_id)?.name ?? '—'}`
        : null,
    ]
      .filter(Boolean)
      .join(' · ');

  /*
   * Предупреждения формы — без сумм: модель, страна компании и законность
   * выбранных наборов. «Только за км» — для стран ЕС/ЕЭЗ.
   */
  /* Валюта ставки: у TES — валюта набора, иначе — компании (как в savePayProfileAction). */
  const bonusCurrency = (model === 'TES' ? sets.find((s) => s.id === setId)?.currency : null) ?? f.currency;
  const money = (cents: number | null | undefined) => (cents ? (cents / 100).toFixed(2).replace('.', ',') : '');
  const tesLegality =
    model === 'TES'
      ? asLegality(sets.find((s) => s.id === setId)?.legality)
      : isAgreed(model) && paperId
        ? asLegality(sets.find((s) => s.id === paperId)?.legality)
        : 'LEGAL';
  const allowanceLegality = asLegality(allowanceSets.find((s) => s.id === allowanceId)?.legality);
  const warnings = wageWarnings({ model, country, legality: tesLegality, currency: f.currency }).filter(
    (w) => w.code !== 'OUTPUT_PAY' || inEea(country),
  );
  const warningTexts = [
    ...warnings.map((w) =>
      w.code === 'OUTPUT_PAY' ? t.paySetup.warnOutput : w.code === 'LEGALITY' ? t.paySetup.warnLegality[w.level] : null,
    ),
    allowanceLegality !== 'LEGAL' ? t.paySetup.warnAllowanceLegality[allowanceLegality] : null,
  ].filter((text): text is string => Boolean(text));

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
          <form {...keepFormAction} action={formAction} className="grid gap-4 sm:grid-cols-2">
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
              <Field label={f.label(t.pay.hourly)} required>
                {(p) => <InputMono {...p} name="hourly" required inputMode="decimal" placeholder="18,50" />}
              </Field>
            )}

            {model === 'PER_KM' && (
              <Field label={f.label(t.pay.perKm)} required>
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

            {/* Договорённость «на руки» — в валюте компании (как пишет savePayProfileAction). */}
            {model === 'DAY_NET' && (
              <>
                <Field label={f.label(t.agreed.dayAmount)} required={countryRows.length === 0}>
                  {(p) => (
                    <InputMono
                      {...p}
                      name="agreed_day"
                      required={countryRows.length === 0}
                      inputMode="decimal"
                      placeholder="120,00"
                      defaultValue={money(lastAgreed?.agreed_day_cents)}
                    />
                  )}
                </Field>
                <Field label={t.agreed.dayBasis} required>
                  {(p) => (
                    <Select {...p} name="agreed_day_basis" defaultValue={asBasis(lastAgreed?.agreed_day_basis)}>
                      {BASES.map((b) => (
                        <option key={b} value={b}>
                          {t.agreed.basis[b]}
                        </option>
                      ))}
                    </Select>
                  )}
                </Field>
                <Field label={f.label(t.agreed.homeDay)} hint={t.agreed.homeDayHint}>
                  {(p) => (
                    <InputMono
                      {...p}
                      name="agreed_home_day"
                      inputMode="decimal"
                      defaultValue={
                        lastAgreed?.agreed_home_day_cents != null ? money(lastAgreed.agreed_home_day_cents) || '0' : ''
                      }
                    />
                  )}
                </Field>
                <fieldset className="sm:col-span-2">
                  <legend className="label-micro mb-1.5">{t.agreed.countryRates}</legend>
                  <p className="mb-2 text-xs text-ink-dim">{t.agreed.countryRatesHint}</p>
                  <input type="hidden" name="agreed_country_rates" value={countryRatesJson} />
                  <div className="flex flex-col gap-2">
                    {countryRows.map((r) => (
                      <div key={r.key} className="grid grid-cols-[5rem_1fr_auto] items-end gap-2 sm:max-w-md">
                        <Field label={t.agreed.rateCountry}>
                          {(p) => (
                            <Input
                              {...p}
                              value={r.country}
                              maxLength={2}
                              onChange={(e) => patchRow(r.key, { country: e.target.value.toUpperCase() })}
                            />
                          )}
                        </Field>
                        <Field label={f.label(`${t.agreed.rateAmount}, €`)}>
                          {(p) => (
                            <InputMono
                              {...p}
                              value={r.amount}
                              inputMode="decimal"
                              onChange={(e) => patchRow(r.key, { amount: e.target.value })}
                            />
                          )}
                        </Field>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setCountryRows((list) => list.filter((x) => x.key !== r.key))}
                        >
                          {t.agreed.removeCountry}
                        </Button>
                      </div>
                    ))}
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    className="mt-2"
                    onClick={() => {
                      setCountryRows((list) => [...list, { key: nextRowKey, country: '', amount: '' }]);
                      setNextRowKey((k) => k + 1);
                    }}
                  >
                    {t.agreed.addCountry}
                  </Button>
                </fieldset>
              </>
            )}

            {model === 'MONTHLY_NET' && (
              <Field label={f.label(t.agreed.monthly)} required>
                {(p) => (
                  <InputMono
                    {...p}
                    name="agreed_monthly"
                    required
                    inputMode="decimal"
                    placeholder="3000,00"
                    defaultValue={money(lastAgreed?.agreed_monthly_cents)}
                  />
                )}
              </Field>
            )}

            {model === 'PER_TRIP' && (
              <Field label={f.label(t.agreed.trip)} required>
                {(p) => (
                  <InputMono
                    {...p}
                    name="agreed_trip"
                    required
                    inputMode="decimal"
                    placeholder="2000,00"
                    defaultValue={money(lastAgreed?.agreed_trip_cents)}
                  />
                )}
              </Field>
            )}

            {/* Законная схема для договорённости: оклад по бумагам из набора правил и водитель из третьей страны. */}
            {isAgreed(model) && (
              <>
                <Field label={t.agreed.paperSet} hint={t.agreed.paperSetHint}>
                  {(p) => (
                    <Select {...p} name="tes_rule_set_id" value={paperId} onChange={(e) => setPaperId(e.target.value)}>
                      <option value="">{t.agreed.paperNone}</option>
                      {sets.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} · {f.date(`${s.valid_from}T12:00:00Z`)}
                        </option>
                      ))}
                    </Select>
                  )}
                </Field>
                <label className="flex items-start gap-2 self-end text-[13px]">
                  <input
                    type="checkbox"
                    name="third_country_driver"
                    defaultChecked={lastAgreed?.third_country_driver === true}
                    className="mt-0.5 size-4 accent-accent"
                  />
                  <span>
                    {t.agreed.thirdCountry}
                    <span className="block text-xs text-ink-dim">{t.agreed.thirdCountryHint}</span>
                  </span>
                </label>
              </>
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

            {/* Премии поверх часов или оклада — в валюте ставки. */}
            {withBonus(model) && (
              <>
                <Field label={f.label(t.paySetup.bonusPerKm, bonusCurrency)} hint={t.paySetup.bonusHint}>
                  {(p) => (
                    <InputMono
                      {...p}
                      name="bonus_per_km"
                      inputMode="decimal"
                      placeholder="0,05"
                      defaultValue={money(profiles[0]?.bonus_per_km_cents)}
                    />
                  )}
                </Field>
                <Field label={t.paySetup.bonusTrip} hint={t.paySetup.bonusHint}>
                  {(p) => (
                    <InputMono
                      {...p}
                      name="bonus_trip_percent"
                      inputMode="decimal"
                      placeholder="5"
                      defaultValue={
                        profiles[0]?.bonus_trip_bps ? String(profiles[0].bonus_trip_bps / 100).replace('.', ',') : ''
                      }
                    />
                  )}
                </Field>
              </>
            )}

            <Field label={t.paySetup.allowanceSet} className="sm:col-span-2">
              {(p) => (
                <Select
                  {...p}
                  name="allowance_rule_set_id"
                  value={allowanceId}
                  onChange={(e) => setAllowanceId(e.target.value)}
                >
                  <option value="">{t.paySetup.allowanceNone}</option>
                  {allowanceSets.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} · {f.date(`${s.valid_from}T12:00:00Z`)}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            {allowanceSets.length === 0 && (
              <p className="-mt-2 text-xs text-ink-dim sm:col-span-2">
                {t.paySetup.noAllowances}{' '}
                <Link href={`/${locale}/carrier/drivers/allowances`} className="underline">
                  {t.allowanceSetup.title}
                </Link>
              </p>
            )}

            {warningTexts.length > 0 && (
              <div className="flex flex-col gap-1.5 sm:col-span-2">
                {warningTexts.map((text) => (
                  <p
                    key={text}
                    role="note"
                    className="rounded-control border border-warn/35 bg-warn/10 px-3 py-2 text-[13px] text-warn"
                  >
                    {text}
                  </p>
                ))}
              </div>
            )}

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

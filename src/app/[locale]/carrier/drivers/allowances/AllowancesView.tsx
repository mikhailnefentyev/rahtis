'use client';

import { useActionState, useCallback, useEffect, useState } from 'react';
import { Button, Card, CardBody, EmptyState, Field, Input, InputMono, Select } from '@/components/ui';
import {
  copyAllowanceTemplateAction,
  deleteAllowanceAction,
  saveAllowanceAction,
  type FormState,
} from '@/lib/drivers/actions';
import { useI18n } from '@/lib/i18n/provider';
import { COUNTRY_CODES } from '@/lib/country';
import { CURRENCIES } from '@/lib/money/currency';
import type { AllowanceRateRow, AllowanceRuleSet } from '@/types/db';
import { useKeepOnError } from '@/lib/forms/keepOnError';
import { byCountry, CountryLabel, LegalityBadge, SourceNote, useCountryName } from '../payCountry';

const initial: FormState = { error: null, done: false };

const RULES = ['PL_DOMESTIC', 'PL_INTERNATIONAL', 'EE_ABROAD', 'LV_TRIP', 'LT_ABROAD', 'GENERIC'] as const;
type Rule = (typeof RULES)[number];
const asRule = (value: string): Rule => (RULES as readonly string[]).includes(value) ? (value as Rule) : 'GENERIC';

type Params = Record<string, unknown>;
const paramsOf = (s: AllowanceRuleSet | null): Params =>
  s?.params && typeof s.params === 'object' && !Array.isArray(s.params) ? (s.params as Params) : {};
const numOf = (p: Params, key: string): number | null => {
  const n = typeof p[key] === 'number' ? (p[key] as number) : Number(p[key]);
  return p[key] == null || !Number.isFinite(n) ? null : n;
};

/* Центы и б.п. — в поля формы, как их пишут люди: «45,00», «70». */
const money = (cents: number | null) => (cents == null ? '' : (cents / 100).toFixed(2).replace('.', ','));
const percent = (bps: number | null) => (bps == null ? '' : String(bps / 100).replace('.', ','));

/**
 * Наборы суточных по странам.
 *
 * Шаблоны оператора — по правилам страны работодателя: польская диета и
 * надбавка за границу (с 2022 — зарплата), эстонская päevaraha 75/40,
 * латвийский потолок 70 %, литовские 1,65 МЗП / 50 %, шведские и датские
 * ставки. Шаблоны страны компании — первыми. Копия — со ставками по
 * странам; свой набор правится целиком, ставки — таблицей.
 */
export function AllowancesView({
  own,
  templates,
  rates,
  home,
}: {
  own: AllowanceRuleSet[];
  templates: AllowanceRuleSet[];
  rates: AllowanceRateRow[];
  home: string;
}) {
  const { t, f, locale } = useI18n();
  const countryName = useCountryName();
  const [editing, setEditing] = useState<AllowanceRuleSet | null | 'new'>(null);
  const close = useCallback(() => setEditing(null), []);

  const ratesOf = (id: string) => rates.filter((r) => r.rule_set_id === id);
  const groups = byCountry(templates, home, countryName);
  const a = t.allowanceSetup;

  /* Параметры правила одной строкой. */
  const describe = (s: AllowanceRuleSet) => {
    const p = paramsOf(s);
    const m = (key: string, cur: string) => (numOf(p, key) == null ? null : f.money(numOf(p, key)!, cur));
    const pc = (key: string) => (numOf(p, key) == null ? null : `${f.decimal(numOf(p, key)! / 100, 0)} %`);
    const parts: Array<string | null> = [];
    switch (asRule(s.rule)) {
      case 'PL_DOMESTIC':
        parts.push(
          m('day_cents', s.currency) && `${a.dayShort} ${m('day_cents', s.currency)}`,
          m('lodging_cents', s.currency) && `${a.lodgingShort} ${m('lodging_cents', s.currency)}`,
          p.cab_lodging === true ? a.cabLodging : null,
        );
        break;
      case 'PL_INTERNATIONAL': {
        const cur = p.day_currency === 'PLN' ? 'PLN' : 'EUR';
        parts.push(
          m('day_cents', cur) && `${a.dayShort} ${m('day_cents', cur)}`,
          m('pit_relief_cents', 'EUR') && `PIT ${m('pit_relief_cents', 'EUR')}`,
          m('zus_relief_cents', 'EUR') && `ZUS ${m('zus_relief_cents', 'EUR')}`,
        );
        break;
      }
      case 'EE_ABROAD':
        parts.push(
          m('first_cents', s.currency) &&
            `${numOf(p, 'first_days') ?? 15} × ${m('first_cents', s.currency)}`,
          m('later_cents', s.currency) && `${a.laterShort} ${m('later_cents', s.currency)}`,
        );
        break;
      case 'LV_TRIP':
        parts.push(pc('cap_bps') && `≤ ${pc('cap_bps')}`);
        break;
      case 'LT_ABROAD':
        parts.push(
          numOf(p, 'coef_bps') != null ? `${f.decimal(numOf(p, 'coef_bps')! / 10_000, 2)} × ${m('mma_cents', s.currency) ?? '—'}` : null,
          pc('half_bps') && `${a.halfShort} ${pc('half_bps')}`,
        );
        break;
      case 'GENERIC':
        break;
    }
    return [a.rules[asRule(s.rule)], ...parts].filter(Boolean).join(' · ');
  };

  const body = (s: AllowanceRuleSet) => (
    <div className="min-w-0">
      <p className="flex flex-wrap items-center gap-2 text-[13px] font-semibold">
        <span>
          {s.name} · {f.date(`${s.valid_from}T12:00:00Z`)}
        </span>
        <LegalityBadge legality={s.legality} />
      </p>
      <p className="mt-1 text-xs text-ink-faint">
        <CountryLabel code={s.country} /> · {s.currency}
      </p>
      <p className="mt-1 text-xs text-ink-muted">{describe(s)}</p>
      <SourceNote note={s.source_note} />
      <RatesList rates={ratesOf(s.id)} />
    </div>
  );

  const templateCard = (s: AllowanceRuleSet) => (
    <Card key={s.id}>
      <CardBody className="flex flex-wrap items-start justify-between gap-3">
        {body(s)}
        <form action={copyAllowanceTemplateAction}>
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="id" value={s.id} />
          <Button type="submit" size="sm">
            {a.copy}
          </Button>
        </form>
      </CardBody>
    </Card>
  );

  return (
    <div className="flex flex-col gap-8">
      <section>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-line pb-2">
          <h2 className="text-[13px] font-semibold tracking-tight text-ink-faint">{a.own}</h2>
          {editing === null && (
            <Button variant="primary" size="sm" onClick={() => setEditing('new')}>
              {a.add}
            </Button>
          )}
        </div>

        {editing !== null && (
          <div className="mb-4">
            <AllowanceForm
              key={editing === 'new' ? 'new' : editing.id}
              set={editing === 'new' ? null : editing}
              rates={editing === 'new' ? [] : ratesOf(editing.id)}
              home={home}
              onClose={close}
            />
          </div>
        )}

        {own.length === 0 && editing === null ? (
          <EmptyState title={a.none} />
        ) : (
          <div className="flex flex-col gap-2">
            {own.map((s) => (
              <Card key={s.id}>
                <CardBody className="flex flex-wrap items-start justify-between gap-3">
                  {body(s)}
                  <div className="flex gap-1.5">
                    <Button size="sm" onClick={() => setEditing(s)}>
                      {t.drivers.edit}
                    </Button>
                    <DeleteAllowance id={s.id} />
                  </div>
                </CardBody>
              </Card>
            ))}
          </div>
        )}
      </section>

      {templates.length > 0 && (
        <section>
          <h2 className="mb-4 border-b border-line pb-2 text-[13px] font-semibold tracking-tight text-ink-faint">
            {a.templates}
          </h2>
          {groups.home.length > 0 ? (
            <>
              <h3 className="label-micro mb-2">
                <CountryLabel code={home} />
              </h3>
              <div className="flex flex-col gap-2">{groups.home.map(templateCard)}</div>
            </>
          ) : (
            <p className="mb-2 text-xs text-ink-dim">{t.paySetup.noHomeTemplates}</p>
          )}
          {groups.others.length > 0 && (
            <details className="mt-6">
              <summary className="cursor-pointer text-[13px] font-semibold text-ink-muted">
                {t.paySetup.otherCountries} ({groups.others.map(([code]) => code).join(', ')})
              </summary>
              <div className="mt-3 flex flex-col gap-5">
                {groups.others.map(([code, list]) => (
                  <div key={code}>
                    <h3 className="label-micro mb-2">
                      <CountryLabel code={code} />
                    </h3>
                    <div className="flex flex-col gap-2">{list.map(templateCard)}</div>
                  </div>
                ))}
              </div>
            </details>
          )}
        </section>
      )}
    </div>
  );
}

/** Ставки по странам поездки — свёрнутой таблицей. */
function RatesList({ rates }: { rates: AllowanceRateRow[] }) {
  const { t, f } = useI18n();
  const name = useCountryName();
  if (rates.length === 0) return null;
  return (
    <details className="mt-2">
      <summary className="cursor-pointer text-xs font-semibold text-ink-muted">
        {t.allowanceSetup.rates} ({rates.length})
      </summary>
      <div className="mt-2 overflow-x-auto">
        <table className="text-xs">
          <thead>
            <tr className="text-left text-ink-faint">
              <th className="py-1 pr-4 font-medium">{t.allowanceSetup.rateCountry}</th>
              <th className="py-1 pr-3 text-right font-medium">{t.allowanceSetup.rateDay}</th>
              <th className="py-1 pr-3 text-right font-medium">{t.allowanceSetup.rateHotel}</th>
            </tr>
          </thead>
          <tbody>
            {rates.map((r) => (
              <tr key={r.country} className="border-t border-line">
                <td className="py-1 pr-4">{name(r.country)}</td>
                <td className="py-1 pr-3 text-right font-mono">{f.money(r.day_cents, r.currency)}</td>
                <td className="py-1 pr-3 text-right font-mono">
                  {r.hotel_limit_cents == null ? '—' : f.money(r.hotel_limit_cents, r.currency)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

function DeleteAllowance({ id }: { id: string }) {
  const { t, locale } = useI18n();
  const [state, action, pending] = useActionState(deleteAllowanceAction, initial);
  const keepAction = useKeepOnError(state);

  return (
    <form {...keepAction} action={action} className="flex flex-col items-end gap-1">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="id" value={id} />
      <Button type="submit" size="sm" variant="danger" disabled={pending}>
        {t.allowanceSetup.delete}
      </Button>
      {state.error && <span className="max-w-60 text-right text-xs text-danger">{state.error}</span>}
    </form>
  );
}

type RateDraft = { key: number; country: string; currency: string; day: string; hotel: string };

function AllowanceForm({
  set,
  rates,
  home,
  onClose,
}: {
  set: AllowanceRuleSet | null;
  rates: AllowanceRateRow[];
  home: string;
  onClose: () => void;
}) {
  const { t, f, locale } = useI18n();
  const a = t.allowanceSetup;
  const countryName = useCountryName();
  const p = paramsOf(set);
  const [rule, setRule] = useState<Rule>(asRule(set?.rule ?? 'GENERIC'));
  const [currency, setCurrency] = useState<string>(set?.currency ?? f.currency);
  const [dayCurrency, setDayCurrency] = useState<string>(p.day_currency === 'PLN' ? 'PLN' : 'EUR');
  const country = set?.country ?? home;
  const countries = [...new Set([country, ...COUNTRY_CODES])];

  const [rows, setRows] = useState<RateDraft[]>(() =>
    rates.map((r, i) => ({
      key: i,
      country: r.country,
      currency: r.currency,
      day: money(r.day_cents),
      hotel: money(r.hotel_limit_cents),
    })),
  );
  const [nextKey, setNextKey] = useState(rates.length);
  const patch = (key: number, change: Partial<RateDraft>) =>
    setRows((list) => list.map((r) => (r.key === key ? { ...r, ...change } : r)));

  const [state, formAction, pending] = useActionState(saveAllowanceAction, initial);
  const keepFormAction = useKeepOnError(state);

  useEffect(() => {
    if (state.done) onClose();
  }, [state.done, onClose]);

  const ratesJson = JSON.stringify(
    rows.map((r) => ({ country: r.country.trim().toUpperCase(), currency: r.currency, day: r.day, hotel: r.hotel })),
  );

  return (
    <Card stripe="info">
      <CardBody>
        <form {...keepFormAction} action={formAction} className="grid gap-4 sm:grid-cols-2">
          <input type="hidden" name="locale" value={locale} />
          {set && <input type="hidden" name="id" value={set.id} />}
          <input type="hidden" name="rates" value={ratesJson} />

          <Field label={a.name} required>
            {(fp) => <Input {...fp} name="name" required maxLength={120} defaultValue={set?.name ?? ''} />}
          </Field>
          <Field label={a.validFrom} required>
            {(fp) => <Input {...fp} type="date" name="valid_from" required defaultValue={set?.valid_from ?? ''} />}
          </Field>

          <Field label={a.country} required>
            {(fp) => (
              <Select {...fp} name="country" defaultValue={country}>
                {countries.map((code) => (
                  <option key={code} value={code}>
                    {countryName(code)}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label={a.currency} required>
            {(fp) => (
              <Select {...fp} name="currency" value={currency} onChange={(e) => setCurrency(e.target.value)}>
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
            )}
          </Field>

          <Field label={a.rule} hint={a.ruleHints[rule]} required className="sm:col-span-2">
            {(fp) => (
              <Select {...fp} name="rule" value={rule} onChange={(e) => setRule(asRule(e.target.value))}>
                {RULES.map((code) => (
                  <option key={code} value={code}>
                    {a.rules[code]}
                  </option>
                ))}
              </Select>
            )}
          </Field>

          {rule === 'PL_DOMESTIC' && (
            <>
              <Field label={f.label(a.day, currency)}>
                {(fp) => (
                  <InputMono {...fp} name="day" inputMode="decimal" defaultValue={money(numOf(p, 'day_cents'))} />
                )}
              </Field>
              <Field label={f.label(a.lodging, currency)}>
                {(fp) => (
                  <InputMono {...fp} name="lodging" inputMode="decimal" defaultValue={money(numOf(p, 'lodging_cents'))} />
                )}
              </Field>
              <label className="flex items-center gap-2 text-[13px] sm:col-span-2">
                <input type="checkbox" name="cab_lodging" defaultChecked={p.cab_lodging === true} />
                {a.cabLodging}
              </label>
            </>
          )}

          {rule === 'PL_INTERNATIONAL' && (
            <>
              <Field label={f.label(a.day, dayCurrency)}>
                {(fp) => (
                  <InputMono {...fp} name="day" inputMode="decimal" defaultValue={money(numOf(p, 'day_cents'))} />
                )}
              </Field>
              <Field label={a.dayCurrency}>
                {(fp) => (
                  <Select
                    {...fp}
                    name="day_currency"
                    value={dayCurrency}
                    onChange={(e) => setDayCurrency(e.target.value)}
                  >
                    <option value="EUR">EUR</option>
                    <option value="PLN">PLN</option>
                  </Select>
                )}
              </Field>
              <Field label={f.label(a.pitRelief, 'EUR')}>
                {(fp) => (
                  <InputMono
                    {...fp}
                    name="pit_relief"
                    inputMode="decimal"
                    defaultValue={money(numOf(p, 'pit_relief_cents') ?? 2000)}
                  />
                )}
              </Field>
              <Field label={f.label(a.zusRelief, 'EUR')}>
                {(fp) => (
                  <InputMono
                    {...fp}
                    name="zus_relief"
                    inputMode="decimal"
                    defaultValue={money(numOf(p, 'zus_relief_cents') ?? 6000)}
                  />
                )}
              </Field>
            </>
          )}

          {rule === 'EE_ABROAD' && (
            <>
              <Field label={a.firstDays}>
                {(fp) => (
                  <InputMono
                    {...fp}
                    name="first_days"
                    inputMode="numeric"
                    defaultValue={String(numOf(p, 'first_days') ?? 15)}
                  />
                )}
              </Field>
              <div />
              <Field label={f.label(a.first, currency)}>
                {(fp) => (
                  <InputMono {...fp} name="first" inputMode="decimal" defaultValue={money(numOf(p, 'first_cents') ?? 7500)} />
                )}
              </Field>
              <Field label={f.label(a.later, currency)}>
                {(fp) => (
                  <InputMono {...fp} name="later" inputMode="decimal" defaultValue={money(numOf(p, 'later_cents') ?? 4000)} />
                )}
              </Field>
            </>
          )}

          {rule === 'LV_TRIP' && (
            <Field label={a.capPct}>
              {(fp) => (
                <InputMono {...fp} name="cap_pct" inputMode="decimal" defaultValue={percent(numOf(p, 'cap_bps') ?? 7000)} />
              )}
            </Field>
          )}

          {rule === 'LT_ABROAD' && (
            <>
              <Field label={a.coef}>
                {(fp) => (
                  <InputMono
                    {...fp}
                    name="coef"
                    inputMode="decimal"
                    defaultValue={String((numOf(p, 'coef_bps') ?? 16500) / 10_000).replace('.', ',')}
                  />
                )}
              </Field>
              <Field label={f.label(a.mma, currency)}>
                {(fp) => (
                  <InputMono {...fp} name="mma" inputMode="decimal" defaultValue={money(numOf(p, 'mma_cents') ?? 115300)} />
                )}
              </Field>
              <Field label={a.halfPct}>
                {(fp) => (
                  <InputMono
                    {...fp}
                    name="half_pct"
                    inputMode="decimal"
                    defaultValue={percent(numOf(p, 'half_bps') ?? 5000)}
                  />
                )}
              </Field>
            </>
          )}

          {/* Ставки по странам поездки: нужны правилам LV, LT и «по стране»; польской диете и Эстонии — нет. */}
          <fieldset className="sm:col-span-2">
            <legend className="label-micro mb-1.5">{a.rates}</legend>
            <p className="mb-2 text-xs text-ink-dim">{a.ratesHint}</p>
            {rows.length === 0 && <p className="mb-2 text-xs text-ink-faint">{a.noRates}</p>}
            <div className="flex flex-col gap-2">
              {rows.map((r) => (
                <div key={r.key} className="grid grid-cols-2 items-end gap-2 sm:grid-cols-[1fr_6rem_7rem_7rem_auto]">
                  <Field label={a.rateCountry}>
                    {(fp) => (
                      <Input
                        {...fp}
                        value={r.country}
                        maxLength={2}
                        list="allowance-countries"
                        onChange={(e) => patch(r.key, { country: e.target.value.toUpperCase() })}
                      />
                    )}
                  </Field>
                  <Field label={a.rateCurrency}>
                    {(fp) => (
                      <Select {...fp} value={r.currency} onChange={(e) => patch(r.key, { currency: e.target.value })}>
                        {CURRENCIES.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </Select>
                    )}
                  </Field>
                  <Field label={a.rateDay}>
                    {(fp) => (
                      <InputMono
                        {...fp}
                        value={r.day}
                        inputMode="decimal"
                        onChange={(e) => patch(r.key, { day: e.target.value })}
                      />
                    )}
                  </Field>
                  <Field label={a.rateHotel}>
                    {(fp) => (
                      <InputMono
                        {...fp}
                        value={r.hotel}
                        inputMode="decimal"
                        onChange={(e) => patch(r.key, { hotel: e.target.value })}
                      />
                    )}
                  </Field>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setRows((list) => list.filter((x) => x.key !== r.key))}
                  >
                    {a.removeRate}
                  </Button>
                </div>
              ))}
            </div>
            <datalist id="allowance-countries">
              {COUNTRY_CODES.map((code) => (
                <option key={code} value={code}>
                  {countryName(code)}
                </option>
              ))}
            </datalist>
            <Button
              type="button"
              size="sm"
              className="mt-2"
              onClick={() => {
                setRows((list) => [...list, { key: nextKey, country: '', currency, day: '', hotel: '' }]);
                setNextKey((k) => k + 1);
              }}
            >
              {a.addRate}
            </Button>
          </fieldset>

          {state.error && (
            <p role="alert" className="text-[13px] text-danger sm:col-span-2">
              {state.error}
            </p>
          )}

          <div className="flex gap-2 sm:col-span-2">
            <Button type="button" onClick={onClose} className="flex-1">
              {t.action.cancel}
            </Button>
            <Button type="submit" variant="primary" disabled={pending} className="flex-[2]">
              {a.save}
            </Button>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}

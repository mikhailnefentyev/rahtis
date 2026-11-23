/*
 * Версия договора в сделке (24.11.2026): выбор версии для печати, реестр
 * версий у каждого шаблона, сборщик у каждой версии и та же текущая версия в
 * базе (app.installment_contract_current). Запуск: npm test.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { INSTALLMENT_COUNTRIES, openInstallmentCountries } from './countries.ts';
import { COUNTRY_CONTRACT_VERSIONS, COUNTRY_CONTRACTS } from './contractText/index.ts';
import {
  CONTRACT_TEMPLATE_VERSIONS,
  contractVersionKnown,
  currentContractVersion,
  dealContractVersion,
  templateOfVersion,
} from './contractVersions.ts';

const MIGRATION = new URL('../../../supabase/migrations/20261203100000_installment_versions_default_steps.sql', import.meta.url);

test('у каждого шаблона из реестра стран есть версии, текущая — последняя; первая версия всех — 2026-11-23', () => {
  for (const code of openInstallmentCountries()) {
    const template = INSTALLMENT_COUNTRIES[code].contract;
    const list = CONTRACT_TEMPLATE_VERSIONS[template];
    assert.ok(list?.length >= 1, `${code}: нет версий шаблона ${template}`);
    assert.equal(list[0], '2026-11-23');
    assert.equal(currentContractVersion(template), `${template}@${list[list.length - 1]}`);
    assert.equal(templateOfVersion(currentContractVersion(template)), template);
  }
});

test('у каждой версии шаблона страны есть сборщик текста; версия 2026-11-23 — тот же текст, что был', () => {
  for (const [template, list] of Object.entries(CONTRACT_TEMPLATE_VERSIONS)) {
    if (template === 'FI_OSAMAKSU') continue;
    for (const v of list) assert.ok(COUNTRY_CONTRACT_VERSIONS[`${template}@${v}`], `${template}@${v}: нет сборщика`);
    assert.equal(COUNTRY_CONTRACT_VERSIONS[`${template}@2026-11-23`].build, COUNTRY_CONTRACTS[template].build);
  }
});

test('выбор версии: записанная — всегда она, даже если шаблон страны сменился; без записи — текущая; неизвестная — null', () => {
  assert.equal(dealContractVersion({ contract_template: 'EE_JARELMAKS', contract_version: '2026-11-23' }, 'EE_JARELMAKS'), 'EE_JARELMAKS@2026-11-23');
  /* Страна сменила шаблон после согласия — печатается записанный. */
  assert.equal(dealContractVersion({ contract_template: 'EE_JARELMAKS', contract_version: '2026-11-23' }, 'LV_NOMAKSA'), 'EE_JARELMAKS@2026-11-23');
  assert.equal(dealContractVersion({}, 'FI_OSAMAKSU'), currentContractVersion('FI_OSAMAKSU'));
  assert.equal(dealContractVersion({ contract_template: null, contract_version: null }, 'PL_RATY'), currentContractVersion('PL_RATY'));
  assert.equal(dealContractVersion({ contract_template: 'EE_JARELMAKS', contract_version: '2099-01-01' }, 'EE_JARELMAKS'), null);
  assert.equal(dealContractVersion({ contract_template: 'XX', contract_version: '2026-11-23' }, 'FI_OSAMAKSU'), null);
  assert.equal(dealContractVersion({ contract_template: 'EE_JARELMAKS', contract_version: null }, 'EE_JARELMAKS'), null);
  assert.equal(dealContractVersion({}, null), null);
  assert.equal(contractVersionKnown('SE_AVBETALNING', '2026-11-23'), true);
  assert.equal(contractVersionKnown('SE_AVBETALNING', '2026-11-24'), false);
});

test('база: текущая версия шаблона каждой страны та же, что в коде; согласие и перенос старых сделок записывают версию', () => {
  const sql = readFileSync(MIGRATION, 'utf8');
  const fn = sql.slice(sql.indexOf('create or replace function app.installment_contract_current'), sql.indexOf('revoke all on function app.installment_contract_current'));
  const pairs = [...fn.matchAll(/when '([A-Z]{2})' then '([A-Z_]+@[\d-]+)'/g)].map((m) => [m[1], m[2]]);
  const expected = Object.entries(INSTALLMENT_COUNTRIES)
    .filter(([, e]) => e.contract)
    .map(([code, e]) => [code, currentContractVersion(e.contract)]);
  assert.deepEqual(Object.fromEntries(pairs), Object.fromEntries(expected));
  const accept = sql.slice(sql.indexOf('create or replace function public.accept_installment_terms'));
  assert.match(accept, /contract_template = split_part\(v_contract, '@', 1\)/);
  assert.match(accept, /contract_version = split_part\(v_contract, '@', 2\)/);
  assert.match(sql, /update public\.installment_deals d\s+set contract_template/);
  assert.match(sql, /security definer\s+set search_path = ''/);
  assert.doesNotMatch(sql, /end case/i);
});

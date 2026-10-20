/**
 * Разбор ответа VIES в вердикт для оператора — чистые функции без импортов,
 * чтобы их проверял node --test (vies.test.mjs). Запрос — в vies.ts.
 *
 * Сверка названий (matchName из prh.ts) передаётся параметром: модуль без
 * импортов, а тест подставляет настоящую сверку.
 */
import type { RegistryCheck } from './prh';

type MatchName = (applied: string, registered: string[]) => RegistryCheck['nameMatch'];

export type ViesResponse = {
  isValid?: boolean;
  userError?: string;
  name?: string;
  address?: string;
};

const empty = (s: string | undefined) => !s || s.trim() === '' || s.trim() === '---';

export function base(): Omit<RegistryCheck, 'verdict' | 'issues'> {
  return {
    checkedAt: new Date().toISOString(),
    officialName: null,
    form: null,
    registeredOn: null,
    nameMatch: null,
    situations: [],
    tradeRegister: null,
    prepayment: null,
    vat: null,
    employer: null,
  };
}

/** Ответ VIES → вердикт для оператора. */
export function evaluateVies(appliedName: string, vatNumber: string, r: ViesResponse, match: MatchName): RegistryCheck {
  if (r.isValid !== true && r.userError && r.userError !== 'INVALID' && r.userError !== 'VALID') {
    return { ...base(), verdict: 'ERROR', issues: [`VIES ei vastannut (${r.userError}). Tarkista ALV-numero ${vatNumber} VIES-palvelusta.`] };
  }
  if (r.isValid !== true) {
    return { ...base(), verdict: 'NOT_FOUND', vat: false, issues: [`ALV-numeroa ${vatNumber} ei löydy VIES-rekisteristä tai se ei ole voimassa.`] };
  }
  const officialName = empty(r.name) ? null : r.name!.trim().replace(/\s+/g, ' ');
  const nameMatch = officialName ? match(appliedName, [officialName]) : null;
  const issues: string[] = [];
  if (!officialName) issues.push('VIES ei kerro tämän maan yritysten nimiä. Tarkista nimi maan kaupparekisteristä.');
  else if (nameMatch === 'DIFFERENT') issues.push(`Hakemuksen nimi poikkeaa VIES-rekisterin nimestä (${officialName}).`);
  else if (nameMatch === 'SIMILAR') issues.push(`Nimi on lähellä VIES-rekisterin nimeä (${officialName}), mutta ei sama.`);
  return { ...base(), verdict: nameMatch === 'EXACT' ? 'OK' : 'ATTENTION', officialName, nameMatch, vat: true, issues };
}

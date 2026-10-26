/**
 * Сверка норвежской заявки с Enhetsregisteret (Brønnøysund), открытый API
 * без ключа. Разбор — brregVerdict.ts. Никогда не бросает: реестр
 * недоступен — заявка принимается, оператор видит ERROR.
 */
import { matchName, type RegistryCheck } from './prh';
import { evaluateBrreg, type BrregEnhet } from './brregVerdict';
import { base } from './viesVerdict';

const API = 'https://data.brreg.no/enhetsregisteret/api/enheter';

export async function checkBrreg(orgnr: string, appliedName: string): Promise<RegistryCheck> {
  try {
    const response = await fetch(`${API}/${encodeURIComponent(orgnr)}`, {
      signal: AbortSignal.timeout(8000),
      headers: { accept: 'application/json' },
      cache: 'no-store',
    });
    /* 404 — номера нет, 410 — компания удалена из реестра. */
    if (response.status === 404 || response.status === 410) return evaluateBrreg(appliedName, orgnr, null, matchName);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return evaluateBrreg(appliedName, orgnr, (await response.json()) as BrregEnhet, matchName);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    console.error(`brreg ${orgnr}: ${reason}`);
    return {
      ...base(),
      verdict: 'ERROR',
      issues: [`Norjan yritysrekisteri ei vastannut (${reason}). Tarkista yritys: https://virksomhet.brreg.no/oppslag/enheter/${orgnr}`],
    };
  }
}

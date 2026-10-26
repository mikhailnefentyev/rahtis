/**
 * Разбор ответа норвежского Enhetsregisteret (Brønnøysund) в вердикт для
 * оператора — чистая функция без импортов значений, её проверяет
 * node --test (brreg.test.mjs). Запрос — в brreg.ts.
 *
 * Норвегия не в ЕС, и VIES её не знает: до 26.10.2026 норвежская заявка
 * приходила без проверки вовсе. Открытый API отдаёт название, форму,
 * регистрацию в MVA (норвежский НДС), банкротство и ликвидацию.
 *
 * Тексты замечаний по-фински: письмо и админка оператора финские.
 */
import type { RegistryCheck } from './prh';

/* Своя заготовка, а не из viesVerdict: модуль без импортов значений — его грузит node --test. */
function base(): Omit<RegistryCheck, 'verdict' | 'issues'> {
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

type MatchName = (applied: string, registered: string[]) => RegistryCheck['nameMatch'];

export type BrregEnhet = {
  navn?: string;
  organisasjonsform?: { kode?: string; beskrivelse?: string };
  registreringsdatoEnhetsregisteret?: string;
  registrertIForetaksregisteret?: boolean;
  registrertIMvaregisteret?: boolean;
  konkurs?: boolean;
  underAvvikling?: boolean;
  underTvangsavviklingEllerTvangsopplosning?: boolean;
  slettedato?: string;
};

/** null — компании в реестре нет (404) или она удалена (410). */
export function evaluateBrreg(appliedName: string, orgnr: string, e: BrregEnhet | null, match: MatchName): RegistryCheck {
  if (!e || !e.navn || e.slettedato) {
    return {
      ...base(),
      verdict: 'NOT_FOUND',
      issues: [`Organisasjonsnummeria ${orgnr} ei löydy Norjan yritysrekisteristä (Brønnøysund) tai yritys on poistettu.`],
    };
  }

  const officialName = e.navn.trim().replace(/\s+/g, ' ');
  const nameMatch = match(appliedName, [officialName]);
  const situations = [
    e.konkurs ? 'Konkurssissa' : null,
    e.underAvvikling ? 'Selvitystilassa' : null,
    e.underTvangsavviklingEllerTvangsopplosning ? 'Pakkoselvitystilassa' : null,
  ].filter((s): s is string => s !== null);

  const issues: string[] = [];
  if (nameMatch === 'DIFFERENT') issues.push(`Nimi ei täsmää: rekisterissä ”${officialName}”.`);
  if (nameMatch === 'SIMILAR') issues.push(`Nimi on lähellä mutta ei sama: rekisterissä ”${officialName}”.`);
  for (const s of situations) issues.push(`${s}.`);
  if (e.registrertIMvaregisteret !== true) issues.push('Ei Norjan arvonlisäverorekisterissä (MVA).');

  return {
    ...base(),
    verdict: issues.length === 0 ? 'OK' : 'ATTENTION',
    officialName,
    form: e.organisasjonsform?.beskrivelse ?? null,
    registeredOn: e.registreringsdatoEnhetsregisteret ?? null,
    nameMatch,
    situations,
    tradeRegister: e.registrertIForetaksregisteret ?? null,
    vat: e.registrertIMvaregisteret === true,
    issues,
  };
}

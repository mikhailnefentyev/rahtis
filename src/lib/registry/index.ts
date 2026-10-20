/**
 * Сверка заявки с реестром — по стране компании (src/lib/country).
 *
 * Финляндия — PRH/YTJ (название, ALV, ennakkoperintä, tilaajavastuu).
 * Остальные страны ЕС — VIES по номеру плательщика НДС. Норвегия и прочие
 * без автоматической проверки — оператору замечание и ссылка на реестр.
 * Ни одна ветка не бросает.
 */
import { countryPack, vatNumberFor } from '@/lib/country';
import { checkRegistry as checkPrh, type RegistryCheck } from './prh';
import { checkVies } from './vies';

export type { RegistryCheck } from './prh';

function manual(issue: string): RegistryCheck {
  return {
    verdict: 'ATTENTION',
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
    issues: [issue],
  };
}

export async function checkCompanyRegistry(input: { country: string; businessId: string; vatNumber: string | null; name: string }): Promise<RegistryCheck> {
  const pack = countryPack(input.country);
  if (pack.registry === 'PRH') return checkPrh(input.businessId, input.name);
  if (pack.registry === 'VIES') {
    const vat = input.vatNumber ?? vatNumberFor(pack.code, input.businessId, null);
    if (!vat) return manual(`ALV-numero puuttuu (${pack.code}). Pyydä se hakijalta ja tarkista VIES-palvelusta.`);
    return checkVies(vat, input.name);
  }
  const url = pack.registryUrl?.(input.businessId);
  return manual(`Maalle ${pack.code} ei ole automaattista tarkistusta. Tarkista yritys ${pack.businessId.label} ${input.businessId} maan rekisteristä${url ? `: ${url}` : '.'}`);
}

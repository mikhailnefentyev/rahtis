/**
 * Регистрация перевозчика отходов по странам — что спрашивать и как
 * называть номер в документе. Источники — docs/outreach/waste-integrations.
 * Без импортов: проверяется node --test.
 */

export const REGISTRATION_COUNTRIES = ['FI', 'SE', 'NO', 'DK', 'EE', 'LV', 'LT', 'PL', 'DE'] as const;
export type RegistrationCountry = (typeof REGISTRATION_COUNTRIES)[number];

/** Название регистрации на языке страны — так его ищут в своих бумагах. */
export const REGISTRATION_LABEL: Record<RegistrationCountry, string> = {
  FI: 'Jätehuoltorekisteri (Lupa- ja valvontavirasto)',
  SE: 'Tillstånd / anmälan för avfallstransport (länsstyrelsen)',
  NO: 'Enhetsregisteret: «avfallstransport» i formål',
  DK: 'Affaldsregistret (Energistyrelsen)',
  EE: 'Keskkonnaamet: jäätmeveo registreering',
  LV: 'VVD atkritumu pārvadāšanas atļauja',
  LT: 'ATVR (Atliekų tvarkytojų valstybės registras)',
  PL: 'Numer rejestrowy BDO',
  DE: 'Anzeige § 53 KrWG / Beförderernummer',
};

export type WasteRegistrations = Partial<Record<RegistrationCountry, string>>;

/** Значение из базы (jsonb) → проверенный объект «страна → номер». */
export function parseRegistrations(value: unknown): WasteRegistrations {
  const out: WasteRegistrations = {};
  if (!value || typeof value !== 'object' || Array.isArray(value)) return out;
  for (const c of REGISTRATION_COUNTRIES) {
    const v = (value as Record<string, unknown>)[c];
    if (typeof v === 'string' && v.trim()) out[c] = v.trim().slice(0, 80);
  }
  return out;
}

/** Строка для документа: «Numer rejestrowy BDO: 000123456». */
export function registrationLine(regs: WasteRegistrations, country: string): string | null {
  const c = country as RegistrationCountry;
  const number = regs[c];
  return number ? `${REGISTRATION_LABEL[c]}: ${number}` : null;
}

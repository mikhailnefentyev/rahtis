/**
 * Сверка заявки с открытыми данными реестра PRH/YTJ.
 *
 * Проверка — подсказка оператору, а не решение: заявку одобряет человек
 * (решение пользователя от 25.09.2026). Здесь собирается то, что оператор
 * раньше смотрел руками на карточке YTJ: то ли название, живая ли
 * компания, стоит ли она в ennakkoperintärekisteri и в реестре ALV.
 * Последние два — то, что требует tilaajavastuulaki от подрядчика.
 *
 * Чего открытые данные не дают, и потому здесь нет:
 *
 *   люди — руководитель, правление, владельцы. Их нет в открытом API
 *   вовсе, только в платных выписках. Совпадение с реестром подтверждает,
 *   что компания существует, но не что заявитель её представляет;
 *
 *   индивидуальные предприниматели (toiminimi). Их данные — персональные,
 *   в открытый набор они не входят. Такой Y-tunnus API не находит, хотя
 *   на сайте YTJ карточка есть. Вердикт NOT_FOUND поэтому означает «не
 *   в открытых данных», а не «не существует», — оператор смотрит YTJ.
 *
 * Модуль без импортов: разбор ответа — чистая функция, её проверяют
 * тесты (prh.test.mjs) так же, как калькулятор водителя.
 */

export type RegistryVerdict = 'OK' | 'ATTENTION' | 'NOT_FOUND' | 'ERROR';

export type NameMatch = 'EXACT' | 'SIMILAR' | 'DIFFERENT';

export type RegistryCheck = {
  verdict: RegistryVerdict;
  checkedAt: string;
  /** Что стоит в реестре. NULL, когда компания не нашлась. */
  officialName: string | null;
  form: string | null;
  registeredOn: string | null;
  nameMatch: NameMatch | null;
  /** Банкротство, реструктуризация, ликвидация — по-фински, как в реестре. */
  situations: string[];
  tradeRegister: boolean | null;
  prepayment: boolean | null;
  vat: boolean | null;
  employer: boolean | null;
  /** Что оператору проверить глазами, по-фински — письмо и админка финские. */
  issues: string[];
};

const API = 'https://avoindata.prh.fi/opendata-ytj-api/v3/companies';

/* Коды реестров PRH (описание REK). */
const REGISTER = { trade: '1', prepayment: '5', vat: '6', employer: '7' } as const;

/* Коды ситуаций: банкротство, реструктуризация, ликвидация. */
const SITUATION: Record<string, string> = {
  KONK: 'Konkurssissa',
  SANE: 'Saneerauksessa',
  SELTILA: 'Selvitystilassa',
};

type Text = { languageCode?: string; description?: string };
type Entry = { register?: string; type?: string; endDate?: string | null; descriptions?: Text[] };
type Company = {
  names?: Array<{ name?: string; type?: string; endDate?: string | null }>;
  companyForms?: Array<{ descriptions?: Text[]; endDate?: string | null }>;
  companySituations?: Array<{ type?: string; endDate?: string | null }>;
  registeredEntries?: Entry[];
  registrationDate?: string;
  status?: string;
};

const fi = (texts?: Text[]) => texts?.find((d) => d.languageCode === '1')?.description ?? null;

/**
 * Название без формы и знаков: «Aivomaa Oy» и «AIVOMAA OY.» — одно и то же.
 * Буквы ä, ö, å сохраняются: «Mäkelä» и «Makela» — разные фамилии.
 */
export function normalizeName(value: string): string {
  return value
    .toLowerCase()
    .replace(/[.,'"’&()/-]+/g, ' ')
    .replace(/\b(oy|oyj|ab|abp|ky|ay|tmi|osk|ry|ltd|as oy)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function matchName(applied: string, registered: string[]): NameMatch {
  const a = normalizeName(applied);
  const names = registered.map(normalizeName).filter(Boolean);
  if (names.includes(a)) return 'EXACT';
  if (a.length >= 3 && names.some((n) => n.includes(a) || a.includes(n))) return 'SIMILAR';
  return 'DIFFERENT';
}

/*
 * В реестре ли компания сейчас. Запись без даты окончания — действующая,
 * но и у действующей бывает состояние «Rekisteröimätön»: Aivomaa стоит в
 * торговом реестре записью «Rekisterissä» после закрытой «Rekisteröimätön».
 */
function inRegister(entries: Entry[], register: string): boolean {
  return entries.some(
    (e) =>
      e.register === register &&
      !e.endDate &&
      !/rekisteröimätön|poistettu|lopettanut|ei rekisterissä/i.test(fi(e.descriptions) ?? ''),
  );
}

/** Ответ API → итог сверки. companies — массив из ответа PRH. */
export function evaluate(appliedName: string, companies: unknown[], now = new Date()): RegistryCheck {
  const checkedAt = now.toISOString();
  const company = companies[0] as Company | undefined;

  if (!company) {
    return {
      verdict: 'NOT_FOUND',
      checkedAt,
      officialName: null,
      form: null,
      registeredOn: null,
      nameMatch: null,
      situations: [],
      tradeRegister: null,
      prepayment: null,
      vat: null,
      employer: null,
      issues: [
        'Y-tunnusta ei löydy avoimesta datasta. Toiminimet eivät ole avoimessa datassa – tarkista yritys YTJ:stä.',
      ],
    };
  }

  const current = (company.names ?? []).filter((n) => !n.endDate && n.name);
  const official = current.find((n) => n.type === '1')?.name ?? current[0]?.name ?? null;
  const nameMatch = matchName(
    appliedName,
    current.map((n) => n.name as string),
  );
  const form = fi(company.companyForms?.find((f) => !f.endDate)?.descriptions) ?? null;
  const situations = (company.companySituations ?? [])
    .filter((s) => !s.endDate && s.type)
    .map((s) => SITUATION[s.type as string] ?? (s.type as string));
  const entries = company.registeredEntries ?? [];

  const tradeRegister = inRegister(entries, REGISTER.trade);
  const prepayment = inRegister(entries, REGISTER.prepayment);
  const vat = inRegister(entries, REGISTER.vat);
  const employer = inRegister(entries, REGISTER.employer);

  const issues: string[] = [];
  if (nameMatch === 'DIFFERENT') issues.push(`Nimi ei täsmää: rekisterissä ”${official}”.`);
  if (nameMatch === 'SIMILAR') issues.push(`Nimi on lähellä mutta ei sama: rekisterissä ”${official}”.`);
  for (const s of situations) issues.push(`${s}.`);
  /* Статус 2 — действующая компания; остальное показываем как есть. */
  if (company.status && company.status !== '2') issues.push(`Yrityksen tila rekisterissä: ${company.status}.`);
  if (!prepayment) issues.push('Ei ennakkoperintärekisterissä.');
  if (!vat) issues.push('Ei arvonlisäverorekisterissä.');

  return {
    verdict: issues.length === 0 ? 'OK' : 'ATTENTION',
    checkedAt,
    officialName: official,
    form,
    registeredOn: company.registrationDate ?? null,
    nameMatch,
    situations,
    tradeRegister,
    prepayment,
    vat,
    employer,
    issues,
  };
}

/**
 * Запрос в PRH и разбор. Никогда не бросает: реестр недоступен — заявка
 * всё равно принимается, а оператор видит ERROR и смотрит YTJ сам.
 */
export async function checkRegistry(businessId: string, appliedName: string): Promise<RegistryCheck> {
  try {
    const response = await fetch(`${API}?businessId=${encodeURIComponent(businessId)}`, {
      signal: AbortSignal.timeout(8000),
      headers: { accept: 'application/json' },
    });
    if (!response.ok) throw new Error(`PRH ${response.status}`);
    const data = (await response.json()) as { companies?: unknown[] };
    return evaluate(appliedName, data.companies ?? []);
  } catch {
    return {
      verdict: 'ERROR',
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
      issues: ['PRH:n rekisteri ei vastannut. Tarkista yritys YTJ:stä.'],
    };
  }
}

/**
 * Сверка заявки компании из ЕС (кроме Финляндии) с VIES — общим реестром
 * плательщиков НДС Евросоюза.
 *
 * Как и PRH, это подсказка оператору, а не решение (решение пользователя
 * от 25.09.2026: заявку одобряет человек). VIES отвечает, действует ли
 * номер плательщика НДС, и — не во всех странах — название и адрес.
 * Германия, например, название не отдаёт: тогда оператор сверяет его сам.
 *
 * Тексты замечаний по-фински: письмо и админка оператора финские.
 *
 * Разбор ответа — viesVerdict.ts (vies.test.mjs); сам запрос никогда не
 * бросает: реестр недоступен — заявка всё равно принимается, оператор
 * видит ERROR.
 */
import { matchName, type RegistryCheck } from './prh';
import { base, evaluateVies, isTransientViesError, type ViesResponse } from './viesVerdict';

const API = 'https://ec.europa.eu/taxation_customs/vies/rest-api/ms';

async function ask(country: string, number: string): Promise<ViesResponse> {
  const response = await fetch(`${API}/${encodeURIComponent(country)}/vat/${encodeURIComponent(number)}`, {
    signal: AbortSignal.timeout(10000),
    headers: { accept: 'application/json' },
    cache: 'no-store',
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return (await response.json()) as ViesResponse;
}

/**
 * Запрос в VIES по номеру вида «EE100366327».
 *
 * Сервисы стран у VIES то и дело заняты (MS_MAX_CONCURRENT_REQ,
 * MS_UNAVAILABLE) — второй запрос через пару секунд обычно проходит.
 * Причина отказа пишется в лог и в замечание: раньше она терялась, и
 * в админке оставалось одно «VIES ei vastannut».
 */
export async function checkVies(vatNumber: string, appliedName: string): Promise<RegistryCheck> {
  const country = vatNumber.slice(0, 2);
  const number = vatNumber.slice(2);
  let reason = '';
  for (let attempt = 0; attempt < 2; attempt++) {
    if (attempt > 0) await new Promise((resolve) => setTimeout(resolve, 2000));
    try {
      const r = await ask(country, number);
      if (isTransientViesError(r) && attempt === 0) {
        reason = r.userError ?? '';
        continue;
      }
      return evaluateVies(appliedName, vatNumber, r, matchName);
    } catch (error) {
      reason = error instanceof Error ? error.message : String(error);
    }
  }
  console.error(`vies ${vatNumber}: ${reason}`);
  return {
    ...base(),
    verdict: 'ERROR',
    issues: [`VIES ei vastannut${reason ? ` (${reason})` : ''}. Tarkista ALV-numero ${vatNumber} VIES-palvelusta.`],
  };
}

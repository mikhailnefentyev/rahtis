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
import { base, evaluateVies, type ViesResponse } from './viesVerdict';

const API = 'https://ec.europa.eu/taxation_customs/vies/rest-api/ms';

/** Запрос в VIES по номеру вида «EE100366327». */
export async function checkVies(vatNumber: string, appliedName: string): Promise<RegistryCheck> {
  const country = vatNumber.slice(0, 2);
  const number = vatNumber.slice(2);
  try {
    const response = await fetch(`${API}/${encodeURIComponent(country)}/vat/${encodeURIComponent(number)}`, {
      signal: AbortSignal.timeout(10000),
      headers: { accept: 'application/json' },
    });
    if (!response.ok) throw new Error(`VIES ${response.status}`);
    return evaluateVies(appliedName, vatNumber, (await response.json()) as ViesResponse, matchName);
  } catch {
    return { ...base(), verdict: 'ERROR', issues: [`VIES ei vastannut. Tarkista ALV-numero ${vatNumber} VIES-palvelusta.`] };
  }
}

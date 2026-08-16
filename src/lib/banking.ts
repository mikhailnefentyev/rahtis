/**
 * Проверка банковских и налоговых идентификаторов.
 *
 * Те же правила действуют в базе (см. миграцию с реквизитами). Здесь они
 * нужны, чтобы человек увидел ошибку при вводе, а не после отправки формы;
 * последнее слово всё равно за ограничениями таблицы.
 */

/** Убирает пробелы и приводит к верхнему регистру: банки печатают IBAN по-разному. */
export function normalizeIban(value: string): string {
  return value.replace(/\s+/g, '').toUpperCase();
}

const IBAN_SHAPE = /^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/;

/**
 * Проверка IBAN по ISO 13616: контрольная сумма mod-97, а не только формат.
 *
 * Ловит и опечатку в цифре, и перестановку двух соседних — самые частые
 * ошибки при переписывании счёта с бумаги. Для выплат перевозчикам это
 * разница между «деньги ушли» и «деньги вернулись через неделю».
 */
export function isValidIban(value: string): boolean {
  const iban = normalizeIban(value);
  if (!IBAN_SHAPE.test(iban)) return false;

  /* Первые четыре символа переносятся в конец, буквы становятся числами. */
  const rearranged = iban.slice(4) + iban.slice(0, 4);
  const digits = rearranged.replace(/[A-Z]/g, (ch) => String(ch.charCodeAt(0) - 55));

  /*
   * Число длиннее, чем помещается в Number, поэтому остаток считается
   * по частям — иначе точность теряется и проверка становится случайной.
   */
  let remainder = 0;
  for (const digit of digits) {
    remainder = (remainder * 10 + Number(digit)) % 97;
  }

  return remainder === 1;
}

/** Разбивает IBAN на группы по четыре: так его печатают и так его читают. */
export function formatIban(value: string): string {
  return normalizeIban(value).replace(/(.{4})/g, '$1 ').trim();
}

/** BIC/SWIFT: 8 или 11 символов. */
export function isValidBic(value: string): boolean {
  return /^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/.test(value.replace(/\s+/g, '').toUpperCase());
}

/** Номер НДС: код страны и от двух до двенадцати знаков. */
export function isValidVatNumber(value: string): boolean {
  return /^[A-Z]{2}[A-Z0-9]{2,12}$/.test(value.replace(/\s+/g, '').toUpperCase());
}

/**
 * Выводит финский ALV-номер из Y-tunnus: 1234567-8 → FI12345678.
 *
 * Только подсказка для формы. Жёстко это не проверяется: при групповой
 * НДС-регистрации дочерняя компания использует номер группы, и требование
 * совпадения заблокировало бы законную компанию.
 */
export function deriveFinnishVat(businessId: string): string {
  const digits = businessId.replace(/\D/g, '');
  return digits.length === 8 ? `FI${digits}` : '';
}

/**
 * OVT-tunnus — адрес получателя электронных счетов.
 * У финских компаний это 0037 + Y-tunnus без дефиса + необязательный суффикс.
 */
export function isValidOvt(value: string): boolean {
  return /^[0-9A-Za-z]{8,17}$/.test(value.replace(/\s+/g, ''));
}

export function deriveFinnishOvt(businessId: string): string {
  const digits = businessId.replace(/\D/g, '');
  return digits.length === 8 ? `0037${digits}` : '';
}

/** Код оператора электронных счетов (välittäjätunnus). */
export function isValidEinvoiceOperator(value: string): boolean {
  return /^[0-9A-Za-z-]{4,20}$/.test(value.replace(/\s+/g, ''));
}

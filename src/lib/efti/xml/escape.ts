/**
 * Безопасная запись текста в XML для сообщений eFTI.
 *
 * XML 1.0 не умеет представлять управляющие символы (кроме \t \n \r),
 * одиночные суррогаты и U+FFFE/U+FFFF даже через &#…; — такие символы
 * выбрасываются, иначе шлюз отвергнет документ целиком.
 */

const INVALID_XML_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g;

/** Убирает символы, недопустимые в XML 1.0. */
export function stripInvalidXmlChars(value: string): string {
  return value.replace(INVALID_XML_CHARS, '');
}

/** Текстовое содержимое элемента. */
export function escapeText(value: string): string {
  return stripInvalidXmlChars(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Значение атрибута в двойных кавычках (переводы строк сохраняются как &#…;). */
export function escapeAttr(value: string): string {
  return stripInvalidXmlChars(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
    .replace(/\t/g, '&#9;')
    .replace(/\n/g, '&#10;')
    .replace(/\r/g, '&#13;');
}

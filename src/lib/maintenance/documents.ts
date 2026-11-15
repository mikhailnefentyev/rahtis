/**
 * Документы машины: виды, допустимые файлы, вид по умолчанию.
 *
 * Без зависимостей — модуль читают серверные действия, формы и тесты.
 */

export const DOCUMENT_KINDS = ['RECEIPT', 'PROTOCOL', 'CERTIFICATE', 'REGISTRATION', 'PHOTO', 'OTHER'] as const;
export type DocumentKind = (typeof DOCUMENT_KINDS)[number];

export const isDocumentKind = (value: string): value is DocumentKind => (DOCUMENT_KINDS as readonly string[]).includes(value);

/** Совпадает с allowed_mime_types бакета fleet-docs и проверкой таблицы. */
export const DOCUMENT_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'] as const;
export type DocumentType = (typeof DOCUMENT_TYPES)[number];
export const DOCUMENT_MAX_BYTES = 10 * 1024 * 1024;

const EXT: Record<DocumentType, string> = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

export const extensionOf = (type: DocumentType): string => EXT[type];

/**
 * Настоящий тип файла по первым байтам. Браузер называет тип по
 * расширению, а не по содержимому: «счёт.pdf», который на деле что-то
 * другое, сюда не пройдёт. null — не PDF и не картинка из списка.
 */
export function sniffDocumentType(head: Uint8Array): DocumentType | null {
  const at = (i: number, ...bytes: number[]) => bytes.every((b, k) => head[i + k] === b);
  if (at(0, 0x25, 0x50, 0x44, 0x46, 0x2d)) return 'application/pdf'; // %PDF-
  if (at(0, 0xff, 0xd8, 0xff)) return 'image/jpeg';
  if (at(0, 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return 'image/png';
  if (at(0, 0x52, 0x49, 0x46, 0x46) && at(8, 0x57, 0x45, 0x42, 0x50)) return 'image/webp'; // RIFF....WEBP
  return null;
}

/**
 * Вид документа к строке книжки, если перевозчик не выбрал: у katsastus
 * и тахографа обычно протокол или свидетельство, у остального — счёт.
 */
export function defaultDocumentKind(recordKind: string | null | undefined): DocumentKind {
  if (recordKind === 'INSPECTION') return 'PROTOCOL';
  if (recordKind === 'TACHOGRAPH' || recordKind === 'ADR' || recordKind === 'FIRE' || recordKind === 'LIFT') return 'CERTIFICATE';
  return 'RECEIPT';
}

/** Имя файла для показа: без пути, не длиннее 120 знаков (проверка таблицы). */
export function displayFileName(name: string): string {
  const base = name.split(/[\\/]/).pop()?.trim() || 'file';
  return base.length > 120 ? `…${base.slice(-119)}` : base;
}

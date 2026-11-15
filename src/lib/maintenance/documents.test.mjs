/*
 * Документы машины: настоящий тип файла и вид по умолчанию. Запуск: npm test.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultDocumentKind, displayFileName, isDocumentKind, sniffDocumentType } from './documents.ts';

const bytes = (...b) => new Uint8Array([...b, ...new Array(16).fill(0)]);

test('тип по первым байтам: PDF, JPEG, PNG, WEBP', () => {
  assert.equal(sniffDocumentType(new TextEncoder().encode('%PDF-1.7\n')), 'application/pdf');
  assert.equal(sniffDocumentType(bytes(0xff, 0xd8, 0xff, 0xe0)), 'image/jpeg');
  assert.equal(sniffDocumentType(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)), 'image/png');
  assert.equal(sniffDocumentType(new TextEncoder().encode('RIFF\x10\x00\x00\x00WEBPVP8 ')), 'image/webp');
});

test('чужое содержимое под видом PDF не проходит', () => {
  assert.equal(sniffDocumentType(new TextEncoder().encode('<html><body>')), null);
  assert.equal(sniffDocumentType(bytes(0x50, 0x4b, 0x03, 0x04)), null); // zip / docx
  assert.equal(sniffDocumentType(new TextEncoder().encode('RIFF\x10\x00\x00\x00WAVEfmt ')), null);
  assert.equal(sniffDocumentType(new Uint8Array([])), null);
});

test('вид по умолчанию: katsastus — протокол, тахограф — свидетельство, ремонт — счёт', () => {
  assert.equal(defaultDocumentKind('INSPECTION'), 'PROTOCOL');
  assert.equal(defaultDocumentKind('TACHOGRAPH'), 'CERTIFICATE');
  assert.equal(defaultDocumentKind('REPAIR'), 'RECEIPT');
  assert.equal(defaultDocumentKind(null), 'RECEIPT');
});

test('имя файла без пути и не длиннее 120 знаков', () => {
  assert.equal(displayFileName('C:\\Users\\x\\lasku.pdf'), 'lasku.pdf');
  assert.equal(displayFileName('a/b/c.png'), 'c.png');
  const long = displayFileName(`${'x'.repeat(200)}.pdf`);
  assert.equal(long.length, 120);
  assert.ok(long.endsWith('.pdf'));
  assert.ok(isDocumentKind('RECEIPT') && !isDocumentKind('INVOICE'));
});

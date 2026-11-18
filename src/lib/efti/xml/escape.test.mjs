/*
 * Экранирование текста для XML eFTI. Запуск: npm test.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import './testSupport.mjs';

const { escapeText, escapeAttr, stripInvalidXmlChars } = await import('./escape.ts');
const { text, token, country, decimal, format102, format205 } = await import('./common.ts');
const { parseXml } = await import('./parse.ts');

test('спецсимволы текста и атрибутов', () => {
  assert.equal(escapeText('a & b < c > d "e" \'f\''), 'a &amp; b &lt; c &gt; d "e" \'f\'');
  assert.equal(escapeAttr('a&"b\'<\n\t'), 'a&amp;&quot;b&apos;&lt;&#10;&#9;');
});

test('недопустимые в XML 1.0 символы выбрасываются, допустимые остаются', () => {
  assert.equal(stripInvalidXmlChars('a\u0000b\u0007c\u001Fd\uFFFEe\uFFFF'), 'abcde');
  assert.equal(stripInvalidXmlChars('x\uD800y\uDC00z'), 'xyz');
  assert.equal(stripInvalidXmlChars('ok\t\n\r😀Äö'), 'ok\t\n\r😀Äö');
});

test('круг: экранированное читается обратно как было', () => {
  const s = 'Kuljetus & <Rahti> "Oy" \'Ab\' ]]> 😀';
  const root = parseXml(`<a v="${escapeAttr(s)}">${escapeText(s)}</a>`);
  assert.equal(root.text, s);
  assert.equal(root.attrs.v, s);
});

test('нормализация под XSD', () => {
  assert.equal(text('  a \n  b  ', 35), 'a b');
  assert.equal(text('   ', 35), null);
  assert.equal(text('😀'.repeat(40), 35), '😀'.repeat(35));
  assert.equal(token('ABC-123', 17), 'ABC-123');
  assert.equal(token('X'.repeat(18), 17), null);
  assert.equal(country(' fi '), 'FI');
  assert.equal(country('FIN'), null);
  assert.equal(decimal(18750.5), '18750.5');
  assert.equal(decimal(1000), '1000');
  assert.equal(decimal(0.1 + 0.2), '0.3');
  assert.throws(() => decimal(1e21), /out of range/);
});

test('даты CL-020 в поясе страны места', () => {
  assert.deepEqual(format205('2026-11-18T07:15:00Z', 'FI'), { format: '205', value: '202611180915+0200' });
  assert.deepEqual(format205('2026-11-18T09:15:00+02:00', 'FI'), { format: '205', value: '202611180915+0200' });
  assert.deepEqual(format205('2026-11-18T23:30:00Z', 'PT'), { format: '205', value: '202611182330+0000' });
  assert.deepEqual(format102('2026-11-18T23:30:00Z', 'FI'), { format: '102', value: '20261119' });
  assert.deepEqual(format205('2026-11-18', 'FI'), { format: '102', value: '20261118' });
  // Неизвестная страна — смещение из строки.
  assert.deepEqual(format205('2026-11-18T09:15:00-05:00', 'US'), { format: '205', value: '202611180915-0500' });
  assert.throws(() => format102('18.11.2026', 'FI'), /ISO 8601/);
});

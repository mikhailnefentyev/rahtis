/*
 * Регистрации перевозчика отходов. Запуск: npm test.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseRegistrations, registrationLine } from './registrations.ts';

test('из базы берутся только известные страны и непустые номера', () => {
  assert.deepEqual(parseRegistrations({ PL: ' 000123456 ', XX: '1', DE: '', LT: 5 }), { PL: '000123456' });
  assert.deepEqual(parseRegistrations(null), {});
  assert.deepEqual(parseRegistrations(['PL']), {});
});

test('строка для документа — название регистрации страны и номер', () => {
  assert.equal(registrationLine({ PL: '000123456' }, 'PL'), 'Numer rejestrowy BDO: 000123456');
  assert.equal(registrationLine({ PL: '000123456' }, 'DE'), null);
});

/*
 * Тесты перенаправления после входа: только внутрь сайта. Запуск: npm test.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { safeRedirect } from './paths.ts';

test('свои адреса проходят', () => {
  assert.equal(safeRedirect('/fi/shipper/orders', '/fi'), '/fi/shipper/orders');
  assert.equal(safeRedirect('/fi/shipper/orders?tab=done#x', '/fi'), '/fi/shipper/orders?tab=done#x');
  assert.equal(safeRedirect(null, '/fi'), '/fi');
  assert.equal(safeRedirect('', '/fi'), '/fi');
});

test('чужие хосты и обходы не проходят', () => {
  for (const evil of [
    'https://evil.com',
    '//evil.com',
    '/\\evil.com',
    '/\\\\evil.com',
    '\\\\evil.com',
    '/\tevil.com',
    '/\n/evil.com',
    'javascript:alert(1)',
    'evil.com',
  ]) {
    assert.equal(safeRedirect(evil, '/fi'), '/fi', JSON.stringify(evil));
  }
});

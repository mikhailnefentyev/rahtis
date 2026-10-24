import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanUrl, isPublicPath, scrubProperties } from './public.ts';

test('аналитика: открытые страницы — только витрина', () => {
  for (const p of ['/', '/en', '/fi/apply', '/fi/tietosuoja', '/en/api-docs', '/blog', '/blog/some-post']) assert.equal(isPublicPath(p), true, p);
  for (const p of ['/fi/carrier/desk', '/en/track/abc123', '/fi/driver', '/en/signin', '/fi/admin/legal', '/blog/a/b']) assert.equal(isPublicPath(p), false, p);
});

test('аналитика: код приглашения и коды закрытых страниц не уходят', () => {
  assert.equal(cleanUrl('https://www.rahtis.eu/fi/apply?invite=SECRET&utm_source=x'), 'https://www.rahtis.eu/fi/apply?utm_source=x');
  assert.equal(cleanUrl('https://www.rahtis.eu/fi/track/SECRET'), 'https://www.rahtis.eu/');
  assert.equal(cleanUrl('https://www.google.com/search?q=rahtis'), 'https://www.google.com/search');
  const out = scrubProperties({
    $referrer: 'https://www.rahtis.eu/en/track/SECRET',
    $prev_pageview_pathname: '/fi/carrier/fleet',
    $set_once: { $initial_current_url: 'https://www.rahtis.eu/en/apply?invite=SECRET' },
    $pathname: '/en/apply',
  });
  assert.equal(JSON.stringify(out).includes('SECRET'), false);
  assert.equal(out.$prev_pageview_pathname, '/');
  assert.equal(out.$pathname, '/en/apply');
});

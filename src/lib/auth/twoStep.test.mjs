/*
 * Двухэтапный вход и новые устройства: отпечаток, префикс адреса,
 * решение о письме, уровень сессии. Запуск: npm test.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  aalOf,
  cityName,
  cleanCode,
  countryCode,
  describeDevice,
  deviceFingerprint,
  ipPrefix,
  lastCodeAt,
  normaliseUserAgent,
  pendingStep,
  qrDataUrl,
  shouldAlert,
  stepUpNeeded,
} from './twoStep.ts';
import { twoStepItem } from '../inbox/rank.ts';

const CHROME_WIN_131 =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const CHROME_WIN_132 = CHROME_WIN_131.replace('131.0.0.0', '132.0.6834.83');
const SAFARI_IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1';
const FIREFOX_LINUX = 'Mozilla/5.0 (X11; Linux x86_64; rv:128.0) Gecko/20100101 Firefox/128.0';
const EDGE_MAC =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0';

function jwt(payload) {
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  return `${b64({ alg: 'ES256' })}.${b64(payload)}.sig`;
}

test('отпечаток: обновление браузера — то же устройство', () => {
  assert.equal(deviceFingerprint(CHROME_WIN_131, 'fi-FI,fi;q=0.9,en;q=0.8'), deviceFingerprint(CHROME_WIN_132, 'fi-FI,fi;q=0.9,en;q=0.8'));
});

test('отпечаток: другой браузер или языки — другое устройство', () => {
  const base = deviceFingerprint(CHROME_WIN_131, 'fi-FI,fi');
  assert.notEqual(base, deviceFingerprint(SAFARI_IPHONE, 'fi-FI,fi'));
  assert.notEqual(base, deviceFingerprint(CHROME_WIN_131, 'en-GB,en'));
  assert.match(base, /^[0-9a-f]{64}$/);
});

test('отпечаток: веса q и пробелы языков не важны', () => {
  assert.equal(deviceFingerprint(CHROME_WIN_131, 'fi-FI, fi;q=0.9'), deviceFingerprint(CHROME_WIN_131, 'fi-fi,fi;q=0.5'));
});

test('отпечаток: пустые заголовки не падают', () => {
  assert.match(deviceFingerprint(null, undefined), /^[0-9a-f]{64}$/);
  assert.equal(normaliseUserAgent(undefined), '');
});

test('название устройства', () => {
  assert.equal(describeDevice(CHROME_WIN_131), 'Chrome · Windows');
  assert.equal(describeDevice(SAFARI_IPHONE), 'Safari · iOS');
  assert.equal(describeDevice(FIREFOX_LINUX), 'Firefox · Linux');
  assert.equal(describeDevice(EDGE_MAC), 'Edge · macOS');
  assert.equal(describeDevice('curl/8.0'), null);
});

test('префикс адреса: IPv4 /24, IPv6 /48, мусор — null', () => {
  assert.equal(ipPrefix('85.76.12.201'), '85.76.12.0/24');
  assert.equal(ipPrefix('::ffff:10.1.2.3'), '10.1.2.0/24');
  assert.equal(ipPrefix('2001:db8:abcd:12:1::5'), '2001:db8:abcd::/48');
  assert.equal(ipPrefix('2001:0db8::1'), '2001:db8:0::/48');
  assert.equal(ipPrefix('300.1.1.1'), null);
  assert.equal(ipPrefix('unknown'), null);
  assert.equal(ipPrefix('1::2::3'), null);
  assert.equal(ipPrefix(''), null);
});

test('страна и город из заголовков Vercel', () => {
  assert.equal(countryCode('fi'), 'FI');
  assert.equal(countryCode('XX'), null);
  assert.equal(countryCode('Finland'), null);
  assert.equal(cityName('Helsinki'), 'Helsinki');
  assert.equal(cityName('S%C3%A3o%20Paulo'), 'São Paulo');
  assert.equal(cityName('%E0%A4%A'), null);
  assert.equal(cityName(null), null);
});

test('письмо: только новое устройство и не при первом входе', () => {
  assert.equal(shouldAlert([], 'a'), false);
  assert.equal(shouldAlert(['a'], 'a'), false);
  assert.equal(shouldAlert(['a'], 'b'), true);
  assert.equal(shouldAlert(['a', 'b'], 'b'), false);
});

test('уровень сессии и время кода из токена', () => {
  assert.equal(aalOf(jwt({ aal: 'aal2' })), 'aal2');
  assert.equal(aalOf(jwt({ aal: 'aal1' })), 'aal1');
  assert.equal(aalOf(jwt({})), null);
  assert.equal(aalOf('broken'), null);
  assert.equal(aalOf(null), null);
  const token = jwt({ amr: [{ method: 'password', timestamp: 100 }, { method: 'totp', timestamp: 200 }, { method: 'totp', timestamp: 150 }] });
  assert.equal(lastCodeAt(token), 200);
  assert.equal(lastCodeAt(jwt({ amr: ['password'] })), null);
});

test('шаг входа: код, подключение оператора или пускать', () => {
  assert.equal(pendingStep({ enabled: true, aal: 'aal1', admin: false }), 'code');
  assert.equal(pendingStep({ enabled: true, aal: null, admin: true }), 'code');
  assert.equal(pendingStep({ enabled: true, aal: 'aal2', admin: true }), null);
  assert.equal(pendingStep({ enabled: false, aal: 'aal1', admin: true }), 'enrol');
  assert.equal(pendingStep({ enabled: false, aal: 'aal1', admin: false }), null);
});

test('код перед важным действием: окно 15 минут', () => {
  const now = 1_000_000 * 1000;
  const at = (secondsAgo) => now / 1000 - secondsAgo;
  assert.equal(stepUpNeeded({ enabled: false, aal: 'aal1', codeAt: null, now }), false);
  assert.equal(stepUpNeeded({ enabled: true, aal: 'aal2', codeAt: at(60), now }), false);
  assert.equal(stepUpNeeded({ enabled: true, aal: 'aal2', codeAt: at(16 * 60), now }), true);
  assert.equal(stepUpNeeded({ enabled: true, aal: 'aal1', codeAt: at(60), now }), true);
  assert.equal(stepUpNeeded({ enabled: true, aal: 'aal2', codeAt: null, now }), true);
});

test('код: шесть цифр, пробелы и дефис убираются', () => {
  assert.equal(cleanCode('123 456'), '123456');
  assert.equal(cleanCode('123-456'), '123456');
  assert.equal(cleanCode('12345'), null);
  assert.equal(cleanCode('abcdef'), null);
});

test('QR: разметка SVG в адрес data:', () => {
  const svg = '<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0h1#"/></svg>';
  const url = qrDataUrl(`data:image/svg+xml;utf-8,${svg}`);
  assert.ok(url.startsWith('data:image/svg+xml;charset=utf-8,%3Csvg'));
  assert.ok(!url.includes('#'));
  assert.equal(qrDataUrl(svg), url);
});

test('«Требует действия»: совета подключить двухэтапный вход нет (убран 9.11.2026)', () => {
  assert.deepEqual(twoStepItem({ owner: false, enabled: false, href: '/fi/account#two-step' }), []);
  assert.deepEqual(twoStepItem({ owner: true, enabled: false, href: '/fi/account#two-step' }), []);
});

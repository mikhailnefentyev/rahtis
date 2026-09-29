/*
 * Тесты чистой логики API заказчиков: ключи, курсор, разбор полей, сверка
 * адреса, подпись вебхука, адрес получателя, перевод отказов базы.
 * Запуск: npm test.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decodeCursor, encodeCursor } from './cursor.ts';
import { locationOf, oneOf, sameAddress, streetOf, text } from './input.ts';
import { generateKey, hashKey, looksLikeKey } from './key.ts';
import { translateRule } from './rules.ts';
import { privateV4, privateV6, sign, urlShapeProblem, verify } from './signature.ts';

test('ключ: форма, префикс и хэш', () => {
  const live = generateKey(false);
  assert.match(live.key, /^rhs_live_[0-9a-f]{8}_[0-9a-f]{40}$/);
  assert.equal(live.prefix, live.key.slice(0, 17));
  assert.equal(live.hash, hashKey(live.key));
  assert.equal(live.hash.length, 64);
  assert.ok(looksLikeKey(live.key));
  assert.match(generateKey(true).key, /^rhs_test_/);
  assert.notEqual(generateKey(false).key, live.key);
});

test('ключ: мусор отсекается до базы', () => {
  assert.equal(looksLikeKey(''), false);
  assert.equal(looksLikeKey('rhs_live_abcd'), false);
  assert.equal(looksLikeKey(`rhs_prod_${'a'.repeat(8)}_${'b'.repeat(40)}`), false);
  assert.equal(looksLikeKey(`rhs_live_${'A'.repeat(8)}_${'b'.repeat(40)}`), false);
  assert.equal(looksLikeKey(` rhs_live_${'a'.repeat(8)}_${'b'.repeat(40)}`), false);
});

test('курсор: туда и обратно', () => {
  const at = '2026-09-29T07:47:15.803743+00:00';
  const id = '8bec005f-e9a8-4cd8-9383-e20037b9f38d';
  assert.deepEqual(decodeCursor(encodeCursor(at, id)), { at, id });
  assert.deepEqual(decodeCursor(encodeCursor('2026-09-29T07:47:15Z', id)), { at: '2026-09-29T07:47:15Z', id });
});

test('курсор: чужое и подделка не проходят', () => {
  const id = '8bec005f-e9a8-4cd8-9383-e20037b9f38d';
  const raw = (s) => Buffer.from(s).toString('base64url');
  assert.equal(decodeCursor('not-a-cursor'), null);
  assert.equal(decodeCursor(raw(`yesterday|${id}`)), null);
  assert.equal(decodeCursor(raw(`2026-09-29T07:47:15Z|nope`)), null);
  assert.equal(decodeCursor(raw(`2026-09-29T07:47:15Z|${id}|x`)), null);
  // Date.parse принял бы это; в фильтр PostgREST оно попасть не должно
  assert.equal(decodeCursor(raw(`2026-09-29 (x),id.gt.0|${id}`)), null);
  assert.equal(decodeCursor(raw(`2026-09-29T07:47:15Z,status.eq.DONE|${id}`)), null);
});

test('поля: строки, списки, координаты', () => {
  assert.equal(text('  Hanko  '), 'Hanko');
  assert.equal(text('   '), undefined);
  assert.equal(text(5), undefined);
  assert.equal(text('abcdef', 3), 'abc');

  const ROLES = ['PICKUP', 'DELIVERY'];
  assert.equal(oneOf('pickup', ROLES), 'PICKUP');
  assert.equal(oneOf('LOAD', ROLES), undefined);
  assert.equal(oneOf(1, ROLES), undefined);

  assert.deepEqual(locationOf({ lat: 60.17, lon: 24.94 }), { lat: 60.17, lon: 24.94 });
  assert.deepEqual(locationOf({ lat: '60.17', lon: '24.94' }), { lat: 60.17, lon: 24.94 });
  assert.equal(locationOf({ lat: 0, lon: 0 }), undefined);
  assert.equal(locationOf({ lat: 91, lon: 24 }), undefined);
  assert.equal(locationOf({ lat: 'x', lon: 24 }), undefined);
  assert.equal(locationOf([60, 24]), undefined);
});

test('адрес: без номера дома точно не узнать', () => {
  assert.equal(streetOf('Satama'), null);
  assert.equal(streetOf('Tikkurilantie 10, Vantaa'), 'tikkurilantie 10');
  assert.equal(streetOf('Mannerheimintie  5 B'), 'mannerheimintie 5 b');
});

test('адрес: сверка улицы, номера и города', () => {
  const street = streetOf('Tikkurilantie 10');
  assert.ok(sameAddress('Tikkurilantie 10, 01380 Vantaa', 'Vantaa', street, 'Vantaa'));
  assert.ok(sameAddress('Tikkurilantie 10 A, Vantaa', 'Vantaa', street, 'vantaa'));
  assert.ok(sameAddress('Tikkurilantie 10', 'Vantaa', street));
  // свое место: «Имя — адрес»
  assert.ok(sameAddress('Varasto — Tikkurilantie 10, Vantaa', 'Vantaa', street, 'Vantaa'));
  // соседний дом, другой номер, другой город, одна улица
  assert.equal(sameAddress('Tikkurilantie 101, Vantaa', 'Vantaa', street, 'Vantaa'), false);
  assert.equal(sameAddress('Tikkurilantie 1, Vantaa', 'Vantaa', street, 'Vantaa'), false);
  assert.equal(sameAddress('Tikkurilantie 10, Helsinki', 'Helsinki', street, 'Vantaa'), false);
  assert.equal(sameAddress('Tikkurilantie, Vantaa', 'Vantaa', street, 'Vantaa'), false);
});

test('подпись: получатель узнаёт своё и отвергает чужое', () => {
  const secret = `whsec_${'ab'.repeat(24)}`;
  const body = '{"id":"d6bf74ce","type":"ping","data":{}}';
  const t = 1_790_000_000;
  const header = `t=${t},v1=${sign(secret, t, body)}`;

  assert.ok(verify(secret, header, body, t + 10));
  assert.equal(verify(secret, header, body + ' ', t + 10), false, 'тело изменено');
  assert.equal(verify(`whsec_${'cd'.repeat(24)}`, header, body, t + 10), false, 'чужой секрет');
  assert.equal(verify(secret, header, body, t + 301), false, 'старое событие');
  assert.equal(verify(secret, `t=${t + 1},v1=${sign(secret, t, body)}`, body, t), false, 'время подменено');
  assert.equal(verify(secret, 'garbage', body, t), false);
});

test('подпись совпадает с примером из документации', () => {
  // HMAC-SHA256("whsec_test", "1700000000.{}") — контрольный пример в документации
  assert.equal(sign('whsec_test', 1_700_000_000, '{}'), '35495024f4ef3f94e5a93e22221544c4b75e9a42300cd965ab81cb85cd994e91');
});

test('адрес вебхука: форма', () => {
  assert.deepEqual(urlShapeProblem('https://erp.example.fi/rahtis'), { host: 'erp.example.fi' });
  assert.deepEqual(urlShapeProblem('https://erp.example.fi:443/x'), { host: 'erp.example.fi' });
  assert.deepEqual(urlShapeProblem('http://erp.example.fi/'), { problem: 'must use https' });
  assert.deepEqual(urlShapeProblem('https://erp.example.fi:8443/'), { problem: 'only the standard https port 443 is allowed' });
  assert.deepEqual(urlShapeProblem('https://user:pw@erp.example.fi/'), { problem: 'credentials in URL are not allowed' });
  assert.deepEqual(urlShapeProblem('https://localhost/'), { problem: 'private host names are not allowed' });
  assert.deepEqual(urlShapeProblem('https://db.internal/'), { problem: 'private host names are not allowed' });
  assert.deepEqual(urlShapeProblem('nonsense'), { problem: 'not a valid URL' });
});

test('адрес вебхука: внутренние сети закрыты', () => {
  for (const ip of ['10.1.2.3', '127.0.0.1', '169.254.169.254', '172.20.0.1', '192.168.1.1', '100.64.0.1', '0.0.0.0', '224.0.0.1']) {
    assert.ok(privateV4(ip), ip);
  }
  for (const ip of ['8.8.8.8', '172.32.0.1', '195.148.1.1']) assert.equal(privateV4(ip), false, ip);

  for (const ip of ['::1', '::', 'fd00::1', 'fe80::1', '::ffff:10.0.0.1']) assert.ok(privateV6(ip), ip);
  // так парсер URL записывает [::ffff:127.0.0.1] и [::ffff:169.254.169.254]
  const host = (u) => new URL(u).hostname.replace(/^\[|\]$/g, '');
  assert.ok(privateV6(host('https://[::ffff:127.0.0.1]/')));
  assert.ok(privateV6(host('https://[::ffff:169.254.169.254]/')));
  assert.equal(privateV6('2a00:1450:4010::200e'), false);
  assert.equal(privateV6(host('https://[::ffff:8.8.8.8]/')), false);
});

test('отказы базы переводятся для программиста', () => {
  assert.deepEqual(translateRule('Укажите регистрационный номер прицепа — по нему водитель его находит.'), {
    field: 'trailer_plate',
    message: 'trailer_plate (the trailer registration number) is required.',
  });
  assert.equal(translateRule('Перецеп заканчивается отцепкой прицепа — укажите, где его оставить.').field, 'stops');
  assert.equal(translateRule('Что-то новое, чего нет в списке.'), null);
});

test('точка водителя: расстояние до адреса точки', async () => {
  const { markAt, metersBetween } = await import('../orders/position.ts');
  const stop = { lat: 60.2934, lon: 25.0378 }; // Tikkurilantie 10, Vantaa
  assert.deepEqual(markAt(stop, null, null), { kind: 'none' });
  assert.deepEqual(markAt({ lat: null, lon: null }, 60.3, 25.0), { kind: 'unknown', accuracyM: null });
  const near = markAt(stop, 60.2936, 25.0381);
  assert.equal(near.kind, 'near');
  assert.ok(near.meters < 50);
  assert.equal(markAt(stop, 60.17, 24.94).kind, 'far'); // Helsingin keskusta
  // погрешность больше промаха — промахом не считается
  assert.equal(markAt(stop, 60.2934, 25.06, 2000).kind, 'near');
  assert.equal(metersBetween(stop, stop), 0);
});

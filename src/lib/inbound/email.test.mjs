/*
 * Заказ из пересланного письма: адрес, отправитель, подпись. Запуск: npm test.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import {
  bareAddress,
  inboxAddress,
  inboxToken,
  mailText,
  parseSenderList,
  pickAttachment,
  senderAllowed,
  senderAuthenticated,
  verifySvix,
} from './email.ts';

const DOMAIN = 'in.rahtis.eu';

test('bareAddress: имя и угловые скобки, регистр', () => {
  assert.equal(bareAddress('Matti Meikäläinen <Matti@Yritys.FI>'), 'matti@yritys.fi');
  assert.equal(bareAddress(' a@b.fi '), 'a@b.fi');
  assert.equal(bareAddress('not an address'), '');
  assert.equal(bareAddress('a@b'), '');
  /* Подделка: две пары скобок — первая выдала бы разрешённый адрес. */
  assert.equal(bareAddress('"<boss@yritys.fi>" <thief@evil.com>'), '');
  assert.equal(bareAddress('Boss <boss@yritys.fi> extra'), '');
});

test('inboxToken: только наш домен и формат orders-<token>', () => {
  const address = inboxAddress('abc123def4567890', DOMAIN);
  assert.equal(address, 'orders-abc123def4567890@in.rahtis.eu');
  assert.equal(inboxToken([address], DOMAIN), 'abc123def4567890');
  assert.equal(inboxToken(['RAHTIS <ORDERS-ABC123DEF4567890@IN.RAHTIS.EU>'], DOMAIN), 'abc123def4567890');
  assert.equal(inboxToken(['someone@else.fi', address], DOMAIN), 'abc123def4567890');
  assert.equal(inboxToken(['orders-abc123def4567890@evil.eu'], DOMAIN), null);
  assert.equal(inboxToken(['orders-short@in.rahtis.eu'], DOMAIN), null);
  assert.equal(inboxToken(['orders-abc123def45678!0@in.rahtis.eu'], DOMAIN), null);
  assert.equal(inboxToken(['info-abc123def4567890@in.rahtis.eu'], DOMAIN), null);
  assert.equal(inboxToken([], DOMAIN), null);
});

test('senderAllowed: входы компании и дополнительные адреса', () => {
  const members = ['matti@yritys.fi', 'liisa@yritys.fi'];
  assert.equal(senderAllowed('Matti <MATTI@yritys.fi>', members, []), true);
  assert.equal(senderAllowed('orders@yritys.fi', members, ['orders@yritys.fi']), true);
  assert.equal(senderAllowed('stranger@spam.com', members, ['orders@yritys.fi']), false);
  assert.equal(senderAllowed('matti@yritys.fi.evil.com', members, []), false);
  assert.equal(senderAllowed('', members, []), false);
});

test('senderAuthenticated: только DMARC pass (выровненный с From)', () => {
  assert.equal(senderAuthenticated({ spf: 'pass', dkim: 'pass', dmarc: 'pass' }), true);
  assert.equal(senderAuthenticated({ spf: 'fail', dkim: 'pass', dmarc: 'unknown' }), false);
  assert.equal(senderAuthenticated({ spf: 'pass', dkim: 'pass', dmarc: 'none' }), false);
  assert.equal(senderAuthenticated({ spf: 'pass', dkim: 'pass', dmarc: 'fail' }), false);
  assert.equal(senderAuthenticated({ spf: 'fail', dkim: 'fail', dmarc: 'gray' }), false);
  assert.equal(senderAuthenticated(null), false);
});

test('parseSenderList: разделители, повторы, ошибки', () => {
  const { list, invalid } = parseSenderList('orders@a.fi, Orders@A.fi\nb@c.se; nonsense');
  assert.deepEqual(list, ['orders@a.fi', 'b@c.se']);
  assert.deepEqual(invalid, ['nonsense']);
});

/* Пример из документации Svix: секрет, id, время, тело и ожидаемая подпись. */
const secret = 'whsec_MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw';
const id = 'msg_p5jXN8AQM9LWM0D4loKWxJek';
const timestamp = '1614265330';
const body = '{"test": 2432232314}';
const now = 1614265330 * 1000;

test('verifySvix: пример документации Svix', () => {
  const signature = 'v1,g0hM9SsE+OTPJTGt/tmIKtSyZlE3uFJELVlNIOLJ1OE=';
  assert.equal(verifySvix({ secret, id, timestamp, signature, body, now }), true);
});

test('verifySvix: несколько подписей, одна верная', () => {
  const key = Buffer.from(secret.slice(6), 'base64');
  const good = createHmac('sha256', key).update(`${id}.${timestamp}.${body}`).digest('base64');
  assert.equal(verifySvix({ secret, id, timestamp, signature: `v1,AAAA v1,${good}`, body, now }), true);
});

test('verifySvix: подмена тела, старое время, нет подписи', () => {
  const signature = 'v1,g0hM9SsE+OTPJTGt/tmIKtSyZlE3uFJELVlNIOLJ1OE=';
  assert.equal(verifySvix({ secret, id, timestamp, signature, body: body.replace('2', '3'), now }), false);
  assert.equal(verifySvix({ secret, id, timestamp, signature, body, now: now + 301_000 }), false);
  assert.equal(verifySvix({ secret, id, timestamp, signature: null, body, now }), false);
  assert.equal(verifySvix({ secret, id: null, timestamp, signature, body, now }), false);
  assert.equal(verifySvix({ secret: 'whsec_b3RoZXI=', id, timestamp, signature, body, now }), false);
  assert.equal(verifySvix({ secret, id, timestamp, signature: 'v2,g0hM9SsE+OTPJTGt/tmIKtSyZlE3uFJELVlNIOLJ1OE=', body, now }), false);
});

test('pickAttachment: PDF первым, потом снимок, лишнее мимо', () => {
  const a = (filename, content_type, size = 1000) => ({ id: filename, filename, content_type, size });
  assert.equal(pickAttachment([a('logo.png', 'image/png'), a('tilaus.pdf', 'application/pdf')])?.id, 'tilaus.pdf');
  assert.equal(pickAttachment([a('x.docx', 'application/vnd.openxmlformats'), a('kuva.jpg', 'image/jpeg')])?.id, 'kuva.jpg');
  assert.equal(pickAttachment([a('big.pdf', 'application/pdf', 5 * 1024 * 1024)]), null);
  assert.equal(pickAttachment([a('run.exe', 'application/octet-stream')]), null);
  assert.equal(pickAttachment([a('ORDER.PDF', 'application/octet-stream')])?.id, 'ORDER.PDF');
});

test('mailText: тема и текст, html без разметки', () => {
  assert.equal(mailText({ subject: 'Kuljetus', text: 'Hanko → Tampere' }), 'Subject: Kuljetus\n\nHanko → Tampere');
  const html = mailText({ subject: '', text: '', html: '<style>p{}</style><p>Lastaus&nbsp;ma</p><p>8:00</p>' });
  assert.equal(html, 'Lastaus ma\n 8:00');
});

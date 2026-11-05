/*
 * Валюты и курсы. Запуск: npm test.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { asCurrency, convertCents, countryCurrency, fxHistory, latestRates, parseEcbXml } from './currency.ts';

const XML = `<gesmes:Envelope><Cube>
<Cube time='2026-11-05'><Cube currency='USD' rate='1.1'/><Cube currency='DKK' rate='7.4747'/><Cube currency='PLN' rate='4.3890'/><Cube currency='SEK' rate='10.9845'/><Cube currency='NOK' rate='10.4365'/></Cube>
<Cube time='2026-11-04'><Cube currency='PLN' rate='4.4000'/></Cube>
</Cube></gesmes:Envelope>`;

test('ЕЦБ: берутся только наши валюты, по дням', () => {
  const rows = parseEcbXml(XML);
  assert.equal(rows.length, 5);
  assert.ok(!rows.some((r) => r.currency === 'USD'));
  assert.deepEqual(rows.find((r) => r.day === '2026-11-04'), { day: '2026-11-04', currency: 'PLN', per_eur: 4.4 });
});

test('пересчёт через евро', () => {
  const rates = latestRates(parseEcbXml(XML));
  assert.equal(rates.PLN, 4.389);
  assert.equal(convertCents(10000, 'EUR', 'PLN', rates), 43890);
  assert.equal(convertCents(43890, 'PLN', 'EUR', rates), 10000);
  assert.equal(convertCents(10000, 'PLN', 'PLN', null), 10000);
  /* Курса нет — null, а не евро как злотые. */
  assert.equal(convertCents(10000, 'EUR', 'SEK', {}), null);
});

test('история: курс последнего дня не позже даты, раньше истории — самый ранний', () => {
  const fx = fxHistory(parseEcbXml(XML));
  assert.equal(fx.perEur('PLN', '2026-11-04'), 4.4);
  assert.equal(fx.perEur('PLN', '2026-11-08'), 4.389); // выходные — пятничный курс
  assert.equal(fx.perEur('PLN', '2026-01-01'), 4.4);
  assert.equal(fx.convert(44000, 'PLN', 'EUR', '2026-11-04'), 10000);
  assert.equal(fx.perEur('EUR', '2026-11-04'), 1);
});

test('валюта страны и разбор строки', () => {
  assert.equal(countryCurrency('PL'), 'PLN');
  assert.equal(countryCurrency('fi'), 'EUR');
  assert.equal(countryCurrency(null), 'EUR');
  assert.equal(asCurrency(' sek '), 'SEK');
  assert.equal(asCurrency('USD', 'PLN'), 'PLN');
});

/*
 * Проверка формата SIIRTO на тестовой среде SYKE: выдуманный рейс →
 * создать → прочитать → удалить. Реальных данных не трогает.
 *
 *   npx tsx scripts/siirto-smoke.mts
 *
 * Ключи — из .env.local: SIIRTO_CLIENT_ID, SIIRTO_CLIENT_SECRET
 * (тестовые, client_credentials). Рабочую среду скрипт не трогает.
 */
import fs from 'node:fs';
import { buildShippingDocument } from '../src/lib/siirto/document';

const env = Object.fromEntries(
  fs
    .readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split(/\r?\n/)
    .filter((l) => /^[A-Z0-9_]+=/.test(l))
    .map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i), l.slice(i + 1).replace(/^["']|["']$/g, '')];
    }),
);
const id = env.SIIRTO_CLIENT_ID;
const secret = env.SIIRTO_CLIENT_SECRET;
if (!id || !secret) {
  console.error('Нет SIIRTO_CLIENT_ID / SIIRTO_CLIENT_SECRET в .env.local');
  process.exit(1);
}
const API = 'https://testbed.ymparisto.fi/siirtoasiakirjarekisteri/api';

const tokenRes = await fetch('https://identitytest.ymparisto.fi/connect/token', {
  method: 'POST',
  headers: { 'content-type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({ grant_type: 'client_credentials', client_id: id, client_secret: secret, scope: 'siirto.shippingdocuments' }),
});
console.log('token', tokenRes.status);
if (!tokenRes.ok) process.exit(1);
const { access_token: token } = (await tokenRes.json()) as { access_token: string };
const auth = { authorization: `Bearer ${token}`, accept: 'application/json' };

const doc = buildShippingDocument({
  required: true,
  country: 'FI',
  materialCode: '170504',
  hazardous: false,
  materialName: 'Maa- ja kiviaines (RAHTIS testi)',
  contaminated: true,
  netKg: 18450,
  day: new Date().toISOString().slice(0, 10),
  unloadedAt: new Date().toISOString(),
  plates: ['TST-101', 'TST-202'],
  job: {
    name: 'RAHTIS testityömaa',
    address: 'Tikkurilantie 10, 01300 Vantaa',
    customerName: 'Testi Rakennus Oy',
    customerBusinessId: '3592993-6',
    customerStreet: 'Testikatu 1',
    customerPostalCode: '00100',
    customerCity: 'Helsinki',
    customerCountry: 'FI',
    contactName: 'Testi Työnjohtaja',
    contactPhone: '+358401234567',
    contactEmail: null,
    treatmentCode: 'R5.3',
    hazardCodes: [],
    hazardComposition: null,
  },
  carrier: { name: 'Aivomaa Oy (testi)', businessId: '3592993-6', street: 'Kankarepolku 5F', postalCode: '00770', city: 'Helsinki' },
  driver: { name: 'Testi Kuljettaja', phone: '+358409876543', email: null },
  receiver: {
    name: 'Testi vastaanotto',
    address: 'Kaatopaikantie 5, 01530 Vantaa',
    city: 'Vantaa',
    postalCode: null,
    operatorName: 'Testi Vastaanotto Oy',
    operatorBusinessId: '3592993-6',
    contactName: 'Testi Vaaka',
    contactPhone: '+35850111222',
    treatmentCode: null,
  },
});
if (!doc.ok) {
  console.error('документ неполный:', doc.missing);
  process.exit(1);
}

const created = await fetch(`${API}/api/v4/shippingdocuments`, {
  method: 'POST',
  headers: { ...auth, 'content-type': 'application/json' },
  body: JSON.stringify(doc.body),
});
const createdText = await created.text();
console.log('create', created.status, createdText.slice(0, 1500));
if (!created.ok) process.exit(1);
const docId = createdText.replace(/^"|"$/g, '');

const read = await fetch(`${API}/api/v4/shippingdocuments/${docId}`, { headers: auth });
const readJson = (await read.json()) as { state?: string; wastes?: { loWCode: string; quantity: number }[] };
console.log('read', read.status, readJson.state, JSON.stringify(readJson.wastes?.map((w) => [w.loWCode, w.quantity])));

const removed = await fetch(`${API}/api/v4/shippingdocuments/${docId}`, { method: 'DELETE', headers: auth });
console.log('delete', removed.status);

/*
 * Фото тягача по марке. Запуск: npm test.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { plateCountryCode, truckBrand, truckPhoto } from './truckPhoto.ts';

test('марка из свободного текста', () => {
  assert.equal(truckBrand('Volvo FH 500'), 'volvo');
  assert.equal(truckBrand('SCANIA R450'), 'scania');
  assert.equal(truckBrand('Mercedes-Benz Actros'), 'mercedes');
  assert.equal(truckBrand('MB Actros 1845'), 'mercedes');
  assert.equal(truckBrand('MAN TGX 18.510'), 'man');
  assert.equal(truckBrand('DAF XF'), 'daf');
  assert.equal(truckBrand('Iveco S-Way'), 'iveco');
  assert.equal(truckBrand('Renault T 480'), 'renault');
  assert.equal(truckBrand('Sisu Polar'), null);
  assert.equal(truckBrand(''), null);
});

test('«man» внутри слова — не MAN', () => {
  assert.equal(truckBrand('Germany truck'), null);
  assert.equal(truckBrand('Romania'), null);
});

test('фото у тягача и фургона, у остальных классов нет', () => {
  assert.equal(truckPhoto('Volvo FH', 'TRACTOR').src, '/media/trucks/volvo.webp');
  assert.equal(truckPhoto('Mercedes Sprinter', 'VAN').src, '/media/vans/mercedes.webp');
  assert.equal(truckPhoto('VW Crafter', 'VAN').src, '/media/vans/vw.webp');
  assert.equal(truckPhoto('Fiat Ducato', 'VAN').src, '/media/vans/fiat.webp');
  assert.equal(truckPhoto('Citroën Jumper', 'VAN').src, '/media/vans/citroen.webp');
  assert.equal(truckPhoto('Ford Transit', 'VAN').src, '/media/vans/ford.webp');
  assert.equal(truckPhoto('Peugeot Boxer', 'VAN'), null);
  assert.equal(truckPhoto('Volvo FL', 'TRUCK'), null);
  assert.equal(truckPhoto('Volvo FH', null), null);
});

test('код страны на знаке', () => {
  assert.equal(plateCountryCode('FI'), 'FIN');
  assert.equal(plateCountryCode('de'), 'D');
  assert.equal(plateCountryCode(null), null);
});

test('марка фургона по словам, не по частям слов', () => {
  assert.equal(truckPhoto('Oxford Van', 'VAN'), null);
  assert.equal(truckPhoto('VW Transporter', 'VAN').src, '/media/vans/vw.webp');
});

test('самосвал: снимок 8×4 по марке, DAF без снимка', () => {
  assert.equal(truckPhoto('Scania R560', 'TIPPER').src, '/media/tippers/scania.webp');
  assert.equal(truckPhoto('Volvo FMX', 'TIPPER').src, '/media/tippers/volvo.webp');
  assert.equal(truckPhoto('DAF CF', 'TIPPER'), null);
});

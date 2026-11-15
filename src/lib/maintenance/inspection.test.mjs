/*
 * Ежедневный осмотр: все пункты, у неисправности — «можно ли ехать» и слова. Запуск: npm test.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { INSPECTION_ITEMS, inspectionFaults, inspectionPayload, inspectionProblem } from './inspection.ts';

const allOk = () => Object.fromEntries(INSPECTION_ITEMS.map((k) => [k, { ok: true }]));

test('пока не отвечены все пункты — отправлять нельзя', () => {
  const answers = allOk();
  delete answers.SAFETY;
  assert.equal(inspectionProblem(answers), 'unanswered');
  assert.equal(inspectionProblem(allOk()), null);
});

test('неисправность требует «можно ли ехать» и описание', () => {
  const answers = { ...allOk(), BRAKES: { ok: false, severity: null, description: '' } };
  assert.equal(inspectionProblem(answers), 'severity');
  answers.BRAKES = { ok: false, severity: 'UNSAFE', description: ' x ' };
  assert.equal(inspectionProblem(answers), 'description');
  answers.BRAKES = { ok: false, severity: 'UNSAFE', description: 'Jarrupoljin pehmeä' };
  assert.equal(inspectionProblem(answers), null);
  assert.deepEqual(inspectionFaults(answers), { count: 1, unsafe: true });
});

test('данные для базы: все пункты по порядку, пробег только целым', () => {
  const answers = { ...allOk(), LIGHTS: { ok: false, severity: 'CAN_DRIVE', description: '  vasen takavalo  ' } };
  const payload = inspectionPayload(answers, '615 950');
  assert.equal(payload.odometer_km, 615950);
  assert.deepEqual(payload.items.map((i) => i.key), [...INSPECTION_ITEMS]);
  assert.deepEqual(payload.items[2], { key: 'LIGHTS', ok: false, severity: 'CAN_DRIVE', description: 'vasen takavalo' });
  assert.equal(inspectionPayload(allOk(), '').odometer_km, null);
  assert.equal(inspectionPayload(allOk(), 'abc').odometer_km, null);
});

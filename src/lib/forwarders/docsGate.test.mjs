import test from 'node:test';
import assert from 'node:assert/strict';
import { DOCS_GATE_CODE, GATE_OPEN, gateBlocked, gateFromRow, isDocsGateError, pendingKinds } from './docsGate.ts';

test('документы экспедитора: свой код базы', () => {
  assert.equal(DOCS_GATE_CODE, '55018');
  assert.equal(isDocsGateError({ code: '55018' }), true);
  assert.equal(isDocsGateError({ code: '55009' }), false);
  assert.equal(isDocsGateError(null), false);
  assert.equal(isDocsGateError(undefined), false);
});

test('документы экспедитора: нет строки — открыто', () => {
  assert.deepEqual(gateFromRow(null), GATE_OPEN);
  assert.equal(gateBlocked(gateFromRow(undefined)), false);
});

test('документы экспедитора: не нужны — открыто, что бы ни пришло', () => {
  const gate = gateFromRow({ required: false, ok: false, register_extract: 'MISSING', insurance: 'MISSING', overall: 'MISSING' });
  assert.equal(gateBlocked(gate), false);
  assert.equal(gate.overall, 'OK');
  assert.deepEqual(pendingKinds(gate), []);
});

test('документы экспедитора: нужны и нет — закрыто, оба в списке', () => {
  const gate = gateFromRow({ required: true, ok: false, register_extract: 'MISSING', insurance: 'REJECTED', overall: 'MISSING' });
  assert.equal(gateBlocked(gate), true);
  assert.deepEqual(pendingKinds(gate), [
    { kind: 'REGISTER_EXTRACT', state: 'MISSING' },
    { kind: 'FORWARDER_INSURANCE', state: 'REJECTED' },
  ]);
});

test('документы экспедитора: на проверке — закрыто, итог REVIEW', () => {
  const gate = gateFromRow({ required: true, ok: false, register_extract: 'OK', insurance: 'PENDING', overall: 'REVIEW' });
  assert.equal(gateBlocked(gate), true);
  assert.equal(gate.overall, 'REVIEW');
  assert.deepEqual(pendingKinds(gate), [{ kind: 'FORWARDER_INSURANCE', state: 'PENDING' }]);
});

test('документы экспедитора: приняты — открыто', () => {
  const gate = gateFromRow({ required: true, ok: true, register_extract: 'OK', insurance: 'OK', overall: 'OK' });
  assert.equal(gateBlocked(gate), false);
  assert.deepEqual(pendingKinds(gate), []);
});

test('документы экспедитора: незнакомое значение — как «нет»', () => {
  const gate = gateFromRow({ required: true, ok: false, register_extract: 'WHAT', insurance: null, overall: 'X' });
  assert.equal(gate.registerExtract, 'MISSING');
  assert.equal(gate.insurance, 'MISSING');
  assert.equal(gate.overall, 'MISSING');
});

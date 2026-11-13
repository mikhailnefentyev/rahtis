/*
 * Сроки обслуживания: что наступит раньше, ступени напоминаний. Запуск: npm test.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addMonths, compareDue, dueKey, dueStatus, nextDue, reachedStages, worstState } from './status.ts';

const today = '2026-11-13';

test('нет ни даты, ни пробега — срока нет', () => {
  assert.equal(dueStatus({ next_due_on: null, next_due_km: null }, today, 100000).state, 'NONE');
});

test('дата далеко — в норме; за 30 дней — скоро; вчера — просрочено', () => {
  assert.equal(dueStatus({ next_due_on: '2027-03-01', next_due_km: null }, today, null).state, 'OK');
  assert.equal(dueStatus({ next_due_on: '2026-12-13', next_due_km: null }, today, null).state, 'SOON');
  const overdue = dueStatus({ next_due_on: '2026-11-12', next_due_km: null }, today, null);
  assert.equal(overdue.state, 'OVERDUE');
  assert.equal(overdue.daysLeft, -1);
});

test('что раньше: дата далеко, но пробег уже набран — просрочено', () => {
  const s = dueStatus({ next_due_on: '2027-06-01', next_due_km: 500000 }, today, 500100);
  assert.equal(s.state, 'OVERDUE');
  assert.equal(s.kmLeft, -100);
});

test('пробег неизвестен — судим только по дате', () => {
  assert.equal(dueStatus({ next_due_on: '2027-06-01', next_due_km: 500000 }, today, null).state, 'OK');
});

test('1500 км до ТО — скоро', () => {
  assert.equal(dueStatus({ next_due_on: null, next_due_km: 501500 }, today, 500000).state, 'SOON');
});

test('сначала просроченное, потом ближайшее', () => {
  const a = dueStatus({ next_due_on: '2026-12-10', next_due_km: null }, today, null);
  const b = dueStatus({ next_due_on: '2026-11-01', next_due_km: null }, today, null);
  const c = dueStatus({ next_due_on: '2026-11-20', next_due_km: null }, today, null);
  assert.deepEqual([a, b, c].sort(compareDue).map((s) => s.daysLeft), [-12, 7, 27]);
  assert.equal(worstState(['OK', 'SOON', 'NONE']), 'SOON');
  assert.equal(worstState([]), 'NONE');
});

test('месяцы: конец месяца не перескакивает', () => {
  assert.equal(addMonths('2026-01-31', 1), '2026-02-28');
  assert.equal(addMonths('2026-11-13', 12), '2027-11-13');
  assert.equal(addMonths('2026-11-13', 24), '2028-11-13');
});

test('следующий срок из последнего раза и интервала', () => {
  assert.deepEqual(nextDue({ lastDoneOn: '2026-05-02', lastDoneKm: 410000, intervalMonths: 12, intervalKm: 90000 }), {
    on: '2027-05-02',
    km: 500000,
  });
  assert.deepEqual(nextDue({ lastDoneOn: null, lastDoneKm: null, intervalMonths: 12, intervalKm: null }), { on: null, km: null });
});

test('ступени: только самая поздняя из ряда, просрочка — одна', () => {
  assert.deepEqual(reachedStages(dueStatus({ next_due_on: '2026-11-18', next_due_km: null }, today, null)), ['D7']);
  assert.deepEqual(reachedStages(dueStatus({ next_due_on: '2026-11-14', next_due_km: null }, today, null)), ['D1']);
  assert.deepEqual(reachedStages(dueStatus({ next_due_on: '2026-12-01', next_due_km: 501800 }, today, 500000)), ['D30', 'K2000']);
  assert.deepEqual(reachedStages(dueStatus({ next_due_on: '2026-11-01', next_due_km: null }, today, null)), ['OVERDUE']);
  assert.deepEqual(reachedStages(dueStatus({ next_due_on: '2027-11-01', next_due_km: null }, today, null)), []);
});

test('ключ срока меняется, когда срок сдвинули', () => {
  assert.notEqual(dueKey({ next_due_on: '2026-11-20', next_due_km: null }), dueKey({ next_due_on: '2027-11-20', next_due_km: null }));
});

/*
 * Тесты проверки смены (практика «Спланируй смену»). Запуск: npm test.
 *
 * Случаи — из задания на модуль (docs/training, п. 7). Время в минутах.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { shiftSegments, validateShift } from './shift.ts';

const drive = (minutes) => ({ kind: 'drive', minutes });
const rest = (minutes) => ({ kind: 'break', minutes });
const work = (minutes) => ({ kind: 'work', minutes });

/** Сценарий, под который план подогнан точно: проверяем правила, а не задание. */
const exact = (blocks, limitMinutes = 540) => ({
  driveMinutes: blocks.filter((b) => b.kind === 'drive').reduce((a, b) => a + b.minutes, 0),
  workMinutes: blocks.filter((b) => b.kind === 'work').reduce((a, b) => a + b.minutes, 0),
  limitMinutes,
});

const codes = (findings) => findings.map((f) => f.code);
const errors = (findings) => findings.filter((f) => f.level === 'error').map((f) => f.code);

test('4 ч 30 мин вождения, 45 мин перерыв, вождение — нарушений нет', () => {
  const plan = [drive(270), rest(45), drive(180)];
  const findings = validateShift(plan, exact(plan));
  assert.deepEqual(errors(findings), []);
  assert.equal(findings[0].code, 'ok');
});

test('15 мин, затем 30 мин — это полный перерыв', () => {
  const plan = [drive(120), rest(15), drive(150), rest(30), drive(240)];
  const findings = validateShift(plan, exact(plan));
  assert.deepEqual(errors(findings), []);
  assert.ok(!codes(findings).includes('split_first_part'));
});

test('30 мин, затем 15 мин — не засчитывается, после 4 ч 30 мин нарушение', () => {
  const plan = [drive(120), rest(30), drive(120), rest(15), drive(60)];
  const findings = validateShift(plan, exact(plan));
  assert.deepEqual(errors(findings), ['continuous_driving']);
  assert.ok(codes(findings).includes('split_first_part'));
  /* 120 + 120 + 30 из последнего отрезка: превышение на 270-й минуте вождения, 315-й минуте смены. */
  assert.equal(findings.find((f) => f.code === 'continuous_driving').atMinute, 315);
});

test('30 мин, затем 15 мин без превышения 4 ч 30 мин — нарушения нет', () => {
  const plan = [drive(120), rest(30), drive(90), rest(15), drive(60)];
  assert.deepEqual(errors(validateShift(plan, exact(plan))), []);
});

test('погрузка не сбрасывает счётчик непрерывного вождения', () => {
  const plan = [drive(240), work(45), drive(60)];
  const findings = validateShift(plan, exact(plan));
  assert.deepEqual(errors(findings), ['continuous_driving']);
});

test('вождение больше 9 ч в сценарии с лимитом 9 ч — ошибка', () => {
  const plan = [drive(270), rest(45), drive(270), rest(45), drive(30)];
  assert.ok(errors(validateShift(plan, exact(plan, 540))).includes('daily_limit'));
});

test('вождение больше 10 ч в сценарии с лимитом 10 ч — ошибка', () => {
  const plan = [drive(270), rest(45), drive(270), rest(45), drive(90)];
  assert.ok(errors(validateShift(plan, exact(plan, 600))).includes('daily_limit'));
});

test('9 ч 30 мин при лимите 10 ч — не ошибка, но продление отмечено', () => {
  const plan = [drive(270), rest(45), drive(270), rest(45), drive(30)];
  const findings = validateShift(plan, exact(plan, 600));
  assert.deepEqual(errors(findings), []);
  assert.ok(codes(findings).includes('extension_used'));
});

test('смена длиннее 13 ч — предупреждение, не ошибка', () => {
  const plan = [work(120), drive(270), rest(45), drive(270), rest(60), work(60)];
  const findings = validateShift(plan, exact(plan));
  const long = findings.find((f) => f.code === 'long_shift');
  assert.equal(long.level, 'warn');
  assert.equal(long.total, 825);
  assert.deepEqual(errors(findings), []);
});

test('ровно 13 ч — без предупреждения', () => {
  const plan = [work(145), drive(270), rest(45), drive(270), rest(50)];
  assert.ok(!codes(validateShift(plan, exact(plan))).includes('long_shift'));
});

test('план не совпадает с заданием — ошибки по вождению и работе', () => {
  const findings = validateShift([drive(60)], { driveMinutes: 480, workMinutes: 60, limitMinutes: 540 });
  assert.deepEqual(errors(findings), ['drive_mismatch', 'work_mismatch']);
});

test('пустой план — одна ошибка', () => {
  assert.deepEqual(codes(validateShift([], { driveMinutes: 480, workMinutes: 0, limitMinutes: 540 })), ['empty']);
});

test('полоса: подряд идущие блоки слиты, превышение отмечено', () => {
  const segments = shiftSegments([drive(60), drive(60), drive(180), rest(15), rest(15)]);
  assert.deepEqual(
    segments.map((s) => [s.kind, s.minutes, s.over]),
    [
      ['drive', 300, true],
      ['break', 30, false],
    ],
  );
});

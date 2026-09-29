
import { createHash, randomBytes } from 'node:crypto';

/**
 * Ключ API: rhs_live_<8 hex>_<40 hex> или rhs_test_… для тестовой компании.
 *
 * Первые 17 символов (rhs_live_ + 8 hex) — префикс, по нему человек
 * узнаёт ключ в списке. Остальное — секрет. В базу уходит только SHA-256
 * всего ключа: ни при выпуске, ни при проверке сам ключ туда не попадает,
 * и утечка таблицы не даёт ни одного рабочего ключа.
 */

export type NewKey = { key: string; prefix: string; hash: string };

export function generateKey(isTest: boolean): NewKey {
  const prefix = `rhs_${isTest ? 'test' : 'live'}_${randomBytes(4).toString('hex')}`;
  const key = `${prefix}_${randomBytes(20).toString('hex')}`;
  return { key, prefix, hash: hashKey(key) };
}

export function hashKey(key: string): string {
  return createHash('sha256').update(key, 'utf8').digest('hex');
}

/** Форма ключа, до похода в базу: мусор отсекается сразу. */
export function looksLikeKey(value: string): boolean {
  return /^rhs_(live|test)_[0-9a-f]{8}_[0-9a-f]{40}$/.test(value);
}

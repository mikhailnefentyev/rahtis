/**
 * Проверка приёмки тренажёра: прогресс водителя не отдаётся чужим ролям.
 *
 * Идёт через тот же API, что браузер кабинета, — публичным ключом и
 * настоящим входом, а не служебным ключом. Служебным ключом скрипт только
 * готовит данные: кладёт водителю перевозчика временную строку прогресса,
 * чтобы было что прятать, и в конце убирает её.
 *
 * Проверяется:
 *   • перевозчик не видит прогресс даже своего водителя и не может его
 *     записать или стереть;
 *   • заказчик не видит ничего;
 *   • гость (без входа) не видит ничего;
 *   • непроверенные вопросы не видны ни перевозчику, ни гостю.
 *
 *   node scripts/check-training-rls.mjs
 *
 * Нужны в .env.local: NEXT_PUBLIC_SUPABASE_URL,
 * NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, SUPABASE_SECRET_KEY и тестовые входы
 * TRAINING_CHECK_CARRIER и TRAINING_CHECK_SHIPPER в виде «почта пароль».
 */
import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

for (const file of ['.env.local', '.env']) {
  const full = path.join(process.cwd(), file);
  if (!fs.existsSync(full)) continue;
  for (const line of fs.readFileSync(full, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishable = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const secret = process.env.SUPABASE_SECRET_KEY;
const login = (name) => {
  const [email, password] = (process.env[name] ?? '').trim().split(/\s+/);
  return email && password ? { email, password } : null;
};
const carrier = login('TRAINING_CHECK_CARRIER');
const shipper = login('TRAINING_CHECK_SHIPPER');

if (!url || !publishable || !secret || !carrier || !shipper) {
  console.error(
    'Не заданы NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, SUPABASE_SECRET_KEY, TRAINING_CHECK_CARRIER или TRAINING_CHECK_SHIPPER.',
  );
  process.exit(1);
}

const options = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(url, secret, options);
const failures = [];
const check = (ok, text) => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${text}`);
  if (!ok) failures.push(text);
};

async function signIn({ email, password }) {
  const client = createClient(url, publishable, options);
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`вход ${email}: ${error.message}`);
  return client;
}

const carrierClient = await signIn(carrier);
const shipperClient = await signIn(shipper);
const guest = createClient(url, publishable, options);

/* Водитель перевозчика — чтобы проверить самый чувствительный случай: «свой» водитель. */
const { data: me } = await carrierClient.auth.getUser();
const { data: profile } = await admin.from('profiles').select('company_id').eq('id', me.user.id).single();
const { data: driver } = await admin
  .from('drivers')
  .select('id, full_name')
  .eq('company_id', profile.company_id)
  .limit(1)
  .maybeSingle();

if (!driver) {
  console.error('У тестового перевозчика нет ни одного водителя — проверять нечего.');
  process.exit(1);
}

const KEY = 'tacho.rlscheck';
const now = new Date().toISOString();
await admin.from('training_progress').upsert({
  driver_id: driver.id,
  card_key: KEY,
  box: 1,
  due_at: now,
  last_answered_at: now,
  correct_count: 0,
  wrong_count: 3,
});

try {
  const visible = async (client) => {
    const { data, error } = await client.from('training_progress').select('card_key').eq('driver_id', driver.id);
    return error ? 0 : (data ?? []).length;
  };

  check((await visible(carrierClient)) === 0, `перевозчик не видит прогресс своего водителя (${driver.full_name})`);
  check((await visible(shipperClient)) === 0, 'заказчик не видит прогресс водителя');
  check((await visible(guest)) === 0, 'гость не видит прогресс водителя');

  const { error: syncError } = await carrierClient.rpc('training_sync', {
    p_cards: { [KEY]: { box: 5, due: Date.now(), last: Date.now(), right: 9, wrong: 0 } },
  });
  check(Boolean(syncError), 'перевозчик не может записать прогресс через training_sync');

  await carrierClient.from('training_progress').delete().eq('driver_id', driver.id);
  await carrierClient.from('training_progress').update({ box: 5 }).eq('driver_id', driver.id);
  const { data: still } = await admin
    .from('training_progress')
    .select('box')
    .eq('driver_id', driver.id)
    .eq('card_key', KEY)
    .maybeSingle();
  check(still?.box === 1, 'перевозчик не может стереть или поправить прогресс водителя');

  for (const [who, client] of [
    ['перевозчик', carrierClient],
    ['гость', guest],
  ]) {
    const { data } = await client.from('training_questions').select('id').is('reviewed_at', null).limit(1);
    check((data ?? []).length === 0, `${who} не видит непроверенные вопросы`);
  }
} finally {
  await admin.from('training_progress').delete().eq('driver_id', driver.id).eq('card_key', KEY);
}

if (failures.length) {
  console.error(`\nНе прошло: ${failures.length}`);
  process.exit(1);
}
console.log('\nВсё прошло.');

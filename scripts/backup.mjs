/**
 * Резервная копия данных и файлов.
 *
 * Схему копировать незачем: она целиком лежит в supabase/migrations и
 * версионируется вместе с кодом. Восстановление начинается с `db push` на
 * чистом проекте, и только потом сюда заливаются данные. Именно поэтому
 * дамп через pg_dump здесь не нужен — а он и невозможен без Docker.
 *
 * Копируются три вещи, которых нет в git:
 *   данные таблиц      — компании, машины, рейсы, счета, переписка;
 *   объекты Storage    — лицензии, страховки, накладные, фото, отчёты;
 *   учётные записи     — иначе после восстановления войти будет некому.
 *
 * Второе забывают чаще первого. Дамп базы без файлов даёт заказ, у
 * которого «есть накладная», и пустое место вместо самой накладной.
 *
 * Третье — с оговоркой, и важной: пароли не выгружаются. Их хэши через
 * API не отдаются ни при каких правах, и это правильно. Значит после
 * восстановления каждому придётся задать пароль заново по ссылке из
 * письма. Знать это надо сейчас, а не в день аварии.
 *
 * Внутри персональные данные: имена, телефоны, адреса, IBAN. Каталог
 * назначения обязан лежать вне репозитория, и скрипт это проверяет.
 *
 *   node scripts/backup.mjs [каталог]
 */
import fs from 'node:fs';
import path from 'node:path';

/*
 * Порядок важен: при восстановлении таблицы заливаются сверху вниз, и
 * ссылка не должна опережать то, на что ссылается. Родители первыми.
 */
const TABLES = [
  'companies',
  'profiles',
  'company_documents',
  'company_events',
  'vehicles',
  'vehicle_events',
  'legal_documents',
  'legal_clauses',
  'legal_acceptances',
  'place_guides',
  'orders',
  'order_stops',
  'order_offers',
  'order_documents',
  'order_amendments',
  'order_events',
  'order_ratings',
  'weekly_reports',
  'conversations',
  'messages',
  'notifications',
  'email_outbox',
  'support_messages',
  'audit_log',
  'incidents',
];

const BUCKETS = ['company-docs', 'trip-docs', 'reports'];

const root = process.cwd();

for (const file of ['.env.local', '.env']) {
  const full = path.join(root, file);
  if (!fs.existsSync(full)) continue;
  for (const line of fs.readFileSync(full, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;

if (!url || !key) {
  console.error('Нет NEXT_PUBLIC_SUPABASE_URL или SUPABASE_SECRET_KEY в .env.local.');
  process.exit(1);
}

const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
const target = path.resolve(process.argv[2] ?? path.join(root, '..', 'rahtis-backups'), `rahtis-${stamp}`);

/*
 * Копия внутри репозитория — это персональные данные на шаг от git push.
 * Проверка грубая нарочно: она обязана срабатывать и на C:\rahti\tmp, и
 * на любом вложенном каталоге.
 */
if (target.startsWith(root + path.sep) || target === root) {
  console.error('Каталог копии внутри репозитория. В копии персональные данные — держите её снаружи.');
  process.exit(1);
}

const { createClient } = await import('@supabase/supabase-js');
const db = createClient(url, key, { auth: { persistSession: false } });

fs.mkdirSync(path.join(target, 'data'), { recursive: true });
fs.mkdirSync(path.join(target, 'storage'), { recursive: true });

const manifest = { at: new Date().toISOString(), project: url, auth: {}, tables: {}, storage: {} };
let problems = 0;

console.log('копия в', target, '\n');

// ── Учётные записи ─────────────────────────────────────────────────
//
// Профили ссылаются на auth.users, и без записей там восстановление
// упрётся во внешний ключ на первой же строке profiles.
{
  const { data, error } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 });

  if (error) {
    console.log(' СБОЙ auth.users:', error.message);
    manifest.auth = { error: error.message };
    problems++;
  } else {
    /* Только то, что нужно для воссоздания. Токены и сессии не переносим. */
    const users = data.users.map((u) => ({
      id: u.id,
      email: u.email,
      email_confirmed_at: u.email_confirmed_at,
      created_at: u.created_at,
      user_metadata: u.user_metadata,
      app_metadata: u.app_metadata,
    }));

    fs.writeFileSync(path.join(target, 'data', '_auth_users.json'), JSON.stringify(users, null, 1));
    manifest.auth = { users: users.length, passwords: 'не выгружаются' };
    console.log(`  ok  ${'auth.users'.padEnd(20)} ${String(users.length).padStart(5)} записей (без паролей)`);
  }
}

// ── Таблицы ────────────────────────────────────────────────────────
for (const table of TABLES) {
  const { data, error } = await db.from(table).select('*');

  if (error) {
    console.log(` СБОЙ ${table}: ${error.message}`);
    manifest.tables[table] = { error: error.message };
    problems++;
    continue;
  }

  fs.writeFileSync(path.join(target, 'data', `${table}.json`), JSON.stringify(data, null, 1));
  manifest.tables[table] = { rows: data.length };
  console.log(`  ok  ${table.padEnd(20)} ${String(data.length).padStart(5)} строк`);
}

// ── Файлы ──────────────────────────────────────────────────────────
async function walk(bucket, prefix = '') {
  const { data, error } = await db.storage.from(bucket).list(prefix, { limit: 1000 });
  if (error || !data) return [];

  const found = [];
  for (const entry of data) {
    const full = prefix ? `${prefix}/${entry.name}` : entry.name;
    /* У папок нет id — по нему они и отличаются от объектов. */
    if (entry.id === null) found.push(...(await walk(bucket, full)));
    else found.push(full);
  }
  return found;
}

console.log('');
for (const bucket of BUCKETS) {
  const files = await walk(bucket);
  let saved = 0;

  for (const file of files) {
    const { data, error } = await db.storage.from(bucket).download(file);
    if (error || !data) {
      console.log(` СБОЙ ${bucket}/${file}: ${error?.message}`);
      problems++;
      continue;
    }

    const out = path.join(target, 'storage', bucket, file);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, Buffer.from(await data.arrayBuffer()));
    saved++;
  }

  manifest.storage[bucket] = { files: saved };
  console.log(`  ok  ${bucket.padEnd(20)} ${String(saved).padStart(5)} файлов`);
}

manifest.problems = problems;
fs.writeFileSync(path.join(target, 'manifest.json'), JSON.stringify(manifest, null, 2));

const bytes = (dir) =>
  fs.readdirSync(dir, { withFileTypes: true }).reduce((sum, e) => {
    const full = path.join(dir, e.name);
    return sum + (e.isDirectory() ? bytes(full) : fs.statSync(full).size);
  }, 0);

console.log(`\nобъём: ${(bytes(target) / 1024).toFixed(0)} КБ`);
console.log(problems === 0 ? 'копия снята полностью' : `копия снята, но сбоев: ${problems}`);
process.exit(problems === 0 ? 0 : 1);

/**
 * Восстановление копии в ПУСТОЙ проект.
 *
 * Порядок целиком: сначала `npx supabase db push` на чистом проекте —
 * он создаст схему из миграций, — и только потом этот скрипт зальёт
 * данные и файлы. Схему скрипт не трогает вовсе.
 *
 * Три замка от попадания в боевую базу, и все три обязательны:
 *   адрес и ключ передаются только аргументами, из .env ничего не берётся;
 *   адрес сверяется с боевым из .env.local и совпадение отвергается;
 *   без --yes скрипт показывает, что собирается делать, и выходит.
 *
 * Это не перестраховка. Восстановление перезаписывает данные, отката у
 * него нет, а перепутать проекты в панели с двумя одинаковыми названиями
 * проще, чем кажется.
 *
 *   node scripts/restore.mjs <каталог> --url https://xxx.supabase.co --key sb_secret_... [--yes]
 */
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : null;
};

const dir = args.find((a) => !a.startsWith('--') && !args[args.indexOf(a) - 1]?.startsWith('--'));
const url = flag('url');
const key = flag('key');
const confirmed = args.includes('--yes');

if (!dir || !url || !key) {
  console.error('Нужны каталог копии, --url и --key целевого проекта.');
  console.error('node scripts/restore.mjs <каталог> --url https://xxx.supabase.co --key sb_secret_...');
  process.exit(1);
}

// ── Замок: это не боевой проект? ───────────────────────────────────
const root = process.cwd();
let live = null;
if (fs.existsSync(path.join(root, '.env.local'))) {
  for (const line of fs.readFileSync(path.join(root, '.env.local'), 'utf8').split(/\r?\n/)) {
    const m = line.match(/^NEXT_PUBLIC_SUPABASE_URL=(.*)$/);
    if (m) live = m[1].replace(/^["']|["']$/g, '').trim();
  }
}

if (live && url.trim().replace(/\/$/, '') === live.replace(/\/$/, '')) {
  console.error('ОТКАЗ: указан боевой проект из .env.local.');
  console.error('Восстановление перезаписывает данные, и отката у него нет.');
  console.error('Создайте отдельный проект и укажите его адрес.');
  process.exit(1);
}

const manifestPath = path.join(dir, 'manifest.json');
if (!fs.existsSync(manifestPath)) {
  console.error('В каталоге нет manifest.json — это не копия, снятая scripts/backup.mjs.');
  process.exit(1);
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

console.log('копия     :', dir);
console.log('снята     :', manifest.at);
console.log('из проекта:', manifest.project);
console.log('в проект  :', url);
console.log('боевой    :', live ?? '(не найден в .env.local)');

if (!confirmed) {
  console.log('\nПроверка пройдена, но ничего не сделано: добавьте --yes, чтобы залить.');
  process.exit(0);
}

const { createClient } = await import('@supabase/supabase-js');
const db = createClient(url, key, { auth: { persistSession: false } });

let problems = 0;

// ── Учётные записи ─────────────────────────────────────────────────
//
// Идентификаторы сохраняются: на них ссылаются profiles и половина
// журналов. Пароля в копии нет и быть не может, поэтому люди войдут
// только после письма со ссылкой на установку пароля.
const usersFile = path.join(dir, 'data', '_auth_users.json');
if (fs.existsSync(usersFile)) {
  const users = JSON.parse(fs.readFileSync(usersFile, 'utf8'));
  let made = 0;

  for (const u of users) {
    const { error } = await db.auth.admin.createUser({
      id: u.id,
      email: u.email,
      email_confirm: Boolean(u.email_confirmed_at),
      user_metadata: u.user_metadata ?? {},
      app_metadata: u.app_metadata ?? {},
    });

    if (error && !/already/i.test(error.message)) {
      console.log(' СБОЙ auth:', u.email, error.message);
      problems++;
    } else made++;
  }

  console.log(`  ok  ${'auth.users'.padEnd(20)} ${String(made).padStart(5)} записей (пароли задать заново)`);
}

// ── Таблицы ────────────────────────────────────────────────────────
//
// Порядок задаётся именами файлов в manifest: он тот же, в котором
// снималась копия, то есть родители раньше ссылающихся.
for (const table of Object.keys(manifest.tables)) {
  const file = path.join(dir, 'data', `${table}.json`);
  if (!fs.existsSync(file)) continue;

  const rows = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (rows.length === 0) {
    console.log(`  ok  ${table.padEnd(20)}     0 строк`);
    continue;
  }

  /*
   * Числовой ключ означает identity-колонку: вписать в неё своё значение
   * через API нельзя, и оно там не нужно — на такие таблицы никто не
   * ссылается, это журналы. Ключи-uuid, наоборот, сохраняются: на них
   * держится половина связей.
   */
  const numericKey = typeof rows[0].id === 'number';
  const payload = numericKey
    ? rows.map((row) => {
        const copy = { ...row };
        delete copy.id;
        return copy;
      })
    : rows;

  let done = 0;
  for (let i = 0; i < payload.length; i += 200) {
    const chunk = payload.slice(i, i + 200);
    const { error } = await db.from(table).insert(chunk);

    if (error) {
      console.log(` СБОЙ ${table}: ${error.message}`);
      problems++;
      break;
    }
    done += chunk.length;
  }

  if (done) console.log(`  ok  ${table.padEnd(20)} ${String(done).padStart(5)} строк`);
}

// ── Файлы ──────────────────────────────────────────────────────────
console.log('');
const storageRoot = path.join(dir, 'storage');

for (const bucket of Object.keys(manifest.storage)) {
  const base = path.join(storageRoot, bucket);
  if (!fs.existsSync(base)) continue;

  /* Бакеты создаёт миграция, но на чистом проекте её могли не применить. */
  await db.storage.createBucket(bucket, { public: false }).catch(() => {});

  const walk = (d) =>
    fs.readdirSync(d, { withFileTypes: true }).flatMap((e) =>
      e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)],
    );

  let sent = 0;
  for (const full of walk(base)) {
    const rel = path.relative(base, full).split(path.sep).join('/');
    const { error } = await db.storage.from(bucket).upload(rel, fs.readFileSync(full), {
      upsert: true,
    });

    if (error) {
      console.log(` СБОЙ ${bucket}/${rel}: ${error.message}`);
      problems++;
      continue;
    }
    sent++;
  }

  console.log(`  ok  ${bucket.padEnd(20)} ${String(sent).padStart(5)} файлов`);
}

console.log(problems === 0 ? '\nвосстановлено полностью' : `\nвосстановлено, но сбоев: ${problems}`);
process.exit(problems === 0 ? 0 : 1);

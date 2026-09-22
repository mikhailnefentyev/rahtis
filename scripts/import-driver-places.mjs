/**
 * Загрузка справочника для водителя: заправки, стоянки, душ, сервис.
 *
 * Источник правды — data/driver-places/places.json. Файл собран из таблиц
 * data/driver-places/source/*.xlsx (исследование от 22.09.2026):
 * координаты получены из адресов через TomTom и проверены, тексты
 * переведены на финский и английский. Чтобы поправить точку, правят
 * places.json и запускают скрипт снова.
 *
 * Загрузка идемпотентна: точки обновляются по id, исчезнувшие из файла
 * удаляются. Нужен служебный ключ: таблица закрыта от записи всем, кроме
 * него.
 *
 *   npm run places:import
 */
import fs from 'node:fs';
import path from 'node:path';

for (const file of ['.env.local', '.env']) {
  if (!fs.existsSync(file)) continue;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
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

const file = path.join('data', 'driver-places', 'places.json');
const { places } = JSON.parse(fs.readFileSync(file, 'utf8'));

const { createClient } = await import('@supabase/supabase-js');
const db = createClient(url, key, { auth: { persistSession: false } });

const rows = places.map((p) => ({ ...p, updated_at: new Date().toISOString() }));

for (let i = 0; i < rows.length; i += 200) {
  const { error } = await db.from('driver_places').upsert(rows.slice(i, i + 200), { onConflict: 'id' });
  if (error) {
    console.error('Загрузка не прошла:', error.message);
    process.exit(1);
  }
}

/* Точки, которых больше нет в файле. */
const { data: existing, error: listError } = await db.from('driver_places').select('id');
if (listError) {
  console.error('Список точек не прочитан:', listError.message);
  process.exit(1);
}
const keep = new Set(rows.map((r) => r.id));
const stale = (existing ?? []).map((r) => r.id).filter((id) => !keep.has(id));
if (stale.length) {
  const { error } = await db.from('driver_places').delete().in('id', stale);
  if (error) {
    console.error('Лишние точки не удалены:', error.message);
    process.exit(1);
  }
}

console.log(`Точек загружено: ${rows.length}, удалено устаревших: ${stale.length}.`);

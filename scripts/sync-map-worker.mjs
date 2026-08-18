/**
 * Кладёт воркер maplibre и его общий модуль рядом в public/maplibre/.
 *
 * Зачем это нужно. maplibre грузит тайлы и шрифты в веб-воркере, а путь к
 * нему вычисляет через import.meta.url. Сборщик Next копирует
 * maplibre-gl-worker.mjs в /_next/static/media/ побайтово — вместе с
 * относительным импортом "./maplibre-gl-shared.mjs" внутри. Общий модуль
 * сборщик тоже кладёт туда, но под именем с другим хешем, поэтому импорт
 * упирается в 404, модульный воркер не инстанцируется и умирает молча:
 * карта показывает контроллы и атрибуцию, а холст остаётся пустым —
 * ни одной ошибки в консоли.
 *
 * Здесь оба файла копируются рядом друг с другом, и относительный импорт
 * снова разрешается. RouteMap указывает на эту копию через setWorkerUrl.
 *
 * Копирование скриптом, а не руками: иначе при обновлении maplibre в
 * public/ осталась бы версия от предыдущей, и расхождение вылезло бы
 * не там, где его будут искать.
 */
import { copyFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const from = join(root, 'node_modules', 'maplibre-gl', 'dist');
const to = join(root, 'public', 'maplibre');

/* Порядок важен только для читателя: воркер импортирует общий модуль. */
const files = ['maplibre-gl-worker.mjs', 'maplibre-gl-shared.mjs'];

await mkdir(to, { recursive: true });

for (const file of files) {
  await copyFile(join(from, file), join(to, file));
}

console.log(`maplibre: ${files.length} файла скопированы в public/maplibre/`);

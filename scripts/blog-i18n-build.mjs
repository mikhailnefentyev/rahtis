// Собирает переводы статей блога в JSON для сайта.
//
// Источник — content/blog-i18n/<язык>/<slug>.html: три строки заголовка
// (title, description, updated — дата статьи HeyCatch, с которой сделан
// перевод), строка «---», затем HTML статьи. Результат —
// src/lib/blog/i18n/<язык>.json: { slug: { title, description, updated, html } }.
//
// Запуск: node scripts/blog-i18n-build.mjs

import { readdirSync, readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const LOCALES = ['fi', 'en', 'sv', 'et', 'lv', 'lt', 'pl', 'de', 'ru'];
const SRC = 'content/blog-i18n';
const OUT = 'src/lib/blog/i18n';

mkdirSync(OUT, { recursive: true });
for (const locale of LOCALES) {
  const dir = join(SRC, locale);
  const result = {};
  if (existsSync(dir)) {
    for (const file of readdirSync(dir).filter((f) => f.endsWith('.html')).sort()) {
      const text = readFileSync(join(dir, file), 'utf8').replace(/\r\n/g, '\n');
      const cut = text.indexOf('\n---\n');
      if (cut < 0) throw new Error(`${locale}/${file}: нет строки ---`);
      const meta = Object.fromEntries(
        text
          .slice(0, cut)
          .split('\n')
          .map((line) => [line.slice(0, line.indexOf(':')).trim(), line.slice(line.indexOf(':') + 1).trim()]),
      );
      for (const key of ['title', 'description', 'updated']) {
        if (!meta[key]) throw new Error(`${locale}/${file}: нет ${key}`);
      }
      result[file.slice(0, -5)] = {
        title: meta.title,
        description: meta.description,
        updated: meta.updated,
        html: text.slice(cut + 5).trim(),
      };
    }
  }
  writeFileSync(join(OUT, `${locale}.json`), JSON.stringify(result) + '\n');
  console.log(locale, Object.keys(result).length);
}

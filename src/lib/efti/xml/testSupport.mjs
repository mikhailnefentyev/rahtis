/*
 * Общее для тестов XML-слоя eFTI (не тест сам по себе).
 *
 * 1) Модули слоя импортируют соседей без расширения ('./common') — так
 *    требует tsconfig и так их собирает Next. Голый `node --test` такие
 *    пути не находит, поэтому регистрируем хук: относительный путь без
 *    расширения → пробуем «.ts». Модули под тестом грузить ТОЛЬКО
 *    динамическим import() после импорта этого файла.
 * 2) validate(xml, schema) — проверка по XSD через xmllint-wasm на копии
 *    схем Fintraffic в ./schemas (platform-v1-schemas.zip, папка
 *    «Semantic XML Schemas» переименована в «semantic», ссылки
 *    schemaLocation поправлены соответственно).
 */
import { registerHooks } from 'node:module';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

registerHooks({
  resolve(specifier, context, nextResolve) {
    try {
      return nextResolve(specifier, context);
    } catch (err) {
      if (
        err?.code === 'ERR_MODULE_NOT_FOUND' &&
        /^\.\.?\//.test(specifier) &&
        !/\.[cm]?[jt]s$/.test(specifier)
      ) {
        return nextResolve(`${specifier}.ts`, context);
      }
      throw err;
    }
  },
});

const SCHEMA_DIR = fileURLToPath(new URL('./schemas/', import.meta.url));

function listFiles(dir, base = '') {
  return readdirSync(path.join(dir, base), { withFileTypes: true }).flatMap((d) =>
    d.isDirectory() ? listFiles(dir, path.posix.join(base, d.name)) : [path.posix.join(base, d.name)],
  );
}

const schemaFiles = listFiles(SCHEMA_DIR).map((fileName) => ({
  fileName,
  contents: readFileSync(path.join(SCHEMA_DIR, fileName), 'utf8'),
}));

export const SCHEMAS = {
  upload: 'gate-api-for-platform/v1-upload-identifier-request.xsd',
  cmds: 'platform-api-for-gate/v1-cmds-response.xsd',
  followUp: 'platform-api-for-gate/v1-follow-up-request.xsd',
};

/**
 * Проверка по XSD. `xml` — строка или массив строк (проверяются одним
 * запуском xmllint, имена document-0.xml…). Возвращает { valid, errors: string[] }.
 */
export async function validate(xml, schemaFileName) {
  const { validateXML } = await import('xmllint-wasm');
  const main = schemaFiles.find((f) => f.fileName === schemaFileName);
  if (!main) throw new Error(`no schema ${schemaFileName}`);
  const result = await validateXML({
    xml: (Array.isArray(xml) ? xml : [xml]).map((contents, i) => ({ fileName: `document-${i}.xml`, contents })),
    schema: [main],
    preload: schemaFiles.filter((f) => f !== main),
    maxMemoryPages: 4096,
  });
  return { valid: result.valid, errors: result.errors.map((e) => e.rawMessage) };
}

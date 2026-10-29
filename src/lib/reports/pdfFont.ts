import path from 'node:path';
import { Font } from '@react-pdf/renderer';

/**
 * Переносы слов в документах выключены.
 *
 * react-pdf по умолчанию рвёт длинное слово дефисом, когда оно не влезло
 * в колонку, и в шапке отчёта появилось «Asi-akirjat». Для финского это
 * особенно заметно: слова длинные, колонки узкие, а перенос ставится не
 * по правилам языка, а по ширине.
 *
 * Слово лучше целиком: узкая колонка перенесёт его на вторую строку, и
 * заголовок останется читаемым.
 */
Font.registerHyphenationCallback((word) => [word]);

/**
 * Шрифт всех PDF — Noto Sans (src/lib/reports/fonts, лицензия OFL).
 *
 * До 29.10.2026 документы набирались встроенной Helvetica: она знает только
 * Windows-1252, и кириллица выходила знаками вопроса, а литовские,
 * латышские и польские буквы теряли точки и хвостики (их подменяла
 * функция ansi). Noto Sans рисует всё это сама.
 *
 * Файлы читаются с диска; на Vercel их кладёт в каждую функцию
 * outputFileTracingIncludes (next.config.ts). Жирный — fontWeight: 'bold'.
 */
export const PDF_FONT = 'NotoSans';

const FONTS = path.join(process.cwd(), 'src', 'lib', 'reports', 'fonts');

Font.register({
  family: PDF_FONT,
  fonts: [
    { src: path.join(FONTS, 'NotoSans-Regular.ttf') },
    { src: path.join(FONTS, 'NotoSans-Bold.ttf'), fontWeight: 'bold' },
  ],
});

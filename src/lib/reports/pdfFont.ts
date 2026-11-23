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

/**
 * Знаки, которые шрифт запоминает сразу после загрузки (23.11.2026).
 *
 * fontkit хранит по одному объекту на глиф и запоминает его с теми знаками,
 * с которыми глиф спросили первым. Составные буквы (Ü, Õ, Š, Ž, Ā, Ķ…)
 * собираются из частей, и при записи документа fontkit спрашивает часть —
 * «U» для «Ü» — без знака. Если до этого прямой «U» в процессе не
 * встречался, глиф запоминался «без буквы», и в СЛЕДУЮЩЕМ документе того же
 * процесса слово с «U» ломалось: строка рвалась внутри слова, а из текста
 * PDF буква пропадала («E R» вместо «EUR», « losottolaitos»). Проверено
 * печатью: эстонский договор, за ним латвийский или финский.
 *
 * С финскими документами это почти не проявлялось (Ä и Ö всегда рядом с A и
 * O), но эстонский договор без единой прямой «U» портил следующий же
 * документ. Поэтому сразу после загрузки шрифта каждый знак латиницы,
 * кириллицы и пунктуации спрашивается по своему коду — глиф запоминается
 * уже с буквой. Очертания при этом не читаются, это только таблица знаков.
 */
const PRIMED_RANGES: [number, number][] = [
  [0x20, 0x24f], // латиница с диакритикой: финский, шведский, эстонский, латышский, литовский, польский, немецкий, румынский
  [0x400, 0x4ff], // кириллица
  [0x2010, 0x2044], // тире, кавычки, многоточие
  [0x20a0, 0x20bf], // знаки валют
];

type GlyphTable = { hasGlyphForCodePoint: (code: number) => boolean; glyphForCodePoint: (code: number) => unknown };

function primeGlyphs(data: unknown): void {
  const font = data as Partial<GlyphTable> | null;
  if (!font || typeof font.hasGlyphForCodePoint !== 'function' || typeof font.glyphForCodePoint !== 'function') return;
  for (const [from, to] of PRIMED_RANGES) {
    for (let code = from; code <= to; code++) {
      if (font.hasGlyphForCodePoint(code)) font.glyphForCodePoint(code);
    }
  }
}

for (const fontWeight of [400, 700]) {
  const source = Font.getFont({ fontFamily: PDF_FONT, fontWeight });
  const load = source.load.bind(source);
  let primed = false;
  /* Загрузку шрифта вызывает сам react-pdf перед вёрсткой; знаки запоминаются один раз, сразу за ней. */
  source.load = async () => {
    await load();
    if (!primed) {
      primed = true;
      primeGlyphs(source.data);
    }
  };
}

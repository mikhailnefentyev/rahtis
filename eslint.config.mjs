import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

/**
 * Правило «ноль пользовательского текста вне словарей» держится линтером,
 * а не договорённостью.
 *
 * Признак нарушения простой: кириллица в строковом литерале или в тексте
 * JSX внутри слоя представления. Комментарии под правило не подпадают —
 * они не литералы, и писать их по-русски можно.
 *
 * Слой представления — это src/app и src/components. В src/lib кириллица
 * разрешена: там она встречается в сообщениях об ошибках для разработчика
 * («Не задана переменная окружения…»), которые пользователь не видит
 * никогда, и в самих словарях.
 */
const noHardcodedText = [
  {
    selector: 'JSXText[value=/[\\u0400-\\u04FF]/]',
    message:
      'Пользовательский текст — только через словарь: t.* для подписей, m() для сообщений с подстановками.',
  },
  {
    selector: 'Literal[value=/[\\u0400-\\u04FF]/]',
    message:
      'Пользовательский текст — только через словарь: t.* для подписей, m() для сообщений с подстановками.',
  },
  {
    selector: 'TemplateElement[value.raw=/[\\u0400-\\u04FF]/]',
    message:
      'Пользовательский текст — только через словарь. Склейка строк ломает перевод: в другом языке порядок слов другой.',
  },
];

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,

  globalIgnores([
    // Default ignores of eslint-config-next:
    '.next/**',
    'out/**',
    'build/**',
    'next-env.d.ts',
    // Визуальный прототип — референс, а не код проекта. В сборку не входит.
    'rahti.jsx',
    // Копия воркера maplibre: чужой собранный код, кладётся скриптом.
    'public/maplibre/**',
  ]),

  {
    files: ['src/app/**/*.{ts,tsx}', 'src/components/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-syntax': ['error', ...noHardcodedText],
    },
  },

  {
    /**
     * Витрина UI-кита — инструмент разработки. Она не переводится, и её
     * служебные заголовки в словарь не выносятся: переводчик получил бы
     * полсотни строк, которых не увидит ни один пользователь. Продуктовые
     * формулировки внутри витрины всё равно берутся из словаря.
     */
    files: ['src/app/**/ui/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-syntax': 'off',
    },
  },
]);

export default eslintConfig;

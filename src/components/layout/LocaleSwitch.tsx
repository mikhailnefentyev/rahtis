'use client';

import Link from 'next/link';
import { Suspense } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { LOCALE_COOKIE, LOCALE_NAMES, locales, type Locale } from '@/lib/i18n/config';

/**
 * Переключатель языка.
 *
 * Ведёт на тот же адрес под другим языком, а не на главную: человек
 * переключает язык, чтобы прочитать по-другому то, на что он сейчас
 * смотрит, а не чтобы начать сначала.
 *
 * Клиентский, потому что нужен текущий путь. Заодно записывает выбор в
 * куку: без неё следующий заход на «/» снова уйдёт по Accept-Language,
 * и выбор пропал бы через одну ссылку.
 *
 * Языков может стать больше двух, поэтому это ряд ссылок, а не тумблер:
 * тумблер пришлось бы переделывать на третьем языке.
 */
export function LocaleSwitch({ current }: { current: Locale }) {
  /*
   * Строка запроса читается внутри Suspense: без границы Next переводит
   * всю страницу в клиентский рендер, а на статических страницах и вовсе
   * отказывается собирать. Пока граница не разрешилась, показываем тот
   * же ряд без строки запроса — вид не прыгает.
   */
  return (
    <Suspense fallback={<Switch current={current} search="" />}>
      <WithSearch current={current} />
    </Suspense>
  );
}

function WithSearch({ current }: { current: Locale }) {
  return <Switch current={current} search={useSearchParams().toString()} />;
}

function Switch({ current, search }: { current: Locale; search: string }) {
  const pathname = usePathname();

  return (
    <nav className="locale-switch" aria-label={LOCALE_NAMES[current]}>
      {locales.map((locale) => {
        const active = locale === current;

        return (
          <Link
            key={locale}
            href={swapLocale(pathname, locale) + (search ? `?${search}` : '')}
            hrefLang={locale}
            data-on={active ? '' : undefined}
            aria-current={active ? 'true' : undefined}
            onClick={() => remember(locale)}
          >
            {locale.toUpperCase()}
            <span className="sr-only"> · {LOCALE_NAMES[locale]}</span>
          </Link>
        );
      })}
    </nav>
  );
}

/**
 * Меняет первый сегмент пути.
 *
 * Путь всегда начинается с языка: без префикса запрос не доходит до
 * страницы, его перенаправляет proxy. Но если сегмента почему-то нет,
 * язык дописывается спереди, а не подменяет чужой сегмент.
 */
function swapLocale(pathname: string, locale: Locale): string {
  const parts = pathname.split('/');
  if ((locales as readonly string[]).includes(parts[1] ?? '')) {
    parts[1] = locale;
    return parts.join('/');
  }
  return `/${locale}${pathname === '/' ? '' : pathname}`;
}

/** Год — столько же, сколько живёт привычка читать интерфейс на своём языке. */
function remember(locale: Locale) {
  document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=31536000; samesite=lax`;
}

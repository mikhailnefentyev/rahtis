'use client';

import Link from 'next/link';
import { Suspense, useEffect, useRef } from 'react';
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
 * Языков девять (пакеты стран, 21.10.2026), и ряд «FI EN SV ET…» в шапке
 * не помещался на телефоне. Поэтому это выпадающий список: закрытым он
 * занимает место одной кнопки, открытым — показывает язык его же словом
 * («Polski», «Deutsch»), а не кодом, который знает не каждый.
 */
export function LocaleSwitch({ current }: { current: Locale }) {
  /*
   * Строка запроса читается внутри Suspense: без границы Next переводит
   * всю страницу в клиентский рендер, а на статических страницах и вовсе
   * отказывается собирать. Пока граница не разрешилась, показываем тот
   * же ряд без строки запроса — вид не прыгает.
   */
  return (
    <Suspense fallback={<Switch current={current} search={null} />}>
      <WithSearch current={current} />
    </Suspense>
  );
}

function WithSearch({ current }: { current: Locale }) {
  return <Switch current={current} search={useSearchParams()} />;
}

function Switch({ current, search }: { current: Locale; search: URLSearchParams | null }) {
  const pathname = usePathname();
  const menu = useRef<HTMLDetailsElement>(null);

  /* Открытый список закрывается щелчком мимо него — как любое меню. */
  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (menu.current?.open && !menu.current.contains(event.target as Node)) menu.current.open = false;
    };
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, []);

  return (
    <details ref={menu} className="locale-menu">
      <summary className="locale-switch" aria-label={LOCALE_NAMES[current]}>
        <span data-on="">{current.toUpperCase()}</span>
        <span aria-hidden="true" className="locale-caret">▾</span>
      </summary>
      <nav className="locale-list" aria-label={LOCALE_NAMES[current]}>
        {locales.map((locale) => {
          const active = locale === current;
          const query = translateQuery(search, locale);

          return (
            <Link
              key={locale}
              href={swapLocale(pathname, locale) + (query ? `?${query}` : '')}
              hrefLang={locale}
              lang={locale}
              data-on={active ? '' : undefined}
              aria-current={active ? 'true' : undefined}
              onClick={() => {
                remember(locale);
                if (menu.current) menu.current.open = false;
              }}
            >
              <span className="locale-code">{locale.toUpperCase()}</span>
              {LOCALE_NAMES[locale]}
            </Link>
          );
        })}
      </nav>
    </details>
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

/**
 * Строка запроса для другого языка.
 *
 * Всё переносится как есть, кроме `next` со страницы входа: без правки
 * человек переключает язык на форме входа, входит — и попадает в кабинет
 * на прежнем языке.
 *
 * Правится только адрес, который уже начинается с известного языка. Это
 * тот же порог, что у `safeRedirect`: параметр приходит из строки
 * запроса, то есть от кого угодно, и трогать его можно, лишь убедившись,
 * что это наш внутренний путь, а не чужой сайт.
 */
function translateQuery(search: URLSearchParams | null, locale: Locale): string {
  if (!search) return '';

  const next = search.get('next');
  if (!next || !next.startsWith('/') || next.startsWith('//')) return search.toString();

  const parts = next.split('/');
  if (!(locales as readonly string[]).includes(parts[1] ?? '')) return search.toString();

  parts[1] = locale;
  const translated = new URLSearchParams(search);
  translated.set('next', parts.join('/'));
  return translated.toString();
}

/** Год — столько же, сколько живёт привычка читать интерфейс на своём языке. */
function remember(locale: Locale) {
  document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=31536000; samesite=lax`;
}

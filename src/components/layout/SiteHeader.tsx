'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { LocaleSwitch } from '@/components/layout/LocaleSwitch';
import { signInPath } from '@/lib/auth/paths';
import { useI18n } from '@/lib/i18n/provider';

/** Высота полосы. Тем же числом задан scroll-margin у секций. */
const HEAD_HEIGHT = 68;

/**
 * Шапка витрины: марка и разделы главной, закреплённые наверху.
 *
 * Два состояния, потому что фон под ней разный. Над первым экраном
 * подложки нет — иначе светлая полоса срезала бы верх съёмки, ради
 * которой экран и сделан во весь рост; марка там светлая. Ниже начинается
 * обычный светлый сайт, и шапка становится полосой с тёмной маркой.
 *
 * Переключается по метке в конце первого экрана, а не по числу пикселей:
 * высота экрана задана в svh и меняется от поворота телефона и от
 * свёрнутой адресной строки, а метка едет вместе с ней.
 *
 * Положение метки читается на прокрутке, хотя напрашивается
 * IntersectionObserver. Он здесь не работает: наблюдатель сообщает о
 * смене пересечения, а при переходе по якорю метка уходит из «ниже
 * экрана» сразу в «выше шапки» — оба раза «не пересекает». Перехода нет,
 * обработчик молчит, и шапка остаётся прозрачной поверх светлой
 * страницы, где её белые буквы не видны.
 *
 * Логотипа два файла, а не один с фильтром: буквы тёмно-синие, и
 * `invert` вместе с ними перекрасил бы голубой акцент у S — то
 * единственное, чем марка отличается от набранного текста.
 */
export function SiteHeader() {
  const { t, locale } = useI18n();
  const [solid, setSolid] = useState(false);

  useEffect(() => {
    /*
     * Метку ставит главная страница в конце первого экрана. Шапка живёт
     * только там же, поэтому пары «шапка — метка» достаточно: без метки
     * переключать было бы не по чему.
     */
    const sentinel = document.getElementById('hero-end');
    if (!sentinel) return;

    /*
     * Замер раз в кадр. Событий прокрутки за секунду приходят десятки, а
     * getBoundingClientRect заставляет браузер пересчитать раскладку —
     * без ограничения это делалось бы на каждое из них.
     */
    let frame = 0;

    const measure = () => {
      frame = 0;
      setSolid(sentinel.getBoundingClientRect().top <= HEAD_HEIGHT);
    };

    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };

    measure();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule, { passive: true });

    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
    };
  }, []);

  const menu = [
    { href: '#service', label: t.landing.menuService },
    { href: '#roles', label: t.landing.menuRoles },
    { href: '#steps', label: t.landing.menuSteps },
    { href: '#assistant', label: t.landing.menuAssistant },
  ];

  const home = `/${locale}`;

  /**
   * Марка возвращает к началу главной.
   *
   * Обычной ссылки для этого мало: шапка живёт только на главной, адрес
   * уже её, и браузер на переход по тому же адресу не отвечает ничем —
   * а если в адресе остался якорь раздела, то и вовсе вернёт к нему.
   *
   * href при этом остаётся настоящим: по нему работают «открыть в новой
   * вкладке» и копирование адреса. Перехват отменяется, если нажатие с
   * модификатором — иначе средняя кнопка и Ctrl открывали бы вкладку и
   * тут же прокручивали текущую.
   */
  function backToTop(event: React.MouseEvent<HTMLAnchorElement>) {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

    event.preventDefault();
    history.replaceState(null, '', home);
    window.scrollTo({
      top: 0,
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
        ? 'auto'
        : 'smooth',
    });
  }

  return (
    <header className="site-head" data-solid={solid || undefined}>
      <div className="site-head__inner">
        <Link href={home} className="site-head__mark" onClick={backToTop}>
          {/*
            * Обе версии в разметке, видимость решает CSS. Подмена src по
            * состоянию давала бы моргание на переключении: браузер
            * начинал бы грузить второй файл в момент, когда он уже нужен.
            */}
          <Image
            src="/logo-header-light.png"
            alt={t.brand.name}
            width={954}
            height={240}
            priority
            className="site-head__logo site-head__logo--light"
          />
          <Image
            src="/logo-header.png"
            alt=""
            aria-hidden="true"
            width={954}
            height={240}
            className="site-head__logo site-head__logo--dark"
          />
        </Link>

        <nav className="site-head__menu">
          {menu.map((item) => (
            <a key={item.href} href={item.href}>
              {item.label}
            </a>
          ))}
        </nav>

        <div className="site-head__side">
          <LocaleSwitch current={locale} />
          <Link href={signInPath(locale)} className="site-head__signin">
            {t.landing.menuSignIn}
          </Link>
        </div>
      </div>
    </header>
  );
}

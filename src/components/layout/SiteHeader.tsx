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
 * Переключает не позиция скролла, а наблюдатель за меткой в конце первого
 * экрана: высота экрана меняется от поворота телефона и от адресной
 * строки, и любое число в пикселях пришлось бы пересчитывать на каждый
 * resize.
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
     * rootMargin поднимает границу до нижней кромки полосы: переключение
     * происходит ровно тогда, когда метка уходит под шапку, а не когда
     * она покидает экран целиком.
     *
     * Решение принимается по координате, а не по isIntersecting: метка
     * не пересекает окно и когда она выше шапки, и когда она ещё ниже
     * экрана, а состояния это разные.
     */
    const io = new IntersectionObserver(
      ([entry]) => setSolid(entry.boundingClientRect.top <= HEAD_HEIGHT),
      { rootMargin: `-${HEAD_HEIGHT}px 0px 0px 0px`, threshold: 0 },
    );

    io.observe(sentinel);
    return () => io.disconnect();
  }, []);

  const menu = [
    { href: '#service', label: t.landing.menuService },
    { href: '#roles', label: t.landing.menuRoles },
    { href: '#steps', label: t.landing.menuSteps },
    { href: '#assistant', label: t.landing.menuAssistant },
  ];

  return (
    <header className="site-head" data-solid={solid || undefined}>
      <div className="site-head__inner">
        <Link href={`/${locale}`} className="site-head__mark">
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

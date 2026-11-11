import Image from "next/image";
import Link from "next/link";
import { buttonClass } from "@/components/ui";
import { signInPath } from "@/lib/auth/paths";
import type { Locale } from "@/lib/i18n";

/**
 * Тёмный баннер посадочных страниц (maansiirto, huolitsijoille,
 * peravaunun-vaihto): фото справа растворяется в фирменном тёмно-синем,
 * текст белый, главная кнопка «Hae mukaan» и вход контуром. На телефоне
 * фото — приглушённый фон на всю ширину.
 *
 * Кадрирование своё у каждого фото: грузовик должен оставаться в правой
 * половине при 1360 px, а не уходить в растворение. Классы перечислены
 * здесь целиком, а не собираются из кусков, иначе Tailwind их не найдёт.
 */
const PHOTOS = {
  /* Самосвал на карьере стоит правее середины. */
  earthworks: {
    src: "/media/maansiirto-hero.webp",
    image: "object-[60%_center] lg:object-[62%_center]",
    mask: "lg:[mask-image:linear-gradient(to_right,transparent_0%,black_50%)]",
  },
  /*
   * Контейнеровоз под кранами: кабина левее середины кадра, поэтому
   * растворение короче, а кадр прижат влево — кабина остаётся видна,
   * краны справа дают глубину.
   */
  forwarders: {
    src: "/media/huolinta-hero.webp",
    image: "object-[38%_center] lg:object-[10%_center]",
    mask: "lg:[mask-image:linear-gradient(to_right,transparent_0%,black_30%)]",
  },
  /* Тягач со шторным полуприцепом у парома: нос парома слева, тягач в середине. */
  trailerSwap: {
    src: "/media/peravaunu-hero.webp",
    image: "object-[55%_center] lg:object-[0%_center]",
    mask: "lg:[mask-image:linear-gradient(to_right,transparent_0%,black_30%)]",
  },
} as const;

export type LandingPhoto = keyof typeof PHOTOS;

export function landingPhotoSrc(photo: LandingPhoto): string {
  return PHOTOS[photo].src;
}

export function LandingHero({
  locale,
  photo,
  eyebrow,
  title,
  lede,
  ctaApply,
  ctaSignIn,
}: {
  locale: Locale;
  photo: LandingPhoto;
  eyebrow: string;
  title: string;
  lede: string;
  ctaApply: string;
  ctaSignIn: string;
}) {
  const p = PHOTOS[photo];
  return (
    <section className="relative isolate overflow-hidden bg-ink text-white">
      <div
        aria-hidden
        className={`absolute inset-y-0 right-0 -z-10 w-full opacity-30 lg:w-[62%] lg:opacity-100 ${p.mask}`}
      >
        <Image
          src={p.src}
          alt=""
          fill
          priority
          sizes="(min-width: 1024px) 62vw, 100vw"
          className={`object-cover brightness-[0.82] ${p.image}`}
        />
      </div>
      {/* Небо на фото светлее фона: затемнение слева и сверху прячет шов. */}
      <div
        aria-hidden
        className="absolute inset-0 -z-10 hidden bg-[radial-gradient(120%_90%_at_100%_70%,transparent_35%,var(--color-ink)_85%)] lg:block"
      />
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-gradient-to-t from-ink/70 via-transparent to-transparent"
      />
      <div className="mx-auto w-full max-w-5xl px-5 py-16 sm:py-24 lg:py-28">
        <div className="max-w-[34rem]">
          <p className="label-micro text-accent-bright">{eyebrow}</p>
          <h1 className="mt-3 max-w-[24ch] text-[clamp(30px,4.2vw,46px)] leading-[1.08] font-semibold tracking-tight text-balance text-white">
            {title}
          </h1>
          <p className="mt-4 max-w-[62ch] text-[17px] leading-relaxed text-white/75">
            {lede}
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link
              href={`/${locale}/apply`}
              className={buttonClass({
                variant: "primary",
                size: "lg",
                className: "h-12 text-[15px]",
              })}
            >
              {ctaApply}
            </Link>
            <Link
              href={signInPath(locale)}
              className="inline-flex h-12 items-center gap-2 rounded-control border border-white/30 px-5 text-[15px] font-semibold text-white transition-colors hover:bg-white/10"
            >
              {ctaSignIn}
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

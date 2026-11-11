import type { Metadata } from "next";
import { ProductLanding } from "@/components/domain/ProductLanding";
import { isLocale } from "@/lib/i18n";
import {
  TRAILER_SWAP,
  trailerSwapPath,
  TRAILER_SWAP_PHOTO,
} from "@/lib/landing/trailerSwap";
import { fiOrEnPath, pageMetadata } from "@/lib/seo";

/*
 * Посадочная для перевозчиков на смене прицепов в портах.
 * Финский слаг /peravaunun-vaihto, остальные языки — /trailer-swap.
 * Оба слага работают в каждой локали, canonical сводит к одному на язык.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const c = TRAILER_SWAP[locale];
  return pageMetadata({
    locale,
    paths: fiOrEnPath("/peravaunun-vaihto", "/trailer-swap"),
    title: c.metaTitle,
    description: c.metaDescription,
    image: { ...TRAILER_SWAP_PHOTO, alt: c.eyebrow },
  });
}

export default async function Page({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return (
    <ProductLanding
      locale={locale}
      copy={TRAILER_SWAP}
      path={trailerSwapPath}
      photo="trailerSwap"
      offer="subscription"
    />
  );
}

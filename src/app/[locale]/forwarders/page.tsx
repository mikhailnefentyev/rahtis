import type { Metadata } from "next";
import { ProductLanding } from "@/components/domain/ProductLanding";
import { isLocale } from "@/lib/i18n";
import {
  FORWARDERS,
  forwardersPath,
  FORWARDERS_PHOTO,
} from "@/lib/landing/forwarders";
import { fiOrEnPath, pageMetadata } from "@/lib/seo";

/*
 * Посадочная для экспедиторов: поиск перевозчиков и публикация грузов.
 * Финский слаг /huolitsijoille, остальные языки — /forwarders.
 * Оба слага работают в каждой локали, canonical сводит к одному на язык.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const c = FORWARDERS[locale];
  return pageMetadata({
    locale,
    paths: fiOrEnPath("/huolitsijoille", "/forwarders"),
    title: c.metaTitle,
    description: c.metaDescription,
    image: { ...FORWARDERS_PHOTO, alt: c.eyebrow },
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
      copy={FORWARDERS}
      path={forwardersPath}
      photo="forwarders"
      offer="free"
    />
  );
}

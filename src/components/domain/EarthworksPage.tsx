import { EARTHWORKS, earthworksPath } from "@/lib/landing/earthworks";
import { ProductLanding } from "./ProductLanding";

/**
 * Посадочная страница модуля объектов: самосвалы и земляные работы.
 * Рамка, баннер и разделы — общие с другими посадочными (ProductLanding).
 */
export function EarthworksPage({ locale }: { locale: string }) {
  return (
    <ProductLanding
      locale={locale}
      copy={EARTHWORKS}
      path={earthworksPath}
      photo="earthworks"
      offer="subscription"
    />
  );
}

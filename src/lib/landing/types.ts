/**
 * Общий вид текста посадочной страницы (maansiirto, huolitsijoille,
 * peravaunun-vaihto): баннер, шаги, что получаете, цена, вопросы, призыв.
 *
 * Цены в тексте — метками {price}, {from} и {discount}: их подставляет
 * fillPrices из config.ts, чтобы смена цены не забывала витрины.
 */
export type LandingCopy = {
  /** Заголовок вкладки и поисковой выдачи (≤ 60 знаков, без «· RAHTIS»). */
  metaTitle: string;
  /** Описание для выдачи (≤ 155 знаков). */
  metaDescription: string;
  eyebrow: string;
  title: string;
  lede: string;
  ctaApply: string;
  ctaSignIn: string;
  dayTitle: string;
  day: { title: string; text: string }[];
  featuresTitle: string;
  features: { title: string; text: string }[];
  priceTitle: string;
  priceText: string;
  faqTitle: string;
  faq: { q: string; a: string }[];
  finalTitle: string;
  finalText: string;
  /** Карточка «для кого» на главной. */
  teaserEyebrow: string;
  teaserTitle: string;
  teaserText: string;
  teaserCta: string;
  /** Ссылка в подвале главной. */
  footerLink: string;
  /** Для разметки schema.org. */
  serviceType: string;
  features_ld: string[];
};

import { APP } from '@/lib/config';
import { ORG_SAME_AS, SITE_URL } from '@/lib/seo';

/**
 * Короткая карточка организации для внутренних страниц (заявка, условия,
 * API). Полная, со странами и описанием, — на главной.
 */
export function OrganisationLd() {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'RAHTIS',
    legalName: APP.operator.legalName,
    url: `${SITE_URL}/`,
    logo: `${SITE_URL}/og.png`,
    email: APP.operator.email,
    taxID: APP.operator.businessId,
    sameAs: ORG_SAME_AS,
  };
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />;
}

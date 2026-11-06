import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { LocaleSwitch } from '@/components/layout/LocaleSwitch';
import { OrganisationLd } from '@/components/layout/OrganisationLd';
import { APP } from '@/lib/config';
import { getI18n, isLocale } from '@/lib/i18n';
import { RULE_VERSIONS, RULES_UPDATED } from '@/lib/legal/ruleVersions';
import { pageMetadata, samePath } from '@/lib/seo';

/*
 * Правила площадки простым языком (P2B, 6.11.2026): цена, роль Aivomaa,
 * порядок стола (как в desk_orders: по времени публикации, без платного
 * поднятия), что стороны видят друг о друге, проверка компаний, отметки
 * об оплате, жалобы и уведомление об изменениях за 30 дней. Открыта
 * анониму на всех языках; обязывающий текст — условия (TERMS).
 */

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const { t } = await getI18n(locale);
  return pageMetadata({ locale, paths: samePath('/rules'), title: t.rules.title, description: t.rules.metaDescription });
}

export default async function RulesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const { t, f } = await getI18n(locale);
  const r = t.rules;
  const day = (d: string) => f.date(`${d}T12:00:00Z`);

  const sections: { id: string; title: string; body: string[] }[] = [
    { id: 'price', title: r.priceTitle, body: [r.priceShippers, r.priceCarriers, r.priceFormer, r.priceNoCommission] },
    { id: 'party', title: r.partyTitle, body: [r.partyBody, r.partyLegacy] },
    { id: 'board', title: r.boardTitle, body: [r.boardOrder, r.boardWho, r.boardGroup, r.boardFilter, r.boardOffers] },
    { id: 'see', title: r.seeTitle, body: [r.seeContract, r.seeCarrier, r.seeShipper, r.seeBank] },
    { id: 'verify', title: r.verifyTitle, body: [r.verifyRegistry, r.verifyDocs, r.verifyInsurance, r.verifyVehicles] },
    { id: 'reports', title: r.reportsTitle, body: [r.reportsBody, r.reportsRemoval, r.reportsReminders] },
    { id: 'route', title: r.routeTitle, body: [r.routeBody] },
    { id: 'complaints', title: r.complaintsTitle, body: [r.complaintsBody, r.complaintsSuspend] },
    { id: 'changes', title: r.changesTitle, body: [r.changesNotice] },
  ];

  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-10">
      <OrganisationLd />
      <nav className="mb-8 flex items-center justify-between gap-4">
        <Link href={`/${locale}`} className="text-[13px] text-ink-muted hover:text-ink">
          ← {t.brand.name}
        </Link>
        <LocaleSwitch current={locale} />
      </nav>

      <h1 className="text-2xl font-semibold tracking-tight">{r.title}</h1>
      <p className="mt-1 text-xs text-ink-dim">{r.updated.replace('{date}', day(RULES_UPDATED))}</p>
      <p className="mt-4 text-[15px] leading-relaxed text-ink-muted">{r.lead}</p>
      <p className="mt-3 flex flex-wrap gap-4 text-[13px]">
        <Link href={`/${locale}/${locale === 'fi' ? 'kayttoehdot' : 'terms'}`} className="text-accent hover:underline">
          {r.termsLink}
        </Link>
        <Link href={`/${locale}/${locale === 'fi' ? 'tietosuoja' : 'privacy'}`} className="text-accent hover:underline">
          {r.privacyLink}
        </Link>
      </p>

      <nav aria-label={r.contents} className="mt-8 rounded-control border border-line bg-sunken px-4 py-3">
        <p className="label-micro mb-2">{r.contents}</p>
        <ol className="flex list-decimal flex-col gap-1 pl-5 text-[13px]">
          {[...sections, { id: 'history', title: r.historyTitle }].map((s) => (
            <li key={s.id}>
              <a href={`#${s.id}`} className="text-accent hover:underline">
                {s.title}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      {sections.map((s, i) => (
        <section key={s.id} id={s.id} className="mt-10 scroll-mt-20">
          <h2 className="text-lg font-semibold tracking-tight">
            {i + 1}. {s.title}
          </h2>
          {s.body.map((p) => (
            <p key={p.slice(0, 40)} className="mt-3 text-[15px] leading-relaxed">
              {p}
            </p>
          ))}
        </section>
      ))}

      <section id="history" className="mt-10 scroll-mt-20">
        <h2 className="text-lg font-semibold tracking-tight">
          {sections.length + 1}. {r.historyTitle}
        </h2>
        <ul className="mt-3 flex flex-col gap-3">
          {RULE_VERSIONS.map((v) => (
            <li key={v.version} className="rounded-control border border-line px-4 py-3">
              <p className="font-mono text-[13px] font-semibold">{v.version}</p>
              <p className="text-xs text-ink-dim">
                {r.historyDate.replace('{published}', day(v.published)).replace('{effective}', day(v.effective))}
              </p>
              <p className="mt-2 text-[14px] leading-relaxed">{r[v.summaryKey]}</p>
            </li>
          ))}
        </ul>
      </section>

      <p className="mt-10 border-t border-line pt-4 text-xs text-ink-dim">
        {t.brand.legalEntity} · {APP.operator.businessId} · {APP.operator.email}
      </p>
    </main>
  );
}

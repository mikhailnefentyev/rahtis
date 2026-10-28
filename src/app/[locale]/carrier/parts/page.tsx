import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { requireRole } from '@/lib/auth/guard';
import { isLocale } from '@/lib/i18n';
import { getViewerI18n } from '@/lib/i18n/viewer';
import { createClient } from '@/lib/supabase/server';
import { PartsSearch } from './PartsSearch';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const { t } = await getViewerI18n(locale);
  return { title: t.parts.title };
}

/**
 * Varaosat: быстрый поиск запчасти у поставщиков, разборок и дилера марки.
 *
 * Этап 1 — прямые ссылки и готовый запрос цены (без базы). Этап 2 —
 * заявка поставщикам в RAHTIS с ответами «цена + срок» в одной карточке
 * (docs/parts/PLAN.md).
 */
export default async function PartsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const viewer = await requireRole(locale, 'CARRIER');
  const [{ t }, supabase] = await Promise.all([getViewerI18n(locale), createClient()]);
  const { data: vehicles } = await supabase
    .from('vehicles')
    .select('id, plate, make')
    .eq('company_id', viewer.company!.id)
    .order('plate');

  return (
    <main className="cab-page">
      <h1 className="page-title">{t.parts.title}</h1>
      <p className="mt-2 max-w-3xl text-[13px] leading-relaxed text-ink-muted">{t.parts.lede}</p>
      <div className="mt-6 max-w-5xl">
        <PartsSearch vehicles={vehicles ?? []} company={viewer.company!.name} />
      </div>
    </main>
  );
}

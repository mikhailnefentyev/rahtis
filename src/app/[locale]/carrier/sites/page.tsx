import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { requireRole } from '@/lib/auth/guard';
import { isLocale } from '@/lib/i18n';
import { getViewerI18n } from '@/lib/i18n/viewer';
import { createClient } from '@/lib/supabase/server';
import { SitesView } from './SitesView';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const { t } = await getViewerI18n(locale);
  return { title: t.sites.title };
}

/** Объекты перевозчика: самосвальная работа у клиента — по часам, рейсам или тоннам. */
export default async function SitesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const viewer = await requireRole(locale, 'CARRIER');
  const [{ t }, supabase] = await Promise.all([getViewerI18n(locale), createClient()]);

  const [{ data: jobs }, { data: scaleSites }] = await Promise.all([
    supabase
      .from('site_jobs')
      .select('*')
      .eq('company_id', viewer.company!.id)
      .order('status', { ascending: true })
      .order('created_at', { ascending: false }),
    supabase.from('scale_sites').select('id, name, city').order('name'),
  ]);

  return (
    <main className="cab-page">
      <h1 className="page-title">{t.sites.title}</h1>
      <p className="mt-2 mb-6 max-w-2xl text-[13px] leading-relaxed text-ink-muted">{t.sites.lede}</p>
      <SitesView jobs={jobs ?? []} scaleSites={scaleSites ?? []} />
    </main>
  );
}

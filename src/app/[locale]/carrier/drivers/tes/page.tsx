import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireRole } from '@/lib/auth/guard';
import { getI18n, isLocale } from '@/lib/i18n';
import { createClient } from '@/lib/supabase/server';
import { TesView } from './TesView';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const { t } = await getI18n(locale);
  return { title: t.tes.title };
}

export default async function TesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  await requireRole(locale, 'CARRIER');
  const [{ t }, supabase] = await Promise.all([getI18n(locale), createClient()]);

  /* RLS отдаёт свои наборы и шаблоны оператора (company_id is null). */
  const { data: sets } = await supabase
    .from('tes_rule_sets')
    .select('*')
    .order('valid_from', { ascending: false });

  return (
    <main className="mx-auto w-full max-w-4xl px-5 py-8">
      <Link href={`/${locale}/carrier/drivers`} className="text-[13px] text-ink-faint hover:text-ink">
        ← {t.drivers.back}
      </Link>
      <h1 className="mt-3 text-xl font-semibold tracking-tight">{t.tes.title}</h1>
      <p className="mt-2 mb-2 max-w-xl text-[13px] leading-relaxed text-ink-muted">{t.tes.subtitle}</p>
      <p className="mb-6 max-w-xl text-xs text-ink-dim">{t.tes.later}</p>

      <TesView
        own={(sets ?? []).filter((s) => s.company_id !== null)}
        templates={(sets ?? []).filter((s) => s.company_id === null)}
      />
    </main>
  );
}

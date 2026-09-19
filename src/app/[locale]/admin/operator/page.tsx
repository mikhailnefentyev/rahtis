import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Card, CardBody } from '@/components/ui';
import { requireRole } from '@/lib/auth/guard';
import { getI18n, isLocale } from '@/lib/i18n';
import { createClient } from '@/lib/supabase/server';
import { OperatorForm } from './form';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const { t } = await getI18n(locale);
  return { title: t.operator.title };
}

/**
 * Реквизиты юридического лица оператора.
 *
 * Отсюда их берут счета заказчикам, сводки периода, отчёты и письма о
 * расчётах. Читается сессией оператора — RLS строки открыта всем
 * вошедшим, потому что те же данные печатаются на каждом счёте.
 */
export default async function OperatorPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  await requireRole(locale, 'ADMIN');
  const [{ t, f }, supabase] = await Promise.all([getI18n(locale), createClient()]);

  const { data: profile } = await supabase.from('operator_profile').select('*').maybeSingle();
  if (!profile) notFound();

  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-8">
      <h1 className="text-xl font-semibold tracking-tight">{t.operator.title}</h1>
      <p className="mt-2 mb-5 max-w-xl text-[13px] leading-relaxed text-ink-muted">
        {t.operator.subtitle}
      </p>

      <Card>
        <CardBody>
          <OperatorForm profile={profile} />
        </CardBody>
      </Card>

      <p className="mt-3 text-xs text-ink-dim">
        {t.operator.updated} {f.dateTime(profile.updated_at)}
      </p>
    </main>
  );
}

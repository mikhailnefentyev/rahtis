import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Badge, Card, CardBody } from '@/components/ui';
import { requireRole } from '@/lib/auth/guard';
import { daysUntil } from '@/lib/dates';
import { getI18n, isLocale } from '@/lib/i18n';
import { createClient } from '@/lib/supabase/server';
import type { CompanyDocument } from '@/types/db';
import { DocumentCard } from './DocumentCard';
import { FleetView } from './FleetView';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const { t } = await getI18n(locale);
  return { title: t.fleet.title };
}

export default async function FleetPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const viewer = await requireRole(locale, 'CARRIER');
  const company = viewer.company!;

  const [{ t, m }, supabase] = await Promise.all([getI18n(locale), createClient()]);

  const [{ data: vehicles }, { data: documents }, { data: readiness }] = await Promise.all([
    supabase
      .from('vehicles')
      .select('*')
      .eq('company_id', company.id)
      .order('created_at', { ascending: true }),
    supabase.from('company_documents').select('*').eq('company_id', company.id).eq('is_current', true),
    /*
     * Право выйти на стол считает база, а не интерфейс: то же правило
     * действует в фильтре стола заказов, и держать его в двух местах
     * значит рано или поздно получить расхождение.
     */
    supabase.rpc('company_readiness', { p_company_id: company.id }),
  ]);

  const byKind = (kind: CompanyDocument['kind']) =>
    (documents ?? []).find((d) => d.kind === kind) ?? null;

  /* Остаток дней считается здесь: у клиента часы могут расходиться с базой. */
  const daysLeftFor = (document: CompanyDocument | null) =>
    document?.valid_until ? daysUntil(document.valid_until) : null;

  const state = readiness?.[0];
  const approved = state?.approved_vehicles ?? 0;
  const canTakeOrders = state?.can_take_orders ?? false;

  const reason = !state?.documents_ok
    ? state?.has_license && state?.has_insurance
      ? t.fleet.whyClosedExpired
      : t.fleet.whyClosedNoDocs
    : approved === 0
      ? t.fleet.whyClosedNoVehicle
      : null;

  return (
    <main className="mx-auto w-full max-w-4xl px-5 py-8">

      <h1 className="text-xl font-semibold tracking-tight">{t.fleet.title}</h1>
      <p className="mt-2 mb-6 max-w-xl text-[13px] leading-relaxed text-ink-muted">
        {t.fleet.subtitle}
      </p>

      {/* Состояние гейта — первое, что должен видеть перевозчик. */}
      <Card stripe={canTakeOrders ? 'ok' : 'warn'} className="mb-8">
        <CardBody className="flex flex-wrap items-center gap-3">
          <Badge tone={canTakeOrders ? 'ok' : 'warn'}>
            {canTakeOrders ? t.fleet.canTakeOrders : t.fleet.cannotTakeOrders}
          </Badge>
          <span className="text-[13px] text-ink-muted">
            {m('fleet.approvedCount', { count: approved })}
          </span>
          {reason && <span className="text-[13px] text-warn">{reason}</span>}
        </CardBody>
      </Card>

      <section className="mb-8">
        <h2 className="mb-4 border-b border-line pb-2 text-[13px] font-semibold tracking-tight text-ink-faint">
          {t.documents.title}
        </h2>
        <div className="grid gap-3 lg:grid-cols-2">
          <DocumentCard
            kind="CARRIER_LICENSE"
            document={byKind('CARRIER_LICENSE')}
            daysLeft={daysLeftFor(byKind('CARRIER_LICENSE'))}
          />
          <DocumentCard
            kind="INSURANCE"
            document={byKind('INSURANCE')}
            daysLeft={daysLeftFor(byKind('INSURANCE'))}
          />
        </div>
      </section>

      <FleetView vehicles={vehicles ?? []} documentsOk={state?.documents_ok ?? false} />
    </main>
  );
}

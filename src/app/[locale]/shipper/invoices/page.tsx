import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Badge, Card, CardBody, EmptyState, Mono } from '@/components/ui';
import { ShipperInvoices } from '@/components/domain/FreightInvoice';
import { requireRole } from '@/lib/auth/guard';
import { todayInHelsinki } from '@/lib/dates';
import { isLocale } from '@/lib/i18n';
import { getViewerI18n } from '@/lib/i18n/viewer';
import { loadShipperInvoices } from '@/lib/invoices/load';
import { createClient } from '@/lib/supabase/server';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const { t } = await getViewerI18n(locale);
  return { title: t.shipperInvoices.title };
}

type Seller = { name?: string; iban?: string; business_id?: string };

/**
 * Счета заказчику (17.11.2026).
 *
 * Сверху — счета, которые RAHTIS составил и отправил от имени перевозчиков
 * (carrier_invoices, получатель — эта компания): номер, перевозчик, период,
 * срок, сумма, статус, реквизиты для платежа и PDF. Ниже — счета, которые
 * перевозчик внёс вручную по отдельным рейсам (freight_invoices), с
 * отметкой об оплате. Платят перевозчику напрямую: Aivomaa Oy денег не
 * принимает.
 */
export default async function ShipperInvoicesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const viewer = await requireRole(locale, 'SHIPPER');

  const [{ t, f }, supabase, manual] = await Promise.all([getViewerI18n(locale), createClient(), loadShipperInvoices()]);
  const si = t.shipperInvoices;
  const today = todayInHelsinki();

  /* RLS отдаёт только счета, где получатель — своя компания. */
  const { data } = await supabase
    .from('carrier_invoices')
    .select('id, number, reference, issued_on, due_on, period_from, period_to, total_cents, currency, seller, paid_at, sent_at, file_path, kind')
    .eq('customer_company_id', viewer.company?.id ?? '00000000-0000-0000-0000-000000000000')
    .not('number', 'like', 'DRAFT-%')
    .order('issued_on', { ascending: false })
    .limit(200);
  const invoices = data ?? [];

  const day = (iso: string) => f.date(`${iso}T12:00:00Z`);
  const open = new Map<string, number>();
  for (const inv of invoices) {
    if (!inv.paid_at) open.set(inv.currency, (open.get(inv.currency) ?? 0) + Number(inv.total_cents));
  }

  return (
    <main className="cab-page">
      <h1 className="page-title">{si.title}</h1>
      <p className="mt-2 mb-6 max-w-2xl text-[13px] leading-relaxed text-ink-muted">{si.subtitle}</p>

      {open.size > 0 && (
        <Card className="mb-6">
          <CardBody className="flex flex-wrap items-baseline gap-x-6 gap-y-1">
            <span className="label-micro">{si.openTotal}</span>
            {[...open].map(([currency, cents]) => (
              <span key={currency} className="text-[17px] font-semibold tracking-tight">
                {f.money(cents, currency)}
              </span>
            ))}
          </CardBody>
        </Card>
      )}

      <section className="mb-10">
        <h2 className="mb-3 text-[15px] font-semibold tracking-tight">{si.sentTitle}</h2>
        {invoices.length === 0 ? (
          <EmptyState title={si.empty} />
        ) : (
          <ul className="flex flex-col gap-2.5">
            {invoices.map((inv) => {
              const seller = (inv.seller ?? {}) as Seller;
              const overdue = !inv.paid_at && inv.due_on < today;
              return (
                <li key={inv.id} className="rounded-control border border-line bg-surface px-3 py-2.5 text-[13px]">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="font-semibold">{seller.name ?? '—'}</span>
                    <Mono className="text-ink-muted">{inv.number}</Mono>
                    <span className="ml-auto text-[15px] font-semibold">{f.money(Number(inv.total_cents), inv.currency)}</span>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-muted">
                    <span>{si.period.replace('{from}', day(inv.period_from)).replace('{to}', day(inv.period_to))}</span>
                    <span>{si.issued.replace('{date}', day(inv.issued_on))}</span>
                    <span className={overdue ? 'font-semibold text-danger' : ''}>{si.due.replace('{date}', day(inv.due_on))}</span>
                    {inv.paid_at ? (
                      <Badge tone="ok">{si.statusPaid.replace('{date}', day(inv.paid_at))}</Badge>
                    ) : overdue ? (
                      <Badge tone="danger">{si.statusOverdue}</Badge>
                    ) : (
                      <Badge tone="warn">{si.statusOpen}</Badge>
                    )}
                  </div>
                  {!inv.paid_at && seller.iban && (
                    <p className="mt-1.5 text-xs text-ink-muted">
                      {si.payTo} <Mono>{seller.iban}</Mono> · {si.reference} <Mono>{inv.reference}</Mono>
                    </p>
                  )}
                  {inv.file_path && (
                    <a
                      href={`/${locale}/shipper/invoices/${inv.id}/pdf`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1.5 inline-block text-xs text-accent hover:underline"
                    >
                      {si.pdf}
                    </a>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        <p className="mt-3 max-w-2xl text-xs text-ink-dim">{si.payNote}</p>
      </section>

      <ShipperInvoices rows={manual} />
    </main>
  );
}

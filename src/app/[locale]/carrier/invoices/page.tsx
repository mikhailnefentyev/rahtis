import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Badge, Button, Card, CardBody, EmptyState, Mono } from '@/components/ui';
import { requireRole } from '@/lib/auth/guard';
import { todayInHelsinki } from '@/lib/dates';
import { isLocale } from '@/lib/i18n';
import { getViewerI18n } from '@/lib/i18n/viewer';
import { markSiteInvoicePaidAction } from '@/lib/invoices/actions';
import { createClient } from '@/lib/supabase/server';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const { t } = await getViewerI18n(locale);
  return { title: t.carrierInvoices.title };
}

type Customer = { name?: string };

/**
 * Счета перевозчика за прямые перевозки (22.11.2026).
 *
 * Счёт составляет и отправляет заказчику RAHTIS — от имени перевозчика, с
 * его номером и IBAN (lib/invoices/freight.ts). Прежде сам перевозчик его
 * нигде не видел: список счетов был только на странице объекта, а у счёта
 * за перевозки объекта нет. Здесь — номер, заказчик, период, срок, сумма,
 * ушло ли письмо, PDF и отметка об оплате: без неё заказчику идут
 * напоминания. Зеркало страницы «Счета» у заказчика.
 */
export default async function CarrierInvoicesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const viewer = await requireRole(locale, 'CARRIER');

  const [{ t, f }, supabase] = await Promise.all([getViewerI18n(locale), createClient()]);
  const ci = t.carrierInvoices;
  const si = t.shipperInvoices;
  const tw = t.trustWins;
  const today = todayInHelsinki();

  /* RLS отдаёт только счета своей компании; заказчик того же счёта видит его у себя. */
  const { data } = await supabase
    .from('carrier_invoices')
    .select('id, number, issued_on, due_on, period_from, period_to, total_cents, currency, customer, paid_at, sent_at, sent_to, file_path, reminder_1_at, reminder_2_at')
    .eq('company_id', viewer.company?.id ?? '00000000-0000-0000-0000-000000000000')
    .eq('kind', 'FREIGHT')
    .not('number', 'like', 'DRAFT-%')
    .order('issued_on', { ascending: false })
    .order('number', { ascending: false })
    .limit(200);
  const invoices = data ?? [];

  const day = (iso: string) => f.date(`${iso}T12:00:00Z`);
  const open = new Map<string, number>();
  for (const inv of invoices) {
    if (!inv.paid_at) open.set(inv.currency, (open.get(inv.currency) ?? 0) + Number(inv.total_cents));
  }

  return (
    <main className="cab-page">
      <h1 className="page-title">{ci.title}</h1>
      <p className="mt-2 mb-6 max-w-2xl text-[13px] leading-relaxed text-ink-muted">{ci.subtitle}</p>

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

      {invoices.length === 0 ? (
        <EmptyState title={si.empty} />
      ) : (
        <ul className="flex flex-col gap-2.5">
          {invoices.map((inv) => {
            const customer = (inv.customer ?? {}) as Customer;
            const overdue = !inv.paid_at && inv.due_on < today;
            const reminders = [inv.reminder_1_at, inv.reminder_2_at].filter((x): x is string => Boolean(x));
            return (
              <li key={inv.id} className="rounded-control border border-line bg-surface px-3 py-2.5 text-[13px]">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="font-semibold">{customer.name ?? '—'}</span>
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
                  <Badge tone={inv.sent_at ? 'ok' : 'warn'}>{inv.sent_at ? `${t.siteInvoice.sent} ${inv.sent_to ?? ''}` : t.siteInvoice.notSent}</Badge>
                  {reminders.length > 0 && <span>{tw.siteReminders.replace('{list}', reminders.map((x) => f.date(x)).join(', '))}</span>}
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2">
                  {inv.file_path && (
                    <a
                      href={`/${locale}/carrier/invoices/${inv.id}/pdf`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-accent hover:underline"
                    >
                      {si.pdf}
                    </a>
                  )}
                  {/* job_id пуст: действие обновит эту страницу, а не страницу объекта. */}
                  {inv.paid_at ? (
                    <form action={markSiteInvoicePaidAction}>
                      <input type="hidden" name="locale" value={locale} />
                      <input type="hidden" name="invoice_id" value={inv.id} />
                      <input type="hidden" name="clear" value="1" />
                      <Button type="submit" size="sm">
                        {tw.notReceived}
                      </Button>
                    </form>
                  ) : (
                    <form action={markSiteInvoicePaidAction} className="flex flex-wrap items-center gap-2">
                      <input type="hidden" name="locale" value={locale} />
                      <input type="hidden" name="invoice_id" value={inv.id} />
                      <label className="flex items-center gap-1.5 text-xs text-ink-muted">
                        {tw.paidDate}
                        <input
                          type="date"
                          name="paid_on"
                          defaultValue={today}
                          min={inv.issued_on}
                          max={today}
                          required
                          className="rounded-control border border-line bg-surface px-2 py-1 text-xs text-ink"
                        />
                      </label>
                      <Button type="submit" size="sm" variant="primary">
                        {tw.markPaid}
                      </Button>
                    </form>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <p className="mt-3 max-w-2xl text-xs text-ink-dim">{tw.siteRemindersHint}</p>
    </main>
  );
}

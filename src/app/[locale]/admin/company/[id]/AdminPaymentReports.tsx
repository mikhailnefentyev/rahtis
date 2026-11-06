import { Badge, Button, Card, CardBody, Input, Mono } from '@/components/ui';
import { ShipperTrustDetails } from '@/components/domain/ShipperTrust';
import { getI18n, type Locale } from '@/lib/i18n';
import { createClient } from '@/lib/supabase/server';
import { moderatePaymentReportAction } from '@/lib/trust/actions';
import { isReportStatus } from '@/lib/trust/model';
import { loadCompanyTrust } from '@/lib/trust/status';

/**
 * Сведения об оплате заказчика у оператора: та же сводка, что видят
 * перевозчики, и сами отметки — с перевозчиком и рейсом. Неверную
 * отметку оператор снимает с причиной (TERMS, раздел 8); снятая в счёт
 * не идёт, перевозчик её больше не правит.
 */
export async function AdminPaymentReports({ locale, companyId }: { locale: Locale; companyId: string }) {
  const [{ t, f }, supabase, trust] = await Promise.all([getI18n(locale), createClient(), loadCompanyTrust(companyId)]);
  const tr = t.trust;

  const { data: reports } = await supabase
    .from('direct_payment_reports')
    .select('*')
    .eq('shipper_company_id', companyId)
    .order('reported_at', { ascending: false })
    .limit(100);

  const carrierIds = [...new Set((reports ?? []).map((r) => r.carrier_company_id))];
  const orderIds = (reports ?? []).map((r) => r.order_id);
  const [{ data: carriers }, { data: orders }] = await Promise.all([
    carrierIds.length ? supabase.from('companies').select('id, name').in('id', carrierIds) : Promise.resolve({ data: [] }),
    orderIds.length ? supabase.from('orders').select('id, ref').in('id', orderIds) : Promise.resolve({ data: [] }),
  ]);
  const carrierName = new Map((carriers ?? []).map((c) => [c.id, c.name]));
  const orderRef = new Map((orders ?? []).map((o) => [o.id, o.ref]));
  const back = `/${locale}/admin/company/${companyId}`;

  return (
    <section className="mt-8">
      <h2 className="label-micro mb-3">{tr.adminTitle}</h2>
      {trust && (
        <Card>
          <CardBody>
            <ShipperTrustDetails trust={trust} />
          </CardBody>
        </Card>
      )}

      <h3 className="label-micro mt-5 mb-2">{tr.adminReports}</h3>
      {(reports ?? []).length === 0 ? (
        <p className="text-[13px] text-ink-muted">{tr.adminNoReports}</p>
      ) : (
        <div className="flex flex-col gap-2">
          {(reports ?? []).map((r) => {
            const status = isReportStatus(r.status) ? r.status : null;
            return (
              <Card key={r.id} stripe={r.removed_at ? 'neutral' : status === 'UNPAID' ? 'danger' : status === 'LATE' ? 'warn' : 'ok'}>
                <CardBody className="flex flex-col gap-1.5 text-[13px]">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={r.removed_at ? 'neutral' : status === 'UNPAID' ? 'danger' : status === 'LATE' ? 'warn' : 'ok'}>
                      {status ? tr[`status${status}`] : r.status}
                      {status === 'LATE' && r.days_late != null && ` · ${tr.daysLateShort.replace('{days}', String(r.days_late))}`}
                    </Badge>
                    <Mono className="text-xs text-ink-dim">{orderRef.get(r.order_id) ?? r.order_id}</Mono>
                    <span className="text-ink">{carrierName.get(r.carrier_company_id) ?? '—'}</span>
                    <span className="text-xs text-ink-dim">
                      {tr.adminReported} {f.date(r.reported_at)}
                    </span>
                  </div>
                  {r.note && <p className="text-ink-muted">{r.note}</p>}
                  {r.removed_at && (
                    <p className="text-xs text-ink-dim">
                      {tr.adminRemoved.replace('{date}', f.date(r.removed_at)).replace('{note}', r.removed_note ?? '—')}
                    </p>
                  )}
                  <form action={moderatePaymentReportAction} className="flex flex-wrap items-center gap-2 border-t border-line pt-2">
                    <input type="hidden" name="locale" value={locale} />
                    <input type="hidden" name="report_id" value={r.id} />
                    <input type="hidden" name="back" value={back} />
                    {r.removed_at ? (
                      <Button type="submit" name="remove" value="0" size="sm">
                        {tr.adminRestore}
                      </Button>
                    ) : (
                      <>
                        <Input name="note" required maxLength={1000} placeholder={tr.adminReason} aria-label={tr.adminReason} className="min-w-0 flex-1 basis-56" />
                        <Button type="submit" name="remove" value="1" variant="danger" size="sm">
                          {tr.adminRemove}
                        </Button>
                      </>
                    )}
                  </form>
                </CardBody>
              </Card>
            );
          })}
        </div>
      )}
    </section>
  );
}

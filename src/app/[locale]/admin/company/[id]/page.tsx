import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  Badge,
  Button,
  Card,
  CardBody,
  EmptyState,
  Mono,
  Plate,
  Stars,
} from '@/components/ui';
import { companyStatusTone, vehicleAccessTone } from '@/components/ui/tone';
import { requireRole } from '@/lib/auth/guard';
import { setCompanyTestAction, setPartnershipAction } from '@/lib/companies/actions';
import { daysUntil } from '@/lib/dates';
import { getI18n, isLocale } from '@/lib/i18n';
import { createClient } from '@/lib/supabase/server';
import type { CompanyDocument, DocumentKind } from '@/types/db';
import { AdminDocument } from './AdminDocument';

/**
 * Карточка компании глазами оператора.
 *
 * Очередь модерации отвечает на вопрос «одобрить или нет» и показывает
 * ровно то, что нужно для этого решения. Но решение принимается не только
 * в момент заявки: страховка кончается, лицензию подделывают, реквизиты
 * меняются молча. Посмотреть компанию целиком было негде.
 *
 * Здесь всё, по чему компанию проверяют: кто она по реестру, чем
 * подтверждает право возить, чем платит и что у неё в парке. Документы
 * открываются настоящими файлами — настоящая страховка отличается от
 * ненастоящей только тем, что её можно увидеть, а не тем, что у неё
 * заполнена дата.
 *
 * Ничего не редактируется. Это смотровое окно: решения принимаются
 * кнопками там, где они и были, — в очереди и в списке разобранных.
 */
export default async function AdminCompanyPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  if (!isLocale(locale)) notFound();

  await requireRole(locale, 'ADMIN');

  const [{ t, m }, supabase] = await Promise.all([getI18n(locale), createClient()]);

  const { data: company } = await supabase
    .from('companies')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (!company) notFound();

  const carrier = company.kind === 'CARRIER';

  /*
   * Всё одним заходом: страница читается целиком и сразу, а не
   * дорисовывается по частям. Заказы считаются с обеих сторон — компания
   * могла быть и заказчиком, и перевозчиком.
   */
  const [{ data: documents }, { data: vehicles }, { data: people }, { data: counts }] =
    await Promise.all([
      supabase
        .from('company_documents')
        .select('*')
        .eq('company_id', id)
        .eq('is_current', true),
      supabase
        .from('vehicles')
        .select('id, plate, driver_name, base_city, access, axles, make, euro_class, whatsapp')
        .eq('company_id', id)
        .order('plate'),
      supabase.from('profiles').select('id, full_name, phone, role').eq('company_id', id),
      /*
       * Функцией: исполнитель заказа закрыт колоночным грантом от всех
       * вошедших, и прямой фильтр по нему у оператора падал с 42501 —
       * у перевозчика всегда выходило «нет рейсов».
       */
      supabase.rpc('admin_company_orders', { p_company_id: id }),
    ]);

  const asShipper = Number(counts?.[0]?.as_shipper ?? 0);
  const asCarrier = Number(counts?.[0]?.as_carrier ?? 0);

  const byKind = (kind: DocumentKind): CompanyDocument | null =>
    (documents ?? []).find((d) => d.kind === kind) ?? null;

  /* Рейтинг принимает компанию: оператору он нужен по чужой, не по своей. */
  const rating = carrier ? (await supabase.rpc('carrier_rating', { p_company_id: id })).data?.[0] : null;

  const orders = (asShipper ?? 0) + (asCarrier ?? 0);

  /*
   * Строка реквизита показывается, только если она заполнена: пустые
   * подписи с прочерками занимают экран и создают вид проверенного.
   */
  const requisites: Array<[string, string | null]> = [
    [t.requisites.legalName, company.legal_name],
    [
      t.requisites.legalSection,
      [company.legal_street, company.legal_postal_code, company.legal_city, company.legal_country]
        .filter(Boolean)
        .join(', ') || null,
    ],
    [t.requisites.vat, company.vat_number],
    [t.requisites.iban, company.iban],
    [t.requisites.bic, company.bic],
    [t.requisites.ovt, company.einvoice_ovt],
    [t.requisites.operator, company.einvoice_operator],
    [t.requisites.billingEmail, company.billing_email],
    [t.requisites.billingReference, company.billing_reference],
  ];

  const filled = requisites.filter(([, value]) => Boolean(value));

  return (
    <main className="mx-auto w-full max-w-5xl px-5 py-8">
      <nav className="mb-6">
        <Link href={`/${locale}/admin`} className="text-[13px] text-ink-muted hover:text-ink">
          ← {t.role.ADMIN}
        </Link>
      </nav>

      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-line pb-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-xl font-semibold tracking-tight">{company.name}</h1>
            <Badge tone={companyStatusTone[company.status]}>
              {t.companyStatus[company.status]}
            </Badge>
            <Badge>{t.role[company.kind]}</Badge>
            {company.frozen_at && <Badge tone="danger">{t.moderation.frozen}</Badge>}
            {company.is_test && <Badge tone="warn">{t.moderation.test}</Badge>}
          </div>

          <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-ink-muted">
            <Mono>{company.business_id}</Mono>
            <span>{company.country}</span>
            <a href={`mailto:${company.contact_email}`} className="hover:text-ink">
              {company.contact_email}
            </a>
            <Mono className="text-ink-dim">{company.language}</Mono>
          </p>

          {/*
            * Причина заморозки и отказа — это то, что оператор написал
            * сам и о чём забудет через месяц.
            */}
          {company.frozen_at && company.freeze_reason && (
            <p className="mt-2 text-[13px] text-danger">{company.freeze_reason}</p>
          )}
          {company.status === 'REJECTED' && company.rejection_reason && (
            <p className="mt-2 text-[13px] text-ink-muted">{company.rejection_reason}</p>
          )}
        </div>

        {/*
          * Тестовая компания не попадает в счета и выплаты. Переключатель
          * здесь, у самой компании: решение про неё, а не про рейс.
          */}
        <form action={setCompanyTestAction} className="flex flex-col items-end gap-1">
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="company_id" value={company.id} />
          <input type="hidden" name="test" value={company.is_test ? 'false' : 'true'} />
          <Button type="submit" size="sm">
            {company.is_test ? t.moderation.unmarkTest : t.moderation.markTest}
          </Button>
          <span className="max-w-60 text-right text-xs text-ink-dim">{t.moderation.testHint}</span>
        </form>

        {/*
          * Ветка перевозчика: за что он платит. Стоит рядом с тестовой
          * отметкой — оба решения про саму компанию, а не про рейс, и
          * оба меняют деньги.
          */}
        {carrier && (
          <form action={setPartnershipAction} className="flex flex-col items-end gap-1">
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="company_id" value={company.id} />
            <input
              type="hidden"
              name="mode"
              value={company.partnership === 'SUBSCRIBER' ? 'SUBCONTRACTOR' : 'SUBSCRIBER'}
            />
            <span className="label-micro">{t.moderation.partnership}</span>
            <Badge tone={company.partnership === 'SUBSCRIBER' ? 'info' : 'neutral'}>
              {company.partnership === 'SUBSCRIBER'
                ? t.moderation.partnershipSub
                : t.moderation.partnershipCon}
            </Badge>
            <span className="max-w-72 text-right text-xs text-ink-dim">
              {company.partnership === 'SUBSCRIBER'
                ? t.moderation.partnershipSubHint
                : t.moderation.partnershipConHint}
            </span>
            <Button type="submit" size="sm" variant="ghost">
              {t.moderation.partnershipSwitch.replace(
                '{mode}',
                company.partnership === 'SUBSCRIBER'
                  ? t.moderation.partnershipCon
                  : t.moderation.partnershipSub,
              )}
            </Button>
          </form>
        )}

        {rating && (
          <div className="flex items-center gap-2">
            <span className="label-micro">{t.rating.company}</span>
            <Stars value={rating.score} count={rating.ratings_count} />
          </div>
        )}
      </header>

      {/*
        * Заказы числом, а не списком: здесь решают, можно ли компанию
        * удалить и сколько за ней истории. Сам список живёт в расчётах.
        */}
      <p className="mt-4 text-[13px] text-ink-muted">
        {m('admin.companyOrders', { count: orders })}
        {orders > 0 && ` · ${t.moderation.removeBlocked}`}
      </p>

      {carrier && (
        <section className="mt-8">
          <h2 className="label-micro mb-3">{t.documents.title}</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {(['CARRIER_LICENSE', 'INSURANCE'] as DocumentKind[]).map((kind) => {
              const doc = byKind(kind);
              return (
                <AdminDocument
                  key={kind}
                  kind={kind}
                  document={doc}
                  daysLeft={doc?.valid_until ? daysUntil(doc.valid_until) : null}
                />
              );
            })}
          </div>
        </section>
      )}

      <section className="mt-8">
        <h2 className="label-micro mb-3">{t.requisites.title}</h2>
        {filled.length === 0 ? (
          <EmptyState title={t.requisites.incomplete} description={t.requisites.fillToActivate} />
        ) : (
          <Card>
            <CardBody className="grid gap-2 sm:grid-cols-2">
              {filled.map(([label, value]) => (
                <p key={label} className="text-[13px]">
                  <span className="label-micro block">{label}</span>
                  <Mono className="text-ink">{value}</Mono>
                </p>
              ))}
            </CardBody>
          </Card>
        )}
      </section>

      {carrier && (
        <section className="mt-8">
          <h2 className="label-micro mb-3">{t.fleet.title}</h2>
          {(vehicles ?? []).length === 0 ? (
            <EmptyState title={t.fleet.noVehicles} description={t.fleet.noVehiclesHint} />
          ) : (
            <div className="flex flex-col gap-2">
              {(vehicles ?? []).map((v) => (
                <Card key={v.id}>
                  <CardBody className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                    <Badge tone={vehicleAccessTone[v.access]}>{t.vehicleAccess[v.access]}</Badge>
                    <Plate>{v.plate}</Plate>
                    <span className="text-[13px] text-ink">{v.driver_name}</span>
                    <span className="text-[13px] text-ink-muted">{v.base_city}</span>
                    <Mono className="text-xs text-ink-dim">
                      {v.make ?? '—'} · {v.axles} · {v.euro_class ?? '—'}
                    </Mono>
                    {v.whatsapp && <Mono className="text-xs text-ink-dim">{v.whatsapp}</Mono>}
                  </CardBody>
                </Card>
              ))}
            </div>
          )}
        </section>
      )}

      <section className="mt-8">
        <h2 className="label-micro mb-3">{t.admin.people}</h2>
        {(people ?? []).length === 0 ? (
          <p className="text-[13px] text-ink-muted">{t.moderation.noUsersYet}</p>
        ) : (
          <div className="flex flex-col gap-2">
            {(people ?? []).map((p) => (
              <Card key={p.id}>
                <CardBody className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <Badge>{t.role[p.role]}</Badge>
                  <span className="text-[13px] text-ink">{p.full_name ?? '—'}</span>
                  {p.phone && <Mono className="text-xs text-ink-dim">{p.phone}</Mono>}
                </CardBody>
              </Card>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

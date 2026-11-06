import Link from 'next/link';
import { Badge, Button, Card, CardBody, EmptyState, Mono, Textarea } from '@/components/ui';
import type { StatusTone } from '@/components/ui/tone';
import { reviewForwarderDocumentAction } from '@/lib/forwarders/actions';
import { belowThreshold, type ReviewStatus } from '@/lib/forwarders/policy';
import { getI18n, type Locale } from '@/lib/i18n';
import { asCurrency, convertCents } from '@/lib/money/currency';
import { latestFxRates } from '@/lib/money/fx';
import { freshUntil, isShipperDocKind } from '@/lib/shipper-docs/model';
import { createClient } from '@/lib/supabase/server';
import type { CompanyDocument } from '@/types/db';
import { OpenDocumentButton } from './OpenDocumentButton';

const reviewTone: Record<ReviewStatus, StatusTone> = { PENDING: 'warn', APPROVED: 'ok', REJECTED: 'danger' };

export type ReviewDocument = CompanyDocument & { company?: { name: string; country: string; business_id: string } | null };

/**
 * Полисы и лицензии экспедиторов на проверке у оператора.
 *
 * Как у документов перевозчика (AdminDocument): главное — открыть файл,
 * поля полиса — подсказка, а не доказательство. Рядом — чек-лист
 * проверки (исследование 6.11.2026, п. 5.3): подлинность сверяется со
 * страховщиком по контактам с его сайта, не из документа, — поддельные
 * сертификаты прямо названы инструментом мошенничества (IUMI/TAPA 2026).
 *
 * Отклонить можно и одобренный прежде документ — так приостанавливается
 * прямой режим (TERMS, раздел 8).
 *
 * Тот же список — для документов заказчика (kinds = 'shipper', 6.11.2026):
 * выписка, налоговые справки, право подписи. У них свой чек-лист на
 * каждом документе, даты выдачи и срока отметки и имя загрузившего —
 * для сверки с доверенностью.
 */
export async function ForwarderReview({
  locale,
  documents,
  back,
  showCompany = true,
  kinds = 'forwarder',
}: {
  locale: Locale;
  documents: ReviewDocument[];
  /** Куда вернуться после решения: пульт или карточка компании. */
  back: string;
  showCompany?: boolean;
  /** Полисы экспедитора (общий чек-лист сверху) или документы заказчика. */
  kinds?: 'forwarder' | 'shipper';
}) {
  const [{ t, f }, rates] = await Promise.all([getI18n(locale), latestFxRates()]);
  const fw = t.forwarder;
  const sd = t.shipperDocs;
  const day = (d: string) => f.date(`${d}T12:00:00Z`);

  /* Кто загрузил: право подписи сверяется с именем заявителя. */
  const uploaderIds = [
    ...new Set(
      documents.filter((d) => isShipperDocKind(d.kind)).map((d) => d.uploaded_by).filter((id): id is string => Boolean(id)),
    ),
  ];
  const { data: uploaders } = uploaderIds.length
    ? await (await createClient()).from('profiles').select('id, full_name').in('id', uploaderIds)
    : { data: [] };
  const uploaderName = new Map((uploaders ?? []).map((p) => [p.id, p.full_name]));

  return (
    <div className="flex flex-col gap-3">
      {kinds === 'forwarder' && (
        <details className="rounded-control border border-line px-3 py-2 text-[13px]">
          <summary className="cursor-pointer font-semibold">{fw.adminChecklistTitle}</summary>
          <ol className="mt-2 list-decimal space-y-1 pl-5 leading-relaxed text-ink-muted">
            <li>{fw.check1}</li>
            <li>{fw.check2}</li>
            <li>{fw.check3}</li>
            <li>{fw.check4}</li>
            <li>{fw.check5}</li>
            <li>{fw.check6}</li>
            <li>{fw.check7}</li>
          </ol>
        </details>
      )}

      {documents.length === 0 ? (
        <EmptyState title={kinds === 'shipper' ? sd.adminEmpty : fw.adminEmpty} />
      ) : (
        documents.map((doc) => {
          const review = (doc.review_status ?? 'PENDING') as ReviewStatus;
          const currency = asCurrency(doc.limit_currency);
          const eventEur =
            doc.limit_event_cents != null ? convertCents(doc.limit_event_cents, currency, 'EUR', rates) : null;
          const yearEur =
            doc.limit_year_cents != null ? convertCents(doc.limit_year_cents, currency, 'EUR', rates) : null;
          const insurance = doc.kind === 'FORWARDER_INSURANCE';
          const low = insurance && belowThreshold(eventEur, yearEur);
          const markUntil = isShipperDocKind(doc.kind) ? freshUntil(doc.kind, doc.issued_on, doc.valid_until) : null;

          return (
            <Card key={doc.id} stripe={reviewTone[review]}>
              <CardBody className="flex flex-col gap-2 text-[13px]">
                <div className="flex flex-wrap items-center gap-2.5">
                  <Badge tone={reviewTone[review]}>{fw[`status${review}`]}</Badge>
                  <span className="font-semibold">{t.documents[doc.kind]}</span>
                  {showCompany && doc.company && (
                    <Link href={`/${locale}/admin/company/${doc.company_id}`} className="text-accent hover:underline">
                      {doc.company.name}
                    </Link>
                  )}
                  {showCompany && doc.company && (
                    <Mono className="text-xs text-ink-dim">
                      {doc.company.country} · {doc.company.business_id}
                    </Mono>
                  )}
                </div>

                <span className="break-all text-ink-muted">
                  {doc.file_name} · {fw.uploadedAt.replace('{date}', f.date(doc.uploaded_at))}
                </span>

                {insurance && (
                  <dl className="grid gap-x-4 gap-y-1 sm:grid-cols-2">
                    <div>
                      <dt className="label-micro">{fw.insurer}</dt>
                      <dd>{doc.insurer ?? '—'}</dd>
                    </div>
                    <div>
                      <dt className="label-micro">{fw.policyNumber}</dt>
                      <dd>
                        <Mono>{doc.policy_number ?? '—'}</Mono>
                      </dd>
                    </div>
                    <div>
                      <dt className="label-micro">{fw.limitEvent}</dt>
                      <dd>
                        {doc.limit_event_cents != null ? f.money(doc.limit_event_cents, currency) : '—'}
                        {currency !== 'EUR' && eventEur != null && (
                          <span className="text-ink-dim"> (≈ {f.money(eventEur, 'EUR')})</span>
                        )}
                      </dd>
                    </div>
                    <div>
                      <dt className="label-micro">{fw.limitYear}</dt>
                      <dd>
                        {doc.limit_year_cents != null ? f.money(doc.limit_year_cents, currency) : '—'}
                        {currency !== 'EUR' && yearEur != null && (
                          <span className="text-ink-dim"> (≈ {f.money(yearEur, 'EUR')})</span>
                        )}
                      </dd>
                    </div>
                    <div>
                      <dt className="label-micro">{fw.territory}</dt>
                      <dd>{doc.territory ?? '—'}</dd>
                    </div>
                    <div>
                      <dt className="label-micro">{fw.terms}</dt>
                      <dd>{doc.terms ? fw[`terms${doc.terms as 'NSAB2015' | 'ADSP2017' | 'PSYM' | 'OTHER'}`] : '—'}</dd>
                    </div>
                    <div>
                      <dt className="label-micro">{fw.cmrCovered}</dt>
                      <dd>{doc.cmr_covered ? fw.yes : fw.no}</dd>
                    </div>
                    <div>
                      <dt className="label-micro">{fw.validUntil}</dt>
                      <dd>{doc.valid_until ? f.date(`${doc.valid_until}T12:00:00Z`) : '—'}</dd>
                    </div>
                  </dl>
                )}
                {!insurance && !isShipperDocKind(doc.kind) && (
                  <p className="text-ink-muted">
                    {fw.validUntil}: {doc.valid_until ? f.date(`${doc.valid_until}T12:00:00Z`) : t.documents.perpetual}
                  </p>
                )}
                {isShipperDocKind(doc.kind) && (
                  <ShipperDocFacts
                    labels={{
                      issuedOn: sd.issuedOn,
                      validUntil: sd.validUntil,
                      markUntil: sd.markUntil,
                      uploadedBy: sd.uploadedBy,
                      perpetual: t.documents.perpetual,
                      checklist: sd.checklistTitle,
                    }}
                    issuedOn={doc.issued_on ? day(doc.issued_on) : null}
                    validUntil={doc.valid_until ? day(doc.valid_until) : null}
                    markUntil={markUntil ? day(markUntil) : null}
                    uploader={doc.uploaded_by ? (uploaderName.get(doc.uploaded_by) ?? null) : null}
                    checks={sd[`checks${doc.kind}`]}
                  />
                )}

                {low && <p className="font-semibold text-danger">{fw.belowThreshold}</p>}
                {doc.reviewed_at && (
                  <p className="text-xs text-ink-dim">
                    {fw.reviewedAt.replace('{date}', f.date(doc.reviewed_at))}
                    {doc.review_note ? ` · ${doc.review_note}` : ''}
                  </p>
                )}

                <OpenDocumentButton storagePath={doc.storage_path} label={t.documents.view} />

                <form action={reviewForwarderDocumentAction} className="flex flex-col gap-2 border-t border-line pt-2">
                  <input type="hidden" name="locale" value={locale} />
                  <input type="hidden" name="document_id" value={doc.id} />
                  <input type="hidden" name="back" value={back} />
                  <label className="label-micro" htmlFor={`fw-note-${doc.id}`}>
                    {fw.reviewNote}
                  </label>
                  <Textarea id={`fw-note-${doc.id}`} name="note" rows={2} maxLength={1000} />
                  <div className="flex flex-wrap gap-2">
                    {review !== 'APPROVED' && (
                      <Button type="submit" name="decision" value="APPROVED" variant="primary" size="sm">
                        {fw.approve}
                      </Button>
                    )}
                    <Button type="submit" name="decision" value="REJECTED" variant="danger" size="sm">
                      {review === 'APPROVED' ? fw.revoke : fw.reject}
                    </Button>
                  </div>
                </form>
              </CardBody>
            </Card>
          );
        })
      )}
    </div>
  );
}

/** Даты, загрузивший и чек-лист документа заказчика. */
function ShipperDocFacts({
  labels,
  issuedOn,
  validUntil,
  markUntil,
  uploader,
  checks,
}: {
  labels: { issuedOn: string; validUntil: string; markUntil: string; uploadedBy: string; perpetual: string; checklist: string };
  issuedOn: string | null;
  validUntil: string | null;
  markUntil: string | null;
  uploader: string | null;
  checks: readonly string[];
}) {
  return (
    <>
      <dl className="grid gap-x-4 gap-y-1 sm:grid-cols-3">
        <div>
          <dt className="label-micro">{labels.issuedOn}</dt>
          <dd>{issuedOn ?? '—'}</dd>
        </div>
        <div>
          <dt className="label-micro">{labels.validUntil}</dt>
          <dd>{validUntil ?? '—'}</dd>
        </div>
        <div>
          <dt className="label-micro">{labels.markUntil}</dt>
          <dd>{markUntil ?? labels.perpetual}</dd>
        </div>
      </dl>
      {uploader && <p className="text-ink-muted">{labels.uploadedBy.replace('{name}', uploader)}</p>}
      <details className="rounded-control border border-line px-3 py-2">
        <summary className="cursor-pointer font-semibold">{labels.checklist}</summary>
        <ol className="mt-2 list-decimal space-y-1 pl-5 leading-relaxed text-ink-muted">
          {checks.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ol>
      </details>
    </>
  );
}

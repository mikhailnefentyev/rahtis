import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { AdminError } from '@/components/layout/AdminError';
import {
  Badge,
  Button,
  Card,
  CardBody,
  EmptyState,
  Mono,
  Table,
  TableFrame,
  Td,
  Th,
  Tr,
} from '@/components/ui';
import type { StatusTone } from '@/components/ui/tone';
import { requireRole } from '@/lib/auth/guard';
import { getI18n, isLocale } from '@/lib/i18n';
import { activateLegalVersionAction, newLegalVersionAction } from '@/lib/legal/actions';
import { createClient } from '@/lib/supabase/server';
import type { Database } from '@/types/database';

type Kind = Database['public']['Enums']['legal_kind'];
type Status = Database['public']['Enums']['legal_status'];

const KINDS: Kind[] = ['TERMS', 'PRIVACY', 'CARRIER_AGREEMENT', 'SHIPPER_AGREEMENT'];

const statusTone: Record<Status, StatusTone> = {
  DRAFT: 'neutral',
  ACTIVE: 'ok',
  ARCHIVED: 'warn',
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const { t } = await getI18n(locale);
  return { title: t.legal.manage };
}

/**
 * Редакции документов и принятые согласия.
 *
 * Тексты пунктов здесь не правятся: их даёт юрист, и редактор для
 * полусотни пунктов с нумерацией — отдельная работа. Пока черновик
 * наполняется через базу, а этот экран отвечает на два вопроса
 * оператора: какая редакция действует и кто её принял.
 */
export default async function LegalAdminPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  await requireRole(locale, 'ADMIN');

  const { error: failure } = await searchParams;
  const [{ t, m, f }, supabase] = await Promise.all([getI18n(locale), createClient()]);

  const [{ data: documents }, { data: acceptances }] = await Promise.all([
    supabase
      .from('legal_documents')
      .select('id, kind, version, status, effective_from, activated_at')
      .order('kind')
      .order('version', { ascending: false }),
    supabase
      .from('legal_acceptances')
      .select('id, company_id, document_id, accepted_at, source')
      .order('accepted_at', { ascending: false })
      .limit(50),
  ]);

  const docs = documents ?? [];

  /* Сколько пунктов в каждой редакции: без них активировать нельзя. */
  const { data: counts } = await supabase.from('legal_clauses').select('document_id');
  const clauseCount = new Map<string, number>();
  for (const row of counts ?? []) {
    clauseCount.set(row.document_id, (clauseCount.get(row.document_id) ?? 0) + 1);
  }

  const companyIds = [...new Set((acceptances ?? []).map((a) => a.company_id))];
  const { data: companies } = companyIds.length
    ? await supabase.from('companies').select('id, name').in('id', companyIds)
    : { data: [] };
  const companyName = new Map((companies ?? []).map((c) => [c.id, c.name]));
  const byId = new Map(docs.map((d) => [d.id, d]));

  return (
    <main className="mx-auto w-full max-w-6xl px-5 py-8">
      <AdminError locale={locale} code={failure} />


      <h1 className="text-xl font-semibold tracking-tight">{t.legal.manage}</h1>

      <div className="mt-6 flex flex-col gap-4">
        {KINDS.map((kind) => {
          const versions = docs.filter((d) => d.kind === kind);

          return (
            <Card key={kind}>
              <CardBody className="flex flex-col gap-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-[15px] font-semibold tracking-tight">{t.legal[kind]}</h2>

                  <form action={newLegalVersionAction}>
                    <input type="hidden" name="locale" value={locale} />
                    <input type="hidden" name="kind" value={kind} />
                    <Button type="submit" size="sm" formNoValidate>
                      {t.legal.newVersion}
                    </Button>
                  </form>
                </div>

                {versions.length === 0 ? (
                  <p className="text-[13px] text-ink-muted">{t.legal.missing}</p>
                ) : (
                  <ul className="flex flex-col gap-1.5">
                    {versions.map((doc) => (
                      <li
                        key={doc.id}
                        className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-line pt-1.5 first:border-t-0 first:pt-0"
                      >
                        <Mono className="text-[13px] font-semibold">
                          {m('legal.version', { n: doc.version })}
                        </Mono>
                        <Badge tone={statusTone[doc.status]}>{t.legal[doc.status]}</Badge>
                        <span className="text-xs text-ink-dim">
                          {t.legal.clauses}: {clauseCount.get(doc.id) ?? 0}
                        </span>
                        <span className="text-xs text-ink-dim">
                          {m('legal.effective', { date: f.date(doc.effective_from) })}
                        </span>

                        {doc.status !== 'ACTIVE' && (
                          <form action={activateLegalVersionAction} className="ml-auto">
                            <input type="hidden" name="locale" value={locale} />
                            <input type="hidden" name="document_id" value={doc.id} />
                            <Button type="submit" size="sm" variant="primary" formNoValidate>
                              {t.legal.activate}
                            </Button>
                          </form>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </CardBody>
            </Card>
          );
        })}
      </div>

      <section className="mt-10">
        <h2 className="mb-3 border-b border-line pb-2 text-[13px] font-semibold tracking-tight text-ink-faint">
          {t.legal.acceptances}
        </h2>

        {(acceptances ?? []).length === 0 ? (
          <EmptyState title={t.legal.noAcceptances} />
        ) : (
          <TableFrame caption={t.legal.acceptances}>
            <Table>
              <thead>
                <tr>
                  <Th>{t.cabinet.company}</Th>
                  <Th>{t.legal.manage}</Th>
                  <Th>{t.outbox.created}</Th>
                  <Th>{t.legal.acceptedBy}</Th>
                </tr>
              </thead>
              <tbody>
                {(acceptances ?? []).map((row) => {
                  const doc = byId.get(row.document_id);
                  return (
                    <Tr key={row.id}>
                      <Td>{companyName.get(row.company_id) ?? '—'}</Td>
                      <Td>
                        {doc ? `${t.legal[doc.kind]} · ` : ''}
                        <Mono className="text-xs">
                          {doc ? m('legal.version', { n: doc.version }) : '—'}
                        </Mono>
                      </Td>
                      <Td mono>{f.dateTime(row.accepted_at)}</Td>
                      <Td mono>{row.source}</Td>
                    </Tr>
                  );
                })}
              </tbody>
            </Table>
          </TableFrame>
        )}
      </section>
    </main>
  );
}

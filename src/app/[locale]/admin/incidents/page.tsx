import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Badge, Card, CardBody, EmptyState, Mono, Table, TableFrame, Td, Th, Tr } from '@/components/ui';
import type { StatusTone } from '@/components/ui/tone';
import { requireRole } from '@/lib/auth/guard';
import { getI18n, isLocale } from '@/lib/i18n';
import { createClient } from '@/lib/supabase/server';
import type { Database } from '@/types/database';
import { ResolveIncident } from './ResolveIncident';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const { t } = await getI18n(locale);
  return { title: t.incidents.title };
}

type Severity = Database['public']['Enums']['incident_severity'];

const severityTone: Record<Severity, StatusTone> = {
  WARN: 'warn',
  ERROR: 'danger',
  FATAL: 'danger',
};

/**
 * Журнал сбоев.
 *
 * Сверху — открытые записи: то, из-за чего внешняя проверка
 * /api/health отвечает «degraded». Ниже — недавно закрытые с заметкой,
 * чтобы вернувшуюся поломку было с чем сравнить. Персональных данных в
 * журнале нет по построению (lib/incidents/record.ts).
 */
export default async function IncidentsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  /* Гейт уже стоит в layout админки; здесь он на случай переезда страницы. */
  await requireRole(locale, 'ADMIN');

  const [{ t, f }, supabase] = await Promise.all([getI18n(locale), createClient()]);

  const columns =
    'id, severity, source, kind, message, path, sqlstate, seen_count, first_seen, last_seen, resolved_at, note';
  const [{ data: open }, { data: resolved }] = await Promise.all([
    supabase
      .from('incidents')
      .select(columns)
      .neq('status', 'RESOLVED')
      .order('last_seen', { ascending: false })
      .limit(100),
    supabase
      .from('incidents')
      .select(columns)
      .eq('status', 'RESOLVED')
      .order('resolved_at', { ascending: false })
      .limit(20),
  ]);

  const openList = open ?? [];
  const resolvedList = resolved ?? [];
  const fatal = openList.filter((row) => row.severity === 'FATAL').length;

  return (
    <main className="cab-page cab-page--wide">
      <h1 className="page-title">{t.incidents.title}</h1>
      <p className="mt-2 max-w-xl text-[13px] leading-relaxed text-ink-muted">{t.incidents.subtitle}</p>

      {fatal > 0 && (
        <Card stripe="danger" className="mt-4">
          <CardBody>
            <p className="text-[13px] text-ink-muted">{t.incidents.degraded}</p>
          </CardBody>
        </Card>
      )}

      {openList.length === 0 ? (
        <EmptyState className="mt-6" title={t.incidents.empty} description={t.incidents.emptyHint} />
      ) : (
        <div className="mt-6">
          <TableFrame caption={t.incidents.open}>
            <Table>
              <thead>
                <tr>
                  <Th>{t.incidents.lastSeen}</Th>
                  <Th>{t.incidents.severity}</Th>
                  <Th>{t.incidents.what}</Th>
                  <Th>{t.incidents.where}</Th>
                  <Th numeric>{t.incidents.count}</Th>
                  <Th>{t.incidents.firstSeen}</Th>
                  <Th>{t.incidents.resolve}</Th>
                </tr>
              </thead>
              <tbody>
                {openList.map((row) => (
                  <Tr key={row.id}>
                    <Td mono>{f.dateTime(row.last_seen)}</Td>
                    <Td>
                      <Badge tone={severityTone[row.severity]}>{row.severity}</Badge>
                    </Td>
                    <Td>
                      <Mono className="text-xs">
                        {row.kind}
                        {row.sqlstate ? ` · ${row.sqlstate}` : ''}
                      </Mono>
                      <p className="mt-1 text-[13px]">{row.message}</p>
                    </Td>
                    <Td mono>
                      {row.source}
                      {row.path ? ` · ${row.path}` : ''}
                    </Td>
                    <Td numeric>{f.number(row.seen_count)}</Td>
                    <Td mono>{f.dateTime(row.first_seen)}</Td>
                    <Td>
                      <ResolveIncident id={row.id} />
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </TableFrame>
        </div>
      )}

      {resolvedList.length > 0 && (
        <div className="mt-8">
          <TableFrame caption={t.incidents.resolved}>
            <Table>
              <thead>
                <tr>
                  <Th>{t.incidents.resolvedAt}</Th>
                  <Th>{t.incidents.what}</Th>
                  <Th>{t.incidents.where}</Th>
                  <Th numeric>{t.incidents.count}</Th>
                  <Th>{t.incidents.note}</Th>
                </tr>
              </thead>
              <tbody>
                {resolvedList.map((row) => (
                  <Tr key={row.id}>
                    <Td mono>{row.resolved_at ? f.dateTime(row.resolved_at) : '—'}</Td>
                    <Td>
                      <Mono className="text-xs">{row.kind}</Mono>
                      <p className="mt-1 text-[13px]">{row.message}</p>
                    </Td>
                    <Td mono>
                      {row.source}
                      {row.path ? ` · ${row.path}` : ''}
                    </Td>
                    <Td numeric>{f.number(row.seen_count)}</Td>
                    <Td>{row.note ?? '—'}</Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </TableFrame>
        </div>
      )}
    </main>
  );
}

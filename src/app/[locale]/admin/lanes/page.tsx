import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { EmptyState, Table, TableFrame, Td, Th, Tr } from '@/components/ui';
import { requireRole } from '@/lib/auth/guard';
import { getI18n, isLocale } from '@/lib/i18n';
import { createClient } from '@/lib/supabase/server';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const { t } = await getI18n(locale);
  return { title: t.backhaul.adminTitle };
}

/**
 * Направления Kuormavahti: сколько подписок и компаний ждут груз по
 * направлению и сколько заказов совпало за 30 дней. Сигнал спроса —
 * где перевозчики есть, а грузов мало. Тестовые компании не считаются.
 */
export default async function LaneDemandPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  await requireRole(locale, 'ADMIN');

  const [{ t, f }, supabase] = await Promise.all([getI18n(locale), createClient()]);
  const b = t.backhaul;

  const { data } = await supabase.rpc('admin_lane_demand');
  const rows = data ?? [];

  return (
    <main className="cab-page cab-page--wide">
      <h1 className="page-title">{b.adminTitle}</h1>
      <p className="mt-2 max-w-xl text-[13px] leading-relaxed text-ink-muted">{b.adminSubtitle}</p>

      {rows.length === 0 ? (
        <EmptyState className="mt-6" title={b.adminEmpty} description={b.adminSubtitle} />
      ) : (
        <div className="mt-6">
          <TableFrame caption={b.adminTitle}>
            <Table>
              <thead>
                <tr>
                  <Th>{b.colLane}</Th>
                  <Th>{b.haulKind}</Th>
                  <Th numeric>{b.colWatches}</Th>
                  <Th numeric>{b.colCompanies}</Th>
                  <Th numeric>{b.colHits}</Th>
                  <Th>{b.colLast}</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <Tr key={`${row.from_city}|${row.to_city ?? ''}|${row.haul_kind ?? ''}`}>
                    <Td>
                      {row.from_city} → {row.to_city ?? b.anywhere}
                    </Td>
                    <Td>{row.haul_kind ? t.haulKind[row.haul_kind] : b.anyKind}</Td>
                    <Td numeric>{row.watches}</Td>
                    <Td numeric>{row.companies}</Td>
                    <Td numeric>{row.hits_30d}</Td>
                    <Td>{f.date(row.last_created)}</Td>
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

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Table, TableFrame, Td, Th, Tr } from '@/components/ui';
import { requireRole } from '@/lib/auth/guard';
import { isLocale } from '@/lib/i18n';
import { getViewerI18n } from '@/lib/i18n/viewer';
import { createClient } from '@/lib/supabase/server';
import { partsCountry } from '@/lib/parts/sources';
import { PartsSearch } from './PartsSearch';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const { t } = await getViewerI18n(locale);
  return { title: t.parts.title };
}

/**
 * Varaosat: быстрый поиск запчасти и шины у поставщиков страны перевозчика
 * (Финляндия, Прибалтика, Польша, Германия), разборок, шинных сетей и дилера
 * марки; во вкладке шин — круглосуточные номера помощи при проколе.
 *
 * Этап 1 — прямые ссылки и готовый запрос цены (без базы). Этап 2 —
 * заявка поставщикам в RAHTIS с ответами «цена + срок» в одной карточке
 * (docs/parts/PLAN.md).
 */
export default async function PartsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const viewer = await requireRole(locale, 'CARRIER');
  const [{ t, f }, supabase] = await Promise.all([getViewerI18n(locale), createClient()]);
  const [{ data: vehicles }, { data: access }] = await Promise.all([
    supabase.from('vehicles').select('id, plate, make').eq('company_id', viewer.company!.id).order('plate'),
    supabase.rpc('own_orders_access'),
  ]);
  /* Последние покупки из этого раздела — чтобы было видно, что записано и куда. */
  const { data: purchases } = access
    ? await supabase
        .from('vehicle_costs')
        .select('id, vehicle_id, spent_on, category, amount_cents, supplier, note')
        .eq('company_id', viewer.company!.id)
        .in('category', ['PARTS', 'REPAIR', 'TYRES'])
        .order('spent_on', { ascending: false })
        .limit(10)
    : { data: [] };
  const plateOf = new Map((vehicles ?? []).map((v) => [v.id, v.plate]));
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Helsinki' }).format(new Date());

  return (
    <main className="cab-page">
      <h1 className="page-title">{t.parts.title}</h1>
      <p className="mt-2 max-w-3xl text-[13px] leading-relaxed text-ink-muted">{t.parts.lede}</p>
      <div className="mt-6 max-w-5xl">
        <PartsSearch
          vehicles={vehicles ?? []}
          company={viewer.company!.name}
          country={partsCountry(viewer.company!.country)}
          canRecord={!!access}
          today={today}
        />
        {(purchases ?? []).length > 0 && (
          <TableFrame caption={t.parts.purchasesTitle} className="mt-6">
            <Table>
              <thead>
                <tr>
                  <Th>{t.economics.spentOn}</Th>
                  <Th>{t.economics.colVehicle}</Th>
                  <Th>{t.economics.category}</Th>
                  <Th>{t.parts.supplier}</Th>
                  <Th>{t.economics.note}</Th>
                  <Th numeric>{t.economics.amount}</Th>
                </tr>
              </thead>
              <tbody>
                {(purchases ?? []).map((c) => (
                  <Tr key={c.id}>
                    <Td mono>{f.date(`${c.spent_on}T12:00:00Z`)}</Td>
                    <Td mono>
                      <a href={`/${locale}/carrier/economics/${c.vehicle_id}`} className="text-accent hover:underline">
                        {plateOf.get(c.vehicle_id) ?? '—'}
                      </a>
                    </Td>
                    <Td>{t.economics.categories[c.category as keyof typeof t.economics.categories] ?? c.category}</Td>
                    <Td className="whitespace-normal">{c.supplier ?? ''}</Td>
                    <Td className="whitespace-normal">{c.note ?? ''}</Td>
                    <Td numeric>{f.eur(c.amount_cents)}</Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </TableFrame>
        )}
      </div>
    </main>
  );
}

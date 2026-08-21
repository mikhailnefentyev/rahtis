import Link from 'next/link';
import { CompletedList } from '@/components/domain/CompletedList';
import { Stars } from '@/components/ui';
import { requireRole } from '@/lib/auth/guard';
import { cabinetPath } from '@/lib/auth/paths';
import { getI18n, type Locale } from '@/lib/i18n';
import { createClient } from '@/lib/supabase/server';

/**
 * Вкладка выполненных рейсов — одна на заказчика и перевозчика.
 *
 * Страницы у них разные по адресу и по подписи, но не по устройству:
 * данные приходят из одной функции, которая сама решает, что кому видно.
 * Две почти одинаковые страницы разошлись бы на первой же правке —
 * например когда к итогам добавится рейтинг.
 */
export async function CompletedCabinet({
  locale,
  role,
}: {
  locale: Locale;
  role: 'CARRIER' | 'SHIPPER';
}) {
  await requireRole(locale, role);

  const [{ t }, supabase] = await Promise.all([getI18n(locale), createClient()]);

  /* Двенадцать недель: квартал закрытых рейсов покрывает любой спор о счёте. */
  const [{ data: orders }, { data: totals }, { data: rating }] = await Promise.all([
    supabase.rpc('completed_orders', {}),
    supabase.rpc('weekly_totals', { p_weeks: 12 }),
    /*
     * Средняя оценка — только перевозчику и только своя: по ней его
     * выбирают из откликов, и видеть её он должен там же, где видит
     * рейсы, за которые её поставили (ТЗ §10).
     */
    role === 'CARRIER' ? supabase.rpc('carrier_rating', {}) : Promise.resolve({ data: null }),
  ]);

  const own = rating?.[0];

  const title = role === 'CARRIER' ? t.done.titleCarrier : t.done.titleShipper;
  const subtitle = role === 'CARRIER' ? t.done.subtitleCarrier : t.done.subtitleShipper;

  return (
    <main className="mx-auto w-full max-w-4xl px-5 py-8">
      <nav className="mb-6">
        <Link
          href={cabinetPath(locale, role)}
          className="text-[13px] text-ink-muted hover:text-ink"
        >
          ← {t.role[role]}
        </Link>
      </nav>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>

        {own && (
          <div className="flex items-center gap-2">
            <span className="label-micro">{t.rating.company}</span>
            <Stars value={own.score} count={own.ratings_count} />
          </div>
        )}
      </div>

      <p className="mt-2 mb-6 max-w-xl text-[13px] leading-relaxed text-ink-muted">{subtitle}</p>

      <CompletedList orders={orders ?? []} totals={totals ?? []} />
    </main>
  );
}

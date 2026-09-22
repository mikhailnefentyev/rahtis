import Link from 'next/link';
import { notFound } from 'next/navigation';
import { markReadAction } from '@/lib/driverApp/actions';
import { isLocale } from '@/lib/i18n';
import { getDriverI18n } from '@/lib/driverApp/i18n';
import { createClient } from '@/lib/supabase/server';

/**
 * Входящие водителя: новое задание, отмена, возврат на стол.
 *
 * Текст подбирается здесь по коду события, на языке приложения, — в базе
 * лежат только код и подстановки, как у уведомлений кабинета.
 */
export default async function DriverInbox({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const [{ t, m, f }, supabase] = await Promise.all([getDriverI18n(locale), createClient()]);

  const { data: rows } = await supabase
    .from('driver_notifications')
    .select('id, code, params, order_id, read_at, created_at')
    .order('created_at', { ascending: false })
    .limit(50);

  const text = (code: string, params: unknown) => {
    const key = `driverEvent.${code}` as Parameters<typeof m>[0];
    try {
      return m(key, (params ?? {}) as Record<string, string | number>);
    } catch {
      return code;
    }
  };

  const unread = (rows ?? []).some((r) => !r.read_at);

  return (
    <main className="flex flex-col gap-4">
      <header className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">{t.driverApp.inbox}</h1>
        {unread && (
          <form action={markReadAction}>
            <input type="hidden" name="locale" value={locale} />
            <button className="h-11 rounded-control border border-line bg-surface px-3 text-[15px] font-semibold">
              {t.driverApp.markRead}
            </button>
          </form>
        )}
      </header>

      {(rows ?? []).length === 0 ? (
        <p className="py-12 text-center text-[17px] text-ink-muted">{t.driverApp.inboxEmpty}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {(rows ?? []).map((row) => {
            const body = (
              <>
                <p className="text-[16px] font-semibold">{text(row.code, row.params)}</p>
                <p className="mt-0.5 text-sm text-ink-muted">{f.dateTime(row.created_at)}</p>
              </>
            );
            const className = `block rounded-card border px-4 py-3 ${
              row.read_at ? 'border-line bg-surface' : 'border-accent-line bg-accent-wash'
            }`;
            return (
              <li key={row.id}>
                {row.order_id ? (
                  <Link href={`/${locale}/driver/task/${row.order_id}`} className={className}>
                    {body}
                  </Link>
                ) : (
                  <div className={className}>{body}</div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}

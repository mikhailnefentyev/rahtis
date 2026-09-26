import Link from 'next/link';
import { Button } from '@/components/ui';
import { getI18n, type Locale } from '@/lib/i18n';
import { acceptUpdatedLegalAction } from '@/lib/legal/reaccept';
import { createClient } from '@/lib/supabase/server';
import type { Database } from '@/types/database';

type Kind = Database['public']['Enums']['legal_kind'];

/* Где читать каждый документ. Договор стороны — в кабинете, остальное публично. */
function documentHref(locale: Locale, kind: Kind): string {
  switch (kind) {
    case 'TERMS':
      return `/${locale}/${locale === 'fi' ? 'kayttoehdot' : 'terms'}`;
    case 'PRIVACY':
      return `/${locale}/${locale === 'fi' ? 'tietosuoja' : 'privacy'}`;
    case 'CARRIER_AGREEMENT':
      return `/${locale}/carrier/terms`;
    case 'SHIPPER_AGREEMENT':
      return `/${locale}/shipper/terms`;
  }
}

/**
 * Плашка «ehdot ovat muuttuneet» над кабинетом.
 *
 * Показывается работающей компании, у которой есть непринятая
 * действующая редакция. Пока она не принята, новая работа не начинается
 * (проверка в базе — миграция legal_reaccept), а идущая продолжается.
 * Поэтому плашка стоит над всем кабинетом, а не на одной странице:
 * перевозчик должен увидеть её до того, как попробует взять заказ.
 *
 * Одобренная, но не активированная компания плашку не видит — её
 * согласие спрашивает форма реквизитов.
 */
export async function LegalReaccept({
  locale,
  companyStatus,
}: {
  locale: Locale;
  companyStatus: string | null | undefined;
}) {
  if (companyStatus !== 'ACTIVE') return null;

  const supabase = await createClient();
  const { data: pending } = await supabase.rpc('my_pending_legal');
  if (!pending || pending.length === 0) return null;

  const { t } = await getI18n(locale);

  return (
    <div className="border-b border-warn/35 bg-warn/10">
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-3">
        <div className="min-w-0 text-[13px] leading-relaxed">
          <p className="font-semibold text-ink">{t.legal.reacceptTitle}</p>
          <p className="text-ink-muted">
            {t.legal.reacceptText}{' '}
            {pending.map((doc, i) => (
              <span key={doc.kind}>
                {i > 0 && ', '}
                <Link
                  href={documentHref(locale, doc.kind)}
                  className="text-accent underline underline-offset-2 hover:no-underline"
                >
                  {t.legal[doc.kind]} v{doc.version}
                </Link>
              </span>
            ))}
          </p>
        </div>
        <form action={acceptUpdatedLegalAction}>
          <input type="hidden" name="locale" value={locale} />
          <Button type="submit" variant="primary" size="sm">
            {t.legal.reacceptButton}
          </Button>
        </form>
      </div>
    </div>
  );
}

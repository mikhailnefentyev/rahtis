import { Stat, StatRow } from '@/components/ui';
import { getI18n, type Locale } from '@/lib/i18n';
import { createClient } from '@/lib/supabase/server';

/**
 * Карточка перевозчика за 12 месяцев — сама компания или оператор.
 *
 * Считается из записанного (carrier_scorecard): рейсы, приезд вовремя,
 * CMR, отказы от взятых рейсов, претензии, принятые прямые заказы.
 * Процент без пяти наблюдений не показывается — вместо него прочерк.
 */
export async function CarrierScorecard({ locale, companyId }: { locale: Locale; companyId?: string }) {
  const [{ t, m, f }, supabase] = await Promise.all([getI18n(locale), createClient()]);
  const { data } = await supabase.rpc('carrier_scorecard', companyId ? { p_company_id: companyId } : {});
  const sc = data?.[0];
  if (!sc) return null;

  const pct = (value: number | null) => (value == null ? '—' : `${value} %`);
  const pctTone = (value: number | null, good: number) =>
    value == null ? 'neutral' : value >= good ? 'ok' : 'warn';

  return (
    <section className="mb-6">
      <p className="label-micro mb-2.5">{t.scorecard.title}</p>
      <StatRow className="lg:grid-cols-6">
        <Stat label={t.scorecard.trips} value={f.number(sc.trips)} />
        <Stat
          label={t.scorecard.onTime}
          value={pct(sc.on_time_pct)}
          tone={pctTone(sc.on_time_pct, 90)}
          hint={m('scorecard.onTimeHint', { count: sc.timed_stops })}
        />
        <Stat label={t.scorecard.docs} value={pct(sc.docs_pct)} tone={pctTone(sc.docs_pct, 95)} />
        <Stat
          label={t.scorecard.abandoned}
          value={f.number(sc.abandoned)}
          tone={sc.abandoned > 0 ? 'warn' : 'neutral'}
        />
        <Stat label={t.scorecard.claims} value={f.number(sc.claims)} tone={sc.claims > 0 ? 'warn' : 'neutral'} />
        <Stat
          label={t.scorecard.directAccept}
          value={pct(sc.direct_accept_pct)}
          hint={m('scorecard.directHint', { count: sc.direct_decided })}
        />
      </StatRow>
      <p className="mt-2 text-xs text-ink-dim">{t.scorecard.note}</p>
    </section>
  );
}

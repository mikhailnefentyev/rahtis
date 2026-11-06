import { CABOTAGE } from '@/lib/capacity/compute';
import type { Dictionary } from '@/lib/i18n';

/**
 * Каботаж — справка обеим сторонам, не запрет (рег. 1072/2009, ст. 8 в
 * ред. 2020/1055). show — каботаж ли это; ops — рейсы перевозчика
 * целиком внутри этой страны за последние 7 дней по данным RAHTIS, если
 * известны.
 */
export function CabotageNote({ t, show, ops }: { t: Dictionary; show: boolean; ops?: number | null }) {
  if (!show) return null;
  const c = t.capacity;
  const text = c.cabotage
    .replace('{max}', String(CABOTAGE.maxOps))
    .replace('{days}', String(CABOTAGE.days))
    .replace('{cooling}', String(CABOTAGE.coolingDays));
  const counted = typeof ops === 'number';
  return (
    <p className="rounded-control border border-warn/40 bg-warn/10 px-3 py-2 text-[12.5px] leading-relaxed text-ink">
      {text}
      {counted && ` ${c.cabotageCount.replace('{count}', String(ops))}`}
      {counted && ops >= CABOTAGE.maxOps && <strong className="ml-1 text-warn">{c.cabotageLimit}</strong>}
    </p>
  );
}

/** «Kapelli · Vetoauto» — кузов и класс без подробностей. */
export function vehicleText(t: Dictionary, vehicleClass: string | null, body: string | null): string {
  const cls = vehicleClass ? (t.vehicleClass as Record<string, string>)[vehicleClass]?.split(' · ')[0] : null;
  const bodyLabel = body ? (t.mass.bodies as Record<string, string>)[body] : null;
  return [bodyLabel, cls].filter(Boolean).join(' · ');
}

/** Свободное место строкой: метры, тонны и паллеты, если указаны. */
export function spaceText(t: Dictionary, locale: string, free: { ldm: number | null; kg: number | null; pallets: number | null }): string {
  const n = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });
  const parts: string[] = [];
  if (free.ldm !== null) parts.push(`${n.format(free.ldm)} ldm`);
  if (free.kg !== null) parts.push(`${n.format(free.kg / 1000)} t`);
  if (free.pallets !== null) parts.push(t.capacity.pallets.replace('{count}', String(free.pallets)));
  return parts.join(' · ') || '—';
}

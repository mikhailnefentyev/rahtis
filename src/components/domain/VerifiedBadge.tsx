import { cn } from '@/lib/cn';

/**
 * Значок «Tarkastettu»: галочка и слово рядом с именем перевозчика или
 * анонимной меткой отклика. Подпись и подсказка приходят пропсами —
 * значок рисуют и серверные страницы (ссылка без входа, админка), и
 * клиентские карточки откликов.
 *
 * Показывается только при действующем значке: «не проверен» не пишем —
 * отсутствие значка у новичка не должно выглядеть как замечание.
 */
export function VerifiedBadge({ label, hint, className }: { label: string; hint?: string; className?: string }) {
  return (
    <span
      title={hint}
      className={cn(
        'inline-flex shrink-0 items-center gap-1 rounded-pill border border-ok/35 bg-ok/10 px-2 py-0.5',
        'text-[11px] leading-[1.45] font-semibold whitespace-nowrap text-ok shadow-[0_0_10px_-3px] shadow-ok/40',
        className,
      )}
    >
      <svg viewBox="0 0 16 16" className="size-3" fill="none" aria-hidden>
        <path d="M3.5 8.5l3 3 6-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {label}
    </span>
  );
}

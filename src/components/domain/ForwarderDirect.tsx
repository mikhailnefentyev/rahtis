'use client';

import Link from 'next/link';
import { createContext, useContext, type ReactNode } from 'react';
import { accountPath } from '@/lib/auth/paths';
import type { DirectBlock } from '@/lib/forwarders/policy';
import { useI18n } from '@/lib/i18n/provider';

/**
 * Закрыт ли заказчику договор напрямую с перевозчиком и почему.
 *
 * Контекстом, а не пропсом: форма заказа грузится лениво и вложена в
 * список заказов, и протаскивать одно слово через три уровня — значит
 * трогать три сигнатуры. Без провайдера — открыто (свой рейс перевозчика,
 * компания, к которой правило не относится); запрет держит база.
 */
const ForwarderDirectContext = createContext<DirectBlock | null>(null);

export function ForwarderDirectProvider({ block, children }: { block: DirectBlock | null; children: ReactNode }) {
  return <ForwarderDirectContext.Provider value={block}>{children}</ForwarderDirectContext.Provider>;
}

export function useForwarderBlock(): DirectBlock | null {
  return useContext(ForwarderDirectContext);
}

/** Почему прямой договор закрыт — и куда идти, чтобы открыть. */
export function ForwarderBlockNotice({ block, className }: { block: DirectBlock; className?: string }) {
  const { t, locale } = useI18n();
  const fw = t.forwarder;
  const reason =
    block === 'PENDING'
      ? fw.blockedPending
      : block === 'REJECTED'
        ? fw.blockedRejected
        : block === 'LICENSE'
          ? fw.blockedLicense
          : fw.blockedText;

  return (
    <div
      role="status"
      className={`rounded-control border border-warn/35 bg-warn/10 px-3 py-2.5 text-[13px] leading-relaxed ${className ?? ''}`}
    >
      <p className="font-semibold text-ink">{fw.blockedTitle}</p>
      <p className="mt-1 text-ink-muted">{reason}</p>
      <Link href={accountPath(locale)} className="mt-1.5 inline-block font-semibold text-accent hover:underline">
        {fw.openAccount}
      </Link>
    </div>
  );
}

/**
 * Отсрочка для прежних экспедиторов: с какой даты прямой договор
 * потребует полис. Показывается, пока проверенного полиса нет.
 */
export function ForwarderGraceBanner({ graceUntil, className = 'mb-6' }: { graceUntil: string; className?: string }) {
  const { t, f, locale } = useI18n();
  const fw = t.forwarder;
  const date = f.date(`${graceUntil}T12:00:00Z`);

  return (
    <div
      role="status"
      className={`rounded-control border border-warn/35 bg-warn/10 px-4 py-3 text-[13px] leading-relaxed ${className}`}
    >
      <p className="font-semibold text-ink">{fw.graceTitle.replace('{date}', date)}</p>
      <p className="mt-1 max-w-3xl text-ink-muted">{fw.graceText.replace('{date}', date)}</p>
      <Link href={accountPath(locale)} className="mt-1.5 inline-block font-semibold text-accent hover:underline">
        {fw.openAccount}
      </Link>
    </div>
  );
}

export type ForwarderPolicyInfo = { until: string | null; cargoOwner: boolean };

/**
 * У перевозчика на рейсе по прямому договору: проверен ли полис
 * экспедитора-заказчика и до какой даты. Справка, не гарантия оплаты
 * (CARRIER_AGREEMENT, раздел 2) — так и подписано.
 */
export function ForwarderPolicyNote({ info, className }: { info: ForwarderPolicyInfo | undefined; className?: string }) {
  const { t, f } = useI18n();
  if (!info) return null;
  const fw = t.forwarder;
  const label = info.cargoOwner
    ? fw.cargoOwnerNote
    : info.until
      ? fw.policyChecked.replace('{date}', f.date(`${info.until}T12:00:00Z`))
      : fw.policyNotChecked;

  return (
    <p className={`text-xs ${info.until || info.cargoOwner ? 'text-ink-muted' : 'text-warn'} ${className ?? ''}`} title={fw.infoOnly}>
      {label} <span className="text-ink-dim">· {fw.infoOnly}</span>
    </p>
  );
}

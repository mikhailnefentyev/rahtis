import Link from 'next/link';
import { Badge, Card, CardBody, buttonClass } from '@/components/ui';
import type { StatusTone } from '@/components/ui/tone';
import { accountPath } from '@/lib/auth/paths';
import { gateBlocked, pendingKinds, type DocState, type DocsGate } from '@/lib/forwarders/docsGate';
import type { Dictionary, Locale } from '@/lib/i18n';

const stateTone: Record<DocState, StatusTone> = {
  OK: 'ok',
  PENDING: 'warn',
  REJECTED: 'danger',
  EXPIRED: 'danger',
  MISSING: 'warn',
};

/**
 * Плашка над кабинетом экспедитора, пока выписка и полис не приняты
 * (11.11.2026): что ещё нужно и в каком оно состоянии, ссылка на
 * «Документы компании». Всё на проверке — спокойный текст «ждём
 * проверки», без кнопки. На странице документов ссылки нет (onDocuments).
 */
export function ForwarderDocsBanner({
  locale,
  t,
  gate,
  onDocuments = false,
}: {
  locale: Locale;
  t: Dictionary;
  gate: DocsGate;
  onDocuments?: boolean;
}) {
  if (!gateBlocked(gate)) return null;
  const g = t.docsGate;
  const review = gate.overall === 'REVIEW';

  return (
    <Card stripe={review ? 'info' : 'warn'}>
      <CardBody className="flex flex-col gap-2.5">
        <div>
          <h2 className="text-[15px] font-semibold tracking-tight">{review ? g.adminREVIEW : g.bannerTitle}</h2>
          <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-ink-muted">{review ? g.bannerReview : g.bannerBody}</p>
        </div>
        <ul className="flex flex-col gap-1.5 text-[13px]">
          {pendingKinds(gate).map(({ kind, state }) => (
            <li key={kind} className="flex flex-wrap items-center gap-2">
              <Badge tone={stateTone[state]}>{g[`state${state}`]}</Badge>
              <span>{g[`doc${kind}`]}</span>
            </li>
          ))}
        </ul>
        {!onDocuments && !review && (
          <Link href={`${accountPath(locale)}#documents`} className={buttonClass({ variant: 'primary', size: 'sm', className: 'self-start' })}>
            {g.bannerButton}
          </Link>
        )}
      </CardBody>
    </Card>
  );
}

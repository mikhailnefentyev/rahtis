'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Badge, Button, Card, CardBody, Kv, Mono, Textarea } from '@/components/ui';
import {
  approveCompanyAction,
  recheckRegistryAction,
  rejectCompanyAction,
} from '@/lib/companies/actions';
import { useI18n } from '@/lib/i18n/provider';
import type { RegistryCheck } from '@/lib/registry/prh';
import type { Company } from '@/types/db';

const verdictTone = { OK: 'ok', ATTENTION: 'warn', NOT_FOUND: 'warn', ERROR: 'danger' } as const;

/**
 * Итог сверки с PRH на момент заявки.
 *
 * Замечания показываются как есть, по-фински: их же оператор получил в
 * письме, и две разные формулировки одного замечания только путают.
 */
function RegistryBlock({ company }: { company: Company }) {
  const { t, locale, f } = useI18n();
  const r = company.registry_check as RegistryCheck | null;
  const yes = (value: boolean | null) =>
    value === null ? '–' : value ? t.moderation.registryYes : t.moderation.registryNo;

  return (
    <div className="flex flex-col gap-1.5 rounded-control border border-line bg-sunken p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="label-micro">{t.moderation.registry}</span>
          {r ? (
            <Badge tone={verdictTone[r.verdict]}>{t.moderation.registryVerdict[r.verdict]}</Badge>
          ) : (
            <Badge tone="neutral">{t.moderation.registryNone}</Badge>
          )}
          {r && <Mono className="text-xs text-ink-faint">{f.dateTime(r.checkedAt)}</Mono>}
        </div>
        <form action={recheckRegistryAction}>
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="company_id" value={company.id} />
          <button
            type="submit"
            className="text-xs text-ink-faint underline underline-offset-2 hover:text-ink-muted"
          >
            {t.moderation.registryRecheck}
          </button>
        </form>
      </div>

      {r?.officialName && (
        <div className="flex flex-col gap-1">
          <Kv
            k={t.moderation.registryName}
            v={`${r.officialName}${r.form ? ` · ${r.form}` : ''}`}
          />
          <Kv
            k={`${t.moderation.registryPrepayment} · ${t.moderation.registryVat} · ${t.moderation.registryEmployer}`}
            v={`${yes(r.prepayment)} · ${yes(r.vat)} · ${yes(r.employer)}`}
          />
        </div>
      )}

      {r?.issues.map((issue) => (
        <p key={issue} className="text-xs text-warn">
          {issue}
        </p>
      ))}

      <p className="text-xs text-ink-faint">{t.moderation.registryPeople}</p>
    </div>
  );
}

/**
 * Заявка в очереди модерации.
 *
 * Отказ требует причины: компания увидит её в своей истории, и «отклонено»
 * без объяснения превращается в звонок оператору. Поэтому форма отказа
 * раскрывается отдельным шагом, а не отправляется одним кликом.
 */
export function ApplicationCard({ company, ytjUrl }: { company: Company; ytjUrl: string }) {
  const { t, locale, f } = useI18n();
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');

  return (
    <Card>
      <CardBody className="flex flex-col gap-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <h3 className="text-[15px] font-semibold tracking-tight">
                <Link
                  href={`/${locale}/admin/company/${company.id}`}
                  className="hover:text-accent"
                >
                  {company.name}
                </Link>
              </h3>
              <Badge tone={company.kind === 'CARRIER' ? 'live' : 'info'}>
                {t.role[company.kind]}
              </Badge>
            </div>
            <div className="mt-2 flex flex-col gap-1">
              <Kv
                k={t.cabinet.businessId}
                v={
                  <a
                    href={ytjUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono tracking-tight text-accent hover:underline"
                  >
                    {company.business_id}
                  </a>
                }
              />
              <Kv k={t.company.email} v={company.contact_email} />
              <Kv k={t.moderation.decidedAt} v={<Mono>{f.dateTime(company.created_at)}</Mono>} />
            </div>
          </div>

          {!rejecting && (
            <div className="flex flex-col gap-2">
              <form action={approveCompanyAction}>
                <input type="hidden" name="locale" value={locale} />
                <input type="hidden" name="company_id" value={company.id} />
                <Button type="submit" variant="primary" size="sm" className="w-full">
                  {t.moderation.approveAndInvite}
                </Button>
              </form>
              <Button variant="danger" size="sm" onClick={() => setRejecting(true)}>
                {t.moderation.rejectWithReason}
              </Button>
            </div>
          )}
        </div>

        <RegistryBlock company={company} />

        {rejecting && (
          <form action={rejectCompanyAction} className="flex flex-col gap-2 border-t border-line pt-3">
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="company_id" value={company.id} />

            <label className="label-micro" htmlFor={`reason-${company.id}`}>
              {t.moderation.reasonLabel}
            </label>
            <Textarea
              id={`reason-${company.id}`}
              name="reason"
              rows={2}
              required
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={t.moderation.reasonPlaceholder}
            />
            <p className="text-xs text-ink-faint">{t.moderation.reasonRequired}</p>

            <div className="flex gap-2">
              <Button type="button" size="sm" className="flex-1" onClick={() => setRejecting(false)}>
                {t.action.cancel}
              </Button>
              <Button
                type="submit"
                variant="danger"
                size="sm"
                className="flex-[2]"
                disabled={reason.trim().length === 0}
              >
                {t.moderation.rejectWithReason}
              </Button>
            </div>
          </form>
        )}
      </CardBody>
    </Card>
  );
}

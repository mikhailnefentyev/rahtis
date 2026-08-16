'use client';

import { useState } from 'react';
import { Badge, Button, Card, CardBody, Kv, Mono, Textarea } from '@/components/ui';
import { approveCompanyAction, rejectCompanyAction } from '@/lib/companies/actions';
import { useI18n } from '@/lib/i18n/provider';
import type { Company } from '@/types/db';

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
              <h3 className="text-[15px] font-semibold tracking-tight">{company.name}</h3>
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

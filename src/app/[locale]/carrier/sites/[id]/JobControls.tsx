'use client';

import { useState } from 'react';
import { Button, Card, CardBody, Mono } from '@/components/ui';
import { setSiteJobStatusAction } from '@/lib/sites/actions';
import { useI18n } from '@/lib/i18n/provider';
import type { ScaleSite, SiteJob } from '@/types/db';
import { SiteJobForm } from '../SiteJobForm';

/** Правка объекта, ссылка прораба, закрытие. */
export function JobControls({
  job,
  scaleSites,
  foremanUrl,
}: {
  job: SiteJob;
  scaleSites: Pick<ScaleSite, 'id' | 'name' | 'city'>[];
  foremanUrl: string;
}) {
  const { t, locale } = useI18n();
  const [editing, setEditing] = useState(false);
  const [copied, setCopied] = useState(false);
  const s = t.sites;

  async function copy() {
    try {
      await navigator.clipboard.writeText(foremanUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* без буфера обмена ссылка остаётся на экране — её можно выделить */
    }
  }

  return (
    <div className="mb-8 flex flex-col gap-4">
      {editing ? (
        <SiteJobForm job={job} scaleSites={scaleSites} onClose={() => setEditing(false)} />
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => setEditing(true)}>
            {t.action.details}
          </Button>
          <form action={setSiteJobStatusAction}>
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="id" value={job.id} />
            <input type="hidden" name="status" value={job.status === 'ACTIVE' ? 'CLOSED' : 'ACTIVE'} />
            <Button type="submit" size="sm" variant={job.status === 'ACTIVE' ? 'ghost' : 'primary'}>
              {job.status === 'ACTIVE' ? s.closeJob : s.reopenJob}
            </Button>
          </form>
        </div>
      )}

      <Card>
        <CardBody className="flex flex-col gap-2">
          <p className="text-[13px] font-semibold">{s.foremanLink}</p>
          <p className="text-[13px] text-ink-muted">{s.foremanLinkHint}</p>
          <div className="flex flex-wrap items-center gap-2">
            <Mono className="break-all text-[12px]">{foremanUrl}</Mono>
            <Button size="sm" onClick={copy}>
              {copied ? s.copied : s.copy}
            </Button>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

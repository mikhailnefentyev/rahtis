'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Badge, Button, Card, CardBody, EmptyState } from '@/components/ui';
import { useI18n } from '@/lib/i18n/provider';
import type { ScaleSite, SiteJob } from '@/types/db';
import { SiteJobForm } from './SiteJobForm';

export function SitesView({
  jobs,
  scaleSites,
  defaultCountry,
}: {
  jobs: SiteJob[];
  scaleSites: Pick<ScaleSite, 'id' | 'name' | 'city'>[];
  /** Страна нового объекта по умолчанию — страна компании перевозчика. */
  defaultCountry: string;
}) {
  const { t, locale } = useI18n();
  const [adding, setAdding] = useState(false);
  const s = t.sites;

  return (
    <section>
      <div className="mb-4 flex justify-end">
        {!adding && (
          <Button variant="primary" size="sm" onClick={() => setAdding(true)}>
            {s.newJob}
          </Button>
        )}
      </div>
      {adding && (
        <div className="mb-4">
          <SiteJobForm job={null} scaleSites={scaleSites} defaultCountry={defaultCountry} onClose={() => setAdding(false)} />
        </div>
      )}
      {jobs.length === 0 && !adding ? (
        <EmptyState title={s.title} description={s.noJobs} />
      ) : (
        <div className="flex flex-col gap-2">
          {jobs.map((job) => (
            <Link key={job.id} href={`/${locale}/carrier/sites/${job.id}`}>
              <Card className="transition-colors hover:border-line-strong">
                <CardBody className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[15px] font-semibold">{job.name}</p>
                    <p className="text-[13px] text-ink-muted">
                      {job.customer_name}
                      {job.address ? ` · ${job.address}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 text-[13px]">
                    <span className="text-ink-muted">{s.pricingOptions[job.pricing]}</span>
                    <Badge tone={job.status === 'ACTIVE' ? 'ok' : 'neutral'}>{job.status === 'ACTIVE' ? s.active : s.closed}</Badge>
                  </div>
                </CardBody>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}

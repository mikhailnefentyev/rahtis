'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Badge, Button, buttonClass, Card, CardBody, EmptyState, Mono } from '@/components/ui';
import { orderStatusTone } from '@/components/ui/tone';
import { useI18n } from '@/lib/i18n/provider';
import type { CarrierClient, OrderStatus, OwnVehicle } from '@/types/db';
import { OrderForm } from '../../shipper/orders/OrderForm';
import { OwnClients } from './OwnClients';

export type OwnJob = {
  id: string;
  ref: string;
  status: OrderStatus;
  client: string;
  route: string;
  plate: string;
  created_at: string;
  track: string | null;
  /** Где открыть сам рейс; у снятого открывать нечего. */
  href: string | null;
};

/**
 * Свои рейсы: форма и последние рейсы со ссылкой для клиента.
 *
 * Ссылку можно скопировать и отправить клиенту самому — например, когда
 * почта клиента не указана или письмо до него не дошло.
 */
export function OwnView({
  jobs,
  clients,
  vehicles,
  startNew = false,
  blocked = null,
}: {
  startNew?: boolean;
  /** Почему рейс сейчас не создать (не приняты новые условия). */
  blocked?: string | null;
  jobs: OwnJob[];
  clients: CarrierClient[];
  vehicles: OwnVehicle[];
}) {
  const { t, f } = useI18n();
  const router = useRouter();
  const [composing, setComposing] = useState(startNew);
  const [formKey, setFormKey] = useState(0);
  const [copied, setCopied] = useState<string | null>(null);

  async function copy(job: OwnJob) {
    if (!job.track) return;
    try {
      await navigator.clipboard.writeText(job.track);
      setCopied(job.id);
      setTimeout(() => setCopied((c) => (c === job.id ? null : c)), 2000);
    } catch {
      /* Буфер недоступен (старый браузер, запрет) — ссылка видна в подсказке кнопки. */
    }
  }

  return (
    <>
      <div className="mb-6">
        {blocked ? (
          <p className="rounded-control border border-warn/40 bg-warn/5 px-3 py-2.5 text-[13px] text-ink">{blocked}</p>
        ) : composing ? (
          <OrderForm
            key={formKey}
            knownVehicles={[]}
            own={{ clients, vehicles }}
            onNew={() => {
              setFormKey((k) => k + 1);
              router.refresh();
            }}
            onPublished={() => {
              setComposing(false);
              router.refresh();
            }}
          />
        ) : (
          <Button variant="primary" onClick={() => setComposing(true)}>
            {t.own.newJob}
          </Button>
        )}
      </div>

      <p className="label-micro mb-2">{t.own.recent}</p>
      {jobs.length === 0 ? (
        <EmptyState title={t.own.empty} />
      ) : (
        <div className="flex flex-col gap-2">
          {jobs.map((job) => (
            <Card key={job.id}>
              <CardBody className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <Mono className="text-[13px]">{job.ref}</Mono>
                <Badge tone={orderStatusTone[job.status]}>{t.orderStatus[job.status]}</Badge>
                <span className="text-[13px] font-semibold">{job.client}</span>
                <span className="text-[13px] text-ink-muted">{job.route}</span>
                <span className="text-[13px] text-ink-muted">
                  {[job.plate, f.date(job.created_at)].filter(Boolean).join(' · ')}
                </span>
                <div className="ml-auto flex flex-wrap gap-2">
                  {job.href && (
                    <Link href={job.href} className={buttonClass({ variant: 'default', size: 'sm' })}>
                      {t.own.open}
                    </Link>
                  )}
                  {job.track && (
                    <Button size="sm" title={job.track} onClick={() => copy(job)}>
                      {copied === job.id ? t.own.copied : t.own.copy}
                    </Button>
                  )}
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      <OwnClients clients={clients} />
    </>
  );
}

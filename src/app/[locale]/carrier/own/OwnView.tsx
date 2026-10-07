'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Badge, Button, Card, CardBody, EmptyState, Mono } from '@/components/ui';
import { orderStatusTone } from '@/components/ui/tone';
import { useI18n } from '@/lib/i18n/provider';
import type { CarrierClient, OrderStatus, OwnVehicle } from '@/types/db';
import { OrderForm } from '../../shipper/orders/OrderForm';

export type OwnJob = {
  id: string;
  ref: string;
  status: OrderStatus;
  client: string;
  route: string;
  plate: string;
  created_at: string;
  track: string | null;
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
}: {
  startNew?: boolean;
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
        {composing ? (
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
                  {job.plate} · {f.date(job.created_at)}
                </span>
                {job.track && (
                  <Button size="sm" className="ml-auto" title={job.track} onClick={() => copy(job)}>
                    {copied === job.id ? t.own.copied : t.own.copy}
                  </Button>
                )}
              </CardBody>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}

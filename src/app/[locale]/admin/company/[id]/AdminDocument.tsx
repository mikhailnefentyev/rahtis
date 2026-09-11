'use client';

import { useTransition } from 'react';
import { Badge, Button, Card, CardBody, Mono } from '@/components/ui';
import { documentUrlAction } from '@/lib/fleet/actions';
import { useI18n } from '@/lib/i18n/provider';
import type { CompanyDocument, DocumentKind } from '@/types/db';

/**
 * Документ компании глазами оператора.
 *
 * Отличается от карточки в кабинете перевозчика тем, чего в ней нет:
 * загрузки. Оператор документы не подаёт, он их проверяет, и кнопка
 * «загрузить» на его экране означала бы, что он может подложить компании
 * её лицензию — а отвечать за неё будет компания.
 *
 * Главное здесь — кнопка «открыть». Настоящая страховка отличается от
 * ненастоящей только одним способом: её надо увидеть. Даты и статусы это
 * подсказки, а не доказательство.
 */
export function AdminDocument({
  kind,
  document,
  daysLeft,
}: {
  kind: DocumentKind;
  document: CompanyDocument | null;
  /** Считается на сервере: часы клиента могут врать. */
  daysLeft: number | null;
}) {
  const { t, m, f } = useI18n();
  const [opening, startOpening] = useTransition();

  const expired = daysLeft != null && daysLeft < 0;
  const soon = daysLeft != null && daysLeft >= 0 && daysLeft <= 30;
  const tone = !document ? 'warn' : expired ? 'danger' : soon ? 'warn' : 'ok';

  function open() {
    if (!document) return;
    startOpening(async () => {
      const url = await documentUrlAction(document.storage_path);
      if (url) window.open(url, '_blank', 'noopener,noreferrer');
    });
  }

  return (
    <Card stripe={tone}>
      <CardBody className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-[14px] font-semibold tracking-tight">{t.documents[kind]}</h3>
          <Badge tone={tone}>
            {!document
              ? t.documents.notUploaded
              : expired
                ? t.documents.expired
                : t.companyStatus.ACTIVE}
          </Badge>
        </div>

        {document ? (
          <>
            <span className="truncate text-[13px] text-ink-muted">{document.file_name}</span>
            <Mono className="text-xs text-ink-dim">
              {document.valid_until
                ? expired
                  ? m('documents.expiredAgo', { count: Math.abs(daysLeft!) })
                  : soon
                    ? m('documents.expiresIn', { count: daysLeft! })
                    : m('documents.validUntilDate', { date: f.date(document.valid_until) })
                : t.documents.perpetual}
            </Mono>
            <Button size="sm" onClick={open} disabled={opening} className="self-start">
              {t.documents.view}
            </Button>
          </>
        ) : (
          /* Пусто — это тоже вывод: компания документ не подавала. */
          <p className="text-[13px] text-ink-muted">{t.documents.notUploaded}</p>
        )}
      </CardBody>
    </Card>
  );
}

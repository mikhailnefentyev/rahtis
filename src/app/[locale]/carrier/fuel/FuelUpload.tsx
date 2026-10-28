'use client';

import { useActionState } from 'react';
import { Button, Card, CardBody, FileDrop } from '@/components/ui';
import { uploadFuelReportAction, type FuelUploadState } from '@/lib/fuel/actions';
import { useI18n } from '@/lib/i18n/provider';

const initial: FuelUploadState = { error: null };

/**
 * Месячный отчёт заправщика: PDF или CSV. После загрузки — страница
 * проверки распознанных строк (действие само переходит туда).
 */
export function FuelUpload() {
  const { t, locale } = useI18n();
  const s = t.fuel;
  const [state, action, pending] = useActionState(uploadFuelReportAction, initial);

  return (
    <Card>
      <CardBody>
        <form action={action} className="flex flex-col gap-3">
          <input type="hidden" name="locale" value={locale} />
          <h3 className="text-[13px] font-semibold">{s.upload}</h3>
          <p className="text-[12px] leading-relaxed text-ink-muted">{s.uploadHint}</p>
          <FileDrop
            name="file"
            accept="application/pdf,text/csv,application/vnd.ms-excel,text/plain"
            maxBytes={4 * 1024 * 1024}
            required
            choose={s.choose}
            drop={s.drop}
            tooLarge={s.reportWrongFile}
            wrongType={s.reportWrongFile}
          />
          {state.error && <p className="text-xs text-danger">{state.error}</p>}
          {pending && <p className="text-xs text-ink-muted">{s.uploading}</p>}
          <div>
            <Button type="submit" variant="primary" disabled={pending}>
              {s.uploadButton}
            </Button>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}

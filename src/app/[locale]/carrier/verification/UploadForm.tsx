'use client';

import { useActionState, useState } from 'react';
import { Button, Field, FileDrop, Input } from '@/components/ui';
import { uploadVerificationAction, type VerificationUploadState } from '@/lib/verification/actions';
import { addMonths, THREE_MONTH_ITEMS, VERIFICATION_ITEMS, type VerificationItem } from '@/lib/verification/items';
import { useI18n } from '@/lib/i18n/provider';

const initial: VerificationUploadState = { error: null, done: 0 };

/**
 * Загрузка справки на пункт или отчёта Luotettava Kumppani.
 *
 * Срок считается по дате выдачи на месте: у трёхмесячных справок он не
 * правится (база проверяет то же самое), у TES, työterveyshuolto и
 * страховки — правится. Сегодняшняя дата приходит с сервера: часы
 * клиента могут врать.
 */
export function UploadForm({
  item,
  today,
  compact,
}: {
  /** null — отчёт Vastuu: пункты выбираются галочками. */
  item: VerificationItem | null;
  today: string;
  /** Свёрнута до кнопки, пока перевозчик не решил загрузить. */
  compact?: boolean;
}) {
  const { t, locale } = useI18n();
  const [state, formAction, pending] = useActionState(uploadVerificationAction, initial);
  const [open, setOpen] = useState(!compact);

  if (!open) {
    return (
      <Button size="sm" className="self-start" onClick={() => setOpen(true)}>
        {t.verification.upload}
      </Button>
    );
  }

  /* key по счётчику успешных загрузок: форма начинается заново, без имени прежнего файла. */
  return (
    <UploadFields
      key={state.done}
      item={item}
      today={today}
      locale={locale}
      formAction={formAction}
      pending={pending}
      error={state.error}
    />
  );
}

function UploadFields({
  item,
  today,
  locale,
  formAction,
  pending,
  error,
}: {
  item: VerificationItem | null;
  today: string;
  locale: string;
  formAction: (payload: FormData) => void;
  pending: boolean;
  error: string | null;
}) {
  const { t } = useI18n();
  const v = t.verification;
  const [issued, setIssued] = useState(today);
  const [covers, setCovers] = useState<VerificationItem[]>(item ? [item] : [...VERIFICATION_ITEMS]);
  const [own, setOwn] = useState<string | null>(null);
  const fixed = covers.some((i) => THREE_MONTH_ITEMS.includes(i));
  const auto = /^\d{4}-\d{2}-\d{2}$/.test(issued) ? addMonths(issued, 3) : '';

  return (
    <form action={formAction} className="flex flex-col gap-3 border-t border-line pt-3">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="source" value={item ? 'ITEM' : 'VASTUU'} />
      {item && <input type="hidden" name="items" value={item} />}

      {!item && (
        <fieldset className="flex flex-col gap-1.5">
          <legend className="label-micro mb-1">{v.covers}</legend>
          {VERIFICATION_ITEMS.map((i) => (
            <label key={i} className="flex items-center gap-2 text-[13px]">
              <input
                type="checkbox"
                name="items"
                value={i}
                checked={covers.includes(i)}
                onChange={(e) => setCovers((prev) => (e.target.checked ? [...prev, i] : prev.filter((x) => x !== i)))}
              />
              {v.items[i]}
            </label>
          ))}
        </fieldset>
      )}

      <FileDrop
        name="file"
        accept="application/pdf,image/jpeg,image/png"
        maxBytes={10 * 1024 * 1024}
        required
        choose={t.documents.chooseFile}
        drop={v.dropFile}
        tooLarge={t.documents.tooLarge}
        wrongType={v.wrongType}
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={v.issuedOn} required>
          {(p) => (
            <Input
              {...p}
              type="date"
              name="issued_on"
              required
              max={today}
              value={issued}
              onChange={(e) => setIssued(e.target.value)}
            />
          )}
        </Field>
        <Field label={v.validUntil} hint={fixed ? v.validUntilAuto : v.validUntilOwn}>
          {(p) =>
            fixed ? (
              <Input {...p} type="date" value={auto} readOnly disabled />
            ) : (
              <Input
                {...p}
                type="date"
                name="valid_until"
                min={issued}
                value={own ?? auto}
                onChange={(e) => setOwn(e.target.value)}
              />
            )
          }
        </Field>
      </div>

      {error && (
        <p role="alert" className="text-[13px] text-danger">
          {error}
        </p>
      )}

      <Button type="submit" variant="primary" size="sm" disabled={pending || covers.length === 0} className="self-start">
        {pending ? v.uploading : v.upload}
      </Button>
    </form>
  );
}

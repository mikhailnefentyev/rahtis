'use client';

import { useActionState, useState } from 'react';
import { cn } from '@/lib/cn';
import { deleteCertificateAction, saveCertificateAction, type CertificateState } from '@/lib/drivers/certificates';
import { useI18n } from '@/lib/i18n/provider';
import { Badge, type StatusTone } from '@/components/ui';
import { Constants } from '@/types/database';
import type { DriverCertificateType } from '@/types/db';

export type CertificateRow = {
  id: string;
  type: DriverCertificateType;
  issued_at: string | null;
  expires_at: string;
};

/** За сколько дней до конца документ помечается «скоро истекает»: ступень напоминания 3M. */
const SOON_DAYS = 92;
const DAY = 86_400_000;

type Status = { tone: StatusTone; key: 'expired' | 'soon' | 'valid'; days: number };

function status(expires: string, today: string): Status {
  const days = Math.round((Date.parse(expires) - Date.parse(today)) / DAY);
  if (days < 0) return { tone: 'danger', key: 'expired', days };
  return days <= SOON_DAYS ? { tone: 'warn', key: 'soon', days } : { tone: 'ok', key: 'valid', days };
}

const STRIPE: Record<StatusTone, string> = {
  danger: 'bg-danger',
  warn: 'bg-warn',
  ok: 'bg-ok',
  neutral: 'bg-line-strong',
  live: 'bg-live',
  info: 'bg-accent',
};

/**
 * Сроки сертификатов водителя: список и форма «добавить или продлить».
 *
 * Один компонент на два места: профиль в приложении водителя (крупно, под
 * палец) и карточка водителя в кабинете перевозчика. Права решает база.
 * `today` приходит с сервера, чтобы статус не прыгал при гидратации.
 *
 * Сколько осталось — словами на языке экрана через Intl
 * («через 5 месяцев», «3 дня назад»), без новых строк в словарях.
 */
export function DriverCertificates({
  driverId,
  rows,
  today,
  variant,
}: {
  driverId: string;
  rows: CertificateRow[];
  today: string;
  variant: 'app' | 'cabinet';
}) {
  const { t, f, locale } = useI18n();
  const texts = t.certificates;
  const [open, setOpen] = useState(rows.length === 0);
  /* Сохранилось — форма закрывается; при следующем открытии она пустая, потому что монтируется заново. */
  const [state, action, pending] = useActionState<CertificateState, FormData>(
    async (previous, formData) => {
      const result = await saveCertificateAction(previous, formData);
      if (result.done) setOpen(false);
      return result;
    },
    { error: null, done: false },
  );

  const relative = new Intl.RelativeTimeFormat(t.meta.intl, { numeric: 'auto' });
  const inWords = (days: number) =>
    Math.abs(days) >= 60 ? relative.format(Math.round(days / 30.4), 'month') : relative.format(days, 'day');

  const app = variant === 'app';
  const control = cn(
    /*
     * min-w-0 и appearance-none: поле даты на iPhone иначе держит свою
     * ширину, распирает колонку и делает страницу шире экрана.
     */
    'block w-full min-w-0 appearance-none rounded-control border border-line bg-sunken px-3 text-left text-ink',
    app ? 'h-12 text-[16px]' : 'h-9 text-[13px]',
  );
  const label = app ? 'text-[14px] text-ink-muted' : 'text-[12px] text-ink-muted';

  return (
    <div className="flex flex-col gap-3">
      {rows.length === 0 ? (
        <p className={cn('text-ink-muted', app ? 'text-[15px]' : 'text-[13px]')}>{texts.empty}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {rows.map((row) => {
            const s = status(row.expires_at, today);
            return (
              <li key={row.id} className="flex overflow-hidden rounded-control border border-line bg-surface">
                <span aria-hidden className={cn('w-1.5 shrink-0', STRIPE[s.tone])} />
                <div className={cn('flex min-w-0 flex-1 items-center justify-between gap-3', app ? 'px-3 py-2.5' : 'px-2.5 py-2')}>
                  <div className="min-w-0">
                    <p className={cn('font-semibold', app ? 'text-[16px]' : 'text-[13px]')}>{texts.types[row.type]}</p>
                    <p className={cn('text-ink-muted', app ? 'text-[14px]' : 'text-[12px]')}>
                      {texts.expires} {f.date(`${row.expires_at}T12:00:00Z`)} ·{' '}
                      <span className={cn('font-semibold', s.tone === 'danger' ? 'text-danger' : s.tone === 'warn' ? 'text-warn' : '')}>
                        {inWords(s.days)}
                      </span>
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <Badge tone={s.tone}>{texts[s.key]}</Badge>
                    <form action={deleteCertificateAction}>
                      <input type="hidden" name="locale" value={locale} />
                      <input type="hidden" name="id" value={row.id} />
                      <input type="hidden" name="driver_id" value={driverId} />
                      <button
                        type="submit"
                        aria-label={`${texts.remove}: ${texts.types[row.type]}`}
                        className={cn('text-ink-muted underline', app ? 'min-h-11 px-1 text-[14px]' : 'h-6 text-[12px]')}
                      >
                        {texts.remove}
                      </button>
                    </form>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={cn(
            'rounded-control border-[1.5px] border-dashed border-accent-line font-semibold text-accent',
            app ? 'h-12 text-[16px]' : 'h-9 self-start px-4 text-[13px]',
          )}
        >
          + {texts.add}
        </button>
      ) : (
        <form
          action={action}
          className={cn('flex flex-col gap-2.5 rounded-control bg-raised/60', app ? 'p-3' : 'p-2.5')}
        >
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="driver_id" value={driverId} />
          <label className="flex flex-col gap-1">
            <span className={label}>{texts.type}</span>
            <select name="type" required className={control} defaultValue="CODE95">
              {Constants.public.Enums.driver_certificate_type.map((type) => (
                <option key={type} value={type}>
                  {texts.types[type]}
                </option>
              ))}
            </select>
          </label>
          <div className="grid grid-cols-2 gap-2.5">
            <label className="flex min-w-0 flex-col gap-1">
              <span className={label}>{texts.issued}</span>
              <input type="date" name="issued_at" className={control} />
            </label>
            <label className="flex min-w-0 flex-col gap-1">
              <span className={label}>{texts.expires}</span>
              <input type="date" name="expires_at" required className={control} />
            </label>
          </div>
          {state.error && (
            <p role="alert" className={cn('text-danger', app ? 'text-[14px]' : 'text-[12px]')}>
              {state.error}
            </p>
          )}
          <div className={cn('flex gap-2', !app && 'self-start')}>
            {rows.length > 0 && (
              <button
                type="button"
                onClick={() => setOpen(false)}
                className={cn(
                  'rounded-control border border-line bg-surface font-semibold',
                  app ? 'h-12 flex-1 text-[16px]' : 'h-9 px-4 text-[13px]',
                )}
              >
                {t.training.cancel}
              </button>
            )}
            <button
              type="submit"
              disabled={pending}
              className={cn(
                'rounded-control bg-accent font-semibold text-accent-ink disabled:opacity-40',
                app ? 'h-12 flex-[2] text-[16px]' : 'h-9 px-4 text-[13px]',
              )}
            >
              {texts.save}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

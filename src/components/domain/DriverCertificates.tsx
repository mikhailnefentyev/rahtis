'use client';

import { useActionState, useEffect, useRef } from 'react';
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

function status(expires: string, today: string): { tone: StatusTone; key: 'expired' | 'soon' | 'valid' } {
  if (expires < today) return { tone: 'danger', key: 'expired' };
  const days = (Date.parse(expires) - Date.parse(today)) / 86_400_000;
  return days <= SOON_DAYS ? { tone: 'warn', key: 'soon' } : { tone: 'ok', key: 'valid' };
}

/**
 * Сроки сертификатов водителя: список и форма «добавить или продлить».
 *
 * Один компонент на два места: профиль в приложении водителя (крупно, под
 * палец) и карточка водителя в кабинете перевозчика. Права решает база.
 * `today` приходит с сервера, чтобы статус не прыгал при гидратации.
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
  const [state, action, pending] = useActionState<CertificateState, FormData>(saveCertificateAction, {
    error: null,
    done: false,
  });
  const form = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.done) form.current?.reset();
  }, [state]);

  const app = variant === 'app';
  const control = cn(
    'w-full rounded-control border border-line bg-sunken px-3 text-ink',
    app ? 'h-12 text-[16px]' : 'h-9 text-[13px]',
  );
  const label = app ? 'text-[14px] text-ink-muted' : 'text-[12px] text-ink-muted';

  return (
    <div className="flex flex-col gap-3">
      {rows.length === 0 ? (
        <p className={cn('text-ink-muted', app ? 'text-[15px]' : 'text-[13px]')}>{texts.empty}</p>
      ) : (
        <ul className="divide-y divide-line">
          {rows.map((row) => {
            const s = status(row.expires_at, today);
            return (
              <li key={row.id} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className={cn('font-semibold', app ? 'text-[16px]' : 'text-[13px]')}>{texts.types[row.type]}</p>
                  <p className={cn('text-ink-muted', app ? 'text-[14px]' : 'text-[12px]')}>
                    {texts.expires} {f.date(`${row.expires_at}T12:00:00Z`)}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Badge tone={s.tone}>{texts[s.key]}</Badge>
                  <form action={deleteCertificateAction}>
                    <input type="hidden" name="locale" value={locale} />
                    <input type="hidden" name="id" value={row.id} />
                    <input type="hidden" name="driver_id" value={driverId} />
                    <button
                      type="submit"
                      aria-label={`${texts.remove}: ${texts.types[row.type]}`}
                      className={cn('rounded-control px-2 text-danger', app ? 'h-11 text-[14px]' : 'h-7 text-[12px]')}
                    >
                      {texts.remove}
                    </button>
                  </form>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <form ref={form} action={action} className="flex flex-col gap-2.5">
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
          <label className="flex flex-col gap-1">
            <span className={label}>{texts.issued}</span>
            <input type="date" name="issued_at" className={control} />
          </label>
          <label className="flex flex-col gap-1">
            <span className={label}>{texts.expires}</span>
            <input type="date" name="expires_at" required className={control} />
          </label>
        </div>
        {state.error && (
          <p role="alert" className={cn('text-danger', app ? 'text-[14px]' : 'text-[12px]')}>
            {state.error}
          </p>
        )}
        <button
          type="submit"
          disabled={pending}
          className={cn(
            'rounded-control bg-accent font-semibold text-accent-ink disabled:opacity-40',
            app ? 'h-12 text-[16px]' : 'h-9 self-start px-4 text-[13px]',
          )}
        >
          {texts.save}
        </button>
      </form>
    </div>
  );
}

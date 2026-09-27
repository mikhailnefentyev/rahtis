'use client';

import { useRef, useTransition } from 'react';
import { Select } from '@/components/ui';
import { setDriverLanguageAction } from '@/lib/driverApp/actions';
import { DRIVER_LOCALES, DRIVER_LOCALE_NAMES } from '@/lib/i18n/driver';
import { useI18n } from '@/lib/i18n/provider';

/**
 * Язык приложения водителя.
 *
 * Пустое значение — «как на телефоне»: язык берётся из настроек
 * устройства, и водителю, сменившему телефон на эстонский, ничего
 * выбирать не придётся. Выбор сохраняется у водителя, а не в браузере:
 * вход с нового телефона по коду не должен возвращать чужой язык.
 */
export function LanguagePicker({ current }: { current: string | null }) {
  const { t, locale } = useI18n();
  const form = useRef<HTMLFormElement>(null);
  const [pending, start] = useTransition();

  return (
    <form ref={form} action={setDriverLanguageAction} className="flex items-center gap-2">
      <input type="hidden" name="locale" value={locale} />
      <Select
        name="language"
        defaultValue={current ?? ''}
        disabled={pending}
        aria-label={t.driverApp.language}
        onChange={() => start(() => form.current?.requestSubmit())}
        className="h-11 w-44"
      >
        <option value="">{t.driverApp.languageAuto}</option>
        {DRIVER_LOCALES.map((code) => (
          <option key={code} value={code}>
            {DRIVER_LOCALE_NAMES[code]}
          </option>
        ))}
      </Select>
    </form>
  );
}

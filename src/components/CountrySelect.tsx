'use client';

import { Select } from '@/components/ui';
import { enabledCountries } from '@/lib/country';
import { useI18n } from '@/lib/i18n/provider';

/**
 * Страна компании из пакетов стран (src/lib/country), названия — на языке
 * страницы: «Puola» по-фински, «Poland» по-английски.
 */
export function CountrySelect(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  const { locale } = useI18n();
  const names = new Intl.DisplayNames([locale], { type: 'region' });
  return (
    <Select {...props}>
      {enabledCountries().map((code) => (
        <option key={code} value={code}>
          {names.of(code) ?? code}
        </option>
      ))}
    </Select>
  );
}

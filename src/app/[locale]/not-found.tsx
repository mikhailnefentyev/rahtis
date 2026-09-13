'use client';

import Link from 'next/link';
import { buttonClass, Card, CardBody } from '@/components/ui';
import { signInPath } from '@/lib/auth/paths';
import { useI18n } from '@/lib/i18n/provider';

/**
 * Страница на несуществующий адрес.
 *
 * До этого файла её не было, и Next отдавал свою: «404: This page could
 * not be found.» по-английски, без шапки и без единой ссылки — на
 * финском сайте, финскому читателю, в тупик.
 *
 * Клиентский компонент, хотя ничего не нажимает. Причина в том, что
 * not-found.tsx не получает params: узнать язык из адреса ему нечем.
 * Зато он рисуется внутри layout сегмента [locale], где словарь уже
 * положен в контекст — и useI18n() достаёт из него ровно тот язык, на
 * котором человек и шёл.
 */
export default function NotFound() {
  const { t, locale } = useI18n();

  return (
    <main className="flex flex-1 items-center justify-center px-5 py-16">
      <Card className="w-full max-w-lg">
        <CardBody className="p-7 text-center">
          <p className="label-micro">404</p>

          <h1 className="mt-2.5 text-[clamp(22px,3vw,28px)] leading-tight font-semibold tracking-tight text-balance">
            {t.notFound.title}
          </h1>

          <p className="mx-auto mt-3 max-w-[46ch] text-[16px] leading-relaxed text-ink-muted">
            {t.notFound.lede}
          </p>

          <div className="mt-6 flex flex-wrap justify-center gap-2.5">
            <Link href={`/${locale}`} className={buttonClass({ variant: 'primary', size: 'md' })}>
              {t.notFound.home}
            </Link>
            <Link
              href={signInPath(locale)}
              className={buttonClass({ variant: 'ghost', size: 'md' })}
            >
              {t.notFound.signIn}
            </Link>
          </div>
        </CardBody>
      </Card>
    </main>
  );
}

'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { Button, buttonClass, Card, CardBody, Mono } from '@/components/ui';
import { reportRenderFailure } from '@/lib/incidents/action';
import { useI18n } from '@/lib/i18n/provider';

/**
 * Экран упавшей страницы.
 *
 * До сих пор его не было вовсе: любая ошибка отрисовки показывала
 * служебную страницу Next и не оставляла следа. Пользователь видел белый
 * лист, мы не видели ничего.
 *
 * Первое, что здесь написано, — что данные целы. Человек, у которого
 * страница развалилась посреди рейса, думает не про баг, а про то, не
 * потерялась ли отметка о выгрузке. Ответ: не потерялась, серверные
 * действия либо проходят целиком, либо не проходят вовсе.
 *
 * Отпечаток показан цифрами и моноширинным: его диктуют по телефону.
 */
export default function LocaleError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { t, locale } = useI18n();

  useEffect(() => {
    /*
     * Путь берётся здесь, а не на сервере: серверное действие видит свой
     * собственный адрес, а не тот, на котором упало.
     */
    void reportRenderFailure({ digest: error.digest, path: window.location.pathname });
  }, [error.digest]);

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 items-center px-5 py-16">
      <Card className="w-full" stripe="danger">
        <CardBody className="flex flex-col gap-4 p-6">
          <div>
            <h1 className="text-[17px] font-semibold tracking-tight">{t.error.title}</h1>
            <p className="mt-2 text-[13px] leading-relaxed text-ink-muted">{t.error.body}</p>
          </div>

          {error.digest && (
            <div className="rounded-control border border-line bg-sunken px-3 py-2.5">
              <p className="label-micro">{t.error.reference}</p>
              <Mono className="mt-1 block text-[13px]">{error.digest}</Mono>
              <p className="mt-1.5 text-xs text-ink-faint">{t.error.referenceHint}</p>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="primary" size="md" onClick={reset}>
              {t.error.retry}
            </Button>
            <Link href={`/${locale}`} className={buttonClass({ variant: 'default', size: 'md' })}>
              {t.error.home}
            </Link>
          </div>
        </CardBody>
      </Card>
    </main>
  );
}

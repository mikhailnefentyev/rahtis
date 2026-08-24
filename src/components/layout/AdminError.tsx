import { Card, CardBody } from '@/components/ui';
import type { AdminErrorCode } from '@/lib/admin/errors';
import { getI18n, type Locale } from '@/lib/i18n';

/**
 * Отказ базы на экране оператора.
 *
 * Полоса поверх страницы, а не тост: отказ приходит после перезагрузки
 * и должен остаться на виду, пока человек не сделает следующий шаг.
 * Исчезающее сообщение в админке — способ его не прочитать.
 */
export async function AdminError({
  locale,
  code,
}: {
  locale: Locale;
  code: string | undefined;
}) {
  if (!code) return null;

  const { t } = await getI18n(locale);

  const text: Record<AdminErrorCode, string> = {
    freezeBlocked: t.moderation.freezeBlocked,
    removeBlocked: t.moderation.removeBlocked,
    inviteNotSent: t.moderation.inviteNotSent,
    onlyForward: t.billing.onlyForward,
    notDone: t.billing.notDone,
    generic: t.error.generic,
  };

  const message = text[code as AdminErrorCode] ?? t.error.generic;

  return (
    <Card stripe="danger" className="mb-4">
      <CardBody>
        <p role="alert" className="text-[13px] text-ink">
          {message}
        </p>
      </CardBody>
    </Card>
  );
}

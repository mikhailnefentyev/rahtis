import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Badge, Card, CardBody, EmptyState, Mono, Table, TableFrame, Td, Th, Tr } from '@/components/ui';
import type { StatusTone } from '@/components/ui/tone';
import { requireRole } from '@/lib/auth/guard';
import { getI18n, isLocale } from '@/lib/i18n';
import { createClient } from '@/lib/supabase/server';
import type { Database } from '@/types/database';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const { t } = await getI18n(locale);
  return { title: t.outbox.title };
}

type Status = Database['public']['Enums']['email_status'];

const statusTone: Record<Status, StatusTone> = {
  PENDING: 'warn',
  SENT: 'ok',
  FAILED: 'danger',
  SKIPPED: 'neutral',
};

/**
 * Журнал писем.
 *
 * Единственный способ проверить логику писем, пока отправка не включена:
 * тема, адрес и текст видны целиком, и по ним понятно, что уйдёт в бою.
 * Ссылку приглашения отсюда же можно скопировать вручную — до Resend это
 * рабочий путь выдать доступ, а не заглушка.
 */
export default async function OutboxPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  /* Гейт уже стоит в layout админки; здесь он на случай переезда страницы. */
  await requireRole(locale, 'ADMIN');

  const [{ t, f }, supabase] = await Promise.all([getI18n(locale), createClient()]);

  const { data: rows } = await supabase
    .from('email_outbox')
    .select('id, created_at, template, to_email, to_name, subject, body_text, provider, status, error')
    .order('created_at', { ascending: false })
    .limit(100);

  const list = rows ?? [];
  const sending = list.some((row) => row.provider !== 'stub');

  return (
    <main className="mx-auto w-full max-w-6xl px-5 py-8">
      <h1 className="text-xl font-semibold tracking-tight">{t.outbox.title}</h1>
      <p className="mt-2 max-w-xl text-[13px] leading-relaxed text-ink-muted">
        {t.outbox.subtitle}
      </p>

      {!sending && list.length > 0 && (
        <Card stripe="warn" className="mt-4">
          <CardBody>
            <p className="text-[13px] text-ink-muted">{t.outbox.stubNotice}</p>
          </CardBody>
        </Card>
      )}

      {list.length === 0 ? (
        <EmptyState className="mt-6" title={t.outbox.empty} description={t.outbox.subtitle} />
      ) : (
        <div className="mt-6 flex flex-col gap-4">
          <TableFrame caption={t.outbox.title}>
            <Table>
              <thead>
                <tr>
                  <Th>{t.outbox.created}</Th>
                  <Th>{t.outbox.to}</Th>
                  <Th>{t.outbox.subject}</Th>
                  <Th>{t.outbox.template}</Th>
                  <Th>{t.outbox.provider}</Th>
                  <Th>{t.outbox.status}</Th>
                </tr>
              </thead>
              <tbody>
                {list.map((row) => (
                  <Tr key={row.id}>
                    <Td mono>{f.dateTime(row.created_at)}</Td>
                    <Td>{row.to_name ? `${row.to_name} · ${row.to_email}` : row.to_email}</Td>
                    <Td>{row.subject}</Td>
                    <Td mono>{row.template}</Td>
                    <Td mono>{row.provider}</Td>
                    <Td>
                      <Badge tone={statusTone[row.status]}>{t.outbox[row.status]}</Badge>
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </TableFrame>

          {/*
            * Тело последнего письма разворачивается прямо здесь: чаще
            * всего оператору нужна ссылка из свежего приглашения, и ради
            * неё открывать отдельную страницу незачем.
            */}
          <Card>
            <CardBody className="flex flex-col gap-2">
              <p className="label-micro">{t.outbox.body}</p>
              {list.slice(0, 5).map((row) => (
                <details key={row.id} className="border-t border-line pt-2 first:border-t-0">
                  <summary className="cursor-pointer text-[13px] text-ink-muted">
                    {row.subject} · <Mono className="text-xs">{row.to_email}</Mono>
                  </summary>
                  <pre className="mt-2 overflow-x-auto rounded-control bg-sunken p-3 text-[12px] leading-relaxed whitespace-pre-wrap">
                    {row.body_text}
                  </pre>
                  {row.error && <p className="mt-1 text-[12px] text-danger">{row.error}</p>}
                </details>
              ))}
            </CardBody>
          </Card>
        </div>
      )}
    </main>
  );
}

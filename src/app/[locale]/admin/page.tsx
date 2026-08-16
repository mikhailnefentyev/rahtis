import { notFound } from 'next/navigation';
import {
  Badge,
  Button,
  Card,
  CardBody,
  EmptyState,
  Mono,
  Stat,
  StatRow,
  Table,
  TableFrame,
  Td,
  Th,
  Tr,
} from '@/components/ui';
import { companyStatusTone } from '@/components/ui/tone';
import { requireRole } from '@/lib/auth/guard';
import { resendInviteAction } from '@/lib/companies/actions';
import { getI18n, isLocale } from '@/lib/i18n';
import { createClient } from '@/lib/supabase/server';
import { ApplicationCard } from './ApplicationCard';

/**
 * Пульт оператора: очередь заявок и последние решения.
 *
 * Данные читаются под сессией администратора. RLS отдаёт ему все компании,
 * секретный ключ здесь не нужен — он вступает в дело только там, где нужен
 * Admin API авторизации, то есть при отправке приглашения.
 */
export default async function AdminPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  await requireRole(locale, 'ADMIN');

  const [{ t, m, f }, supabase] = await Promise.all([getI18n(locale), createClient()]);

  const [{ data: pending }, { data: decided }, { data: profiles }] = await Promise.all([
    supabase
      .from('companies')
      .select('*')
      .eq('status', 'PENDING')
      .order('created_at', { ascending: true }),
    supabase
      .from('companies')
      .select('*')
      .neq('status', 'PENDING')
      .order('updated_at', { ascending: false })
      .limit(20),
    supabase.from('profiles').select('company_id').not('company_id', 'is', null),
  ]);

  /* У какой компании уже есть пользователь — значит приглашение дошло. */
  const withUsers = new Set((profiles ?? []).map((p) => p.company_id));

  const queue = pending ?? [];
  const history = decided ?? [];
  const active = history.filter((c) => c.status === 'ACTIVE').length;

  return (
    <main className="mx-auto w-full max-w-6xl px-5 py-8">
      <h1 className="text-xl font-semibold tracking-tight">{t.moderation.applications}</h1>

      <StatRow className="mt-6">
        <Stat
          label={t.moderation.queue}
          value={f.number(queue.length)}
          tone={queue.length > 0 ? 'warn' : 'neutral'}
        />
        <Stat
          label={t.companyStatus.APPROVED}
          value={f.number(history.filter((c) => c.status === 'APPROVED').length)}
          tone="info"
        />
        <Stat label={t.companyStatus.ACTIVE} value={f.number(active)} tone="ok" />
        <Stat
          label={t.companyStatus.REJECTED}
          value={f.number(history.filter((c) => c.status === 'REJECTED').length)}
          tone="neutral"
        />
      </StatRow>

      <section className="mt-8">
        <h2 className="mb-4 border-b border-line pb-2 text-[13px] font-semibold tracking-tight text-ink-faint">
          {m('moderation.pendingCount', { count: queue.length })}
        </h2>

        {queue.length === 0 ? (
          <EmptyState title={t.empty.noApplications} />
        ) : (
          <div className="flex flex-col gap-3">
            {queue.map((company) => (
              <ApplicationCard
                key={company.id}
                company={company}
                /* Реестр PRH/YTJ — оператор сверяет Y-tunnus вручную (ТЗ §3). */
                ytjUrl={`https://tietopalvelu.ytj.fi/yritys/${company.business_id}`}
              />
            ))}
          </div>
        )}
      </section>

      {history.length > 0 && (
        <section className="mt-10">
          <TableFrame caption={t.moderation.recent}>
            <Table>
              <thead>
                <tr>
                  <Th>{t.company.name}</Th>
                  <Th>{t.cabinet.businessId}</Th>
                  <Th>{t.cabinet.yourRole}</Th>
                  <Th>{t.cabinet.status}</Th>
                  <Th>{t.moderation.accessGranted}</Th>
                  <Th numeric>{t.moderation.decidedAt}</Th>
                </tr>
              </thead>
              <tbody>
                {history.map((company) => (
                  <Tr key={company.id}>
                    <Td>{company.name}</Td>
                    <Td mono>{company.business_id}</Td>
                    <Td>{t.role[company.kind]}</Td>
                    <Td>
                      <Badge tone={companyStatusTone[company.status]}>
                        {t.companyStatus[company.status]}
                      </Badge>
                    </Td>
                    <Td>
                      {company.status === 'REJECTED' ? (
                        <span className="text-ink-dim">—</span>
                      ) : withUsers.has(company.id) ? (
                        <span className="text-ok">{t.moderation.inviteSent}</span>
                      ) : (
                        <form action={resendInviteAction} className="flex items-center gap-2">
                          <input type="hidden" name="locale" value={locale} />
                          <input type="hidden" name="company_id" value={company.id} />
                          <span className="text-warn">{t.moderation.noUsersYet}</span>
                          <Button type="submit" size="sm">
                            {t.moderation.resendInvite}
                          </Button>
                        </form>
                      )}
                    </Td>
                    <Td numeric>
                      <Mono className="text-ink-muted">
                        {f.date(company.rejected_at ?? company.approved_at ?? company.updated_at)}
                      </Mono>
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </TableFrame>

          {history.some((c) => c.status === 'REJECTED' && c.rejection_reason) && (
            <Card className="mt-3">
              <CardBody className="flex flex-col gap-2">
                <p className="label-micro">{t.moderation.reasonLabel}</p>
                {history
                  .filter((c) => c.status === 'REJECTED' && c.rejection_reason)
                  .map((c) => (
                    <p key={c.id} className="text-[13px] text-ink-muted">
                      <span className="text-ink">{c.name}</span> — {c.rejection_reason}
                    </p>
                  ))}
              </CardBody>
            </Card>
          )}
        </section>
      )}
    </main>
  );
}

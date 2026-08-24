import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  Badge,
  Button,
  buttonClass,
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
import { deleteCompanyAction, resendInviteAction } from '@/lib/companies/actions';
import { daysUntil } from '@/lib/dates';
import { getI18n, isLocale } from '@/lib/i18n';
import { createClient } from '@/lib/supabase/server';
import { ApplicationCard } from './ApplicationCard';
import { VehicleCard } from './VehicleCard';

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

  const [
    { data: pending },
    { data: decided },
    { data: profiles },
    { data: pendingVehicles },
    { data: attention },
  ] = await Promise.all([
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
    /*
     * Связь с компанией составная, поэтому имя внешнего ключа указано
     * явно: без подсказки PostgREST выбирает связь сам.
     */
    supabase
      .from('vehicles')
      .select('*, company:companies!vehicles_company_fk(name)')
      .eq('access', 'PENDING')
      .order('submitted_at', { ascending: true }),
    supabase.rpc('documents_needing_attention', { p_within_days: 30 }),
  ]);

  /* Документы компаний, чьи машины сейчас на допуске: решение принимается вместе. */
  const vehicleCompanyIds = [...new Set((pendingVehicles ?? []).map((v) => v.company_id))];
  const { data: vehicleDocs } = vehicleCompanyIds.length
    ? await supabase
        .from('company_documents')
        .select('*')
        .in('company_id', vehicleCompanyIds)
        .eq('is_current', true)
    : { data: [] };

  /* У какой компании уже есть пользователь — значит приглашение дошло. */
  const withUsers = new Set((profiles ?? []).map((p) => p.company_id));

  const queue = pending ?? [];
  const history = decided ?? [];
  const active = history.filter((c) => c.status === 'ACTIVE').length;

  return (
    <main className="mx-auto w-full max-w-6xl px-5 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold tracking-tight">{t.moderation.applications}</h1>

        <div className="flex flex-wrap gap-2">
          {/* Журнал писем рядом с допусками: приглашение уходит отсюда же. */}
          <Link
            href={`/${locale}/admin/outbox`}
            className={buttonClass({ variant: 'default', size: 'md' })}
          >
            {t.outbox.title}
          </Link>

          {/* Счета и выплаты — соседний пульт: там деньги, здесь допуски. */}
          <Link
            href={`/${locale}/admin/billing`}
            className={buttonClass({ variant: 'primary', size: 'md' })}
          >
            {t.done.titleAdmin}
          </Link>
        </div>
      </div>

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

      <section className="mt-10">
        <h2 className="mb-4 border-b border-line pb-2 text-[13px] font-semibold tracking-tight text-ink-faint">
          {m('fleet.pendingCount', { count: (pendingVehicles ?? []).length })}
        </h2>

        {(pendingVehicles ?? []).length === 0 ? (
          <EmptyState title={t.empty.noVehicles} />
        ) : (
          <div className="flex flex-col gap-3">
            {(pendingVehicles ?? []).map((vehicle) => (
              <VehicleCard
                key={vehicle.id}
                vehicle={vehicle}
                companyName={vehicle.company?.name ?? '—'}
                documents={(vehicleDocs ?? [])
                  .filter((d) => d.company_id === vehicle.company_id)
                  .map((document) => ({
                    document,
                    daysLeft: document.valid_until ? daysUntil(document.valid_until) : null,
                  }))}
              />
            ))}
          </div>
        )}
      </section>

      {(attention ?? []).length > 0 && (
        <section className="mt-10">
          <h2 className="mb-2 border-b border-line pb-2 text-[13px] font-semibold tracking-tight text-danger">
            {t.documents.attention}
          </h2>
          <p className="mb-4 text-[13px] text-ink-muted">{t.documents.attentionHint}</p>

          <TableFrame>
            <Table>
              <thead>
                <tr>
                  <Th>{t.role.CARRIER}</Th>
                  <Th>{t.order.documents}</Th>
                  <Th>{t.documents.validUntil}</Th>
                  <Th numeric>{t.moderation.vehicles}</Th>
                </tr>
              </thead>
              <tbody>
                {(attention ?? []).map((row) => (
                  <Tr key={`${row.company_id}-${row.kind}`}>
                    <Td>{row.company_name}</Td>
                    <Td>{t.documents[row.kind]}</Td>
                    <Td>
                      <span className={row.days_left < 0 ? 'text-danger' : 'text-warn'}>
                        {row.days_left < 0
                          ? m('documents.expiredAgo', { count: Math.abs(row.days_left) })
                          : m('documents.expiresIn', { count: row.days_left })}
                      </span>
                    </Td>
                    <Td numeric>{f.number(row.approved_vehicles)}</Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </TableFrame>
        </section>
      )}

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
                  <Th />
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
                    <Td>
                      {/*
                        * Подтверждение нативное: удаление редкое, и ради него
                        * тащить в админку модалку с состоянием незачем. База
                        * всё равно откажет, если у компании есть заказы.
                        */}
                      <form action={deleteCompanyAction}>
                        <input type="hidden" name="locale" value={locale} />
                        <input type="hidden" name="company_id" value={company.id} />
                        <Button
                          type="submit"
                          size="sm"
                          variant="ghost"
                          className="text-danger"
                          formNoValidate
                        >
                          {t.moderation.remove}
                        </Button>
                      </form>
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

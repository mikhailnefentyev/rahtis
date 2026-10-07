import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Badge, Button, Card, CardBody, EmptyState, Mono, Table, TableFrame, Td, Th, Tr } from '@/components/ui';
import type { StatusTone } from '@/components/ui/tone';
import { requireRole } from '@/lib/auth/guard';
import { resendInviteAction } from '@/lib/companies/actions';
import { getI18n, isLocale } from '@/lib/i18n';
import { createClient } from '@/lib/supabase/server';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const { t } = await getI18n(locale);
  return { title: t.onboardingAdmin.title };
}

const stageTone: Record<string, StatusTone> = {
  INVITE: 'danger',
  ACTIVATE: 'warn',
  SETUP: 'warn',
  FIRST_ORDER: 'neutral',
};

/**
 * Кто остановился на пути к первой работе и на каком шаге.
 *
 * Письма-напоминания уходят сами (2, 5, 10 день на шаге), но после
 * третьего — тишина: дальше помогает звонок. Здесь оператор видит, кому
 * звонить первым: давно стоящие наверху, последний вход — чтобы понять,
 * открывал ли человек кабинет вообще.
 */
export default async function OnboardingAdminPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  await requireRole(locale, 'ADMIN');

  const [{ t, f }, supabase] = await Promise.all([getI18n(locale), createClient()]);
  const o = t.onboardingAdmin;
  const { data } = await supabase.rpc('onboarding_status');
  const rows = data ?? [];

  return (
    <main className="cab-page cab-page--wide">
      <h1 className="page-title">{o.title}</h1>
      <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-ink-muted">{o.subtitle}</p>

      {rows.length === 0 ? (
        <Card className="mt-6">
          <CardBody>
            <EmptyState title={o.empty} description={o.emptyHint} />
          </CardBody>
        </Card>
      ) : (
        <TableFrame className="mt-6">
          <Table>
            <thead>
              <Tr>
                <Th>{o.company}</Th>
                <Th>{o.stage}</Th>
                <Th className="text-right">{o.days}</Th>
                <Th>{o.lastLogin}</Th>
                <Th>{o.progress}</Th>
                <Th className="text-right">{o.reminders}</Th>
                <Th />
              </Tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const days = r.days_on_stage;
                return (
                  <Tr key={r.company_id}>
                    <Td>
                      <a href={`/${locale}/admin/company/${r.company_id}`} className="font-semibold text-ink hover:underline">
                        {r.name}
                      </a>
                      <div className="text-[12px] text-ink-muted">
                        {t.role[r.kind as 'CARRIER' | 'SHIPPER']} · <Mono>{r.contact_email}</Mono>
                      </div>
                    </Td>
                    <Td>
                      <Badge tone={stageTone[r.stage] ?? 'neutral'}>{o.stages[r.stage as keyof typeof o.stages] ?? r.stage}</Badge>
                    </Td>
                    <Td className="text-right">
                      <Mono className={days !== null && days >= 5 ? 'font-semibold text-danger' : ''}>{days ?? '—'}</Mono>
                    </Td>
                    <Td>{r.last_sign_in_at ? f.dateTime(r.last_sign_in_at) : <span className="text-danger">{o.never}</span>}</Td>
                    <Td className="text-[12px] text-ink-muted">
                      {r.kind === 'CARRIER'
                        ? o.carrierProgress
                            .replace('{docs}', r.has_documents ? '✓' : '—')
                            .replace('{vehicles}', `${r.approved_vehicles}/${r.vehicles}`)
                            .replace('{drivers}', String(r.drivers))
                        : '—'}
                    </Td>
                    <Td className="text-right">
                      <Mono>{r.reminders_sent}</Mono>
                    </Td>
                    <Td>
                      {r.stage === 'INVITE' && (
                        <form action={resendInviteAction}>
                          <input type="hidden" name="locale" value={locale} />
                          <input type="hidden" name="company_id" value={r.company_id} />
                          <Button type="submit" size="sm">
                            {o.resend}
                          </Button>
                        </form>
                      )}
                    </Td>
                  </Tr>
                );
              })}
            </tbody>
          </Table>
        </TableFrame>
      )}
    </main>
  );
}

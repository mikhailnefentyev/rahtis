import { Button, Card, CardBody, Textarea } from '@/components/ui';
import { VerificationPackageView } from '@/components/domain/VerificationPackageView';
import { VerifiedBadge } from '@/components/domain/VerifiedBadge';
import { getI18n, type Locale } from '@/lib/i18n';
import { createClient } from '@/lib/supabase/server';
import { grantVerificationAction, revokeVerificationAction } from '@/lib/verification/actions';
import { fill } from '@/lib/verification/fill';
import { loadPackage } from '@/lib/verification/package';

/**
 * Значок «Tarkastettu» у оператора.
 *
 * Значок ставит человек: совпадение с открытыми данными PRH не
 * доказывает, что заявитель представляет компанию, а toiminimi в
 * открытых данных нет вовсе. Рядом — весь пакет со сроками и файлами,
 * чтобы решать по нему, а не по памяти. Действует значок, только пока
 * все пункты в сроке; снятие — отдельной кнопкой с причиной.
 */
export async function AdminVerification({ locale, companyId }: { locale: Locale; companyId: string }) {
  const [i18n, supabase] = await Promise.all([getI18n(locale), createClient()]);
  const v = i18n.t.verification;

  const [pkg, { data: grant }] = await Promise.all([
    loadPackage(companyId),
    supabase
      .from('verification_grants')
      .select('granted_at, note, revoked_at, revoke_note')
      .eq('company_id', companyId)
      .maybeSingle(),
  ]);

  const active = Boolean(grant && !grant.revoked_at);

  return (
    <>
      <h2 className="label-micro mb-3">{v.adminTitle}</h2>
      <Card stripe={pkg?.verified ? 'ok' : active ? 'warn' : 'neutral'} className="mb-3">
        <CardBody className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2.5 text-[13px]">
            {pkg?.verified && <VerifiedBadge label={v.badge} />}
            <span>
              {active && grant
                ? fill(v.adminGrantedAt, { date: i18n.f.date(grant.granted_at) })
                : grant?.revoked_at
                  ? fill(v.adminRevokedAt, { date: i18n.f.date(grant.revoked_at) })
                  : v.adminNotGranted}
            </span>
            {active && !pkg?.verified && <span className="text-warn">{v.statusLapsed}</span>}
          </div>
          {grant?.note && active && <p className="text-[13px] text-ink-muted">{grant.note}</p>}
          {grant?.revoke_note && !active && <p className="text-[13px] text-ink-muted">{grant.revoke_note}</p>}
          <p className="max-w-2xl text-xs text-ink-dim">{v.adminHint}</p>

          <div className="grid gap-3 sm:grid-cols-2">
            <form action={grantVerificationAction} className="flex flex-col gap-2">
              <input type="hidden" name="locale" value={locale} />
              <input type="hidden" name="company_id" value={companyId} />
              <label className="label-micro" htmlFor="verification-note">
                {v.adminNote}
              </label>
              <Textarea id="verification-note" name="note" rows={2} maxLength={1000} />
              <Button type="submit" variant="primary" size="sm" className="self-start">
                {active ? v.adminRegrant : v.adminGrant}
              </Button>
            </form>

            {active && (
              <form action={revokeVerificationAction} className="flex flex-col gap-2">
                <input type="hidden" name="locale" value={locale} />
                <input type="hidden" name="company_id" value={companyId} />
                <label className="label-micro" htmlFor="verification-revoke-note">
                  {v.adminNote}
                </label>
                <Textarea id="verification-revoke-note" name="note" rows={2} maxLength={1000} />
                <Button type="submit" variant="danger" size="sm" className="self-start">
                  {v.adminRevoke}
                </Button>
              </form>
            )}
          </div>
        </CardBody>
      </Card>

      {pkg && <VerificationPackageView pkg={pkg} i18n={i18n} showCompany={false} />}
    </>
  );
}

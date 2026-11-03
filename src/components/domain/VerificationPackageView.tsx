import { Badge, Card, CardBody, Mono } from '@/components/ui';
import type { I18n } from '@/lib/i18n';
import { itemStatusTone } from '@/lib/verification/items';
import type { PackageView } from '@/lib/verification/package';
import { VerifiedBadge } from './VerifiedBadge';
import { fill } from '@/lib/verification/fill';

/**
 * Пакет tilaajavastuu на чтение: шапка компании со значком, данные PRH,
 * пункты с состоянием и документы со ссылками.
 *
 * Один и тот же вид у ссылки без входа, заказчика-партнёра и оператора:
 * все они смотрят на одно и то же, и расхождений между «что видит
 * заказчик» и «что видит оператор» быть не должно.
 */
export function VerificationPackageView({
  pkg,
  i18n,
  showCompany = true,
}: {
  pkg: PackageView;
  i18n: Pick<I18n, 't' | 'f'>;
  showCompany?: boolean;
}) {
  const { t, f } = i18n;
  const v = t.verification;
  const date = (iso: string) => f.date(`${iso.slice(0, 10)}T12:00:00Z`);
  const flag = (value: boolean | null | undefined) => (value == null ? v.unknown : value ? v.yes : v.no);

  return (
    <div className="flex flex-col gap-4">
      {showCompany && (
        <Card stripe={pkg.verified ? 'ok' : 'neutral'}>
          <CardBody className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <span className="text-[15px] font-semibold tracking-tight">{pkg.company.name}</span>
            {pkg.verified && <VerifiedBadge label={v.badge} hint={v.badgeHint} />}
            <span className="text-[13px] text-ink-muted">
              {v.businessId} <Mono>{pkg.company.business_id}</Mono>
            </span>
          </CardBody>
        </Card>
      )}

      <Card>
        <CardBody className="flex flex-col gap-2">
          <p className="label-micro">{v.registryTitle}</p>
          {pkg.registry ? (
            <div className="grid gap-x-6 gap-y-1 text-[13px] sm:grid-cols-2">
              {pkg.registry.officialName && (
                <p>
                  <span className="text-ink-faint">{v.company}: </span>
                  {pkg.registry.officialName}
                </p>
              )}
              <p>
                <span className="text-ink-faint">{v.tradeRegister}: </span>
                {flag(pkg.registry.tradeRegister)}
              </p>
              <p>
                <span className="text-ink-faint">{v.prepayment}: </span>
                {flag(pkg.registry.prepayment)}
              </p>
              <p>
                <span className="text-ink-faint">{v.vat}: </span>
                {flag(pkg.registry.vat)}
              </p>
              <p>
                <span className="text-ink-faint">{v.employer}: </span>
                {flag(pkg.registry.employer)}
              </p>
              {pkg.registry.checkedAt && (
                <p className="text-xs text-ink-dim sm:col-span-2">
                  {fill(v.checkedAt, { date: date(pkg.registry.checkedAt) })}
                </p>
              )}
            </div>
          ) : (
            <p className="text-[13px] text-ink-muted">{v.noRegistry}</p>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardBody className="flex flex-col divide-y divide-line">
          {pkg.items.map((i) => (
            <div key={i.item} className="flex flex-wrap items-center justify-between gap-2 py-2 first:pt-0 last:pb-0">
              <span className="text-[13px] font-semibold">{v.items[i.item]}</span>
              <span className="flex flex-wrap items-center gap-2 text-xs text-ink-muted">
                {i.valid_until && <span>{fill(v.validUntilDate, { date: date(i.valid_until) })}</span>}
                {i.source && <span className="text-ink-dim">{i.source === 'PRH' ? v.fromPrh : v.fromDocument}</span>}
                <Badge tone={itemStatusTone[i.status]}>{v.status[i.status]}</Badge>
              </span>
            </div>
          ))}
        </CardBody>
      </Card>

      {pkg.documents.length > 0 && (
        <Card>
          <CardBody className="flex flex-col gap-2">
            <p className="label-micro">{v.documents}</p>
            {pkg.documents.map((d) => (
              <div key={d.id} className="flex flex-wrap items-center justify-between gap-2 text-[13px]">
                <span className="min-w-0">
                  <span className="block font-semibold">
                    {d.source === 'VASTUU' ? v.vastuuTitle : v.items[d.items[0]]}
                  </span>
                  <span className="block text-xs text-ink-muted">
                    {d.source === 'VASTUU' && `${d.items.map((i) => v.items[i]).join(' · ')} · `}
                    {fill(v.issued, { date: date(d.issued_on) })} · {fill(v.validUntilDate, { date: date(d.valid_until) })}
                  </span>
                </span>
                {d.url && (
                  <a href={d.url} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
                    {v.open}
                  </a>
                )}
              </div>
            ))}
          </CardBody>
        </Card>
      )}
    </div>
  );
}

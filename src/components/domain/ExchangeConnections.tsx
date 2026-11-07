'use client';

import { useActionState } from 'react';
import { Badge, Button, Card, CardBody, Mono } from '@/components/ui';
import { exchangeInterestAction, type ExchangeState } from '@/lib/exchanges/actions';
import { EXCHANGE_NAMES, EXCHANGE_PROVIDERS, type ExchangeProvider, type ExchangeRow } from '@/lib/exchanges/model';
import { useI18n } from '@/lib/i18n/provider';

/**
 * «Подключённые биржи» в /account (7.11.2026). Пока договоров с биржами
 * нет — «хочу подключить»: так видно, кому и какая биржа нужна. Когда
 * доступ появится, в той же строке будет вход через страницу биржи.
 */
export function ExchangeConnections({ rows, kind }: { rows: ExchangeRow[]; kind: 'CARRIER' | 'SHIPPER' }) {
  const { t } = useI18n();
  const te = t.exchanges;
  const byProvider = new Map(rows.map((r) => [r.provider, r]));

  return (
    <Card id="exchanges" className="scroll-mt-24">
      <CardBody className="flex flex-col gap-4">
        <div>
          <h2 className="text-[15px] font-semibold tracking-tight">{te.title}</h2>
          <p className="mt-1.5 max-w-xl text-[13px] leading-relaxed text-ink-muted">{te.hint}</p>
        </div>

        <ul className="flex flex-col divide-y divide-line">
          {EXCHANGE_PROVIDERS.map((provider) => (
            <ExchangeRowView key={provider} provider={provider} row={byProvider.get(provider) ?? null} kind={kind} />
          ))}
        </ul>

        <p className="max-w-xl text-xs text-ink-faint">{te.privacy}</p>
      </CardBody>
    </Card>
  );
}

function ExchangeRowView({ provider, row, kind }: { provider: ExchangeProvider; row: ExchangeRow | null; kind: 'CARRIER' | 'SHIPPER' }) {
  const { t, locale } = useI18n();
  const te = t.exchanges;
  const [state, action, pending] = useActionState<ExchangeState, FormData>(exchangeInterestAction, { error: null });
  const name = EXCHANGE_NAMES[provider];
  const status = row?.status === 'REVOKED' ? null : (row?.status ?? null);

  return (
    <li className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0">
      <div className="flex flex-wrap items-center gap-2.5">
        <span className="text-[14px] font-semibold">{name}</span>
        {status === 'CONNECTED' ? (
          <Badge tone="ok">{te.connected}</Badge>
        ) : (
          <Badge tone="neutral">{te.soon}</Badge>
        )}
        {status === 'CONNECTED' && row?.external_account && <Mono className="text-xs text-ink-muted">{row.external_account}</Mono>}
      </div>
      <p className="max-w-xl text-[13px] leading-relaxed text-ink-muted">
        {(kind === 'CARRIER' ? te.carrier : te.shipper).replace('{provider}', name)}
      </p>

      {status !== 'CONNECTED' && (
        <form action={action} className="flex flex-wrap items-center gap-3">
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="provider" value={provider} />
          {status === 'INTERESTED' ? (
            <>
              <span className="text-[13px] text-ink">{te.requested}</span>
              <Button type="submit" name="intent" value="withdraw" size="sm" variant="ghost" disabled={pending}>
                {te.withdraw}
              </Button>
            </>
          ) : (
            <Button type="submit" name="intent" value="request" size="sm" disabled={pending}>
              {te.want}
            </Button>
          )}
          {state.error && (
            <span className="text-[13px] text-danger" role="alert">
              {state.error}
            </span>
          )}
        </form>
      )}
    </li>
  );
}

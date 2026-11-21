'use client';

import { useActionState, useState } from 'react';
import { Button } from '@/components/ui';
import {
  acceptTermsAction,
  proposeTermsAction,
  startDealAction,
  type ActionState,
} from '@/lib/installments/actions';
import type { InstallmentUiCopy } from '@/lib/installments/copy';
import type { InstallmentCopy } from '@/lib/landing/installment';
import { TermsFields, type TermsDefaults } from './TermsFields';

const initial: ActionState = { error: null, saved: false };

/** Предложение покупателя по объявлению: условия продавца как черновик, даты — свои. */
export function OfferForm({
  locale,
  ui,
  calc,
  listingId,
  defaults,
}: {
  locale: string;
  ui: InstallmentUiCopy;
  calc: InstallmentCopy;
  listingId: string;
  defaults: TermsDefaults;
}) {
  const [state, action, pending] = useActionState(startDealAction, initial);
  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="listing_id" value={listingId} />
      <TermsFields ui={ui} calc={calc} defaults={defaults} vatEditable={false} withDates locale={locale} />
      {state.error && <p className="text-[14px] text-danger">{state.error}</p>}
      <div>
        <Button type="submit" variant="primary" disabled={pending}>
          {ui.deal.start}
        </Button>
      </div>
    </form>
  );
}

/** Ответ на условия: принять увиденную версию или предложить свои. */
export function DealResponse({
  locale,
  ui,
  calc,
  dealId,
  version,
  canAccept,
  defaults,
}: {
  locale: string;
  ui: InstallmentUiCopy;
  calc: InstallmentCopy;
  dealId: string;
  version: number;
  canAccept: boolean;
  defaults: TermsDefaults;
}) {
  const [acceptState, accept, accepting] = useActionState(acceptTermsAction, initial);
  const [proposeState, propose, proposing] = useActionState(proposeTermsAction, initial);
  const [counter, setCounter] = useState(false);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        {canAccept && (
          <form action={accept}>
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="deal_id" value={dealId} />
            <input type="hidden" name="version" value={version} />
            <Button type="submit" variant="primary" disabled={accepting}>
              {ui.deal.accept}
            </Button>
          </form>
        )}
        {!counter && (
          <Button type="button" onClick={() => setCounter(true)}>
            {ui.deal.counter}
          </Button>
        )}
      </div>
      {acceptState.error && <p className="text-[14px] text-danger">{acceptState.error}</p>}

      {counter && (
        /* key по версии: новое предложение второй стороны сбрасывает черновик. */
        <form key={version} action={propose} className="flex flex-col gap-4 rounded-card border border-line p-4">
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="deal_id" value={dealId} />
          <TermsFields ui={ui} calc={calc} defaults={defaults} vatEditable={false} withDates locale={locale} />
          {proposeState.error && <p className="text-[14px] text-danger">{proposeState.error}</p>}
          <div className="flex gap-2">
            <Button type="submit" variant="primary" disabled={proposing}>
              {ui.deal.send}
            </Button>
            <Button type="button" onClick={() => setCounter(false)}>
              {ui.deal.cancel}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}

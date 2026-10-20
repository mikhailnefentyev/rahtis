'use client';

import { useActionState, useEffect, useState } from 'react';
import { CountrySelect } from '@/components/CountrySelect';
import { Button, Card, CardBody, Field, Input, InputMono, Mono } from '@/components/ui';
import { countryPack } from '@/lib/country';
import { deleteClientAction, saveClientAction, type ClientState } from '@/lib/orders/ownClients';
import { useI18n } from '@/lib/i18n/provider';
import type { CarrierClient } from '@/types/db';
import { useKeepOnError } from '@/lib/forms/keepOnError';

/**
 * Справочник клиентов перевозчика.
 *
 * Свёрнут: это место для редкой правки — опечатка в названии, новая
 * почта, лишний клиент, заведённый по ошибке. Удалить можно только
 * клиента без рейсов: рейсы остаются в отчётах, и клиент в них должен
 * быть назван.
 */

const initial: ClientState = { error: null, done: false };

export function OwnClients({ clients }: { clients: CarrierClient[] }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);

  if (clients.length === 0) return null;

  return (
    <div className="mt-8">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="label-micro cursor-pointer hover:text-ink"
      >
        {t.own.clients} · {clients.length}
      </button>

      {open && (
        <div className="mt-2 flex flex-col gap-2">
          {clients.map((client) =>
            editing === client.id ? (
              <ClientForm key={client.id} client={client} onClose={() => setEditing(null)} />
            ) : (
              <ClientRow key={client.id} client={client} onEdit={() => setEditing(client.id)} />
            ),
          )}
        </div>
      )}
    </div>
  );
}

function ClientRow({ client, onEdit }: { client: CarrierClient; onEdit: () => void }) {
  const { t, locale } = useI18n();
  const [state, deleteAction, pending] = useActionState(deleteClientAction, initial);
  const keepDeleteAction = useKeepOnError(state);
  const [asking, setAsking] = useState(false);

  return (
    <Card>
      <CardBody className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <span className="text-[13px] font-semibold">{client.name}</span>
        {client.business_id && (
          <Mono className="text-[13px] text-ink-muted">
            {client.country !== 'FI' && `${client.country} `}
            {client.business_id}
          </Mono>
        )}
        {client.contact_email && <span className="text-[13px] text-ink-muted">{client.contact_email}</span>}
        <span className="text-[13px] text-ink-dim">
          {t.own.clientJobs}: {client.orders}
        </span>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          {state.error && (
            <span role="alert" className="text-xs text-danger">
              {state.error}
            </span>
          )}
          <Button size="sm" onClick={onEdit}>
            {t.own.clientEdit}
          </Button>
          {client.orders === 0 &&
            (asking ? (
              <form {...keepDeleteAction} action={deleteAction} className="flex items-center gap-2">
                <input type="hidden" name="locale" value={locale} />
                <input type="hidden" name="client_id" value={client.id} />
                <span className="text-xs text-ink-muted">{t.own.clientDeleteConfirm}</span>
                <Button type="submit" size="sm" variant="danger" disabled={pending}>
                  {t.own.clientDelete}
                </Button>
                <Button type="button" size="sm" onClick={() => setAsking(false)}>
                  {t.action.cancel}
                </Button>
              </form>
            ) : (
              <Button size="sm" variant="danger" onClick={() => setAsking(true)}>
                {t.own.clientDelete}
              </Button>
            ))}
        </div>
      </CardBody>
    </Card>
  );
}

function ClientForm({ client, onClose }: { client: CarrierClient; onClose: () => void }) {
  const { t, locale } = useI18n();
  const [state, saveAction, pending] = useActionState(saveClientAction, initial);
  const keepSaveAction = useKeepOnError(state);
  const optional = ` (${t.own.optional})`;
  const [country, setCountry] = useState(client.country || 'FI');
  const pack = countryPack(country);

  useEffect(() => {
    if (state.done) onClose();
  }, [state.done, onClose]);

  return (
    <Card stripe="info">
      <CardBody>
        <form {...keepSaveAction} action={saveAction} className="grid gap-3 sm:grid-cols-3">
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="client_id" value={client.id} />

          <Field label={t.own.clientName} required>
            {(p) => <Input {...p} name="name" required minLength={2} maxLength={200} defaultValue={client.name} />}
          </Field>
          <Field label={t.company.country}>
            {(p) => <CountrySelect {...p} name="country" value={country} onChange={(e) => setCountry(e.target.value)} />}
          </Field>
          <Field label={`${country === 'FI' ? t.own.clientBusinessId : pack.businessId.label}${optional}`}>
            {(p) => (
              <InputMono
                {...p}
                name="business_id"
                placeholder={pack.businessId.example}
                defaultValue={client.business_id ?? ''}
              />
            )}
          </Field>
          <Field label={`${t.own.clientEmail}${optional}`}>
            {(p) => <Input {...p} name="email" type="email" defaultValue={client.contact_email ?? ''} />}
          </Field>

          {state.error && (
            <p role="alert" className="text-[13px] text-danger sm:col-span-3">
              {state.error}
            </p>
          )}

          <div className="flex gap-2 sm:col-span-3">
            <Button type="button" size="sm" onClick={onClose}>
              {t.action.cancel}
            </Button>
            <Button type="submit" size="sm" variant="primary" disabled={pending}>
              {t.action.save}
            </Button>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}

'use client';

import { useMemo, useState } from 'react';
import { Badge, Button, Card, CardBody, Field, Input, Select, Textarea } from '@/components/ui';
import { useI18n } from '@/lib/i18n/provider';
import { partsSources, quoteRequestText, type PartsSource } from '@/lib/parts/sources';

type Vehicle = { id: string; plate: string; make: string | null };

/**
 * Поиск запчасти: номер или название → поиск открывается сразу у всех
 * источников, плюс готовый текст запроса цены для поставщиков без
 * открытого поиска и для разборок.
 */
export function PartsSearch({ vehicles, company }: { vehicles: Vehicle[]; company: string }) {
  const { t } = useI18n();
  const s = t.parts;
  const [vehicleId, setVehicleId] = useState('');
  const [query, setQuery] = useState('');
  const [note, setNote] = useState('');
  const [submitted, setSubmitted] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const vehicle = vehicles.find((v) => v.id === vehicleId) ?? null;
  const q = { query: submitted ?? '', make: vehicle?.make ?? null, plate: vehicle?.plate ?? null };
  const sources = useMemo(() => (submitted ? partsSources(q) : []), [submitted, vehicle?.make]); // eslint-disable-line react-hooks/exhaustive-deps
  const request = submitted ? quoteRequestText({ ...q, company, note }) : '';

  const kindLabel = (k: PartsSource['kind']) => s.kinds[k];

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(request);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* без буфера — текст виден, его можно выделить */
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardBody>
          <form
            className="grid gap-3 sm:grid-cols-[minmax(0,14rem)_minmax(0,1fr)_auto] sm:items-end"
            onSubmit={(e) => {
              e.preventDefault();
              if (query.trim().length >= 2) setSubmitted(query.trim());
            }}
          >
            <Field label={s.vehicle}>
              {(p) => (
                <Select {...p} value={vehicleId} onChange={(e) => setVehicleId(e.target.value)}>
                  <option value="">{s.anyVehicle}</option>
                  {vehicles.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.plate}
                      {v.make ? ` · ${v.make}` : ''}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label={s.query} hint={s.queryHint}>
              {(p) => <Input {...p} value={query} onChange={(e) => setQuery(e.target.value)} maxLength={120} required />}
            </Field>
            <Button type="submit" variant="primary">
              {s.search}
            </Button>
          </form>
        </CardBody>
      </Card>

      {submitted && (
        <>
          <ul className="grid gap-3 sm:grid-cols-2">
            {sources.map((src) => (
              <li key={src.id}>
                <Card className="h-full">
                  <CardBody>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[13px] font-semibold">{src.name}</span>
                      <Badge tone={src.kind === 'USED' ? 'warn' : src.kind === 'DEALER' ? 'info' : 'neutral'}>{kindLabel(src.kind)}</Badge>
                    </div>
                    <p className="mt-1 text-[12px] text-ink-muted">
                      {src.direct ? s.direct : s.loginOnly}
                      {' · '}
                      {src.pricesPublic ? s.pricesPublic : s.pricesLogin}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <a
                        href={src.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center rounded-control border border-line px-3 py-1.5 text-[13px] font-medium hover:bg-sunken"
                      >
                        {src.direct ? s.openSearch : s.openSite} ↗
                      </a>
                      {src.email && (
                        <a
                          href={`mailto:${src.email}?subject=${encodeURIComponent(`Tarjouspyyntö: ${submitted}`)}&body=${encodeURIComponent(request)}`}
                          className="inline-flex items-center rounded-control border border-line px-3 py-1.5 text-[13px] hover:bg-sunken"
                        >
                          {s.emailQuote}
                        </a>
                      )}
                      {src.phone && (
                        <a href={`tel:${src.phone.replace(/\s/g, '')}`} className="inline-flex items-center px-1 py-1.5 font-mono text-[13px] text-ink-muted">
                          {src.phone}
                        </a>
                      )}
                    </div>
                  </CardBody>
                </Card>
              </li>
            ))}
          </ul>

          <Card>
            <CardBody>
              <h3 className="text-[13px] font-semibold">{s.quoteTitle}</h3>
              <p className="mt-1 text-[12px] leading-relaxed text-ink-muted">{s.quoteHint}</p>
              <Field label={s.note} className="mt-3">
                {(p) => <Textarea {...p} rows={2} value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} />}
              </Field>
              <pre className="mt-3 whitespace-pre-wrap rounded-control border border-line bg-sunken p-3 font-mono text-[12px]">{request}</pre>
              <div className="mt-3">
                <Button type="button" onClick={copy}>
                  {copied ? s.copied : s.copy}
                </Button>
              </div>
            </CardBody>
          </Card>
        </>
      )}
    </div>
  );
}

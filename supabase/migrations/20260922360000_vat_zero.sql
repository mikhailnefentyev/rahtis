-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · ALV пока 0 % для всех
--
-- 22.09.2026 пользователь: «НДС сразу не указывай, все цены НДС 0 %,
-- потом добавляем финнам». Ставка по стране (25,5 % финским компаниям)
-- остаётся готовой, но выключена переключателем: app.vat_charged() здесь
-- и VAT_CHARGED в src/lib/config.ts. Включать — вместе, иначе документы
-- периода (считает приложение) и месячный сбор (считает база) разойдутся.
--
-- Правятся черновики TERMS v10 (8.5) и SHIPPER_AGREEMENT v6 (3.2): вместо
-- «финской компании прибавляется 25,5 %» — «пока 0 %, о введении
-- сообщается заранее». Основание нулевой ставки — налоговый вопрос, он
-- под маркером юриста. Активация — решение пользователя.
-- ═══════════════════════════════════════════════════════════════════

create or replace function app.vat_charged()
returns boolean
language sql
immutable
as $$
  select false;
$$;

comment on function app.vat_charged() is
  'Начисляется ли ALV. Пока false — все цены с ALV 0 %. Включать вместе с VAT_CHARGED в config.ts.';

create or replace function app.vat_bps_for(p_country text)
returns integer
language sql
immutable
as $$
  select case when app.vat_charged() and p_country = 'FI' then 2550 else 0 end;
$$;

comment on function app.vat_bps_for(text) is
  'Ставка ALV контрагента: 25,5 % финской компании, когда ALV включён; иначе 0.';

grant execute on function app.vat_charged(), app.vat_bps_for(text) to authenticated, service_role;

/* Месячный сбор — со ставкой через переключатель, а не зашитыми 25,5 %. */
create or replace function public.issue_monthly_subscriptions(p_month date)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_month date := date_trunc('month', p_month)::date;
  v_end date := (date_trunc('month', p_month) + interval '1 month' - interval '1 day')::date;
  v_count integer;
begin
  insert into public.carrier_subscription_fees (
    carrier_company_id, month, active_vehicles, unit_cents, net_cents, vat_bps, gross_cents
  )
  select
    a.company_id, v_month, a.vehicles, app.subscription_unit_cents(),
    a.vehicles * app.subscription_unit_cents(),
    app.vat_bps_for(c.country::text),
    a.vehicles * app.subscription_unit_cents()
      + round(a.vehicles * app.subscription_unit_cents() * app.vat_bps_for(c.country::text) / 10000.0)::integer
  from (
    select o.assigned_company_id as company_id, count(distinct o.assigned_vehicle_id)::integer as vehicles
    from public.orders o
    where o.status = 'DONE'
      and o.assigned_vehicle_id is not null
      and (app.closed_moment(o) at time zone 'Europe/Helsinki')::date between v_month and v_end
    group by o.assigned_company_id
  ) a
  join public.companies c on c.id = a.company_id
  where not c.is_test
    and (app.free_until(c.id) is null or app.free_until(c.id) < v_end)
  on conflict (carrier_company_id, month) do nothing;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;


-- ── Черновики документов ───────────────────────────────────────────

do $$
declare
  v_terms uuid;
  v_shipper uuid;
begin
  select id into v_terms from public.legal_documents
  where kind = 'TERMS' and status = 'DRAFT' order by version desc limit 1;
  select id into v_shipper from public.legal_documents
  where kind = 'SHIPPER_AGREEMENT' and status = 'DRAFT' order by version desc limit 1;

  update public.legal_clauses set body = case locale
    when 'fi' then regexp_replace(
      replace(body, '29,90 euroa ja arvonlisäveron kalenterikuukaudessa', '29,90 euroa kalenterikuukaudessa'),
      'Arvonlisävero määräytyy sopimuskumppanin maan mukaan:.*$',
      'Hintoihin ei toistaiseksi lisätä arvonlisäveroa (0 %). Jos arvonlisävero otetaan käyttöön, siitä ilmoitetaan etukäteen, ja se koskee vain ilmoituksen jälkeen alkavia tilityskausia. [Kohta täydennetään juristin kanssa: arvonlisäverokäsittelyn peruste.]')
    else regexp_replace(
      replace(body, 'EUR 29.90 plus VAT per calendar month', 'EUR 29.90 per calendar month'),
      'VAT is determined by the country of the contracting party:.*$',
      'For the time being no VAT is added to the prices (0 %). If VAT is introduced, this is announced in advance and applies only to settlement periods beginning after the announcement. [This clause is to be completed with counsel: the basis for the VAT treatment.]')
  end
  where document_id = v_terms and path = array[8, 5];

  update public.legal_clauses set body = case locale
    when 'fi' then regexp_replace(body,
      'Vahvistuksessa ja laskussa kerrotaan sovellettava arvonlisäverokäsittely:.*$',
      'Hintoihin ei toistaiseksi lisätä arvonlisäveroa (0 %). Jos arvonlisävero otetaan käyttöön, siitä ilmoitetaan etukäteen, ja se koskee vain ilmoituksen jälkeen alkavia tilityskausia. [Kohta täydennetään juristin kanssa: arvonlisäverokäsittelyn peruste.]')
    else regexp_replace(body,
      'The confirmation and the invoice state the applicable value added tax treatment:.*$',
      'For the time being no VAT is added to the prices (0 %). If VAT is introduced, this is announced in advance and applies only to settlement periods beginning after the announcement. [This clause is to be completed with counsel: the basis for the VAT treatment.]')
  end
  where document_id = v_shipper and path = array[3, 2];
end;
$$;

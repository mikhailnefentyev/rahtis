-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · eFTI: набор данных о перевозке для властей (19.11.2026)
--
-- Этап А — тестовый шлюз Fintraffic (efti.fintraffic.fi). Регламент
-- (EU) 2020/1056: власти принимают электронные данные о грузе с
-- 9.7.2027; для перевозчика — добровольно, но только через
-- сертифицированную платформу. До сертификации всё это работает только
-- с тестовым шлюзом.
--
--   · efti_datasets — набор данных на заказ: datasetId (UUIDv4, наш), UIL
--     от шлюза (gateId + platformId + datasetId), статус по 2025/2243
--     (ACTIVE → INACTIVE после фактической доставки → READY_TO_ARCHIVE →
--     ARCHIVED), когда загружены идентификаторы;
--   · efti_requests — журнал обращений шлюза (2025/2243 ст. 3: след
--     каждого запроса властей): какие части набора, какая страна, ответ;
--   · efti_follow_ups — сообщения инспектора перевозчику (FTI025).
--
-- Пишет только сервер (служебный ключ). Перевозчик и заказчик заказа
-- видят набор своих заказов; журнал запросов — оператор и перевозчик.
-- ═══════════════════════════════════════════════════════════════════

create table public.efti_datasets (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders (id) on delete cascade,
  status text not null default 'ACTIVE'
    constraint efti_datasets_status check (status in ('ACTIVE', 'INACTIVE', 'READY_TO_ARCHIVE', 'ARCHIVED')),
  gate_id text,
  platform_id text,
  /* Последняя успешная загрузка идентификаторов в шлюз и с доставкой ли она. */
  uploaded_at timestamptz,
  delivery_uploaded_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.efti_datasets is
  'eFTI: набор данных о перевозке (UIL = gate_id + platform_id + id). Тестовый шлюз Fintraffic, 19.11.2026.';

create table public.efti_requests (
  id bigint generated always as identity primary key,
  dataset_id uuid references public.efti_datasets (id) on delete set null,
  kind text not null constraint efti_requests_kind check (kind in ('DATASET', 'FOLLOW_UP', 'PING')),
  request_id text,
  requester_country text,
  subset_ids text[],
  http_status integer not null,
  created_at timestamptz not null default now()
);

create index efti_requests_dataset_idx on public.efti_requests (dataset_id, created_at desc);

create table public.efti_follow_ups (
  id uuid primary key default gen_random_uuid(),
  dataset_id uuid not null references public.efti_datasets (id) on delete cascade,
  query_request_id text,
  requester_country text,
  message text not null,
  received_at timestamptz not null default now(),
  read_at timestamptz
);

create index efti_follow_ups_dataset_idx on public.efti_follow_ups (dataset_id, received_at desc);

alter table public.efti_datasets enable row level security;
alter table public.efti_requests enable row level security;
alter table public.efti_follow_ups enable row level security;

/* Набор видят стороны заказа и оператор. */
create policy efti_datasets_parties
  on public.efti_datasets for select to authenticated
  using (
    (select app.is_admin())
    or exists (
      select 1 from public.orders o
      where o.id = order_id
        and (o.assigned_company_id = (select app.current_company_id())
             or o.shipper_company_id = (select app.current_company_id()))
    )
  );

/* Журнал запросов властей и сообщения инспектора — перевозчику заказа и оператору. */
create policy efti_requests_carrier
  on public.efti_requests for select to authenticated
  using (
    (select app.is_admin())
    or exists (
      select 1 from public.efti_datasets d join public.orders o on o.id = d.order_id
      where d.id = dataset_id and o.assigned_company_id = (select app.current_company_id())
    )
  );

create policy efti_follow_ups_carrier
  on public.efti_follow_ups for select to authenticated
  using (
    (select app.is_admin())
    or exists (
      select 1 from public.efti_datasets d join public.orders o on o.id = d.order_id
      where d.id = dataset_id and o.assigned_company_id = (select app.current_company_id())
    )
  );

grant select on public.efti_datasets, public.efti_requests, public.efti_follow_ups to authenticated;

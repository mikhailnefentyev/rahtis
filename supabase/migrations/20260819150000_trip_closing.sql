-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · Этап 6 · закрытие рейса с документами (ТЗ §9)
--
-- После прохождения всех точек перевозчик закрывает рейс: прикладывает
-- CMR, фото загрузки и выгрузки, фото повреждений. Всё фиксируется с
-- таймстампом и привязкой к рейсу — это доказательная база — и уходит
-- заказчику вместе со статусом «выполнен».
--
-- Две границы, которые здесь устроены иначе, чем у документов компании.
--
-- Первая: владелец папки. У company-docs первый сегмент пути — компания,
-- и политика сравнивает его с компанией вызывающего. Здесь первый сегмент
-- — заказ, а доступ есть у обеих сторон этого заказа: перевозчик грузит,
-- заказчик читает. Значит сравнением с одной компанией не обойтись —
-- нужен предикат «сторона этого заказа».
--
-- Вторая: удаление. У документов компании его нет ни у кого, кроме
-- оператора, потому что они основание выданных допусков. Здесь то же
-- самое и по более острой причине: CMR — основание для выплаты
-- перевозчику и для счёта заказчику. Стереть его после закрытия рейса не
-- может ни одна из сторон.
-- ═══════════════════════════════════════════════════════════════════

create type public.trip_document_kind as enum (
  /* Накладная. Без неё рейс не закрывается — см. close_order. */
  'CMR',
  'LOADING_PHOTO',
  'UNLOADING_PHOTO',
  'DAMAGE_PHOTO'
);

create table public.order_documents (
  id uuid primary key default gen_random_uuid(),

  order_id uuid not null references public.orders (id) on delete cascade,

  /*
   * Точка, к которой относится документ. NULL у того, что описывает рейс
   * целиком, — например у CMR. Фото повреждения без точки бессмысленно:
   * повреждения и записываются на точку.
   */
  stop_id uuid references public.order_stops (id) on delete set null,

  kind public.trip_document_kind not null,

  /* Путь в бакете trip-docs. Первый сегмент — идентификатор заказа. */
  storage_path text not null unique,
  file_name text not null,
  mime_type text not null,
  size_bytes integer not null,

  uploaded_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),

  constraint order_documents_size_positive
    check (size_bytes between 1 and 10485760),

  constraint order_documents_damage_has_stop
    check (kind <> 'DAMAGE_PHOTO' or stop_id is not null)
);

comment on table public.order_documents is
  'Документы рейса: CMR, фото загрузки и выгрузки, фото повреждений (ТЗ §9).';

create index order_documents_order_idx on public.order_documents (order_id, created_at);


-- ── Кто сторона этого заказа ───────────────────────────────────────

/*
 * Заказчик заказа, назначенный перевозчик или оператор.
 *
 * security definer по той же причине, что у app.owns_order: выражение
 * читает assigned_company_id, которого у authenticated нет вовсе, и
 * колоночный грант не должен решать, кто увидит документы.
 */
create or replace function app.party_to_order(p_order_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select app.is_admin() or exists (
    select 1
    from public.orders o
    where o.id = p_order_id
      and (
        o.shipper_company_id = app.current_company_id()
        or o.assigned_company_id = app.current_company_id()
      )
  );
$$;

comment on function app.party_to_order(uuid) is
  'Заказчик заказа, назначенный перевозчик или оператор. Definer: читает колонку исполнителя.';

revoke all on function app.party_to_order(uuid) from public, anon;
grant execute on function app.party_to_order(uuid) to authenticated, service_role;


-- ── Права и RLS ────────────────────────────────────────────────────

alter table public.order_documents enable row level security;
revoke all on public.order_documents from anon, authenticated;
grant select, insert on public.order_documents to authenticated;

create policy order_documents_select_party
  on public.order_documents for select to authenticated
  using ((select app.party_to_order(order_id)));

/*
 * Грузит только назначенный перевозчик: документы рейса составляет тот,
 * кто его выполнял. Заказчику они приходят готовыми — подменить CMR он
 * не должен.
 */
create policy order_documents_insert_carrier
  on public.order_documents for insert to authenticated
  with check ((select app.carries_order(order_id)));


-- ── Бакет ──────────────────────────────────────────────────────────

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'trip-docs',
  'trip-docs',
  false,
  10485760,
  array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

/*
 * Политики сравнивают первый сегмент пути с заказом, то есть проверяют,
 * где объект физически лежит, а не что попросил клиент.
 */
create policy "trip docs: стороны заказа читают"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'trip-docs'
    and (select app.party_to_order(((storage.foldername(name))[1])::uuid))
  );

create policy "trip docs: перевозчик пишет в папку своего рейса"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'trip-docs'
    and (select app.carries_order(((storage.foldername(name))[1])::uuid))
  );

/*
 * Удаляет только оператор, и только для запросов на стирание
 * персональных данных. CMR — основание для выплаты перевозчику и для
 * счёта заказчику; стереть его не может ни одна из сторон.
 */
create policy "trip docs: оператор удаляет"
  on storage.objects for delete to authenticated
  using (bucket_id = 'trip-docs' and (select app.is_admin()));


-- ── Закрытие рейса ─────────────────────────────────────────────────

/*
 * Рейс закрывает перевозчик после прохождения всех точек.
 *
 * CMR обязателен. Это не бюрократия: накладная — основание, по которому
 * оператор платит перевозчику и выставляет счёт заказчику. Закрытый рейс
 * без неё означал бы обязательство заплатить, не подтверждённое ничем.
 *
 * Проверка всех точек здесь тоже не формальность: незакрытая точка — это
 * либо неотмеченная работа, либо работа невыполненная, и различить их
 * задним числом уже нельзя.
 */
create or replace function public.close_order(p_order_id uuid)
returns public.orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
  v_pending integer;
begin
  select * into v_order from public.orders where id = p_order_id;
  if v_order.id is null then
    raise exception 'Заказ не найден.' using errcode = 'P0002';
  end if;

  if not (
    v_order.assigned_company_id = (select app.current_company_id())
    or (select app.is_admin())
  ) then
    raise exception 'Закрыть рейс может только назначенный перевозчик.'
      using errcode = '42501';
  end if;

  if v_order.status <> 'IN_PROGRESS' then
    raise exception 'Закрывать можно только идущий рейс, текущий статус: %.', v_order.status
      using errcode = '55000';
  end if;

  select count(*) into v_pending
  from public.order_stops s
  where s.order_id = p_order_id and s.completed_at is null;

  if v_pending > 0 then
    raise exception 'Сначала отметьте все точки маршрута: осталось %.', v_pending
      using errcode = '55000';
  end if;

  if not exists (
    select 1 from public.order_documents d
    where d.order_id = p_order_id and d.kind = 'CMR'
  ) then
    raise exception 'Приложите CMR — без накладной рейс не закрывается.'
      using errcode = '55000';
  end if;

  update public.orders
  set status = 'DONE'
  where id = p_order_id
  returning * into v_order;

  return v_order;
end;
$$;

comment on function public.close_order(uuid) is
  'Закрывает рейс: все точки пройдены и приложен CMR (ТЗ §9).';

revoke all on function public.close_order(uuid) from public, anon;
grant execute on function public.close_order(uuid) to authenticated, service_role;


-- ── Выполненные рейсы остаются видны обеим сторонам ────────────────

/*
 * my_assignments отдавал только AWAIT_DRIVER и IN_PROGRESS: закрытый рейс
 * исчезал у перевозчика вместе с документами, которые он же и приложил.
 * DONE остаётся в списке — по нему считается выплата, и до неё рейс нужен.
 */
create or replace function public.my_assignments()
returns table (
  id uuid,
  ref text,
  order_type public.order_type,
  status public.order_status,
  deadline_at timestamptz,
  trailer text,
  distance_km integer,
  rate_cents integer,
  comment text,
  shipper_name text,
  vehicle_plate text,
  route_geometry text,
  route_bounds jsonb,
  stops jsonb
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_company_id uuid;
begin
  if (select app.current_party_role()) is distinct from 'CARRIER' then
    raise exception 'Раздел доступен только перевозчику.' using errcode = '42501';
  end if;

  v_company_id := (select app.current_company_id());

  return query
  select
    o.id, o.ref, o.order_type, o.status, o.deadline_at,
    o.trailer, o.distance_km, o.rate_cents, o.comment,
    c.name, v.plate,
    o.route_geometry, o.route_bounds,
    (
      select jsonb_agg(to_jsonb(s) order by s.sequence)
      from public.order_stops s
      where s.order_id = o.id
    )
  from public.orders o
  join public.companies c on c.id = o.shipper_company_id
  left join public.vehicles v on v.id = o.assigned_vehicle_id
  where o.assigned_company_id = v_company_id
    and o.status in ('AWAIT_DRIVER', 'IN_PROGRESS', 'DONE')
  order by o.deadline_at nulls last, o.published_at desc;
end;
$$;

comment on function public.my_assignments() is
  'Рейсы перевозчика: ждущие подтверждения, идущие и выполненные.';

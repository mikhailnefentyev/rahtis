-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · транспорт на карте — по классам машин
--
-- Список присутствия показывал две группы: «vetoa» и «pika». Первое —
-- обрубок слова vetoauto, второе — название ветки экспресса, а не машины,
-- и в нём фургон с грузовиком слиты в одно. Заказчик читает «Tampere
-- 1 pika» и не знает, приедет ли пакетти или кузов на четыре тонны.
--
-- Классы у машин уже есть — TRACTOR, TRUCK, VAN, — и здесь они просто
-- перестают складываться: три счётчика вместо двух, а называть их
-- полными словами будет интерфейс.
--
-- Тип результата меняется, поэтому функция пересоздаётся.
-- ═══════════════════════════════════════════════════════════════════

drop function if exists public.carrier_presence();

create or replace function public.carrier_presence()
returns table (
  city text,
  country text,
  lat double precision,
  lon double precision,
  tractors integer,
  trucks integer,
  vans integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if (select app.current_party_role()) not in ('SHIPPER', 'ADMIN') then
    raise exception 'Карта транспорта доступна заказчику и оператору.' using errcode = '42501';
  end if;

  return query
  select
    min(btrim(v.base_city))::text,
    max(v.base_country)::text,
    avg(v.base_lat)::double precision,
    avg(v.base_lon)::double precision,
    count(*) filter (where v.vehicle_class = 'TRACTOR')::integer,
    count(*) filter (where v.vehicle_class = 'TRUCK')::integer,
    count(*) filter (where v.vehicle_class = 'VAN')::integer
  from public.vehicles v
  join public.companies c on c.id = v.company_id
  where v.access = 'APPROVED'
    and v.base_lat is not null
    and c.kind = 'CARRIER'
    and c.status = 'ACTIVE'
    and c.frozen_at is null
    /* Документы просрочены — машина заказы не берёт, и на карте её нет. */
    and app.company_documents_ok(c.id)
  group by v.base_country, lower(btrim(v.base_city))
  order by 5 desc, 6 desc, 7 desc, 1;
end;
$$;

comment on function public.carrier_presence() is
  'Допущенные машины по городам базирования, по классам: тягачи, грузовики, фургоны.';

revoke all on function public.carrier_presence() from public, anon;
grant execute on function public.carrier_presence() to authenticated, service_role;

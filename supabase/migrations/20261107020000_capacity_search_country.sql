-- Поиск свободного места падал на первом же предложении: страна компании
-- хранится как char(2), а функция отдаёт text (42804). Приводим тип.

create or replace function public.capacity_offers_search(
  p_country text default null,
  p_city text default null,
  p_date_from date default null,
  p_date_to date default null
)
returns table(
  offer_id uuid,
  from_city text,
  from_country text,
  to_city text,
  to_country text,
  available_from date,
  available_to date,
  free_ldm numeric,
  free_kg integer,
  free_pallets smallint,
  body text,
  vehicle_class public.vehicle_class,
  carrier_name text,
  carrier_country text,
  verified boolean,
  cabotage_ops integer,
  my_pending integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_me uuid := app.capacity_viewer();
  v_city text := nullif(btrim(coalesce(p_city, '')), '');
  v_country text := nullif(upper(btrim(coalesce(p_country, ''))), '');
begin
  return query
  select
    p.id,
    p.from_city,
    p.from_country,
    p.to_city,
    p.to_country,
    p.available_from,
    p.available_to,
    p.free_ldm,
    p.free_kg,
    p.free_pallets,
    p.body,
    p.vehicle_class,
    c.name,
    c.country::text,
    app.company_verified(c.id),
    app.capacity_cabotage_ops(c.id, p.from_country, p.to_country),
    (select count(*)::integer from public.capacity_requests r
      where r.offer_id = p.id and r.shipper_company_id = v_me and r.status = 'PENDING')
  from public.capacity_offers p
  join public.companies c on c.id = p.company_id
  where p.status = 'PUBLISHED'
    and c.id <> v_me
    and c.client_of is null
    and app.same_world(v_me, c.id)
    and app.capacity_offer_live(p.id)
    and (v_country is null or p.from_country = v_country or p.to_country = v_country)
    and (v_city is null
      or position(lower(v_city) in lower(p.from_city)) > 0
      or position(lower(v_city) in lower(p.to_city)) > 0)
    and (p_date_from is null or p.available_to >= p_date_from)
    and (p_date_to is null or p.available_from <= p_date_to)
  order by p.available_from, p.from_city, p.id
  limit 200;
end;
$$;

comment on function public.capacity_offers_search(text, text, date, date) is
  'Догрузы для заказчика: опубликованное свободное место — городами, без машины и координат.';

revoke all on function public.capacity_offers_search(text, text, date, date) from public, anon;
grant execute on function public.capacity_offers_search(text, text, date, date) to authenticated;


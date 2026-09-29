-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · API заказчиков, полный цикл — этап 2: действия
--
-- Всё, что заказчик делает с заказом в кабинете, — через одну обёртку:
-- api_order_action(ключ, действие, аргументы) выполняет от имени
-- выпустившего ключ ту же функцию, что вызывает кабинет. Права, статусы
-- и все правила остаются там, где они уже есть, — в этих функциях.
-- Список действий закрыт: неизвестное имя — отказ, а не динамический
-- вызов чего угодно.
--
-- Знакомые машины для прямого назначения — отдельной функцией на чтение:
-- ключу без права записи список тоже нужен, чтобы выбрать машину.
-- ═══════════════════════════════════════════════════════════════════

create or replace function public.api_order_action(p_key_id uuid, p_action text, p_args jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
  a jsonb := coalesce(p_args, '{}'::jsonb);
begin
  perform app.api_act_as(p_key_id);

  case p_action
    when 'choose_offer' then
      v_result := to_jsonb(public.choose_offer((a->>'offer_id')::uuid));
    when 'cancel_order' then
      v_result := to_jsonb(public.cancel_order((a->>'order_id')::uuid));
    when 'direct_assign_order' then
      v_result := to_jsonb(public.direct_assign_order((a->>'order_id')::uuid, (a->>'vehicle_id')::uuid));
    when 'amend_stop' then
      v_result := to_jsonb(public.amend_stop((a->>'stop_id')::uuid, a->'patch'));
    when 'add_stop' then
      v_result := to_jsonb(public.add_stop((a->>'before_stop_id')::uuid, a->'stop'));
    when 'remove_stop' then
      v_result := to_jsonb(public.remove_stop((a->>'stop_id')::uuid));
    when 'store_route' then
      v_result := to_jsonb(public.store_route((a->>'order_id')::uuid, a->'route'));
    when 'reprice_order' then
      v_result := to_jsonb(public.reprice_order((a->>'order_id')::uuid, (a->>'distance_km')::integer, (a->>'rate_cents')::integer));
    when 'rate_order' then
      v_result := to_jsonb(public.rate_order((a->>'order_id')::uuid, (a->>'score')::smallint, nullif(a->>'comment', '')));
    when 'file_claim' then
      v_result := to_jsonb(public.file_claim(
        (a->>'order_id')::uuid,
        (a->>'kind')::public.claim_kind,
        a->>'description',
        nullif(a->>'stop_id', '')::uuid,
        nullif(a->>'amount_cents', '')::integer
      ));
    when 'comment_claim' then
      v_result := to_jsonb(public.comment_claim((a->>'claim_id')::uuid, a->>'body'));
    when 'attach_to_claim' then
      v_result := to_jsonb(public.attach_to_claim(
        (a->>'claim_id')::uuid,
        a->>'storage_path',
        a->>'file_name',
        a->>'mime_type',
        (a->>'size_bytes')::integer,
        nullif(a->>'note', '')
      ));
    else
      raise exception 'Неизвестное действие %.', p_action using errcode = '22023';
  end case;

  return v_result;
end;
$$;

revoke all on function public.api_order_action(uuid, text, jsonb) from public, anon, authenticated;
grant execute on function public.api_order_action(uuid, text, jsonb) to service_role;


/*
 * Знакомые машины заказчика — без банковских реквизитов перевозчика и
 * контактов водителя: для назначения они не нужны, а API — чужая
 * система, куда лишнего не выносим.
 */
create or replace function public.api_known_vehicles(p_key_id uuid)
returns table (
  vehicle_id uuid,
  plate text,
  make text,
  vehicle_class text,
  euro_class text,
  axles integer,
  payload_kg integer,
  ldm numeric,
  container_feet integer[],
  driver_name text,
  carrier_name text,
  direct_billing boolean,
  rating numeric,
  trips integer,
  last_trip_at timestamptz,
  available boolean,
  busy boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid;
begin
  select k.created_by into v_user from public.api_keys k where k.id = p_key_id and k.revoked_at is null;
  if v_user is null then
    return;
  end if;

  perform set_config('request.jwt.claims', json_build_object('sub', v_user, 'role', 'authenticated')::text, true);

  return query
  select v.vehicle_id, v.plate::text, v.make::text, v.vehicle_class::text, v.euro_class::text, v.axles::integer,
         v.payload_kg::integer, v.ldm::numeric, v.container_feet::integer[], v.driver_name::text, v.carrier_name::text,
         v.direct_billing, v.rating::numeric, v.trips::integer, v.last_trip_at, v.available, v.busy
  from public.known_vehicles_for_shipper() v;
end;
$$;

revoke all on function public.api_known_vehicles(uuid) from public, anon, authenticated;
grant execute on function public.api_known_vehicles(uuid) to service_role;

-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · агенты узнают, что везут
--
-- Третий раз тот же класс дефекта, и на этот раз он пойман до
-- подключения, а не после. Колонки haul_kind и container_feet заведены,
-- права выданы, интерфейсы показывают — а функции, которыми пользуются
-- воркфлоу n8n, отдают прежний набор полей. Поля, которого нет в ответе
-- функции, для агента не существует.
--
-- Цена ошибки здесь выше, чем на экране. Проверка на боевой базе: у рейса
-- RS-2026-0043 haul_kind = CONTAINER, container_feet = 20, trailer_plate =
-- MSCU1234561. Агент водителя получил бы номер и отправил человека в
-- Вуосаари искать «прицеп MSCU1234561» — прицепа с таким номером не
-- существует, а двадцатифутовый контейнер стоит рядом, и водитель об этом
-- не знает.
--
-- Исправляются оба канала: агент водителя в WhatsApp и инструменты агента
-- кабинетов. У agent_order_by_ref меняется набор выходных колонок, поэтому
-- она пересоздаётся через drop; driver_active_trips собирает jsonb и
-- обходится create or replace.
-- ═══════════════════════════════════════════════════════════════════


-- ── Что у водителя в работе ────────────────────────────────────────

create or replace function public.driver_active_trips(p_phone text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(trip order by trip->>'ref'), '[]'::jsonb)
  from (
    select jsonb_build_object(
      'ref', o.ref,
      'status', o.status,
      'order_type', o.order_type,
      'trailer', o.trailer,
      'trailer_plate', o.trailer_plate,
      'haul_kind', o.haul_kind,
      'container_feet', o.container_feet,
      'distance_km', o.distance_km,
      'comment', o.comment,

      'vehicle', jsonb_build_object(
        'plate', v.plate,
        'driver_name', v.driver_name,
        'languages', v.languages
      ),

      /* Этап выводится из точек, как и везде в продукте (ТЗ §7). */
      'progress', jsonb_build_object(
        'done', (select count(*) from public.order_stops s
                 where s.order_id = o.id and s.completed_at is not null),
        'total', (select count(*) from public.order_stops s where s.order_id = o.id),
        'next', (select jsonb_build_object('sequence', s.sequence, 'role', s.role,
                                           'place', coalesce(s.place_name, s.company_name, s.city))
                 from public.order_stops s
                 where s.order_id = o.id and s.completed_at is null
                 order by s.sequence limit 1)
      ),

      'stops', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'sequence', s.sequence,
          'role', s.role,
          'place_name', s.place_name,
          'place_kind', s.place_kind,
          'company_name', s.company_name,
          'address', s.address,
          'city', s.city,
          'scheduled_date', s.scheduled_date,
          'scheduled_time', s.scheduled_time,
          'consignee', s.consignee,
          'contact_name', s.contact_name,
          'contact_phone', s.contact_phone,
          'cargo_weight_kg', s.cargo_weight_kg,
          'seal_required', s.seal_required,
          'trailer_loaded', s.trailer_loaded,
          /* Инструкции к точке. Здесь же живёт номер брони или пропуска. */
          'note', s.note,
          'completed_at', s.completed_at
        ) order by s.sequence), '[]'::jsonb)
        from public.order_stops s where s.order_id = o.id
      ),

      /*
       * Инструкции площадок: общие платформенные плюс написанные
       * заказчиком этого рейса. Чужих заказчиков здесь быть не может —
       * компания берётся из самого заказа, а не из запроса.
       */
      'guides', (
        select coalesce(jsonb_agg(distinct jsonb_build_object(
          'place_key', g.place_key,
          'locale', g.locale,
          'title', g.title,
          'body', g.body,
          'from_shipper', g.company_id is not null
        )), '[]'::jsonb)
        from public.place_guides g
        where (g.company_id is null or g.company_id = o.shipper_company_id)
          and exists (
            select 1 from public.order_stops s
            where s.order_id = o.id
              and (lower(g.place_key) = lower(coalesce(s.place_name, ''))
                or lower(g.place_key) = lower(s.city))
          )
      )
    ) as trip
    from public.orders o
    join public.vehicles v on v.id = o.assigned_vehicle_id
    where o.status = 'IN_PROGRESS'
      and v.id in (select id from app.driver_vehicles(p_phone))
  ) trips;
$$;

comment on function public.driver_active_trips(text) is
  'Рейсы водителя по номеру телефона: точки, этап, единица и её размер. Для агента в WhatsApp.';


-- ── Заказ по номеру, для агента кабинетов ──────────────────────────

drop function if exists public.agent_order_by_ref(uuid, uuid, text);

create or replace function public.agent_order_by_ref(
  p_conversation_id uuid,
  p_token uuid,
  p_ref text
)
returns table (
  ref text,
  status public.order_status,
  order_type public.order_type,
  haul_kind public.haul_kind,
  container_feet smallint,
  distance_km integer,
  rate_cents integer,
  trailer text,
  trailer_plate text,
  published_at timestamptz,
  closed_at timestamptz,
  counterparty text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_ctx public.conversations;
begin
  v_ctx := app.agent_context(p_conversation_id, p_token);

  return query
  select
    o.ref, o.status, o.order_type, o.haul_kind, o.container_feet, o.distance_km, o.rate_cents,
    o.trailer, o.trailer_plate, o.published_at, o.closed_at,
    /*
     * Контрагент показывается только оператору. Заказчик и перевозчик
     * работают с Aivomaa, а не друг с другом (ТЗ §1), и агент не должен
     * знать больше, чем знает тот, кто его спрашивает.
     */
    case when v_ctx.audience = 'ADMIN'
      then coalesce(sh.name, '') || ' → ' || coalesce(ca.name, '')
    end
  from public.orders o
  left join public.companies sh on sh.id = o.shipper_company_id
  left join public.companies ca on ca.id = o.assigned_company_id
  where upper(o.ref) = upper(btrim(p_ref))
    and (
      v_ctx.audience = 'ADMIN'
      or o.shipper_company_id = v_ctx.company_id
      or o.assigned_company_id = v_ctx.company_id
    );
end;
$$;

comment on function public.agent_order_by_ref(uuid, uuid, text) is
  'Карточка заказа для агента: единица и её размер входят в ответ, контрагент — только оператору.';

revoke all on function public.agent_order_by_ref(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.agent_order_by_ref(uuid, uuid, text) to agent, service_role;

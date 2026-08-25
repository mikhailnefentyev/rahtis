-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · инструменты агента и роль, которая не умеет писать
--
-- Все функции здесь принимают тред и пропуск, но НЕ принимают компанию.
-- Компанию каждая выводит сама через app.agent_context. Это не проверка,
-- которую можно забыть, а отсутствие поля: агенту некуда вписать чужую
-- компанию.
--
-- Внутри — только select. Роль agent при этом лишена привилегий записи
-- на все таблицы, поэтому даже ошибка в теле функции не сможет ничего
-- изменить: definer исполняется от владельца, но саму функцию агент
-- зовёт как agent, а список исполняемых функций закрыт.
-- ═══════════════════════════════════════════════════════════════════

-- ── Заказ по номеру ────────────────────────────────────────────────

create or replace function public.agent_order_by_ref(
  p_conversation_id uuid,
  p_token uuid,
  p_ref text
)
returns table (
  ref text,
  status public.order_status,
  order_type public.order_type,
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
    o.ref, o.status, o.order_type, o.distance_km, o.rate_cents,
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


-- ── Где рейс сейчас ────────────────────────────────────────────────

create or replace function public.agent_trip_status(
  p_conversation_id uuid,
  p_token uuid,
  p_ref text
)
returns table (
  ref text,
  status public.order_status,
  sequence smallint,
  stop_role public.stop_role,
  place_name text,
  city text,
  /* Дата и время лежат раздельно: у точки бывает день без часа. */
  scheduled_date date,
  scheduled_time time,
  completed_at timestamptz,
  damage text
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
    o.ref, o.status, s.sequence, s.role, s.place_name, s.city,
    s.scheduled_date, s.scheduled_time, s.completed_at, s.damage_note
  from public.orders o
  join public.order_stops s on s.order_id = o.id
  where upper(o.ref) = upper(btrim(p_ref))
    and (
      v_ctx.audience = 'ADMIN'
      or o.shipper_company_id = v_ctx.company_id
      or o.assigned_company_id = v_ctx.company_id
    )
  order by s.sequence;
end;
$$;


-- ── Документы рейса ────────────────────────────────────────────────

create or replace function public.agent_trip_documents(
  p_conversation_id uuid,
  p_token uuid,
  p_ref text
)
returns table (ref text, kind public.trip_document_kind, uploaded_at timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_ctx public.conversations;
begin
  v_ctx := app.agent_context(p_conversation_id, p_token);

  /*
   * Отдаётся факт наличия и время, но не путь к файлу. Ссылку на
   * документ выдаёт сайт по подписи и на час — агент не должен уметь
   * раздавать вечные адреса к накладным.
   */
  return query
  select o.ref, d.kind, d.created_at
  from public.orders o
  join public.order_documents d on d.order_id = o.id
  where upper(o.ref) = upper(btrim(p_ref))
    and (
      v_ctx.audience = 'ADMIN'
      or o.shipper_company_id = v_ctx.company_id
      or o.assigned_company_id = v_ctx.company_id
    )
  order by d.created_at;
end;
$$;


-- ── Деньги компании по неделям ─────────────────────────────────────

create or replace function public.agent_company_money(
  p_conversation_id uuid,
  p_token uuid,
  p_weeks integer default 8
)
returns table (
  week date,
  orders_count integer,
  gross_cents bigint,
  commission_cents bigint,
  payout_cents bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_ctx public.conversations;
  v_carrier boolean;
begin
  v_ctx := app.agent_context(p_conversation_id, p_token);
  v_carrier := v_ctx.audience in ('CARRIER', 'DRIVER');

  return query
  select
    app.report_week(app.closed_moment(o)) as w,
    count(*)::integer,
    sum(coalesce(o.rate_cents, 0))::bigint,
    /* Комиссия и выплата — дело перевозчика. Заказчику их не показываем. */
    case when v_carrier
      then sum(app.commission_cents(o.rate_cents, app.order_bps(o)))::bigint end,
    case when v_carrier
      then sum(app.payout_cents(o.rate_cents, app.order_bps(o)))::bigint end
  from public.orders o
  where o.status = 'DONE'
    and (
      (v_carrier and o.assigned_company_id = v_ctx.company_id)
      or (not v_carrier and o.shipper_company_id = v_ctx.company_id)
    )
  group by w
  order by w desc
  limit greatest(1, least(coalesce(p_weeks, 8), 52));
end;
$$;


-- ── Пункт договора ─────────────────────────────────────────────────

create or replace function public.agent_legal_clause(
  p_conversation_id uuid,
  p_token uuid,
  p_number text,
  p_kind public.legal_kind default 'TERMS',
  p_locale text default 'fi'
)
returns table (number text, title text, body text, section_title text, version integer)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform app.agent_context(p_conversation_id, p_token);

  /*
   * Действующая редакция, а не любая: агент цитирует то, что человек
   * прочитает на сайте сегодня. Ссылаться на архивную редакцию можно
   * только зная её номер, и это отдельный разговор.
   */
  return query select * from public.legal_clause(p_kind, p_locale, p_number);
end;
$$;


-- ── Инструкции по площадке ─────────────────────────────────────────

create or replace function public.agent_place_guide(
  p_conversation_id uuid,
  p_token uuid,
  p_query text
)
returns table (place_key text, title text, body text)
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
  select g.place_key, g.title, g.body
  from public.place_guides g
  where (g.company_id is null or g.company_id = v_ctx.company_id)
    and (
      g.place_key ilike '%' || btrim(p_query) || '%'
      or g.title ilike '%' || btrim(p_query) || '%'
    )
  order by (g.company_id is not null) desc, g.place_key
  limit 10;
end;
$$;


-- ── Роль агента: только чтение и только эти функции ────────────────

/*
 * Роль без входа. Она существует не для того, чтобы под ней
 * подключались, а чтобы у привилегий было имя: список того, что агенту
 * можно, проверяется одним запросом к information_schema, а не чтением
 * кода.
 */
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'agent') then
    create role agent nologin;
  end if;
end;
$$;

/* Ни одной таблицы. Ни одной последовательности. Ничего на запись. */
revoke all on all tables in schema public from agent;
revoke all on all sequences in schema public from agent;
revoke all on all functions in schema public from agent;
revoke all on schema app from agent;

grant usage on schema public to agent;

grant execute on function public.agent_order_by_ref(uuid, uuid, text) to agent;
grant execute on function public.agent_trip_status(uuid, uuid, text) to agent;
grant execute on function public.agent_trip_documents(uuid, uuid, text) to agent;
grant execute on function public.agent_company_money(uuid, uuid, integer) to agent;
grant execute on function
  public.agent_legal_clause(uuid, uuid, text, public.legal_kind, text) to agent;
grant execute on function public.agent_place_guide(uuid, uuid, text) to agent;

/*
 * Сайт зовёт те же функции служебным ключом: путь один и тот же, чтобы
 * проверенное на нём поведение совпадало с боевым.
 */
grant execute on function public.agent_order_by_ref(uuid, uuid, text) to service_role;
grant execute on function public.agent_trip_status(uuid, uuid, text) to service_role;
grant execute on function public.agent_trip_documents(uuid, uuid, text) to service_role;
grant execute on function public.agent_company_money(uuid, uuid, integer) to service_role;
grant execute on function
  public.agent_legal_clause(uuid, uuid, text, public.legal_kind, text) to service_role;
grant execute on function public.agent_place_guide(uuid, uuid, text) to service_role;

/* Наружу через PostgREST инструменты не публикуются: их зовёт только сайт. */
revoke all on function public.agent_order_by_ref(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.agent_trip_status(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.agent_trip_documents(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.agent_company_money(uuid, uuid, integer) from public, anon, authenticated;
revoke all on function
  public.agent_legal_clause(uuid, uuid, text, public.legal_kind, text)
  from public, anon, authenticated;
revoke all on function public.agent_place_guide(uuid, uuid, text) from public, anon, authenticated;

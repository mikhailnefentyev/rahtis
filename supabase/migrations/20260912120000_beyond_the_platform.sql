-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · вопросы, ответ на которые лежит за пределами платформы
--
-- Две функции, и обе про одно: помощник перестаёт быть тупиком.
--
-- Первая даёт следующую точку с координатами, чтобы на вопрос «когда
-- буду на месте» отвечала та же машина маршрутов, что считала заказ, а
-- не догадка модели.
--
-- Вторая — вопрос оператору из кабинета. У водителя такая возможность
-- есть с самого начала (driver_escalate), а у заказчика и перевозчика её
-- не было: помощник говорил «напишите оператору» и на этом кончался.
-- Совет обратиться к человеку, не сопровождённый способом это сделать,
-- ничем не лучше молчания — а помощник для того и заведён, чтобы
-- спрашивать было куда.
-- ═══════════════════════════════════════════════════════════════════


-- ── Следующая точка с координатами ─────────────────────────────────

/*
 * Куда водитель едет прямо сейчас — со всем, что нужно для расчёта.
 *
 * Идентификатора рейса не принимает, как и остальные функции водителя:
 * рейс выводится из телефона, и вписать чужой номер сюда некуда.
 *
 * Несколько идущих рейсов — отказ, а не выбор наугад. Посчитать время до
 * точки не того рейса хуже, чем не посчитать никакого: водитель поверит
 * числу и поедет не туда.
 *
 * Страна нужна для профиля грузовика: финская сцепка и европейская едут
 * по разным дорогам (см. routing/profiles.ts). Берётся у точки забора,
 * а не у точки назначения, — тем же правилом, что и при расчёте заказа.
 */
create or replace function public.driver_next_stop(p_phone text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
  v_stop public.order_stops;
  v_country text;
  v_count integer;
begin
  select count(*) into v_count
  from public.orders o
  where o.status = 'IN_PROGRESS'
    and o.assigned_vehicle_id in (select id from app.driver_vehicles(p_phone));

  if v_count = 0 then
    raise exception 'Идущего рейса у этого номера нет.' using errcode = 'P0002';
  end if;

  if v_count > 1 then
    raise exception 'У номера несколько идущих рейсов, расчёт невозможен.'
      using errcode = '55000';
  end if;

  select o.* into v_order
  from public.orders o
  where o.status = 'IN_PROGRESS'
    and o.assigned_vehicle_id in (select id from app.driver_vehicles(p_phone));

  select s.* into v_stop
  from public.order_stops s
  where s.order_id = v_order.id and s.completed_at is null
  order by s.sequence
  limit 1;

  if v_stop.id is null then
    raise exception 'Все точки рейса % уже пройдены.', v_order.ref using errcode = '55000';
  end if;

  /*
   * Точка без координат — обычное дело: адрес, набранный руками, их не
   * имеет вовсе. Это отказ с отдельным кодом, а не пустой ответ: агент
   * должен сказать «адреса на карте нет», а не промолчать.
   */
  if v_stop.lat is null or v_stop.lon is null then
    raise exception 'У точки % нет координат.', v_stop.sequence using errcode = '55002';
  end if;

  select s.country into v_country
  from public.order_stops s
  where s.order_id = v_order.id and s.role = 'PICKUP'
  order by s.sequence
  limit 1;

  return jsonb_build_object(
    'ref', v_order.ref,
    'sequence', v_stop.sequence,
    'role', v_stop.role,
    'place', coalesce(v_stop.place_name, v_stop.company_name, v_stop.city),
    'address', v_stop.address,
    'city', v_stop.city,
    'lat', v_stop.lat,
    'lon', v_stop.lon,
    /* Страна забора — для профиля грузовика, а не адреса этой точки. */
    'profile_country', coalesce(v_country, v_stop.country),
    'scheduled_date', v_stop.scheduled_date,
    'scheduled_time', v_stop.scheduled_time,
    'note', v_stop.note
  );
end;
$$;

comment on function public.driver_next_stop(text) is
  'Следующая непройденная точка рейса этого телефона, с координатами. Рейс выводится из номера.';

revoke all on function public.driver_next_stop(text) from public, anon, authenticated;
grant execute on function public.driver_next_stop(text) to driver_agent, service_role;


-- ── Вопрос оператору из кабинета ───────────────────────────────────

/*
 * Единственная запись во всём наборе инструментов кабинетного агента.
 *
 * Остальные функции agent_* только читают, и роль agent лишена прав
 * записи на все таблицы. Здесь исключение сделано осознанно и стоит
 * ровно столько, сколько стоит: одна таблица, одна строка, компания —
 * из треда, а не из запроса. Поля, в которое агент вписал бы чужую
 * компанию, не существует, как и во всех соседних функциях.
 *
 * Оператору при этом писать некуда и незачем: он и есть тот, кому
 * пишут. Отказ здесь не ограничение прав, а защита от бессмыслицы —
 * письмо самому себе в очередь, которую сам же и читаешь.
 */
create or replace function public.agent_ask_operator(
  p_conversation_id uuid,
  p_token uuid,
  p_question text,
  p_subject text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ctx public.conversations;
  v_company public.companies;
  v_email text;
  v_role public.party_role;
  v_id bigint;
begin
  v_ctx := app.agent_context(p_conversation_id, p_token);

  if v_ctx.audience = 'ADMIN' then
    raise exception 'Оператор и есть адресат этой очереди.' using errcode = '55000';
  end if;

  if v_ctx.company_id is null then
    raise exception 'У треда нет компании.' using errcode = '55000';
  end if;

  if length(btrim(coalesce(p_question, ''))) < 3 then
    raise exception 'Вопрос пуст.' using errcode = '22023';
  end if;

  select * into v_company from public.companies where id = v_ctx.company_id;

  /*
   * Адрес автора, а не компании, если он известен: отвечать оператор
   * будет тому, кто спросил. Тред заведён из кабинета, значит автор
   * есть; у треда из WhatsApp его может не быть.
   */
  select u.email into v_email from auth.users u where u.id = v_ctx.created_by;

  v_role := case when v_ctx.audience = 'CARRIER' then 'CARRIER'::public.party_role
                 else 'SHIPPER'::public.party_role end;

  insert into public.support_messages (company_id, user_id, role, from_email, subject, body)
  values (
    v_ctx.company_id,
    v_ctx.created_by,
    v_role,
    coalesce(v_email, v_company.contact_email, 'tuntematon'),
    left(coalesce(nullif(btrim(coalesce(p_subject, '')), ''), 'Kysymys avustajalta'), 200),
    left(
      btrim(p_question)
        /*
         * Ссылка на тред в теле, а не отдельной графой: оператор читает
         * очередь глазами, и ему нужно знать, где лежит разговор
         * целиком. Заводить под это столбец значит менять таблицу ради
         * строки, которую всё равно читает человек.
         */
        || E'\n\n— ' || coalesce(v_company.name, 'tuntematon yritys')
        || ' · ' || v_ctx.audience::text
        || E'\n' || 'Keskustelu: ' || v_ctx.id::text,
      4000
    )
  )
  returning id into v_id;

  return jsonb_build_object('id', v_id, 'company', v_company.name);
end;
$$;

comment on function public.agent_ask_operator(uuid, uuid, text, text) is
  'Вопрос оператору в очередь поддержки из кабинетного треда. Компания берётся из треда.';

revoke all on function public.agent_ask_operator(uuid, uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.agent_ask_operator(uuid, uuid, text, text) to agent, service_role;

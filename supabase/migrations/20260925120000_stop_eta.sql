-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · примерное время прибытия на следующую точку
--
-- Заказчик видел, что точка пройдена, но не видел, когда машина будет
-- дальше: у клиента на выгрузке или в порту на отцепке. Вопрос «когда
-- приедут» решался звонком оператору, а тот звонил перевозчику.
--
-- Теперь у каждой отметки прохождения есть продолжение: следующая точка
-- получает оценку прибытия. Главные случаи — прицеп зацеплен (едем к
-- клиенту) и закончена последняя загрузка или выгрузка (едем в порт),
-- но правило одно на все точки: пройдена точка — у следующей появляется
-- оценка. Отдельное правило для середины рейса оставило бы заказчика
-- без ответа ровно там, где точек больше двух.
--
-- Оценка складывается в три слоя, и каждый следующий сильнее:
--
--   ROUTE    момент отметки + время плеча из расчёта маршрута при
--            публикации. Без пробок, зато есть всегда и ставится здесь
--            же, в базе, — не важно, отметил кабинет или телефон.
--   TRAFFIC  сервер сразу после отметки пересчитывает плечо от места
--            отметки с пробками. Может не случиться: нет ключа, нет
--            координат, телефон отдал отметку из очереди через час.
--   CARRIER  перевозчик поправил руками. Его слово последнее: пробки
--            не знают, что водитель встал на обед.
-- ═══════════════════════════════════════════════════════════════════

create type public.eta_source as enum ('ROUTE', 'TRAFFIC', 'CARRIER');

alter table public.order_stops
  /*
   * Момент, а не настенное время: оценку сравнивают с фактом прибытия
   * (arrived_at, completed_at), и оба должны быть одной природы.
   */
  add column eta_at timestamptz,
  add column eta_source public.eta_source,
  add column eta_updated_at timestamptz,

  add constraint order_stops_eta_together
    check ((eta_at is null) = (eta_source is null) and (eta_at is null) = (eta_updated_at is null));

comment on column public.order_stops.eta_at is
  'Примерное время прибытия. Ставится, когда пройдена предыдущая точка; остаётся после прибытия для сравнения с фактом.';
comment on column public.order_stops.eta_source is
  'Откуда оценка: ROUTE — плечо без пробок, TRAFFIC — пересчёт с пробками от места отметки, CARRIER — перевозчик.';


-- ── Оценка по маршруту в момент отметки ────────────────────────────

/*
 * Триггер, а не строка в complete_stop_at: отметку ставят и кабинет, и
 * приложение, и оператор, а снимают отдельной функцией. В триггере
 * правило одно на все пути.
 *
 * Снятие отметки убирает оценку у следующей точки: она была посчитана
 * от события, которого больше нет.
 */
create or replace function app.on_stop_completed_eta()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_next public.order_stops;
begin
  select * into v_next
  from public.order_stops s
  where s.order_id = new.order_id and s.sequence > new.sequence
  order by s.sequence
  limit 1;

  if v_next.id is null then
    return new;
  end if;

  if new.completed_at is not null and old.completed_at is null then
    if v_next.completed_at is null and v_next.leg_duration_s is not null then
      update public.order_stops
      set eta_at = new.completed_at + make_interval(secs => v_next.leg_duration_s),
          eta_source = 'ROUTE',
          eta_updated_at = now()
      where id = v_next.id;
    end if;
  elsif new.completed_at is null and old.completed_at is not null then
    update public.order_stops
    set eta_at = null, eta_source = null, eta_updated_at = null
    where id = v_next.id and completed_at is null;
  end if;

  return new;
end;
$$;

revoke all on function app.on_stop_completed_eta() from public, anon, authenticated;

create trigger order_stops_eta_on_complete
  after update of completed_at on public.order_stops
  for each row execute function app.on_stop_completed_eta();


-- ── Уточнение: пробки и перевозчик ─────────────────────────────────

/*
 * Оценка ставится только следующей непройденной точке и только пока на
 * неё не приехали. Дальние точки не оцениваются: между ними погрузка,
 * время которой не знает никто, и цифра там была бы уверенной выдумкой.
 *
 * Пересчёт с пробками не перетирает оценку перевозчика — он знает то,
 * чего не знает карта.
 *
 * Окно — от получаса назад до недели вперёд. Раньше «сейчас» оценка
 * бывает законно: машина задержалась на въезде и отмечает с опозданием.
 * Дальше недели — опечатка в годе или месяце.
 */
create or replace function public.set_stop_eta(
  p_stop_id uuid,
  p_eta timestamptz,
  p_source public.eta_source default 'CARRIER'
)
returns public.order_stops
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_stop public.order_stops;
  v_order public.orders;
  v_pending_seq smallint;
begin
  if p_source not in ('TRAFFIC', 'CARRIER') then
    raise exception 'Оценку по маршруту ставит только отметка точки.' using errcode = '22023';
  end if;

  select * into v_stop from public.order_stops where id = p_stop_id;
  if v_stop.id is null then
    raise exception 'Точка не найдена.' using errcode = 'P0002';
  end if;

  select * into v_order from public.orders where id = v_stop.order_id;

  if not (
    v_order.assigned_company_id = (select app.current_company_id())
    or (select app.is_admin())
    or v_order.assigned_driver_id = (select app.current_driver_id())
  ) then
    raise exception 'Время прибытия указывает назначенный перевозчик.' using errcode = '42501';
  end if;

  if v_order.status <> 'IN_PROGRESS' then
    raise exception 'Рейс не идёт, время прибытия не меняется.' using errcode = '55000';
  end if;

  select min(s.sequence) into v_pending_seq
  from public.order_stops s
  where s.order_id = v_stop.order_id and s.completed_at is null;

  if v_stop.sequence is distinct from v_pending_seq or v_stop.arrived_at is not null then
    raise exception 'Время прибытия указывается только для следующей точки до прибытия на неё.'
      using errcode = '55000';
  end if;

  if p_eta is null or p_eta < now() - interval '30 minutes' or p_eta > now() + interval '7 days' then
    raise exception 'Время прибытия вне допустимого окна.' using errcode = '22023';
  end if;

  if p_source = 'TRAFFIC' and v_stop.eta_source = 'CARRIER' then
    return v_stop;
  end if;

  update public.order_stops
  set eta_at = p_eta, eta_source = p_source, eta_updated_at = now()
  where id = p_stop_id
  returning * into v_stop;

  return v_stop;
end;
$$;

comment on function public.set_stop_eta(uuid, timestamptz, public.eta_source) is
  'Уточняет оценку прибытия на следующую точку: пересчёт с пробками или слово перевозчика.';

revoke all on function public.set_stop_eta(uuid, timestamptz, public.eta_source) from public, anon;
grant execute on function public.set_stop_eta(uuid, timestamptz, public.eta_source)
  to authenticated, service_role;


-- ── Документы ──────────────────────────────────────────────────────

/*
 * PRIVACY 2.4: точка отметки теперь не только хранится, но и уходит в
 * TomTom для пересчёта времени до следующей точки. Поставщик уже назван
 * в 5.2 (маршруты), новая здесь цель.
 *
 * TERMS 8.3: оценка прибытия — ориентир, а не обещанное время. Без этой
 * фразы опоздание против показанной цифры выглядело бы нарушением.
 *
 * Черновики. Активация — решение пользователя.
 */
create or replace function pg_temp.draft_of(p_kind public.legal_kind)
returns uuid
language plpgsql
as $$
declare
  v_active uuid := public.active_legal_document(p_kind);
  v_draft uuid;
begin
  if v_active is null then
    raise exception 'Нет действующей редакции %.', p_kind using errcode = '55007';
  end if;

  select d.id into v_draft
  from public.legal_documents d
  where d.kind = p_kind and d.status = 'DRAFT'
    and d.version > (select version from public.legal_documents where id = v_active)
  order by d.version desc
  limit 1;

  if v_draft is null then
    insert into public.legal_documents (kind, version, status, effective_from)
    values (p_kind, (select max(version) + 1 from public.legal_documents where kind = p_kind),
            'DRAFT', current_date)
    returning id into v_draft;

    insert into public.legal_clauses (document_id, locale, path, title, body)
    select v_draft, c.locale, c.path, c.title, c.body
    from public.legal_clauses c where c.document_id = v_active;
  end if;

  return v_draft;
end;
$$;

do $$
declare
  v_privacy uuid := pg_temp.draft_of('PRIVACY');
  v_terms uuid := pg_temp.draft_of('TERMS');
  v_hit integer;
begin
  update public.legal_clauses
  set body = replace(
    body,
    'Sijainti näkyy kyseisen tilauksen tilaajalle ja ylläpitäjälle.',
    'Sijainti näkyy kyseisen tilauksen tilaajalle ja ylläpitäjälle. Kuittauksen sijainnista ja seuraavan pisteen osoitteesta lasketaan reititystoimittajan (kohta 5.2) avulla arvioitu saapumisaika seuraavalle pisteelle liikennetilanne huomioiden; arvio näkyy tilaajalle, kuljetusliikkeelle ja ylläpitäjälle.')
  where document_id = v_privacy and path = array[2, 4] and locale = 'fi';

  update public.legal_clauses
  set body = replace(
    body,
    'The position is visible to the shipper of that order and to the operator.',
    'The position is visible to the shipper of that order and to the operator. From the confirmation position and the address of the next stop, an estimated time of arrival at the next stop is calculated with the routing supplier (section 5.2), taking traffic into account; the estimate is visible to the shipper, the carrier and the operator.')
  where document_id = v_privacy and path = array[2, 4] and locale = 'en';

  update public.legal_clauses
  set body = body || ' Palvelun näyttämä arvioitu saapumisaika on suuntaa antava arvio reitistä ja liikenteestä tai kuljetusliikkeen ilmoitus, eikä se ole sovittu toimitusaika.'
  where document_id = v_terms and path = array[8, 3] and locale = 'fi'
    and body not like '%arvioitu saapumisaika%';

  update public.legal_clauses
  set body = body || ' The estimated time of arrival shown by the service is an indicative estimate based on the route and traffic or on the carrier''s notice, and is not an agreed delivery time.'
  where document_id = v_terms and path = array[8, 3] and locale = 'en'
    and body not like '%estimated time of arrival%';

  select count(*) into v_hit
  from public.legal_clauses c
  where (c.document_id = v_privacy and c.path = array[2, 4]
         and (c.body like '%arvioitu saapumisaika%' or c.body like '%estimated time of arrival%'))
     or (c.document_id = v_terms and c.path = array[8, 3]
         and (c.body like '%arvioitu saapumisaika%' or c.body like '%estimated time of arrival%'));

  if v_hit <> 4 then
    raise exception 'Заменены не все четыре текста (получилось %).', v_hit using errcode = '55000';
  end if;
end;
$$;

-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · сроки хранения данных рейсов и пункты 4.6, 6.4, 8.4 политики
--
-- Решения пользователя 28.09.2026:
--
--   • заказы, счета, расчёты и CMR — 6 лет после конца календарного года
--     окончания рейса (бухучёт). Первые такие данные истекают в 2033 году;
--     удаление для них добавляется отдельной миграцией до того срока;
--   • смены, перерывы и расчёты зарплаты водителей — 6 лет, тот же принцип;
--   • точка местоположения при отметке остановки и фото рейса (погрузка,
--     выгрузка, повреждения) — 24 месяца после окончания рейса;
--   • события приложения водителя, переписка с ассистентом и обращения
--     в поддержку — 24 месяца;
--   • уведомления в сервисе и журнал отправленных писем — 12 месяцев.
--
-- Рейс с открытой претензией (OPEN, IN_REVIEW) не трогается: его данные
-- — доказательство (пункт 8.5 политики).
--
-- Фото лежат в хранилище trip-docs. Удалять объекты хранилища из SQL
-- Supabase не даёт — только через Storage API, поэтому фото удаляет
-- маршрут /api/retention/photos, который будит эта же база (как
-- напоминания о сертификатах). SQL-функция лишь выдаёт кандидатов.
-- ═══════════════════════════════════════════════════════════════════

/* Рейс закончен давно и спора по нему нет. */
create or replace function app.order_expired(p_order_id uuid, p_age interval)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.orders o
    where o.id = p_order_id
      and o.status in ('DONE', 'CANCELLED')
      and coalesce(o.closed_at, o.updated_at) < now() - p_age
      and not exists (
        select 1 from public.claims c
        where c.order_id = o.id and c.status in ('OPEN', 'IN_REVIEW')
      )
  );
$$;

revoke all on function app.order_expired(uuid, interval) from public, anon, authenticated;


create or replace function app.purge_operational_data()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_positions integer;
  v_app_events integer;
  v_messages integer;
  v_support integer;
  v_notifications integer;
  v_driver_notifications integer;
  v_outbox integer;
begin
  update public.order_stops s
  set completed_lat = null, completed_lon = null, completed_accuracy_m = null
  where s.completed_lat is not null
    and app.order_expired(s.order_id, interval '24 months');
  get diagnostics v_positions = row_count;

  delete from public.driver_app_events where received_at < now() - interval '24 months';
  get diagnostics v_app_events = row_count;

  delete from public.messages where created_at < now() - interval '24 months';
  get diagnostics v_messages = row_count;

  delete from public.support_messages where created_at < now() - interval '24 months';
  get diagnostics v_support = row_count;

  delete from public.notifications where created_at < now() - interval '12 months';
  get diagnostics v_notifications = row_count;

  delete from public.driver_notifications where created_at < now() - interval '12 months';
  get diagnostics v_driver_notifications = row_count;

  delete from public.email_outbox where created_at < now() - interval '12 months';
  get diagnostics v_outbox = row_count;

  return jsonb_build_object(
    'stop_positions', v_positions,
    'driver_app_events', v_app_events,
    'messages', v_messages,
    'support_messages', v_support,
    'notifications', v_notifications,
    'driver_notifications', v_driver_notifications,
    'email_outbox', v_outbox
  );
end;
$$;

revoke all on function app.purge_operational_data() from public, anon, authenticated;

/* 03:30 UTC — после очистки тренажёра (03:20). */
select cron.schedule(
  'rahtis-operational-retention',
  '30 3 * * *',
  $$ select app.purge_operational_data(); $$
);


-- ── Фото рейсов: кандидаты для маршрута ─────────────────────────────

create or replace function public.retention_photo_candidates(p_limit integer default 500)
returns table (id uuid, storage_path text)
language sql
stable
security definer
set search_path = ''
as $$
  select d.id, d.storage_path
  from public.order_documents d
  where d.kind in ('LOADING_PHOTO', 'UNLOADING_PHOTO', 'DAMAGE_PHOTO')
    and app.order_expired(d.order_id, interval '24 months')
  order by d.created_at
  limit greatest(1, least(p_limit, 1000));
$$;

revoke all on function public.retention_photo_candidates(integer) from public, anon, authenticated;
grant execute on function public.retention_photo_candidates(integer) to service_role;

/* Адрес маршрута — от адреса отчётов, как у напоминаний о сертификатах. */
insert into app.runtime_config (key, value, note)
select 'retention_photos_url',
       regexp_replace(value, '/api/reports/weekly$', '/api/retention/photos'),
       'Маршрут удаления фото рейсов старше срока хранения. Будит app.run_photo_retention.'
from app.runtime_config
where key = 'reports_url' and value ~ '/api/reports/weekly$'
on conflict (key) do nothing;

create or replace function app.run_photo_retention()
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_url text;
  v_secret text;
  v_request bigint;
begin
  select value into v_url from app.runtime_config where key = 'retention_photos_url';
  select value into v_secret from app.runtime_config where key = 'reports_secret';

  if v_url is null or v_secret is null then
    raise notice 'Фото рейсов не очищены: в app.runtime_config нет retention_photos_url или reports_secret.';
    return null;
  end if;

  select net.http_post(
    url := v_url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_secret),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  ) into v_request;

  insert into app.scheduler_calls (request_id, job)
  values (v_request, 'photo-retention')
  on conflict (request_id) do nothing;

  return v_request;
end;
$$;

revoke all on function app.run_photo_retention() from public, anon, authenticated;

select cron.schedule(
  'rahtis-photo-retention',
  '40 3 * * *',
  $$ select app.run_photo_retention(); $$
);


-- ── Политика: 4.6, 6.4, 8.4 в черновике ─────────────────────────────
-- Меняется только черновик. Активация — решение пользователя.

do $$
declare
  v_draft uuid;
  v_n integer;
begin
  select d.id into v_draft
  from public.legal_documents d
  where d.kind = 'PRIVACY' and d.status = 'DRAFT'
  order by d.version desc
  limit 1;

  if v_draft is null then
    raise exception 'Нет черновика PRIVACY.' using errcode = '55007';
  end if;

  update public.legal_clauses set body = case locale
    when 'fi' then 'Työaikatietoja ja palkkamalleja käsitellään, jotta kuljetusliike saa kuljettajiensa työaikakirjanpidon ja suuntaa-antavan palkkalaskelman palvelusta ja kuljettaja näkee omat tuntinsa ja ansionsa. '
      || 'Aivomaa Oy käsittelee näitä tietoja kuljetusliikkeen lukuun henkilötietojen käsittelijänä; rekisterinpitäjä on kuljetusliike työnantajana. Käsittelyn peruste on kuljetusliikkeen lakisääteinen velvollisuus pitää työaikakirjanpitoa sekä työsuhteen hoitaminen. '
      || 'Työaika- ja palkkalaskelmatiedot säilytetään kuusi vuotta sen kalenterivuoden päättymisestä, jota tiedot koskevat. Jos kuljetusliike tarvitsee tietoja pidempään, se vastaa niiden säilyttämisestä omassa kirjanpidossaan. Aivomaa Oy avustaa kuljetusliikettä kuljettajien näitä tietoja koskevien pyyntöjen käsittelyssä.'
    else 'Working-time data and pay models are processed so that the carrier obtains its drivers'' working-time records and an indicative pay calculation from the service, and the driver can see their own hours and earnings. '
      || 'Aivomaa Oy processes this data on behalf of the carrier as a processor; the controller is the carrier as the employer. The legal basis is the carrier''s statutory obligation to keep working-time records and the management of the employment relationship. '
      || 'Working-time and pay calculation data is retained for six years from the end of the calendar year to which the data relates. If the carrier needs the data for longer, it is responsible for retaining it in its own records. Aivomaa Oy assists the carrier in handling drivers'' requests concerning this data.'
    end
  where document_id = v_draft and path = array[4, 6];
  get diagnostics v_n = row_count;
  if v_n <> 2 then raise exception 'Пункт 4.6: ожидалось 2 строки, найдено %.', v_n; end if;

  update public.legal_clauses set body = case locale
    when 'fi' then 'Kun henkilötietoja siirretään ETA-alueen ulkopuolelle, siirto perustuu Euroopan komission tietosuojan riittävyyttä koskevaan päätökseen, kuten EU:n ja Yhdysvaltojen väliseen tietosuojakehykseen (Data Privacy Framework) niiden toimittajien osalta, jotka ovat sertifioituneet siihen, tai Euroopan komission hyväksymiin vakiosopimuslausekkeisiin, jotka sisältyvät toimittajan kanssa tehtyyn tietojenkäsittelysopimukseen. Tiedonsiirto on salattu. Tiedon kulloinkin käytettävästä siirtoperusteesta saa osoitteesta admin@rahtis.eu.'
    else 'Where personal data is transferred outside the EEA, the transfer is based on an adequacy decision of the European Commission, such as the EU–US Data Privacy Framework for suppliers certified under it, or on the standard contractual clauses approved by the European Commission and included in the data processing agreement with the supplier. Data in transit is encrypted. Information on the transfer mechanism used in each case is available from admin@rahtis.eu.'
    end
  where document_id = v_draft and path = array[6, 4];
  get diagnostics v_n = row_count;
  if v_n <> 2 then raise exception 'Пункт 6.4: ожидалось 2 строки, найдено %.', v_n; end if;

  update public.legal_clauses set body = case locale
    when 'fi' then 'Säilytysajat tietoryhmittäin: tilaukset, laskut, tilitykset ja rahtikirjat (CMR) säilytetään kuusi vuotta sen kalenterivuoden päättymisestä, jona keikka päättyi. Kuljettajan pisteen ohittaessa tallentama sijaintitieto sekä kuormaus-, purku- ja vauriokuvat säilytetään 24 kuukautta keikan päättymisestä. Kuljettajasovelluksen tapahtumat, avustajan keskustelut ja tukipyynnöt säilytetään 24 kuukautta. Palvelun ilmoitukset ja lähetettyjen sähköpostien loki säilytetään 12 kuukautta. '
      || 'Määräajan umpeuduttua tiedot poistetaan automaattisesti; kirjanpidon edellyttämät tilaus- ja laskutiedot poistetaan tai anonymisoidaan säilytysajan päätyttyä. Jos keikasta on vireillä reklamaatio tai muu vaatimus, sen tietoja säilytetään kohdan 8.5 mukaisesti.'
    else 'Retention periods by category: orders, invoices, settlements and consignment notes (CMR) are retained for six years from the end of the calendar year in which the job ended. The location recorded when the driver marks a stop as passed, and loading, unloading and damage photos, are retained for 24 months from the end of the job. Driver app events, assistant conversations and support requests are retained for 24 months. Service notifications and the log of sent emails are retained for 12 months. '
      || 'When the period ends, the data is deleted automatically; order and invoice data required for bookkeeping is deleted or anonymised at the end of its retention period. If a claim or other demand concerning a job is pending, its data is retained as set out in section 8.5.'
    end
  where document_id = v_draft and path = array[8, 4];
  get diagnostics v_n = row_count;
  if v_n <> 2 then raise exception 'Пункт 8.4: ожидалось 2 строки, найдено %.', v_n; end if;
end;
$$;

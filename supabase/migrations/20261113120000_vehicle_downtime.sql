-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · обслуживание, этап 2: машина вне работы (13.11.2026)
--
-- Решение пользователя: «машина в сервисе, но перевозчик может снять
-- это ограничение».
--
-- Машина вне работы не выходит на рейсы: стол заказов, прямые заказы,
-- свои рейсы, сцепки и «знакомые машины» заказчика её не предлагают.
-- Всё это уже идёт через одну проверку — app.vehicle_is_dispatchable,
-- поэтому ограничение встроено туда, а не в каждое место отдельно.
--
-- Откуда берётся:
--   SERVICE    — перевозчик сам ставит машину в сервис на даты
--                (запись в мастерскую); действует с первого дня;
--   DEFECT     — дефект «ехать нельзя» (водитель или кабинет) ставит
--                машину вне работы сразу; дефект закрыт — ограничение
--                снимается само;
--   INSPECTION — katsastus просрочен (в Финляндии такая машина в
--                ajokielto); ставит ежедневный маршрут; отметили
--                katsastus сделанным — снимается само.
--
-- Снять ограничение перевозчик может всегда (кнопка «Palauta ajoon»):
-- дефект остаётся открытым, просрочка — в плане, но машина снова
-- выходит на рейсы. Тот же срок katsastus второй раз машину не
-- блокирует: строка привязана к пункту и дате срока.
--
-- Прицепы не блокируются: в проверке рейса участвует машина.
-- ═══════════════════════════════════════════════════════════════════

create table public.vehicle_downtime (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  vehicle_id uuid not null references public.vehicles (id) on delete cascade,
  reason text not null constraint vehicle_downtime_reason check (reason in ('SERVICE', 'DEFECT', 'INSPECTION')),
  starts_on date not null default ((now() at time zone 'Europe/Helsinki')::date),
  /* Последний день вне работы включительно; пусто — пока не закроют. */
  ends_on date,
  defect_id uuid references public.vehicle_defects (id) on delete set null,
  item_id uuid references public.maintenance_items (id) on delete set null,
  /* Срок katsastus, из-за которого машина вне работы: тот же срок второй раз не блокирует. */
  due_on date,
  note text constraint vehicle_downtime_note check (char_length(note) <= 300),
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  /* Закрыто: RESOLVED — само (дефект закрыт, katsastus сделан), LIFTED — перевозчик снял. */
  ended_at timestamptz,
  end_kind text constraint vehicle_downtime_end_kind check (end_kind in ('RESOLVED', 'LIFTED')),
  ended_by uuid references auth.users (id) on delete set null,
  end_note text constraint vehicle_downtime_end_note check (char_length(end_note) <= 300),
  constraint vehicle_downtime_dates check (ends_on is null or ends_on >= starts_on),
  constraint vehicle_downtime_ended check ((ended_at is null) = (end_kind is null))
);

comment on table public.vehicle_downtime is
  'Машина вне работы: сервис по датам, дефект «ехать нельзя», просроченный katsastus. Открытая строка на сегодня закрывает app.vehicle_is_dispatchable.';

create index vehicle_downtime_vehicle_idx on public.vehicle_downtime (vehicle_id) where ended_at is null;
create index vehicle_downtime_company_idx on public.vehicle_downtime (company_id, created_at desc);
create unique index vehicle_downtime_item_due_key on public.vehicle_downtime (item_id, due_on) where item_id is not null;
create unique index vehicle_downtime_defect_open_key on public.vehicle_downtime (defect_id) where defect_id is not null and ended_at is null;

create trigger vehicle_downtime_check
  before insert or update of vehicle_id, company_id on public.vehicle_downtime
  for each row execute function app.fleet_asset_check();

alter table public.vehicle_downtime enable row level security;

create policy vehicle_downtime_own
  on public.vehicle_downtime for select to authenticated
  using (company_id = (select app.current_company_id()));

/* Из кабинета — только сервис по датам; дефект и katsastus ставит база. */
create policy vehicle_downtime_insert_own
  on public.vehicle_downtime for insert to authenticated
  with check (
    company_id = (select app.current_company_id())
    and reason = 'SERVICE'
    and ended_at is null
    and defect_id is null
    and item_id is null
  );

create policy vehicle_downtime_admin
  on public.vehicle_downtime for select to authenticated using ((select app.is_admin()));

grant select on public.vehicle_downtime to authenticated;
grant insert (company_id, vehicle_id, reason, starts_on, ends_on, note) on public.vehicle_downtime to authenticated;

-- ── Проверка: вне работы сегодня ──────────────────────────────────

create or replace function app.vehicle_in_service(p_vehicle_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.vehicle_downtime d
    where d.vehicle_id = p_vehicle_id
      and d.ended_at is null
      and d.starts_on <= (now() at time zone 'Europe/Helsinki')::date
      and (d.ends_on is null or d.ends_on >= (now() at time zone 'Europe/Helsinki')::date)
  );
$$;

revoke all on function app.vehicle_in_service(uuid) from public, anon;
grant execute on function app.vehicle_in_service(uuid) to authenticated;

/*
 * Прежнее правило (допуск, документы, компания открыта, есть водитель)
 * плюс «не вне работы». Все пути назначения уже зовут эту функцию.
 */
create or replace function app.vehicle_is_dispatchable(p_vehicle_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select v.access = 'APPROVED'
     and app.company_documents_ok(v.company_id)
     and app.company_is_open(v.company_id)
     and app.vehicle_driver_at(v.id) is not null
     and not app.vehicle_in_service(v.id)
  from public.vehicles v
  where v.id = p_vehicle_id;
$$;

-- ── Дефект «ехать нельзя» ─────────────────────────────────────────

create or replace function app.defect_downtime_sync()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.vehicle_id is null then
    return new;
  end if;

  /* Дефект закрыт — снимается и ограничение (если его не сняли раньше). */
  if tg_op = 'UPDATE' and old.status = 'OPEN' and new.status <> 'OPEN' then
    update public.vehicle_downtime
    set ended_at = now(), end_kind = 'RESOLVED', ended_by = new.resolved_by
    where defect_id = new.id and ended_at is null;
    return new;
  end if;

  /* Новый или снова открытый дефект «ехать нельзя» — машина вне работы сразу. */
  if new.status = 'OPEN' and new.severity = 'UNSAFE'
     and (tg_op = 'INSERT' or old.status <> 'OPEN' or old.severity <> 'UNSAFE') then
    insert into public.vehicle_downtime (company_id, vehicle_id, reason, defect_id, created_by)
    values (new.company_id, new.vehicle_id, 'DEFECT', new.id, new.reported_by)
    on conflict do nothing;
  end if;

  return new;
end;
$$;

revoke all on function app.defect_downtime_sync() from public, anon, authenticated;

create trigger vehicle_defects_downtime
  after insert or update of status, severity on public.vehicle_defects
  for each row execute function app.defect_downtime_sync();

-- ── Katsastus: сделан или пункт удалён ────────────────────────────

create or replace function app.inspection_downtime_sync()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    update public.vehicle_downtime
    set ended_at = now(), end_kind = 'RESOLVED', ended_by = auth.uid()
    where item_id = old.id and ended_at is null;
    return old;
  end if;

  /* Срок сдвинули (отметили сделанным или поправили дату) — блок по старому сроку снимается. */
  if new.next_due_on is distinct from old.next_due_on then
    update public.vehicle_downtime
    set ended_at = now(), end_kind = 'RESOLVED', ended_by = auth.uid()
    where item_id = new.id and ended_at is null and due_on is distinct from new.next_due_on;
  end if;
  return new;
end;
$$;

revoke all on function app.inspection_downtime_sync() from public, anon, authenticated;

create trigger maintenance_items_downtime_update
  after update of next_due_on on public.maintenance_items
  for each row execute function app.inspection_downtime_sync();

create trigger maintenance_items_downtime_delete
  before delete on public.maintenance_items
  for each row execute function app.inspection_downtime_sync();

/*
 * Ежедневно: машины с просроченным katsastus — вне работы. Возвращает
 * только новые строки, чтобы маршрут сообщил о них перевозчику. Тот же
 * срок второй раз не блокирует (уникальный ключ пункт + срок), даже если
 * перевозчик снял ограничение.
 */
create or replace function public.maintenance_sync_downtime()
returns table (downtime_id uuid, company_id uuid, vehicle_id uuid, plate text, due_on date)
language sql
security definer
set search_path = ''
as $$
  with added as (
    insert into public.vehicle_downtime (company_id, vehicle_id, reason, item_id, due_on, created_by)
    select i.company_id, i.vehicle_id, 'INSPECTION', i.id, i.next_due_on, null
    from public.maintenance_items i
    join public.vehicles v on v.id = i.vehicle_id
    join public.companies c on c.id = i.company_id
    where i.kind = 'INSPECTION'
      and i.vehicle_id is not null
      and i.next_due_on < (now() at time zone 'Europe/Helsinki')::date
      and c.status = 'ACTIVE'
    on conflict do nothing
    returning id, company_id, vehicle_id, due_on
  )
  select a.id, a.company_id, a.vehicle_id, v.plate, a.due_on
  from added a join public.vehicles v on v.id = a.vehicle_id;
$$;

revoke all on function public.maintenance_sync_downtime() from public, anon, authenticated;
grant execute on function public.maintenance_sync_downtime() to service_role;

-- ── Снять ограничение ─────────────────────────────────────────────

/*
 * «Palauta ajoon»: машина снова выходит на рейсы. Дефект остаётся
 * открытым, katsastus — просроченным в плане; снимается только запрет.
 * Будущий сервис по датам этой же кнопкой отменяется.
 */
create or replace function public.carrier_downtime_end(p_id uuid, p_note text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.vehicle_downtime
  set ended_at = now(),
      end_kind = 'LIFTED',
      ended_by = auth.uid(),
      end_note = nullif(left(btrim(coalesce(p_note, '')), 300), '')
  where id = p_id
    and company_id = (select app.current_company_id())
    and ended_at is null;

  if not found then
    raise exception 'Ограничение не найдено или уже снято.' using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function public.carrier_downtime_end(uuid, text) from public, anon;
grant execute on function public.carrier_downtime_end(uuid, text) to authenticated;

-- ── Приложение водителя: машина вне работы ─────────────────────────

/* Тот же экран «Vika / huolto» плюс причина, если машина сейчас вне работы. */
create or replace function public.driver_vehicle_downtime()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select (
    select jsonb_build_object('reason', d.reason, 'starts_on', d.starts_on, 'ends_on', d.ends_on)
    from public.vehicle_downtime d
    where d.vehicle_id = (
        select vd.vehicle_id from public.vehicle_drivers vd
        where vd.driver_id = (select app.current_driver_id()) and upper_inf(vd.during)
        limit 1)
      and d.ended_at is null
      and d.starts_on <= (now() at time zone 'Europe/Helsinki')::date
      and (d.ends_on is null or d.ends_on >= (now() at time zone 'Europe/Helsinki')::date)
    order by d.created_at
    limit 1
  );
$$;

revoke all on function public.driver_vehicle_downtime() from public, anon;
grant execute on function public.driver_vehicle_downtime() to authenticated;

-- ── Уже открытые дефекты «ехать нельзя» ───────────────────────────

/* Дефекты до этой миграции — тоже ставят машину вне работы. */
insert into public.vehicle_downtime (company_id, vehicle_id, reason, defect_id, created_by, starts_on)
select d.company_id, d.vehicle_id, 'DEFECT', d.id, d.reported_by, (d.reported_at at time zone 'Europe/Helsinki')::date
from public.vehicle_defects d
where d.status = 'OPEN' and d.severity = 'UNSAFE' and d.vehicle_id is not null
on conflict do nothing;

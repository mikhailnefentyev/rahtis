-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · весовой талон по фото (3.11.2026)
--
-- Водитель на экране «Объект» или диспетчер на странице объекта снимает
-- весовой талон (punnituskuitti, vågsedel). Сервер кладёт фото в
-- приватный бакет weigh-tickets, отдаёт его n8n → OpenAI на чтение и
-- возвращает поля в форму рейса. Человек проверяет и сохраняет сам —
-- молча ничего не пишется.
--
--   weigh_tickets — фото талона: где лежит, хэш файла, что прочитано,
--                   к какому рейсу (site_loads) прикреплено;
--   weigh_ticket_context — компания и номера машин для подсказки чтению
--                   (водителю и диспетчеру, каждому по своей сессии);
--   weigh_ticket_add — строка фото + повторы: тот же файл или тот же
--                   номер талона уже были в компании;
--   driver_site_action LOAD — weigh_ticket_id в данных привязывает фото
--                   к созданному рейсу;
--   carrier_site_load_save — диспетчер сохраняет рейс по талону: на
--                   своём объекте правит или добавляет рейс, на объекте
--                   под заказ платформы только прикрепляет фото (цена
--                   заказа меняется лишь отметками водителя).
--
-- Пишут в таблицу только функции; хранилище — только сервер служебным
-- ключом, читает своя компания (первый сегмент пути) и оператор.
-- ═══════════════════════════════════════════════════════════════════

-- ── Бакет ─────────────────────────────────────────────────────────

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('weigh-tickets', 'weigh-tickets', false, 10485760, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy weigh_tickets_read_own
  on storage.objects for select to authenticated
  using (
    bucket_id = 'weigh-tickets'
    and (storage.foldername(name))[1] = (select app.current_company_id())::text
  );

create policy weigh_tickets_read_admin
  on storage.objects for select to authenticated
  using (bucket_id = 'weigh-tickets' and (select app.is_admin()));

/* Талон — основание веса в рейсе и в счёте: стереть его может только оператор. */
create policy weigh_tickets_delete_admin
  on storage.objects for delete to authenticated
  using (bucket_id = 'weigh-tickets' and (select app.is_admin()));

-- ── Номер талона для сравнения ────────────────────────────────────

/* «12 345», «12-345» и «12345» — один талон: сравниваем без пробелов и знаков. */
create or replace function app.weigh_ticket_norm(p_value text)
returns text
language sql
immutable
set search_path = ''
as $$
  select nullif(regexp_replace(upper(coalesce(p_value, '')), '[^0-9A-ZÅÄÖÜ]', '', 'g'), '');
$$;

create index site_loads_ticket_norm_idx
  on public.site_loads (company_id, app.weigh_ticket_norm(ticket_no))
  where ticket_no is not null;

-- ── Фото талонов ──────────────────────────────────────────────────

create table public.weigh_tickets (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  job_id uuid not null references public.site_jobs (id) on delete cascade,
  load_id uuid references public.site_loads (id) on delete set null,
  storage_path text not null unique,
  mime_type text not null constraint weigh_tickets_mime check (mime_type in ('image/jpeg', 'image/png', 'image/webp')),
  size_bytes integer not null constraint weigh_tickets_size check (size_bytes between 1 and 10485760),
  /* SHA-256 файла: тот же снимок, загруженный второй раз, — повтор. */
  sha256 text not null constraint weigh_tickets_sha256 check (sha256 ~ '^[0-9a-f]{64}$'),
  /*
   * READ — прочитан; NOT_CONFIGURED — чтение не подключено; FAILED — не
   * прочитался; NOT_READ — пришёл из очереди без связи вместе с рейсом.
   */
  reading_status text not null constraint weigh_tickets_status check (reading_status in ('READ', 'NOT_CONFIGURED', 'FAILED', 'NOT_READ')),
  /* Поля, как их вернуло чтение, — до правки человеком. */
  reading jsonb,
  ticket_no text constraint weigh_tickets_ticket_no check (length(ticket_no) <= 60),
  uploaded_by uuid references auth.users (id) on delete set null,
  driver_id uuid references public.drivers (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint weigh_tickets_path_in_company check (storage_path like company_id::text || '/%')
);

comment on table public.weigh_tickets is
  'Фото весовых талонов рейсов на объекте: файл в weigh-tickets, прочитанные поля, привязка к site_loads.';

create index weigh_tickets_company_sha_idx on public.weigh_tickets (company_id, sha256);
create index weigh_tickets_load_idx on public.weigh_tickets (load_id) where load_id is not null;
create index weigh_tickets_job_idx on public.weigh_tickets (job_id, created_at);

alter table public.weigh_tickets enable row level security;
revoke all on public.weigh_tickets from anon, authenticated;

create policy weigh_tickets_own
  on public.weigh_tickets for select to authenticated
  using (company_id = (select app.current_company_id()));

create policy weigh_tickets_admin
  on public.weigh_tickets for select to authenticated
  using ((select app.is_admin()));

grant select on public.weigh_tickets to authenticated;

-- ── Чей объект ────────────────────────────────────────────────────

/*
 * Компания объекта, если вызывающий может работать с ним: водитель —
 * открытый объект своей компании, диспетчер — объект своей компании.
 * NULL — нельзя.
 */
create or replace function app.weigh_ticket_job_company(p_job_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select j.company_id
  from public.site_jobs j
  where j.id = p_job_id
    and (
      (j.status = 'ACTIVE' and j.company_id = (select d.company_id from public.drivers d where d.id = (select app.current_driver_id())))
      or j.company_id = (select app.current_company_id())
    );
$$;

revoke all on function app.weigh_ticket_job_company(uuid) from public, anon, authenticated;

/*
 * Что нужно серверу до загрузки: компания (первый сегмент пути в бакете),
 * страна и номера машин и прицепов компании — подсказка чтению, где на
 * талоне номер машины.
 */
create or replace function public.weigh_ticket_context(p_job_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_company uuid := app.weigh_ticket_job_company(p_job_id);
begin
  if v_company is null then
    raise exception 'Объект не найден.' using errcode = 'P0002';
  end if;

  return jsonb_build_object(
    'company_id', v_company,
    'country', (select country from public.companies where id = v_company),
    'plates', coalesce((
      select jsonb_agg(p.plate order by p.plate)
      from (
        select v.plate from public.vehicles v where v.company_id = v_company
        union
        select t.plate from public.trailers t where t.company_id = v_company
      ) p
      where p.plate is not null
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.weigh_ticket_context(uuid) from public, anon;
grant execute on function public.weigh_ticket_context(uuid) to authenticated;

-- ── Повторы ───────────────────────────────────────────────────────

/*
 * Тот же файл (по хэшу) и тот же номер талона в рейсах компании. Номер
 * сравнивается без пробелов и знаков; весы сверяет уже форма: у разных
 * весов номера талонов могут совпасть.
 */
create or replace function app.weigh_ticket_duplicates(p_company uuid, p_ticket uuid, p_sha256 text, p_ticket_no text, p_exclude_load uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'photo', coalesce((
      select jsonb_agg(jsonb_build_object(
        'ticket_id', w.id, 'load_id', w.load_id, 'created_at', w.created_at,
        'unloaded_at', l.unloaded_at, 'job_name', j.name) order by w.created_at desc)
      from public.weigh_tickets w
      join public.site_jobs j on j.id = w.job_id
      left join public.site_loads l on l.id = w.load_id
      /* Повтор — фото, уже прикреплённое к рейсу; прочитанное и брошенное (переснял) не в счёт. */
      where w.company_id = p_company and w.sha256 = p_sha256 and w.id <> p_ticket and w.load_id is not null
    ), '[]'::jsonb),
    'ticket', coalesce((
      select jsonb_agg(x.item order by x.unloaded_at desc)
      from (
        select l.unloaded_at, jsonb_build_object(
          'load_id', l.id, 'ticket_no', l.ticket_no, 'scale_site_id', l.scale_site_id,
          'scale_name', (select s.name from public.scale_sites s where s.id = l.scale_site_id),
          'unloaded_at', l.unloaded_at, 'net_kg', l.net_kg, 'job_name', j.name) as item
        from public.site_loads l
        join public.site_jobs j on j.id = l.job_id
        where l.company_id = p_company
          and l.ticket_no is not null
          and app.weigh_ticket_norm(l.ticket_no) = app.weigh_ticket_norm(p_ticket_no)
          and l.id is distinct from p_exclude_load
        order by l.unloaded_at desc
        limit 5
      ) x
    ), '[]'::jsonb)
  );
$$;

revoke all on function app.weigh_ticket_duplicates(uuid, uuid, text, text, uuid) from public, anon, authenticated;

-- ── Регистрация фото ──────────────────────────────────────────────

/*
 * Строка фото, которое сервер уже положил в бакет. Повтор с тем же
 * идентификатором (очередь телефона, двойное нажатие) возвращает прежнюю
 * строку. p_load_event_id — фото пришло из очереди вместе с рейсом:
 * привязываем к рейсу с этим идентификатором действия.
 *
 * Возвращает id и повторы: тот же файл, тот же номер талона.
 */
create or replace function public.weigh_ticket_add(
  p_id uuid,
  p_job_id uuid,
  p_storage_path text,
  p_mime_type text,
  p_size_bytes integer,
  p_sha256 text,
  p_status text,
  p_reading jsonb default null,
  p_load_event_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_company uuid := app.weigh_ticket_job_company(p_job_id);
  v_row public.weigh_tickets;
  v_ticket_no text := nullif(left(btrim(coalesce(p_reading ->> 'ticket_number', '')), 60), '');
  v_load uuid;
begin
  if v_company is null then
    raise exception 'Объект не найден.' using errcode = 'P0002';
  end if;

  select * into v_row from public.weigh_tickets where id = p_id;
  if v_row.id is not null and v_row.company_id <> v_company then
    raise exception 'Фото не найдено.' using errcode = 'P0002';
  end if;

  if v_row.id is null then
    if p_load_event_id is not null then
      select id into v_load from public.site_loads
      where event_id = p_load_event_id and company_id = v_company and job_id = p_job_id;
    end if;

    insert into public.weigh_tickets (id, company_id, job_id, load_id, storage_path, mime_type, size_bytes, sha256,
                                      reading_status, reading, ticket_no, uploaded_by, driver_id)
    values (p_id, v_company, p_job_id, v_load, p_storage_path, p_mime_type, p_size_bytes, lower(p_sha256),
            p_status, p_reading, v_ticket_no, (select auth.uid()), (select app.current_driver_id()))
    returning * into v_row;
  end if;

  return jsonb_build_object('id', v_row.id)
    || jsonb_build_object('duplicates',
         app.weigh_ticket_duplicates(v_company, v_row.id, v_row.sha256, v_row.ticket_no, v_row.load_id));
end;
$$;

revoke all on function public.weigh_ticket_add(uuid, uuid, text, text, integer, text, text, jsonb, uuid) from public, anon;
grant execute on function public.weigh_ticket_add(uuid, uuid, text, text, integer, text, text, jsonb, uuid) to authenticated;

-- ── Рейс водителя забирает фото ───────────────────────────────────

do $$
declare
  v_sig constant text := 'public.driver_site_action(text, uuid, jsonb, timestamptz, uuid)';
  v_def text := replace(pg_get_functiondef(v_sig::regprocedure), E'\r\n', E'\n');
  v_decl constant text := E'  v_trailer uuid;\n';
  v_mark constant text := 'on conflict do nothing;';
begin
  if (length(v_def) - length(replace(v_def, v_decl, ''))) / length(v_decl) <> 1
     or (length(v_def) - length(replace(v_def, v_mark, ''))) / length(v_mark) <> 1 then
    raise exception 'driver_site_action: место правки не найдено или встретилось не один раз';
  end if;

  v_def := replace(v_def, v_decl, v_decl || E'  v_load uuid;\n');
  v_def := replace(v_def, v_mark, $m$on conflict do nothing
    returning id into v_load;
    /* Фото весового талона, прочитанное до сохранения, — к этому рейсу. */
    if v_load is not null and coalesce(p_data ->> 'weigh_ticket_id', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      update public.weigh_tickets
      set load_id = v_load
      where id = (p_data ->> 'weigh_ticket_id')::uuid
        and company_id = v_job.company_id and job_id = v_job.id and load_id is null;
    end if;$m$);
  execute v_def;
end;
$$;

-- ── Диспетчер сохраняет рейс по талону ────────────────────────────

/*
 * p_load_id NULL — новый рейс в этот день (только свой объект);
 * иначе — правка рейса. p_data: material_code, scale_site_id, gross_kg,
 * tare_kg, ticket_no, unloaded_at (новый рейс; не раньше прибытия).
 *
 * Объект под заказ платформы: веса и рейсы там меняет только водитель
 * (из них считается цена заказа), диспетчер лишь прикрепляет фото к
 * существующему рейсу.
 *
 * День в счёте не меняется. Правка снимает подтверждение прораба: он
 * подтверждал другие веса.
 */
create or replace function public.carrier_site_load_save(
  p_day_id uuid,
  p_load_id uuid default null,
  p_data jsonb default '{}'::jsonb,
  p_weigh_ticket_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_company uuid := (select app.current_company_id());
  v_day public.site_days;
  v_job public.site_jobs;
  v_load uuid;
  v_material text := nullif(p_data ->> 'material_code', '');
  v_scale uuid;
  v_at timestamptz;
begin
  if v_company is null then
    raise exception 'Нет компании.' using errcode = '42501';
  end if;

  select * into v_day from public.site_days where id = p_day_id and company_id = v_company for update;
  if v_day.id is null then
    raise exception 'День не найден.' using errcode = 'P0002';
  end if;
  select * into v_job from public.site_jobs where id = v_day.job_id;
  if v_job.status <> 'ACTIVE' then
    raise exception 'Объект закрыт.' using errcode = '55000';
  end if;
  if v_day.invoice_id is not null then
    raise exception 'День уже в счёте.' using errcode = '55000';
  end if;

  if p_load_id is not null then
    select id into v_load from public.site_loads where id = p_load_id and day_id = v_day.id;
    if v_load is null then
      raise exception 'Рейс не найден.' using errcode = 'P0002';
    end if;
  end if;

  if v_job.order_id is not null then
    if v_load is null then
      raise exception 'Рейсы заказа платформы записывает водитель.' using errcode = '42501';
    end if;
  else
    if v_material is not null and v_material !~ '^[A-Z0-9]{2,12}$' then
      raise exception 'Неверный груз.' using errcode = '22023';
    end if;
    select id into v_scale from public.scale_sites
    where id = nullif(p_data ->> 'scale_site_id', '')::uuid
      and (approved_at is not null or created_by_company = v_company);

    if v_load is null then
      v_at := greatest(coalesce(nullif(p_data ->> 'unloaded_at', '')::timestamptz, now()), v_day.arrived_at);
      insert into public.site_loads (day_id, job_id, company_id, material_code, scale_site_id, gross_kg, tare_kg, unloaded_at, ticket_no)
      values (
        v_day.id, v_job.id, v_company,
        coalesce(v_material, v_job.material_code),
        v_scale,
        nullif(p_data ->> 'gross_kg', '')::integer,
        nullif(p_data ->> 'tare_kg', '')::integer,
        v_at,
        nullif(left(btrim(coalesce(p_data ->> 'ticket_no', '')), 60), '')
      )
      returning id into v_load;
    else
      update public.site_loads
      set material_code = coalesce(v_material, material_code),
          scale_site_id = v_scale,
          gross_kg = nullif(p_data ->> 'gross_kg', '')::integer,
          tare_kg = nullif(p_data ->> 'tare_kg', '')::integer,
          ticket_no = nullif(left(btrim(coalesce(p_data ->> 'ticket_no', '')), 60), '')
      where id = v_load;
    end if;

    update public.site_days
    set approved_at = null, approved_by = null, approval_note = null
    where id = v_day.id and approved_at is not null;
  end if;

  if p_weigh_ticket_id is not null then
    update public.weigh_tickets
    set load_id = v_load
    where id = p_weigh_ticket_id and company_id = v_company and job_id = v_job.id
      and (load_id is null or load_id = v_load);
  end if;

  return v_load;
end;
$$;

revoke all on function public.carrier_site_load_save(uuid, uuid, jsonb, uuid) from public, anon;
grant execute on function public.carrier_site_load_save(uuid, uuid, jsonb, uuid) to authenticated;

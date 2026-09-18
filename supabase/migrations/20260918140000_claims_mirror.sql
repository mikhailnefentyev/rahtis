-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · claim идёт оператору, второй стороне — зеркалом на почту
--
-- Первая версия claims строила общую ленту: заказчик и перевозчик
-- переписывались в одном споре, оператор смотрел со стороны. Это
-- расходится с тем, как устроен договор: претензия заказчика адресована
-- Aivomaa Oy — его контрагенту (условия 1.3 и 12.1), — а с перевозчиком
-- по ней говорит уже Aivomaa, от своего имени.
--
-- Теперь так.
--
--   Подавший ведёт спор с оператором в кабинете: пишет, прикладывает,
--   видит решение.
--
--   Вторая сторона получает claim сразу, письмом от имени RAHTIS /
--   Aivomaa Oy, с полным текстом, суммой и вложениями; ответ на письмо
--   приходит оператору. Дальнейшая переписка с ней — почтой. В кабинете
--   она видит claim без чужой переписки: суть, рейс, доказательства,
--   статус и решение. Писать в него она не может — это был бы второй
--   канал к тому же разговору, и одна из веток неизбежно отстала бы.
--
--   Оператор видит всё и отвечает подавшему в кабинете.
--
-- Отметка о зеркале (mirrored_at, mirrored_to) — доказательство того,
-- что вторая сторона была уведомлена и когда: по претензии текут сроки.
-- ═══════════════════════════════════════════════════════════════════

alter table public.claims
  add column mirrored_at timestamptz,
  add column mirrored_to text;

comment on column public.claims.mirrored_at is
  'Когда claim ушёл второй стороне письмом от имени оператора. NULL — не ушёл (нет адреса, сбой почты).';
comment on column public.claims.mirrored_to is
  'Адрес, на который ушло зеркало claim. Виден только оператору.';


-- ── Писать может подавший и оператор ──────────────────────────────

create or replace function app.claim_writer_role(p_claim public.claims)
returns public.party_role
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when app.is_admin() then 'ADMIN'::public.party_role
    when p_claim.filed_by_company_id = app.current_company_id() then app.current_party_role()
  end;
$$;

comment on function app.claim_writer_role(public.claims) is
  'Роль, от которой можно писать в claim: оператор или подавший. NULL у второй стороны — она ведёт спор почтой.';

revoke all on function app.claim_writer_role(public.claims) from public, anon, authenticated;


create or replace function public.comment_claim(p_claim_id uuid, p_body text)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_claim public.claims;
  v_role public.party_role;
  v_id bigint;
begin
  select * into v_claim from public.claims where id = p_claim_id;
  if v_claim.id is null or not (select app.party_to_claim(p_claim_id)) then
    raise exception 'Claim не найден.' using errcode = 'P0002';
  end if;

  v_role := app.claim_writer_role(v_claim);
  if v_role is null then
    raise exception 'Вторая сторона ведёт claim с оператором по почте.' using errcode = '42501';
  end if;

  if v_claim.status in ('RESOLVED', 'REJECTED') and v_role <> 'ADMIN' then
    raise exception 'Claim закрыт.' using errcode = '55000';
  end if;

  if length(btrim(coalesce(p_body, ''))) = 0 then
    raise exception 'Пустой комментарий.' using errcode = '22023';
  end if;

  insert into public.claim_events (claim_id, kind, author_role, author_id, body)
  values (p_claim_id, 'COMMENT', v_role, (select auth.uid()), left(btrim(p_body), 4000))
  returning id into v_id;

  update public.claims set updated_at = now() where id = p_claim_id;

  return v_id;
end;
$$;


create or replace function public.attach_to_claim(
  p_claim_id uuid,
  p_storage_path text,
  p_file_name text,
  p_mime_type text,
  p_size_bytes integer,
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_claim public.claims;
  v_role public.party_role;
  v_id uuid;
begin
  select * into v_claim from public.claims where id = p_claim_id;
  if v_claim.id is null or not (select app.party_to_claim(p_claim_id)) then
    raise exception 'Claim не найден.' using errcode = 'P0002';
  end if;

  v_role := app.claim_writer_role(v_claim);
  if v_role is null then
    raise exception 'Вторая сторона ведёт claim с оператором по почте.' using errcode = '42501';
  end if;

  if v_claim.status in ('RESOLVED', 'REJECTED') and v_role <> 'ADMIN' then
    raise exception 'Claim закрыт.' using errcode = '55000';
  end if;

  if split_part(p_storage_path, '/', 1) <> p_claim_id::text then
    raise exception 'Файл лежит не в папке claim.' using errcode = '22023';
  end if;

  insert into public.claim_attachments (
    claim_id, storage_path, file_name, mime_type, size_bytes, author_role, uploaded_by
  )
  values (
    p_claim_id, p_storage_path, left(p_file_name, 120), p_mime_type, p_size_bytes,
    v_role, (select auth.uid())
  )
  returning id into v_id;

  insert into public.claim_events (claim_id, kind, author_role, author_id, body, attachment_id)
  values (p_claim_id, 'ATTACHMENT', v_role, (select auth.uid()),
          nullif(left(btrim(coalesce(p_note, '')), 4000), ''), v_id);

  update public.claims set updated_at = now() where id = p_claim_id;

  return v_id;
end;
$$;


-- ── Второй стороне — без чужой переписки ───────────────────────────

/*
 * Та же карточка, но лента второй стороны — только подача и смены
 * статуса. Переписку подавшего с оператором она не видит: с ней оператор
 * говорит отдельно, почтой. Вложения видны — их она получила и в письме.
 *
 * channel подсказывает интерфейсу, где идёт разговор: CABINET у
 * подавшего и оператора, EMAIL у второй стороны.
 */
create or replace function public.claim_detail(p_claim_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_admin boolean := (select app.is_admin());
  v_role public.party_role := (select app.current_party_role());
  v_company uuid := (select app.current_company_id());
  v_claim public.claims;
  v_viewer public.party_role;
  v_counterparty boolean;
begin
  select * into v_claim from public.claims where id = p_claim_id;
  if v_claim.id is null or not (v_admin or v_company in (v_claim.filed_by_company_id, v_claim.against_company_id)) then
    return null;
  end if;

  v_viewer := case when v_admin then 'ADMIN'::public.party_role else v_role end;
  v_counterparty := not v_admin and v_claim.filed_by_company_id <> v_company;

  return jsonb_build_object(
    'viewer', v_viewer,
    'channel', case when v_counterparty then 'EMAIL' else 'CABINET' end,
    'claim', jsonb_build_object(
      'id', v_claim.id,
      'ref', v_claim.ref,
      'kind', v_claim.kind,
      'status', v_claim.status,
      'filed_by_role', v_claim.filed_by_role,
      'mine', v_claim.filed_by_company_id = v_company,
      'stop_id', v_claim.stop_id,
      'description', v_claim.description,
      'amount_cents', v_claim.amount_cents,
      'resolution', v_claim.resolution,
      'resolved_at', v_claim.resolved_at,
      'created_at', v_claim.created_at,
      'updated_at', v_claim.updated_at,
      'mirrored_at', v_claim.mirrored_at,
      'mirrored_to', case when v_admin then v_claim.mirrored_to end
    ),
    'order', (
      select jsonb_build_object(
        'id', o.id,
        'ref', o.ref,
        'shipper_ref', o.shipper_ref,
        'status', o.status,
        'order_type', o.order_type,
        'haul_kind', o.haul_kind,
        'container_feet', o.container_feet,
        'trailer', o.trailer,
        'trailer_plate', o.trailer_plate,
        'distance_km', o.distance_km,
        'rate_cents', o.rate_cents,
        'closed_at', o.closed_at,
        'vehicle_plate', v.plate,
        'shipper_name', case when v_viewer in ('ADMIN', 'CARRIER') then sh.name end,
        'carrier_name', case when v_viewer = 'ADMIN' then ca.name end,
        'route_geometry', o.route_geometry,
        'route_bounds', o.route_bounds,
        'stops', (
          select jsonb_agg(to_jsonb(s) order by s.sequence)
          from public.order_stops s where s.order_id = o.id
        )
      )
      from public.orders o
      join public.companies sh on sh.id = o.shipper_company_id
      left join public.companies ca on ca.id = o.assigned_company_id
      left join public.vehicles v on v.id = o.assigned_vehicle_id
      where o.id = v_claim.order_id
    ),
    'documents', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', d.id,
          'kind', d.kind,
          'file_name', d.file_name,
          'storage_path', d.storage_path,
          'mime_type', d.mime_type,
          'size_bytes', d.size_bytes,
          'stop_id', d.stop_id,
          'source', d.source,
          'phase', d.phase,
          'subject', d.subject,
          'captured_at', d.captured_at,
          'created_at', d.created_at
        )
        order by coalesce(d.captured_at, d.created_at)
      )
      from public.order_documents d where d.order_id = v_claim.order_id
    ), '[]'::jsonb),
    'attachments', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', a.id,
          'file_name', a.file_name,
          'storage_path', a.storage_path,
          'mime_type', a.mime_type,
          'size_bytes', a.size_bytes,
          'author_role', a.author_role,
          'created_at', a.created_at
        )
        order by a.created_at
      )
      from public.claim_attachments a where a.claim_id = v_claim.id
    ), '[]'::jsonb),
    'events', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', e.id,
          'kind', e.kind,
          'author_role', e.author_role,
          'body', e.body,
          'status_from', e.status_from,
          'status_to', e.status_to,
          'attachment_id', e.attachment_id,
          'created_at', e.created_at
        )
        order by e.created_at, e.id
      )
      from public.claim_events e
      where e.claim_id = v_claim.id
        and (not v_counterparty or e.kind in ('CREATED', 'STATUS'))
    ), '[]'::jsonb)
  );
end;
$$;


-- ── Кому уведомление в кабинет ─────────────────────────────────────

/*
 * Подача    — второй стороне: claim пришёл, подробности в письме.
 * Сообщение — подавшего видит оператор (письмом из приложения), вторую
 *             сторону оно не касается; сообщение оператора — подавшему.
 * Статус    — обеим сторонам, кроме той, что его поставила.
 */
create or replace function app.on_claim_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_claim public.claims;
  v_order_ref text;
  v_shipper uuid;
  v_code text;
  v_params jsonb;
  v_target uuid;
  v_targets uuid[];
begin
  select * into v_claim from public.claims where id = new.claim_id;
  select o.ref, o.shipper_company_id into v_order_ref, v_shipper
  from public.orders o where o.id = v_claim.order_id;

  v_code := case new.kind
    when 'CREATED' then 'claim.opened'
    when 'COMMENT' then 'claim.comment'
    when 'ATTACHMENT' then 'claim.attachment'
    when 'STATUS' then 'claim.status'
  end;

  v_targets := case
    when new.kind = 'CREATED' then array[v_claim.against_company_id]
    when new.kind in ('COMMENT', 'ATTACHMENT') and new.author_role = 'ADMIN'
      then array[v_claim.filed_by_company_id]
    when new.kind in ('COMMENT', 'ATTACHMENT') then array[]::uuid[]
    when new.author_role = 'ADMIN' then array[v_claim.filed_by_company_id, v_claim.against_company_id]
    else array[v_claim.against_company_id]
  end;

  v_params := jsonb_build_object(
    'ref', v_claim.ref,
    'order', v_order_ref,
    'kind', v_claim.kind,
    'status', coalesce(new.status_to, v_claim.status)
  );

  foreach v_target in array v_targets loop
    perform app.notify_event(
      v_target,
      'CLAIM'::public.notification_kind,
      v_code,
      v_params,
      case when v_target = v_shipper then '/shipper/claims/' else '/carrier/claims/' end
        || v_claim.id::text
    );
  end loop;

  return new;
end;
$$;

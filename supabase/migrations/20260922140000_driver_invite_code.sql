-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · вход водителя по коду
--
-- Ссылка-приглашение открывается в браузере, а на iPhone приложение с
-- экрана «Домой» хранит вход отдельно от Safari. Водитель, вошедший по
-- ссылке и потом установивший приложение, мог открыть его невошедшим —
-- с одноразовой ссылкой, уже потраченной, и без адресной строки, куда
-- вставить новую.
--
-- Теперь у приглашения есть и шестизначный код. Приложение на экране
-- «не привязано» спрашивает телефон и код — порядок «сначала установить,
-- потом войти» работает на любом телефоне.
--
-- Код без телефона не принимается: шесть цифр — это миллион вариантов на
-- все приглашения платформы сразу. С телефоном перебор сужается до
-- одного приглашения, а app.throttle_hit даёт пять попыток на номер за
-- пятнадцать минут. За сутки жизни кода это меньше тысячной доли
-- вариантов.
-- ═══════════════════════════════════════════════════════════════════

alter table public.driver_invites add column code_hash text;

comment on column public.driver_invites.code_hash is
  'sha256 от номера водителя и шестизначного кода. Сам код не хранится.';

/* Код привязан к номеру: одинаковые коды у двух водителей не пересекаются. */
create or replace function app.invite_code_hash(p_phone text, p_code text)
returns text
language sql
immutable
set search_path = ''
as $$
  select app.token_hash(app.phone_digits(p_phone) || ':' || btrim(p_code));
$$;


-- ── Приглашение: ссылка и код ──────────────────────────────────────

drop function public.create_driver_invite(uuid);

create function public.create_driver_invite(p_driver_id uuid)
returns table (token text, code text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_token text := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
  /* gen_random_uuid — криптостойкий источник; из него шесть цифр. */
  v_code text := lpad(
    (abs(('x' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))::bit(32)::int) % 1000000)::text,
    6, '0'
  );
  v_phone text;
begin
  if (select app.current_party_role()) is distinct from 'CARRIER'
     or not app.owns_driver(p_driver_id) then
    raise exception 'Водитель не найден в вашей компании.' using errcode = '42501';
  end if;

  select phone into v_phone from public.drivers where id = p_driver_id and status = 'ACTIVE';
  if v_phone is null then
    raise exception 'Водитель в архиве.' using errcode = '55000';
  end if;

  update public.driver_invites
  set expires_at = least(expires_at, now())
  where driver_id = p_driver_id and used_at is null and expires_at > now();

  insert into public.driver_invites (driver_id, token_hash, code_hash, expires_at, created_by)
  values (
    p_driver_id,
    app.token_hash(v_token),
    app.invite_code_hash(v_phone, v_code),
    now() + interval '24 hours',
    (select auth.uid())
  );

  return query select v_token, v_code;
end;
$$;

revoke all on function public.create_driver_invite(uuid) from public, anon;
grant execute on function public.create_driver_invite(uuid) to authenticated;


-- ── Найти приглашение: по ссылке или по телефону и коду ────────────

drop function public.driver_invite_preview(text);

/*
 * Одна функция на оба входа, чтобы правила «действует ли приглашение»
 * не разошлись между ссылкой и кодом. Путь по коду считает попытки на
 * номер и отказывает кодом 54000, когда их больше пяти за 15 минут.
 */
create function public.driver_invite_lookup(
  p_token text default null,
  p_phone text default null,
  p_code text default null
)
returns table (invite_id uuid, driver_id uuid, full_name text, company_name text, auth_user_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_token is null then
    if app.phone_digits(p_phone) is null or btrim(coalesce(p_code, '')) !~ '^\d{6}$' then
      return;
    end if;

    if not app.throttle_hit(app.token_hash('driver-code:' || app.phone_digits(p_phone)), 5, interval '15 minutes') then
      raise exception 'Слишком много попыток.' using errcode = '54000';
    end if;
  end if;

  return query
  select i.id, d.id, d.full_name, c.name, d.auth_user_id
  from public.driver_invites i
  join public.drivers d on d.id = i.driver_id and d.status = 'ACTIVE'
  join public.companies c on c.id = d.company_id
  where i.used_at is null
    and i.expires_at > now()
    and (
      (p_token is not null and i.token_hash = app.token_hash(p_token))
      or (p_token is null and i.code_hash = app.invite_code_hash(p_phone, p_code)
          and app.phone_digits(d.phone) = app.phone_digits(p_phone))
    )
  limit 1;
end;
$$;


-- ── Погасить приглашение ───────────────────────────────────────────

drop function public.claim_driver_invite(text, uuid);

/* По идентификатору, найденному driver_invite_lookup, — каким бы путём. */
create function public.claim_driver_invite(p_invite_id uuid, p_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invite public.driver_invites;
begin
  select * into v_invite from public.driver_invites where id = p_invite_id for update;

  if v_invite.id is null or v_invite.used_at is not null or v_invite.expires_at <= now() then
    raise exception 'Приглашение недействительно.' using errcode = 'P0002';
  end if;

  update public.driver_invites set used_at = now() where id = v_invite.id;

  update public.drivers
  set auth_user_id = p_user_id
  where id = v_invite.driver_id and status = 'ACTIVE';

  if not found then
    raise exception 'Водитель в архиве.' using errcode = '55000';
  end if;

  return v_invite.driver_id;
end;
$$;

revoke all on function
  public.driver_invite_lookup(text, text, text),
  public.claim_driver_invite(uuid, uuid)
from public, anon, authenticated;

grant execute on function
  public.driver_invite_lookup(text, text, text),
  public.claim_driver_invite(uuid, uuid)
to service_role;

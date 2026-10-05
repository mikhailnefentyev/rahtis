-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · перевозчик приглашает перевозчика
--
-- 4.10.2026 функцией «пригласить своего заказчика» пригласили шесть
-- транспортных компаний: письмо звало их заказывать перевозки, а форма
-- заявки заранее выбирала «заказчик». Теперь приглашение бывает двух
-- видов (shipper_invites.invite_kind): заказчику — как раньше, перевозчику
-- — своё письмо и форма, где сразу выбран перевозчик.
--
-- У приглашённого перевозчика нет связи с пригласившим (связь — про
-- прямые заказы заказчика). Пригласивший получает уведомление, когда
-- приглашённого одобрят. Срок хранения — как у всех приглашений, 12 мес.
-- ═══════════════════════════════════════════════════════════════════

alter table public.shipper_invites
  add column invite_kind text not null default 'SHIPPER',
  add constraint shipper_invites_kind check (invite_kind in ('SHIPPER', 'CARRIER'));

grant select (invite_kind) on public.shipper_invites to authenticated;


/* Приглашение заказчика или перевозчика: только активный перевозчик, не больше 20 в сутки. */
create or replace function public.carrier_invite_company(
  p_kind text, p_name text, p_business_id text, p_email text, p_token_hash text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_company public.companies;
  v_id uuid;
begin
  if p_kind not in ('SHIPPER', 'CARRIER') then
    raise exception 'Вид приглашения: SHIPPER или CARRIER.' using errcode = '22023';
  end if;
  if (select app.current_party_role()) is distinct from 'CARRIER' then
    raise exception 'Приглашает перевозчик.' using errcode = '42501';
  end if;
  select * into v_company from public.companies where id = (select app.current_company_id());
  if v_company.id is null or v_company.status <> 'ACTIVE' or v_company.frozen_at is not null then
    raise exception 'Приглашает активная компания.' using errcode = '55000';
  end if;
  if (select count(*) from public.shipper_invites
      where carrier_company_id = v_company.id and created_at > now() - interval '1 day') >= 20 then
    raise exception 'Не больше 20 приглашений в сутки.' using errcode = '55001';
  end if;

  insert into public.shipper_invites (carrier_company_id, token_hash, company_name, business_id, email, created_by, invite_kind)
  values (v_company.id, lower(p_token_hash), btrim(p_name), btrim(p_business_id), lower(btrim(p_email)), (select auth.uid()), p_kind)
  returning id into v_id;

  perform app.audit('company_invite.create', v_id::text, jsonb_build_object('carrier', v_company.id, 'kind', p_kind));
  return v_id;
end;
$$;

revoke all on function public.carrier_invite_company(text, text, text, text, text) from public, anon;
grant execute on function public.carrier_invite_company(text, text, text, text, text) to authenticated;


/* Приглашённого перевозчика одобрили — пригласившему уведомление. */
create or replace function app.on_invited_carrier_approved()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invite record;
begin
  if new.kind <> 'CARRIER' or new.status <> 'APPROVED' or old.status is not distinct from new.status then
    return new;
  end if;

  for v_invite in
    select distinct i.carrier_company_id
    from public.shipper_invites i
    where i.applied_company_id = new.id and i.invite_kind = 'CARRIER'
  loop
    perform app.notify_event(
      v_invite.carrier_company_id, 'ORDER', 'invite.carrier_approved',
      jsonb_build_object('carrier', new.name), '/carrier/partners');
  end loop;

  return new;
end;
$$;

revoke all on function app.on_invited_carrier_approved() from public, anon, authenticated;

create trigger companies_invited_carrier_approved
  after update of status on public.companies
  for each row execute function app.on_invited_carrier_approved();

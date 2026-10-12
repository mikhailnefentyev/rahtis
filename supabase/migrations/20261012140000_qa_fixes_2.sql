-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · правки по сквозному прогону 12.10.2026, часть 2
--
-- 1. Письмо о новом заказе называло не тот маршрут. Город назначения
--    брался только из точки с ролью DELIVERY, а форма заказа создаёт
--    выгрузки ролью EXTRA_UNLOAD — и у обычного перецепа «Helsinki →
--    Vantaa → Helsinki» в теме письма стояло «Helsinki → Helsinki».
--    Теперь назначение — последняя рабочая точка, а у перегона — место,
--    где оставляют единицу: та же подпись, что на столе.
--
-- 2. Ключ API, выпущенный диспетчером, после снятия его доступа молча
--    переставал работать (ключ действует, пока выпустивший остаётся в
--    компании), но в списке ключей значился действующим. Теперь снятие
--    доступа отзывает ключи этого человека — список говорит правду.
--
-- 3. Модель оплаты водителя сохранялась без ставки. Ограничение
--    driver_pay_profiles_fields написано через CASE, а CHECK с NULL
--    считается пройденным: «PER_KM» с пустой ставкой проходил и
--    показывался как «0 € / km».
-- ═══════════════════════════════════════════════════════════════════

-- ── 1. Письмо о новом заказе: куда едем ────────────────────────────

do $$
declare
  v_proc regprocedure := 'public.order_dispatch_card(uuid)'::regprocedure;
  v_def text := replace(pg_get_functiondef(v_proc), E'\r\n', E'\n');
  v_new text;
begin
  if position('left join lateral' in v_def) > 0 then
    return;
  end if;

  v_new := regexp_replace(
    v_def,
    $p$left join public\.order_stops delivery(\s+)on delivery\.order_id = o\.id and delivery\.role = 'DELIVERY'$p$,
    $r$left join lateral (
    select s.*
    from public.order_stops s
    where s.order_id = o.id and s.role <> 'PICKUP'
    /* Сначала рабочие точки, последняя из них; возврат единицы — только если других нет. */
    order by (s.role = 'TRAILER_RETURN'), s.sequence desc
    limit 1
  ) delivery on true$r$
  );

  if v_new = v_def then
    raise exception 'order_dispatch_card: место правки не найдено';
  end if;

  execute v_new;
end;
$$;


-- ── 2. Снятие доступа отзывает ключи API этого человека ────────────

/* Тело из 20261012110000 с одной правкой: отзыв ключей перед удалением профиля. */
create or replace function public.remove_company_member(p_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := (select app.current_company_id());
begin
  if v_me is null or not (select app.is_company_owner()) then
    raise exception 'Пользователями управляет главный пользователь компании.' using errcode = '42501';
  end if;

  if p_user_id = (select auth.uid()) then
    raise exception 'Себя убрать нельзя.' using errcode = '55000';
  end if;

  if not exists (
    select 1 from public.profiles
    where id = p_user_id and company_id = v_me and member_kind = 'DISPATCHER'
  ) then
    raise exception 'Диспетчер не найден.' using errcode = 'P0002';
  end if;

  update public.api_keys
  set revoked_at = now(), revoked_by = (select auth.uid())
  where created_by = p_user_id and company_id = v_me and revoked_at is null;

  delete from public.profiles
  where id = p_user_id and company_id = v_me and member_kind = 'DISPATCHER';

  return p_user_id;
end;
$$;


-- ── 3. Модель оплаты: ставка своей модели обязательна ──────────────

alter table public.driver_pay_profiles
  drop constraint driver_pay_profiles_fields,
  add constraint driver_pay_profiles_fields check (
    coalesce(
      case model
        when 'PER_KM' then per_km_cents between 1 and 100000
        when 'TRIP_PERCENT' then trip_bps between 1 and 10000
        when 'FLAT_HOURLY' then hourly_cents between 1 and 100000
        when 'TES' then tes_rule_set_id is not null
      end,
      false
    )
  );

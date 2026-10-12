-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · правки по сквозному прогону 12.10.2026
--
-- Четыре находки прогона по всем сценариям на тестовом контуре.
--
-- 1. Имя заказчика утекало перевозчику. Решение от 22.09.2026:
--    перевозчик не видит, чей это заказ, пока договор — с Aivomaa Oy.
--    Два места этого не знали:
--      · страница претензии (claim_detail) отдавала перевозчику название
--        заказчика всегда;
--      · уведомление после первого общего рейса («Ajoit ensimmäisen
--        kuljetuksen tilaajalle …») называло заказчика по имени.
--    Теперь в претензии имя видно перевозчику только по прямому договору
--    (стороны и так знают друг друга), а в уведомлении — тот же код
--    «Asiakas 3F2A», что в разделе «Asiakkaat».
--
-- 2. «Обычный простой на площадке» считался по всем рейсам подряд, и
--    тестовые рейсы (точки отмечены за секунды) давали «0 мин» настоящим
--    перевозчикам на настоящих терминалах. Статистика теперь своя у
--    каждого контура, как стол и рассылка (app.same_world).
--
-- 3. Экспресс с грузом тяжелее класса машины публиковался: «фургон до
--    3,5 т» с грузом 5 т не может взять никто, и заказ висел бы на столе.
-- ═══════════════════════════════════════════════════════════════════

-- ── 1а. Претензия: имя заказчика перевозчику — только по прямому договору ──

do $$
declare
  v_proc regprocedure := 'public.claim_detail(uuid)'::regprocedure;
  v_def text := replace(pg_get_functiondef(v_proc), E'\r\n', E'\n');
  v_new text;
begin
  v_new := replace(
    v_def,
    $a$'shipper_name', case when v_viewer in ('ADMIN', 'CARRIER') then sh.name end$a$,
    $b$'shipper_name', case
          when v_viewer = 'ADMIN' or (v_viewer = 'CARRIER' and o.contract_party = 'CARRIER') then sh.name
        end$b$
  );

  if v_new = v_def then
    raise exception 'claim_detail: место правки не найдено';
  end if;

  execute v_new;
end;
$$;


-- ── 1б. Первый общий рейс: код заказчика вместо имени ──────────────

/* Тело из 20261007100000; меняется только то, как назван заказчик. */
create or replace function app.on_first_trip_together()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inserted integer;
begin
  if new.status is not distinct from old.status
     or new.status <> 'DONE'
     or new.assigned_company_id is null
     or app.is_carrier_client(new.shipper_company_id) then
    return new;
  end if;

  insert into public.carrier_shipper_links (carrier_company_id, shipper_company_id)
  values (new.assigned_company_id, new.shipper_company_id)
  on conflict do nothing;

  get diagnostics v_inserted = row_count;

  if v_inserted > 0 then
    perform app.notify_event(
      new.assigned_company_id,
      'ORDER',
      'link.offer',
      jsonb_build_object(
        /*
         * По прямому договору стороны знают друг друга; по договору с
         * Aivomaa Oy — тот же код, что в разделе «Asiakkaat».
         */
        'shipper', case
          when new.contract_party = 'CARRIER'
            then coalesce((select name from public.companies where id = new.shipper_company_id), '')
          else 'Asiakas ' || upper(substr(md5(new.shipper_company_id::text), 1, 4))
        end
      ),
      '/carrier/partners'
    );
  end if;

  return new;
end;
$$;


-- ── 2. Простой на площадке — в своём контуре ───────────────────────

do $$
declare
  v_proc regprocedure := 'app.site_waiting(double precision, double precision)'::regprocedure;
  v_def text := replace(pg_get_functiondef(v_proc), E'\r\n', E'\n');
  v_new text;
begin
  if position('same_world' in v_def) > 0 then
    return;
  end if;

  v_new := replace(
    v_def,
    $a$where o.status = 'DONE'$a$,
    $b$where o.status = 'DONE'
      and app.same_world(o.shipper_company_id, (select app.current_company_id()))$b$
  );

  if v_new = v_def then
    raise exception 'site_waiting: место правки не найдено';
  end if;

  execute v_new;
end;
$$;


-- ── 3. Экспресс: груз не тяжелее класса машины ─────────────────────

/*
 * Потолок — полная масса класса из названия единицы («Pakettiauto ·
 * enintään 3,5 t», «Kuorma-auto · enintään 26 t»). Проверка стоит до
 * проверок публикации: черновик с таким грузом тоже не имеет смысла.
 */
do $$
declare
  v_proc regprocedure := 'app.create_order_for(uuid, jsonb, jsonb, boolean, uuid)'::regprocedure;
  v_def text := replace(pg_get_functiondef(v_proc), E'\r\n', E'\n');
  v_new text;
begin
  if position('тяжелее класса машины' in v_def) > 0 then
    return;
  end if;

  v_new := regexp_replace(
    v_def,
    $p$(\n\s*)if p_publish then(\s+)if not v_has_pickup then$p$,
    $r$\1if v_haul in ('VAN', 'TRUCK')
     and app.order_max_weight_kg(v_order.id) > (case v_haul when 'VAN' then 3500 else 26000 end) then
    raise exception 'Груз тяжелее класса машины: фургон — до 3500 кг, грузовик — до 26000 кг.'
      using errcode = '22023';
  end if;
\1if p_publish then\2if not v_has_pickup then$r$
  );

  if v_new = v_def then
    raise exception 'create_order_for: место правки не найдено';
  end if;

  execute v_new;
end;
$$;

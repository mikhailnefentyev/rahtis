-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · экспресс: потолок груза по тому, что машина везёт (26.10.2026)
--
-- Было: фургон — до 3500 кг, грузовик — до 26000 кг. Это полная масса
-- машины, а не груз: фургон 3,5 т реально берёт 1–1,5 т, грузовик 26 т —
-- около 15 т. Решение владельца: фургон до 1500 кг, грузовик до 15000 кг.
-- Уже созданные заказы не трогаем — проверка только при создании.
-- Текст функции берётся из базы и меняется точечно, как в 20261012130000.
-- ═══════════════════════════════════════════════════════════════════

do $$
declare
  v_proc regprocedure := 'app.create_order_for(uuid, jsonb, jsonb, boolean, uuid)'::regprocedure;
  v_def text := replace(pg_get_functiondef(v_proc), E'\r\n', E'\n');
  v_old_cap constant text := $m$(case v_haul when 'VAN' then 3500 else 26000 end)$m$;
  v_old_msg constant text := $m$фургон — до 3500 кг, грузовик — до 26000 кг.$m$;
  v_new text;
begin
  if position(v_old_cap in v_def) = 0 or position(v_old_msg in v_def) = 0 then
    raise exception 'create_order_for: место правки не найдено';
  end if;

  v_new := replace(v_def, v_old_cap, $m$(case v_haul when 'VAN' then 1500 else 15000 end)$m$);
  v_new := replace(v_new, v_old_msg, $m$фургон — до 1500 кг, грузовик — до 15000 кг.$m$);

  execute v_new;
end;
$$;

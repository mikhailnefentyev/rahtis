-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · адрес выпуска документов периода выводится, а не вводится
--
-- Задание уже стоит в расписании, но без settlement_url в runtime_config
-- оно молча ничего не делает. Настройка, которую надо не забыть завести
-- руками, — это настройка, которую забудут: первого числа никто не
-- заметит, что документы не выпущены, потому что и уведомления о них не
-- придёт.
--
-- Адрес выводится из reports_url: это тот же сайт, отличается только
-- последний сегмент пути. Если недельные отчёты выпускаются — а они
-- выпускаются, — значит и этот адрес верен.
--
-- on conflict do nothing: заведённое руками значение важнее выведенного.
-- Перенос на другой хост делается правкой обеих строк, и затирать чужую
-- правку при повторном применении миграции нельзя.
-- ═══════════════════════════════════════════════════════════════════

insert into app.runtime_config (key, value, note)
select
  'settlement_url',
  regexp_replace(value, '/weekly/?$', '/settlement'),
  'Куда стучится задание документов расчётного периода. Выведен из reports_url.'
from app.runtime_config
where key = 'reports_url'
  and value ~ '/weekly/?$'
on conflict (key) do nothing;

do $$
declare
  v_url text;
begin
  select value into v_url from app.runtime_config where key = 'settlement_url';

  if v_url is null then
    raise notice
      'settlement_url не заведён: в reports_url нет пути /weekly. Заведите адрес вручную, иначе документы периода выпускаться не будут.';
  else
    raise notice 'settlement_url = %', v_url;
  end if;
end;
$$;

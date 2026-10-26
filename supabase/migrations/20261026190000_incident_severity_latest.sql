-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · уровень сбоя — по последнему случаю (26.10.2026)
--
-- Старая сборка после выкладки (ChunkLoadError) и обрыв сети (…Network)
-- писались из браузера как FATAL, а открытый FATAL держит /api/health в
-- «degraded». Теперь приложение пишет их как WARN, но повтор той же
-- ошибки уровень строки не менял: однажды записанная FATAL-строка так
-- и осталась бы FATAL. Здесь:
--   1. повтор переписывает уровень последним (on conflict … severity);
--   2. уже записанные такие строки из браузера переводятся в WARN.
-- Текст функции берётся из базы и меняется точечно, как в 20261013210000.
-- ═══════════════════════════════════════════════════════════════════

do $$
declare
  v_sig constant text := 'public.record_incident(text, public.incident_severity, text, text, text, text, text)';
  v_def text := replace(pg_get_functiondef(v_sig::regprocedure), E'\r\n', E'\n');
  v_mark constant text := 'set seen_count = public.incidents.seen_count + 1,';
begin
  if position('severity = excluded.severity' in v_def) > 0 then
    return;
  end if;
  if (length(v_def) - length(replace(v_def, v_mark, ''))) / length(v_mark) <> 1 then
    raise exception 'record_incident: место правки не найдено или встретилось не один раз';
  end if;

  execute replace(v_def, v_mark, v_mark || E'\n        severity = excluded.severity,');
end;
$$;

update public.incidents
   set severity = 'WARN'
 where source = 'render'
   and severity = 'FATAL'
   and (kind = 'ChunkLoadError' or kind like '%Network');

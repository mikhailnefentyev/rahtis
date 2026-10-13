-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · забытая смена завершается на отметке 24 часа
--
-- База не допускает смену длиннее суток, а «завершить» ставило концом
-- текущую минуту. Водитель, забывший закрыть смену, через сутки не мог
-- ни завершить её (ограничение длины), ни начать новую («смена уже
-- идёт»), а перевозчик смены из приложения не правит (прогон 13.10.2026).
--
-- Решение пользователя 13.10.2026: завершение смены, открытой дольше
-- суток, закрывает её на отметке 24 часа и оставляет пометку для
-- перевозчика — он удалит её и внесёт верную вручную. Перерывы за
-- пределами этих суток убираются, незакрытый — обрезается по ним.
-- Текст функции берётся из базы и меняется точечно.
-- ═══════════════════════════════════════════════════════════════════

do $$
declare
  v_sig constant text := 'public.driver_shift_action(text, double precision, double precision, timestamp with time zone, uuid)';
  v_def text := replace(pg_get_functiondef(v_sig::regprocedure), E'\r\n', E'\n');
  v_mark constant text := E'  elsif p_action = ''END'' then\n';
  v_new text;
begin
  if (length(v_def) - length(replace(v_def, v_mark, ''))) / length(v_mark) <> 1 then
    raise exception 'driver_shift_action: место правки не найдено или встретилось не один раз';
  end if;

  v_new := replace(
    v_def,
    v_mark,
    v_mark || $r$    /* Забытая смена: закрывается на отметке 24 часа, иначе её не завершить вовсе. */
    if v_at > v_shift.started_at + interval '24 hours' then
      delete from public.driver_breaks
      where shift_id = v_shift.id and started_at >= v_shift.started_at + interval '24 hours';

      update public.driver_breaks
      set ended_at = v_shift.started_at + interval '24 hours'
      where shift_id = v_shift.id
        and (ended_at is null or ended_at > v_shift.started_at + interval '24 hours');

      update public.driver_shifts
      set ended_at = started_at + interval '24 hours',
          note = left(coalesce(note || ' · ', '') || 'Suljettu automaattisesti 24 h kohdalle — tarkista aika.', 500)
      where id = v_shift.id;
      return;
    end if;

$r$
  );

  execute v_new;
end;
$$;

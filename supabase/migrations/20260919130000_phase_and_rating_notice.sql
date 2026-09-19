-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · фаза у фото из кабинета и уведомление об оценке
--
-- Две дыры, найденные полным прогоном платформы на боевом.
--
-- Первая. Миграция claims проставила фазу (взятие / сдача) документам,
-- лежавшим в базе, и научила ей приложение водителя. Но перевозчик,
-- загружающий фото выгрузки в кабинете, фазу не передаёт — и его снимок
-- попадал в claim не в колонку «после», а в «прочие документы». Фаза
-- выводится из рода документа и роли точки; делать это должен не каждый
-- путь записи, а сама таблица.
--
-- Вторая. ТЗ §10: оценка «уведомляет перевозчика». Оценка писалась,
-- средний рейтинг считался, а перевозчик о ней узнавал, только открыв
-- выполненные рейсы. Теперь — уведомление в кабинет.
-- ═══════════════════════════════════════════════════════════════════

create or replace function app.default_document_phase()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.phase is null and new.kind <> 'CMR' then
    new.phase := case
      when new.kind = 'LOADING_PHOTO' then 'PICKUP'::public.trip_phase
      when new.kind = 'UNLOADING_PHOTO' then 'DELIVERY'::public.trip_phase
      when new.kind = 'DAMAGE_PHOTO' then (
        select case when s.role in ('PICKUP', 'EXTRA_LOAD') then 'PICKUP'::public.trip_phase
                    else 'DELIVERY'::public.trip_phase end
        from public.order_stops s where s.id = new.stop_id
      )
    end;
  end if;
  return new;
end;
$$;

create trigger order_documents_default_phase
  before insert on public.order_documents
  for each row execute function app.default_document_phase();

/* То, что успело лечь без фазы после миграции claims. */
update public.order_documents d
set phase = case
  when d.kind = 'LOADING_PHOTO' then 'PICKUP'::public.trip_phase
  when d.kind = 'UNLOADING_PHOTO' then 'DELIVERY'::public.trip_phase
  when d.kind = 'DAMAGE_PHOTO' then (
    select case when s.role in ('PICKUP', 'EXTRA_LOAD') then 'PICKUP'::public.trip_phase
                else 'DELIVERY'::public.trip_phase end
    from public.order_stops s where s.id = d.stop_id
  )
end
where d.phase is null and d.kind <> 'CMR';


create or replace function app.on_rating()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ref text;
begin
  if tg_op = 'UPDATE' and new.score is not distinct from old.score then
    return new;
  end if;

  select ref into v_ref from public.orders where id = new.order_id;

  perform app.notify_event(
    new.carrier_company_id,
    'ORDER',
    'rating.received',
    jsonb_build_object('ref', v_ref, 'score', new.score),
    '/carrier/done'
  );

  return new;
end;
$$;

create trigger order_ratings_notify
  after insert or update of score on public.order_ratings
  for each row execute function app.on_rating();

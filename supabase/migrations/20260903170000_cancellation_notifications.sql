-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · снятый рейс перестаёт исчезать молча
--
-- Ревизия отмен нашла две дыры, обе в триггере уведомлений о смене
-- статуса. Он знает три перехода — выбрали перевозчика, заказ вернулся на
-- стол, рейс закрыт, — и все три появились раньше, чем заказ научился
-- сниматься и возвращаться из работы.
--
-- ПЕРВАЯ. Статуса CANCELLED в триггере нет вовсе. Заказчик снимает рейс,
-- который перевозчик уже везёт, — и у того рейс просто пропадает из
-- кабинета: my_assignments отдаёт только AWAIT_DRIVER и IN_PROGRESS.
-- Водитель едет к площадке, а работы больше нет, и узнать об этом неоткуда.
--
-- ВТОРАЯ. Возврат на стол уведомляет, только если заказ пришёл из
-- REQUESTED или AWAIT_DRIVER. Отказ перевозчика от нетронутого рейса ведёт
-- из IN_PROGRESS, и под это условие не попадает: заказ уходит обратно на
-- стол, а заказчик об этом не знает.
--
-- Обе чинятся в одном месте, потому что это одно упущение: переходы
-- дописывались по мере появления, и новые прошли мимо.
--
-- Причина снятия в уведомление не кладётся. Она лежит в журнале заказа
-- вместе с автором и временем, а уведомление — это сигнал «посмотри», а
-- не пересказ. Свободный текст в списке уведомлений к тому же нечем
-- ограничить по длине.
-- ═══════════════════════════════════════════════════════════════════

create or replace function app.on_order_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status is not distinct from old.status then
    return new;
  end if;

  /*
   * Выбрали перевозчика. Срок в подстановке, а не в тексте: пятнадцать
   * минут — настройка матчинга, и менять её в двух местах нельзя.
   */
  if new.status = 'AWAIT_DRIVER' and new.assigned_company_id is not null then
    perform app.notify_event(
      new.assigned_company_id,
      'ORDER',
      'offer.chosen',
      jsonb_build_object('ref', new.ref, 'minutes', 15),
      '/carrier/desk'
    );

  /*
   * Заказ вернулся на стол. Причина не различается намеренно: срок
   * вышел, водитель отказался или заказчик откатил — для обеих сторон
   * это один факт, заказ снова свободен.
   *
   * IN_PROGRESS добавлен к прежним двум статусам: отказ перевозчика от
   * нетронутого рейса ведёт именно оттуда, и без этого заказчик узнавал
   * бы о сорвавшемся рейсе, только заглянув в кабинет.
   *
   * Перевозчик берётся из OLD: в этой же строке назначение уже снято.
   */
  elsif new.status = 'OPEN' and old.status in ('REQUESTED', 'AWAIT_DRIVER', 'IN_PROGRESS') then
    perform app.notify_event(
      new.shipper_company_id,
      'ORDER',
      'order.released',
      jsonb_build_object('ref', new.ref),
      '/shipper/orders'
    );

    if old.assigned_company_id is not null then
      perform app.notify_event(
        old.assigned_company_id,
        'ORDER',
        'order.released',
        jsonb_build_object('ref', new.ref),
        '/carrier/desk'
      );
    end if;

  /*
   * Рейс снят.
   *
   * Уведомляются обе стороны, а кто именно снял — не различается: тот,
   * кто нажал, и так знает. Перевозчик берётся из NEW, а не из OLD:
   * withdraw_order назначение не стирает, оставляя его историей рейса,
   * и OLD здесь дал бы то же значение только по совпадению.
   */
  elsif new.status = 'CANCELLED' then
    perform app.notify_event(
      new.shipper_company_id,
      'ORDER',
      'order.cancelled',
      jsonb_build_object('ref', new.ref),
      '/shipper/orders'
    );

    if coalesce(new.assigned_company_id, old.assigned_company_id) is not null then
      perform app.notify_event(
        coalesce(new.assigned_company_id, old.assigned_company_id),
        'ORDER',
        'order.cancelled',
        jsonb_build_object('ref', new.ref),
        '/carrier/desk'
      );
    end if;

  /* Рейс закрыт: документы у заказчика. */
  elsif new.status = 'DONE' then
    perform app.notify_event(
      new.shipper_company_id,
      'ORDER',
      'order.closed',
      jsonb_build_object('ref', new.ref),
      '/shipper/done'
    );
  end if;

  return new;
end;
$$;

comment on function app.on_order_status() is
  'Уведомления о смене статуса заказа: выбор перевозчика, возврат на стол, снятие, закрытие.';

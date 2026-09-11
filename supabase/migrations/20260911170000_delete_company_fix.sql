-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · удаление компании наконец работает
--
-- delete_company не удаляла ничего и никогда. Она возвращает
-- пользователей компании запросом `select p.user_id from profiles p`, а
-- в profiles такой колонки нет: идентификатор там называется id и
-- совпадает с auth.users. Тело plpgsql проверяется при создании только
-- синтаксически, а план запроса строится при первом выполнении — поэтому
-- функция принялась без единой жалобы и падала у оператора на каждой
-- компании.
--
-- Оператор при этом видел не «колонки нет», а общий отказ: разбор ошибок
-- в админке знает код 55002 «у компании есть заказы» и показывает его
-- человеческим текстом, а на незнакомый код отвечает общей фразой. Ошибка
-- выглядела как правило продукта.
--
-- ВТОРАЯ, ЕЩЁ НЕ ПРОЯВИВШАЯСЯ. Комментарий функции обещает: «профили уйдут
-- каскадом вместе с компанией». Не уйдут: составной ключ
-- profiles_company_matches_role создан без ON DELETE, то есть NO ACTION.
-- Починив первую ошибку, мы получили бы вторую — компания с
-- пользователями по-прежнему не удалялась бы, но теперь уже по нарушению
-- внешнего ключа.
--
-- Ровно это уже находили у машин: миграция vehicles_cascade от 16 августа
-- переписывает такой же ключ с тем же диагнозом. Тогда поправили одну
-- таблицу из двух — вторая ждала своего часа месяц.
-- ═══════════════════════════════════════════════════════════════════


-- ── Профили уходят вместе с компанией ──────────────────────────────

alter table public.profiles
  drop constraint profiles_company_matches_role;

alter table public.profiles
  add constraint profiles_company_matches_role
    foreign key (company_id, role)
    references public.companies (id, kind)
    on delete cascade;

/*
 * У администратора company_id пуст, и правило MATCH SIMPLE такую пару не
 * проверяет вовсе — каскад его не касается. Это то же свойство, ради
 * которого ключ и сделан составным.
 */


-- ── Функция читает ту колонку, которая есть ────────────────────────

create or replace function public.delete_company(p_company_id uuid)
returns setof uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_company public.companies;
  v_orders integer;
begin
  if not (select app.is_admin()) then
    raise exception 'Удалять компании может только оператор.' using errcode = '42501';
  end if;

  select * into v_company from public.companies where id = p_company_id;

  if v_company.id is null then
    raise exception 'Компания не найдена.' using errcode = 'P0002';
  end if;

  /*
   * Заказы считаются с обеих сторон: компания могла быть и заказчиком, и
   * перевозчиком. Считаем все, а не только закрытые: идущий рейс тоже
   * нельзя обрывать удалением стороны.
   */
  select count(*) into v_orders
  from public.orders
  where shipper_company_id = p_company_id
     or assigned_company_id = p_company_id;

  if v_orders > 0 then
    raise exception
      'У компании % заказов, удалить нельзя. История заказов не стирается.', v_orders
      using errcode = '55002';
  end if;

  /*
   * Пользователи возвращаются наружу до удаления строк.
   *
   * Профили уходят каскадом вместе с компанией — теперь действительно
   * уходят, ключ переписан выше. Но учётные записи в auth.users каскадом
   * не удаляются: их снимает вызывающий код админским ключом. Без этого
   * остались бы аккаунты, которые могут войти, но не привязаны ни к чему.
   *
   * Колонка id, а не user_id: профиль и учётная запись делят один
   * идентификатор — профиля без пользователя не бывает.
   */
  return query
    select p.id from public.profiles p where p.company_id = p_company_id;

  delete from public.companies where id = p_company_id;
end;
$$;

comment on function public.delete_company(uuid) is
  'Удаляет компанию без заказов и возвращает id её пользователей для снятия учётных записей.';

revoke all on function public.delete_company(uuid) from public, anon;
grant execute on function public.delete_company(uuid) to authenticated, service_role;

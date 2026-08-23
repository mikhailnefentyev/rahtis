-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · удаление компании из разобранных заявок
--
-- В списке разобранных заявок копятся отклонённые и пробные компании.
-- Убирать их было нечем: статус менялся, строка оставалась навсегда.
--
-- Удаление настоящее, а не пометка. Пробная компания не должна висеть в
-- реестре и попадать оператору на глаза при каждом разборе очереди.
--
-- И одна жёсткая граница: компанию с заказами удалить нельзя. Внешние
-- ключи на companies стоят с on delete cascade, и удаление заказчика
-- унесло бы вместе с ним все его заказы — вместе с закрытыми, их
-- накладными и суммами, по которым выставлены счета. Такую историю
-- стирать нельзя даже оператору, поэтому проверка стоит в базе, а не в
-- диалоге подтверждения.
-- ═══════════════════════════════════════════════════════════════════

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
   * Профили уйдут каскадом вместе с компанией, но учётные записи в
   * auth.users каскадом не удаляются — их снимает вызывающий код через
   * админский ключ. Без этого остались бы аккаунты, которые могут войти,
   * но не привязаны ни к чему.
   */
  return query
    select p.user_id from public.profiles p where p.company_id = p_company_id;

  delete from public.companies where id = p_company_id;
end;
$$;

comment on function public.delete_company(uuid) is
  'Удаляет компанию без заказов и возвращает id её пользователей для снятия учётных записей.';

revoke all on function public.delete_company(uuid) from public, anon;
grant execute on function public.delete_company(uuid) to authenticated, service_role;

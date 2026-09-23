-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · перевозчик переключает формат сотрудничества сам
--
-- 23.09.2026 решение пользователя. До сих пор ветку ставил только
-- оператор; теперь перевозчик меняет её в своём кабинете.
--
-- Одно ограничение, и оно не про доверие, а про деньги. Сторона
-- договора у рейса выводится из ветки перевозчика и пересчитывается при
-- закрытии: рейс, начатый подрядчиком, закроется как рейс подписчика,
-- если ветку переключить посреди пути. Счёт заказчику от нас тогда не
-- уйдёт, а заказчик его ждёт — он видел нас своим сопоставником, когда
-- заказ подтверждал.
--
-- Поэтому переключение разрешено, только когда у перевозчика нет рейсов
-- в работе. Это понятное правило: доделай начатое, потом меняй условия.
-- Оператор по-прежнему может переключить когда угодно — он видит
-- картину целиком и отвечает за последствия.
-- ═══════════════════════════════════════════════════════════════════

create or replace function public.set_own_partnership(p_mode public.partnership_mode)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_company uuid := (select app.current_company_id());
  v_kind public.party_role;
  v_frozen timestamptz;
  v_busy integer;
begin
  if (select app.current_party_role()) is distinct from 'CARRIER' or v_company is null then
    raise exception 'Формат сотрудничества меняет перевозчик у своей компании.' using errcode = '42501';
  end if;

  select kind, frozen_at into v_kind, v_frozen
  from public.companies where id = v_company;

  if v_kind is distinct from 'CARRIER' then
    raise exception 'Формат есть только у перевозчика.' using errcode = '22023';
  end if;

  if v_frozen is not null then
    raise exception 'Компания заморожена: формат меняет оператор.' using errcode = '42501';
  end if;

  select count(*) into v_busy
  from public.orders o
  where o.assigned_company_id = v_company
    and o.status in ('AWAIT_DRIVER', 'IN_PROGRESS');

  if v_busy > 0 then
    raise exception 'Сначала доведите до конца рейсы в работе: их %.', v_busy
      using errcode = '55006';
  end if;

  update public.companies set partnership = p_mode where id = v_company;

  perform app.audit('company.partnership', v_company::text,
    jsonb_build_object('mode', p_mode, 'by', 'CARRIER'));
end;
$$;

comment on function public.set_own_partnership(public.partnership_mode) is
  'Смена ветки самим перевозчиком. Запрещена, пока есть рейсы в работе: у них сторона договора пересчитывается при закрытии.';

revoke all on function public.set_own_partnership(public.partnership_mode) from public, anon;
grant execute on function public.set_own_partnership(public.partnership_mode) to authenticated;

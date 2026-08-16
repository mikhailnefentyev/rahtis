-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · Этап 2 · решение модерации
--
-- Смена статуса компании закрыта колоночными грантами, поэтому оператор
-- не может сделать её обычным UPDATE. Раньше предполагалось выполнять её
-- под секретным ключом, но у этого пути два минуса: service_role обходит
-- RLS целиком, а auth.uid() под ним равен NULL — журнал остался бы без
-- автора решения.
--
-- Поэтому решение оформлено функцией SECURITY DEFINER. Она выполняется
-- с правами владельца (значит, может менять статус), но вызывается под
-- сессией оператора — и права проверяет сама, а auth.uid() отдаёт того,
-- кто действительно нажал кнопку.
-- ═══════════════════════════════════════════════════════════════════

create or replace function public.moderate_company(
  p_company_id uuid,
  p_decision public.company_status,
  p_note text default null
)
returns public.companies
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_company public.companies;
begin
  if not (select app.is_admin()) then
    raise exception 'Решение модерации может принимать только администратор.'
      using errcode = '42501';
  end if;

  if p_decision not in ('APPROVED', 'REJECTED') then
    raise exception 'Недопустимое решение: %. Ожидается APPROVED или REJECTED.', p_decision
      using errcode = '22023';
  end if;

  select * into v_company from public.companies where id = p_company_id for update;

  if v_company.id is null then
    raise exception 'Компания не найдена.' using errcode = 'P0002';
  end if;

  /*
   * Повторное решение по уже рассмотренной заявке — почти всегда двойной
   * клик или открытая в двух вкладках очередь. Молча перезаписывать статус
   * нельзя: одобренная компания могла успеть получить доступ.
   */
  if v_company.status <> 'PENDING' then
    raise exception 'Заявка уже рассмотрена, текущий статус: %.', v_company.status
      using errcode = '55000';
  end if;

  update public.companies
  set status = p_decision,
      approved_at = case when p_decision = 'APPROVED' then now() else approved_at end,
      rejected_at = case when p_decision = 'REJECTED' then now() else rejected_at end,
      rejection_reason = case when p_decision = 'REJECTED' then nullif(btrim(p_note), '') else null end
  where id = p_company_id
  returning * into v_company;

  /*
   * Строку в company_events пишет триггер на UPDATE статуса. Здесь она не
   * дублируется: журнал должен наполняться независимо от того, каким путём
   * пришло изменение.
   */

  return v_company;
end;
$$;

comment on function public.moderate_company(uuid, public.company_status, text) is
  'Одобряет или отклоняет заявку. Проверяет права администратора внутри себя.';

/*
 * Функция живёт в public, потому что вызывается через PostgREST (RPC).
 * Гостям она не нужна: очередь модерации доступна только вошедшему
 * администратору.
 */
revoke all on function public.moderate_company(uuid, public.company_status, text) from public, anon;
grant execute on function public.moderate_company(uuid, public.company_status, text)
  to authenticated, service_role;

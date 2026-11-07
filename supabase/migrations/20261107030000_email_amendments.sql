-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · поправка к рейсу из письма (7.11.2026)
--
-- Клиент (DFDS и др.) присылает изменения по тому же номеру заказа:
-- другое время, другой адрес, другая машина. Если номер заказа клиента
-- (shipper_ref) совпадает с идущим рейсом этой компании, письмо — не
-- новый черновик, а поправка: amends_order_id указывает рейс.
--
-- Сама поправка в базе ничего не меняет. Человек видит «сейчас → в
-- письме», отмечает, что принять, и правки идут обычными функциями
-- (amend_stop, change_trip_assignment) — с его именем, стороной и
-- причиной «из письма …» в журнале order_amendments. Потом черновик
-- закрывается close_order_email_draft(id, order_id) → USED.
-- ═══════════════════════════════════════════════════════════════════

alter table public.order_email_drafts
  add column amends_order_id uuid references public.orders (id) on delete set null;

comment on column public.order_email_drafts.amends_order_id is
  'Рейс, к которому письмо — поправка (тот же номер заказа клиента). NULL — новый заказ.';

create index order_email_drafts_amends on public.order_email_drafts (amends_order_id)
  where amends_order_id is not null;


-- ── «Это не изменение, а новый заказ» ─────────────────────────────

/*
 * Номер заказа совпал случайно (клиент повторяет номера, новый рейс по
 * той же заявке): письмо отвязывается от рейса и открывается как
 * обычный черновик. Своя компания, только неиспользованный черновик.
 */
create or replace function public.detach_order_email_draft(p_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_company uuid := (select app.current_company_id());
begin
  if v_company is null then
    raise exception 'Нет компании.' using errcode = '42501';
  end if;

  update public.order_email_drafts
  set amends_order_id = null,
      updated_at = now()
  where id = p_id
    and company_id = v_company
    and status = 'PARSED';
end;
$$;

revoke all on function public.detach_order_email_draft(uuid) from public, anon;
grant execute on function public.detach_order_email_draft(uuid) to authenticated;

-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · очередь расчётов оператора
--
-- Админка расчётов читала orders напрямую: billing, invoice_ref,
-- closed_at, commission_bps. Этих колонок у роли authenticated нет —
-- их закрыли колоночными грантами, чтобы заказчик не видел комиссию и
-- исполнителя (миграции carrier_anonymity, commission_frozen). Гранты
-- общие для всех вошедших, оператора в том числе, и запрос молча
-- возвращал ошибку, а страница — «выполненных рейсов нет». Отметить
-- счёт, оплату и выплату было нельзя.
--
-- Открыть колонки обратно нельзя: RLS режет строки, а не колонки, и
-- комиссия стала бы видна заказчику его же рейса. Поэтому — функция
-- только для оператора, как partner_totals.
-- ═══════════════════════════════════════════════════════════════════

create or replace function public.billing_queue(p_limit integer default 50)
returns table (
  id uuid,
  ref text,
  rate_cents integer,
  commission_bps integer,
  billing public.billing_status,
  invoice_ref text,
  closed_at timestamptz,
  shipper_name text,
  carrier_name text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not (select app.is_admin()) then
    raise exception 'Очередь расчётов видна только оператору.' using errcode = '42501';
  end if;

  return query
  select o.id, o.ref, o.rate_cents, app.order_bps(o), o.billing, o.invoice_ref, o.closed_at,
         sh.name, ca.name
  from public.orders o
  join public.companies sh on sh.id = o.shipper_company_id
  left join public.companies ca on ca.id = o.assigned_company_id
  where o.status = 'DONE'
  /* Незакрытые расчёты первыми: это работа, а не архив. */
  order by (o.billing <> 'SETTLED') desc, o.closed_at desc nulls last
  limit least(greatest(coalesce(p_limit, 50), 1), 500);
end;
$$;

revoke all on function public.billing_queue(integer) from public, anon;
grant execute on function public.billing_queue(integer) to authenticated, service_role;

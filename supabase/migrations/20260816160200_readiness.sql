-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · Этап 3 · готовность автопарка для интерфейса
--
-- Функции в схеме app наружу не выставлены: PostgREST отдаёт только public.
-- Это правильно для внутренних хелперов RLS, но интерфейсу нужно знать,
-- готова ли компания брать заказы, а считать это в TypeScript значило бы
-- держать одно правило в двух местах.
--
-- Поэтому здесь тонкие публичные обёртки: сама логика остаётся в app.
-- ═══════════════════════════════════════════════════════════════════

/*
 * Готовность компании одним запросом: документы, сроки, число допущенных
 * машин и итоговое право выйти на стол.
 */
create or replace function public.company_readiness(p_company_id uuid)
returns table (
  documents_ok boolean,
  has_license boolean,
  has_insurance boolean,
  license_valid_until date,
  insurance_valid_until date,
  approved_vehicles integer,
  can_take_orders boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not (
    (select app.is_admin())
    or p_company_id = (select app.current_company_id())
  ) then
    raise exception 'Нет доступа к этой компании.' using errcode = '42501';
  end if;

  return query
  select
    app.company_documents_ok(p_company_id),
    exists (
      select 1 from public.company_documents d
      where d.company_id = p_company_id and d.kind = 'CARRIER_LICENSE' and d.is_current
    ),
    exists (
      select 1 from public.company_documents d
      where d.company_id = p_company_id and d.kind = 'INSURANCE' and d.is_current
    ),
    (
      select d.valid_until from public.company_documents d
      where d.company_id = p_company_id and d.kind = 'CARRIER_LICENSE' and d.is_current
    ),
    (
      select d.valid_until from public.company_documents d
      where d.company_id = p_company_id and d.kind = 'INSURANCE' and d.is_current
    ),
    (
      select count(*)::integer from public.vehicles v
      where v.company_id = p_company_id and v.access = 'APPROVED'
    ),
    app.has_dispatchable_vehicle(p_company_id);
end;
$$;

comment on function public.company_readiness(uuid) is
  'Состояние документов и допуска компании. Доступно самой компании и оператору.';


/*
 * Очередь внимания оператора: документы, которые уже просрочены или
 * истекают в ближайшее время, у компаний с допущенными машинами.
 *
 * Именно эти компании создают риск: машины числятся допущенными, а
 * основание допуска перестаёт действовать. Выйти на стол они уже не
 * смогут — это закрывает app.company_documents_ok, — но оператор должен
 * узнать об этом заранее, а не от перевозчика, который не понял, почему
 * пропали заказы.
 */
create or replace function public.documents_needing_attention(p_within_days integer default 30)
returns table (
  company_id uuid,
  company_name text,
  kind public.document_kind,
  valid_until date,
  days_left integer,
  approved_vehicles integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not (select app.is_admin()) then
    raise exception 'Раздел доступен только администратору.' using errcode = '42501';
  end if;

  return query
  select
    c.id,
    c.name,
    d.kind,
    d.valid_until,
    (d.valid_until - current_date)::integer,
    (
      select count(*)::integer from public.vehicles v
      where v.company_id = c.id and v.access = 'APPROVED'
    )
  from public.company_documents d
  join public.companies c on c.id = d.company_id
  where d.is_current
    and d.valid_until is not null
    and d.valid_until <= current_date + p_within_days
    and exists (
      select 1 from public.vehicles v
      where v.company_id = c.id and v.access = 'APPROVED'
    )
  order by d.valid_until;
end;
$$;

comment on function public.documents_needing_attention(integer) is
  'Просроченные и скоро истекающие документы у компаний с допущенными машинами.';

revoke all on function public.company_readiness(uuid) from public, anon;
revoke all on function public.documents_needing_attention(integer) from public, anon;

grant execute on function public.company_readiness(uuid) to authenticated, service_role;
grant execute on function public.documents_needing_attention(integer) to authenticated, service_role;

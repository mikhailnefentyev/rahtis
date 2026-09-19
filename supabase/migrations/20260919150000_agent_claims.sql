-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · агент видит претензии
--
-- Агент на вопрос о CL-RS-2026-0059-1 честно ответил, что таких номеров
-- его инструменты не отдают: claims появились после набора инструментов,
-- и ни один из них в таблицу претензий не смотрел. У оператора был
-- свободный SQL, но в его описании claims не значились, и модель о них
-- не знала.
--
-- Инструмент один: по номеру претензии (CL-…) или по номеру заказа (RS-…)
-- — все претензии этого рейса. Права те же, что в кабинете:
--
--   оператор      — любая претензия, с перепиской;
--   подавший      — своя, с последним ответом оператора;
--   вторая сторона — суть, статус и решение, без переписки подавшего с
--                    оператором (миграция claims_mirror: с ней говорят
--                    почтой);
--   водитель      — ничего: претензии — дело компаний, а не кабины.
--
-- Имя перевозчика заказчику не отдаётся, как и в кабинете.
-- ═══════════════════════════════════════════════════════════════════

create or replace function public.agent_claim(p_conversation_id uuid, p_token uuid, p_ref text)
returns table (
  ref text,
  order_ref text,
  kind public.claim_kind,
  status public.claim_status,
  filed_by text,
  filed_by_you boolean,
  amount_eur numeric,
  description text,
  resolution text,
  created_at timestamptz,
  resolved_at timestamptz,
  forwarded_to_counterparty_at timestamptz,
  shipper_name text,
  carrier_name text,
  messages_count integer,
  last_operator_message text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_ctx public.conversations;
  v_ref text := upper(btrim(coalesce(p_ref, '')));
  v_admin boolean;
begin
  v_ctx := app.agent_context(p_conversation_id, p_token);

  if v_ctx.audience = 'DRIVER' then
    raise exception 'Претензии водителю не показываются.' using errcode = '42501';
  end if;

  v_admin := v_ctx.audience = 'ADMIN';

  return query
  select
    c.ref,
    o.ref,
    c.kind,
    c.status,
    c.filed_by_role::text,
    (c.filed_by_company_id = v_ctx.company_id),
    round(c.amount_cents / 100.0, 2),
    c.description,
    c.resolution,
    c.created_at,
    c.resolved_at,
    c.mirrored_at,
    case when v_admin or v_ctx.audience = 'CARRIER' then sh.name end,
    case when v_admin then ca.name end,
    /* Переписка — оператору и подавшему; второй стороне её не видно. */
    case when v_admin or c.filed_by_company_id = v_ctx.company_id then
      (select count(*)::integer from public.claim_events e
        where e.claim_id = c.id and e.kind in ('COMMENT', 'ATTACHMENT'))
    end,
    case when v_admin or c.filed_by_company_id = v_ctx.company_id then
      (select e.body from public.claim_events e
        where e.claim_id = c.id and e.author_role = 'ADMIN' and e.body is not null
        order by e.created_at desc, e.id desc limit 1)
    end
  from public.claims c
  join public.orders o on o.id = c.order_id
  join public.companies sh on sh.id = o.shipper_company_id
  left join public.companies ca on ca.id = o.assigned_company_id
  where (upper(c.ref) = v_ref or upper(o.ref) = v_ref)
    and (v_admin or v_ctx.company_id in (c.filed_by_company_id, c.against_company_id))
  order by c.created_at;
end;
$$;

comment on function public.agent_claim(uuid, uuid, text) is
  'Претензии по номеру CL-… или по номеру рейса RS-… в правах треда агента. Водителю — отказ.';

revoke all on function public.agent_claim(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.agent_claim(uuid, uuid, text) to agent, service_role;
